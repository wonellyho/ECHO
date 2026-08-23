import type { ExperienceTag } from '../types';

interface FilterableEntry {
  raw_text: string;
  tags: ExperienceTag[];
}

// 목록 화면의 태그 필터 + 키워드 검색 로직. 둘 다 지정되면 AND로 결합한다.
export function filterEntries<T extends FilterableEntry>(
  entries: T[],
  activeTag: ExperienceTag | null,
  query: string,
): T[] {
  const trimmedQuery = query.trim();
  return entries.filter((entry) => {
    const matchesTag = !activeTag || entry.tags.includes(activeTag);
    const matchesQuery = !trimmedQuery || entry.raw_text.includes(trimmedQuery);
    return matchesTag && matchesQuery;
  });
}
