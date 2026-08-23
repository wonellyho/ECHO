import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { ExperienceTag } from '../types';
import { TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';

const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  tags: ExperienceTag[];
}

export function EntriesPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ExperienceTag | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: entryRows } = await supabase
        .from('entries')
        .select('id, raw_text, created_at')
        .order('created_at', { ascending: false });

      const { data: tagRows } = await supabase.from('entry_tags').select('entry_id, tag');

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      setEntries(
        (entryRows ?? []).map((e) => ({
          ...e,
          tags: tagsByEntry.get(e.id) ?? [],
        })),
      );
      setLoading(false);
    })();
  }, []);

  // MVP 검색: 태그 필터 + 키워드 매칭. 추후 임베딩 기반 유사도 검색으로 고도화 예정 (CLAUDE.md 참고)
  const filtered = entries.filter((e) => {
    const matchesTag = !activeTag || e.tags.includes(activeTag);
    const matchesQuery = !query.trim() || e.raw_text.includes(query.trim());
    return matchesTag && matchesQuery;
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-slate-900">내 경험 기록</h2>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">불러오는 중...</p>}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-slate-500">기록이 없습니다.</p>
      )}

      <ul className="flex flex-col gap-3">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Link
              to={`/entries/${entry.id}`}
              className="block rounded-xl border border-slate-200 p-4 shadow-sm transition hover:border-violet-300"
            >
              <p className="text-xs text-slate-400">
                {new Date(entry.created_at).toLocaleDateString('ko-KR')}
              </p>
              <p className="mt-1 text-sm text-slate-800">{entry.raw_text.slice(0, 60)}</p>
              {entry.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.tags.map((t) => (
                    <span
                      key={t}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[t]}`}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
