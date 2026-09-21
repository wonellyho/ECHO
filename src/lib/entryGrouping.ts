export interface GroupableEntry {
  id: string;
  created_at: string;
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

export const UNASSIGNED_KEY = 'unassigned';
const UNASSIGNED_LABEL = '미분류';

// entries는 이미 created_at 내림차순으로 정렬돼 들어온다고 가정한다(EntriesPage 쿼리와 동일한 정렬).
// 그룹 내부 순서는 재정렬하지 않고 입력 순서를 그대로 유지한다. 그룹 자체는 각 그룹의 최신 기록
// 기준으로 정렬하되, 미분류는 항상 맨 뒤로 보낸다.
//
// 2026-09-02: 예전엔 project(자유 텍스트 제목)/month/collection 세 기준으로 나눌 수 있었다.
// project_title과 collection_id가 실질적으로 같은 "묶음" 개념으로 쓰이고 있어(저장 시점에 하나만
// 고르는 방식이었고, 실제로 사용자가 둘을 구분해 쓰지 않았음) 컬렉션 하나로 통일했다. month는
// 최신순과 정렬 순서가 완전히 같고 그룹 헤더만 다른 채였어서(재정렬 없음) 별도로 유지할 실익이
// 없어 함께 제거했다. 자세한 내용은 design.md 참고.
export function groupEntries<T extends GroupableEntry>(
  entries: T[],
  collections: CollectionLookup[],
): EntryGroup<T>[] {
  const nameById = new Map(collections.map((c) => [c.id, c.name]));
  const buckets = new Map<string, EntryGroup<T>>();

  for (const entry of entries) {
    // name이 아니라 컬렉션 존재 여부로 분기한다 — 이름이 빈 문자열인 컬렉션(생성 경로에서
    // 막혀 있어 지금은 안 나오지만)도 미분류와 섞이지 않아야 한다.
    const found = entry.collection_id !== null && nameById.has(entry.collection_id);
    const key = found ? `collection:${entry.collection_id}` : UNASSIGNED_KEY;
    const label = found ? nameById.get(entry.collection_id as string)! : UNASSIGNED_LABEL;

    const existing = buckets.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      buckets.set(key, { key, label, entries: [entry] });
    }
  }

  const groups = Array.from(buckets.values());

  return groups.sort((a, b) => {
    if (a.key === UNASSIGNED_KEY) return 1;
    if (b.key === UNASSIGNED_KEY) return -1;
    const aMostRecent = a.entries[0]?.created_at ?? '';
    const bMostRecent = b.entries[0]?.created_at ?? '';
    return aMostRecent < bMostRecent ? 1 : -1;
  });
}
