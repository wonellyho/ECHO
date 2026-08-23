import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import type { ExperienceTag } from '../types';

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
  const filtered = filterEntries(entries, activeTag, query);

  return (
    <div>
      <h2>내 경험 기록</h2>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            #{tag}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p>기록이 없습니다.</p>}

      <ul>
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Link to={`/entries/${entry.id}`}>
              <p>{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
              <p>{entry.raw_text.slice(0, 60)}</p>
              {entry.tags.length > 0 && (
                <div>
                  {entry.tags.map((t) => (
                    <span key={t}>#{t}</span>
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
