export type GroupBy = 'project' | 'month' | 'collection';

export interface GroupableEntry {
  id: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
}

export interface CollectionLookup {
  id: string;
  name: string;
}

export interface EntryGroup<T> {
  key: string;
  label: string;
  entries: T[];
}

const UNASSIGNED_KEY = 'unassigned';
const UNASSIGNED_LABEL = '미분류';

function monthKeyAndLabel(isoDate: string): { key: string; label: string } {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return { key: `${year}-${String(month).padStart(2, '0')}`, label: `${year}년 ${month}월` };
}

// entries는 이미 created_at 내림차순으로 정렬돼 들어온다고 가정한다(EntriesPage 쿼리와 동일한 정렬).
// 그룹 내부 순서는 재정렬하지 않고 입력 순서를 그대로 유지한다.
export function groupEntries<T extends GroupableEntry>(
  entries: T[],
  groupBy: GroupBy,
  collections: CollectionLookup[],
): EntryGroup<T>[] {
  const buckets = new Map<string, EntryGroup<T>>();

  for (const entry of entries) {
    let key: string;
    let label: string;

    if (groupBy === 'month') {
      const m = monthKeyAndLabel(entry.created_at);
      key = m.key;
      label = m.label;
    } else if (groupBy === 'project') {
      const title = entry.project_title?.trim();
      key = title ? `project:${title}` : UNASSIGNED_KEY;
      label = title || UNASSIGNED_LABEL;
    } else {
      const found = entry.collection_id ? collections.find((c) => c.id === entry.collection_id) : undefined;
      key = found ? `collection:${found.id}` : UNASSIGNED_KEY;
      label = found ? found.name : UNASSIGNED_LABEL;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      buckets.set(key, { key, label, entries: [entry] });
    }
  }

  const groups = Array.from(buckets.values());

  if (groupBy === 'month') {
    return groups.sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  return groups.sort((a, b) => {
    if (a.key === UNASSIGNED_KEY) return 1;
    if (b.key === UNASSIGNED_KEY) return -1;
    const aMostRecent = a.entries[0]?.created_at ?? '';
    const bMostRecent = b.entries[0]?.created_at ?? '';
    return aMostRecent < bMostRecent ? 1 : -1;
  });
}
