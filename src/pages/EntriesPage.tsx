import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
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
  const filtered = entries.filter((e) => {
    const matchesTag = !activeTag || e.tags.includes(activeTag);
    const matchesQuery = !query.trim() || e.raw_text.includes(query.trim());
    return matchesTag && matchesQuery;
  });

  return (
    <div className="entries-page">
      <h2>내 경험 기록</h2>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="tag-filters">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={activeTag === tag ? 'tag active' : 'tag'}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
          >
            #{tag}
          </button>
        ))}
      </div>

      {loading && <p>불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p>기록이 없습니다.</p>}

      <ul className="entry-list">
        {filtered.map((entry) => (
          <li key={entry.id}>
            <Link to={`/entries/${entry.id}`}>
              <p>{entry.raw_text.slice(0, 60)}</p>
              <div className="tags">
                {entry.tags.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
