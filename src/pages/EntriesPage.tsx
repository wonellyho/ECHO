import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, type GroupBy } from '../lib/entryGrouping';
import { TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'month', label: '월별' },
  { value: 'project', label: '프로젝트별' },
  { value: 'collection', label: '컬렉션별' },
];

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

interface CollectionOption {
  id: string;
  name: string;
}

export function EntriesPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ExperienceTag | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: entryRows }, { data: tagRows }, { data: structuredRows }, { data: collectionRows }] =
        await Promise.all([
          supabase
            .from('entries')
            .select('id, raw_text, created_at, project_title, collection_id')
            .order('created_at', { ascending: false }),
          supabase.from('entry_tags').select('entry_id, tag'),
          supabase.from('entries_structured').select('entry_id, situation'),
          supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
        ]);

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      const situationByEntry = new Map<string, string | null>();
      (structuredRows ?? []).forEach((row) => {
        situationByEntry.set(row.entry_id, row.situation);
      });

      setEntries(
        (entryRows ?? []).map((e) => ({
          ...e,
          situation: situationByEntry.get(e.id) ?? null,
          tags: tagsByEntry.get(e.id) ?? [],
        })),
      );
      setCollections((collectionRows ?? []) as CollectionOption[]);
      setLoading(false);
    })();
  }, []);

  // MVP 검색: 태그 필터 + 키워드 매칭. 추후 임베딩 기반 유사도 검색으로 고도화 예정 (CLAUDE.md 참고)
  const filtered = filterEntries(entries, activeTag, query);
  const groups = groupEntries(filtered, groupBy, collections);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">내 경험 기록</h2>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        {GROUP_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={groupBy === opt.value}
            onClick={() => setGroupBy(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              groupBy === opt.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">기록이 없습니다.</p>}

      {groups.map((group) => (
        <section key={group.key} className="mt-5">
          <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.entries.map((entry) => (
              <Link
                key={entry.id}
                to={`/entries/${entry.id}`}
                className="flex h-36 flex-col justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">{entry.project_title || '제목 없음'}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-800">{entry.situation ?? entry.raw_text}</p>
                </div>
                <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
