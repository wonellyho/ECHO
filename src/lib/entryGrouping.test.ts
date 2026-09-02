import { describe, expect, test } from 'vitest';
import { groupEntries } from './entryGrouping';

interface Row {
  id: string;
  created_at: string;
  collection_id: string | null;
}

const collections = [
  { id: 'c1', name: '취준 소재' },
  { id: 'c2', name: '3학년 1학기' },
];

// EntriesPage 쿼리와 동일하게 이미 created_at 내림차순으로 정렬된 상태를 가정한다.
const entries: Row[] = [
  { id: '1', created_at: '2026-08-20T00:00:00Z', collection_id: 'c1' },
  { id: '2', created_at: '2026-08-10T00:00:00Z', collection_id: null },
  { id: '3', created_at: '2026-07-15T00:00:00Z', collection_id: 'c2' },
  { id: '4', created_at: '2026-07-01T00:00:00Z', collection_id: null },
];

describe('groupEntries', () => {
  test('groups by collection using name lookup, most-recent-first, unassigned falls to 미분류', () => {
    const groups = groupEntries(entries, collections);
    expect(groups.map((g) => g.label)).toEqual(['취준 소재', '3학년 1학기', '미분류']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['1']);
    expect(groups[2].entries.map((e) => e.id)).toEqual(['2', '4']);
  });

  test('미분류 stays last even if its most recent entry is newest', () => {
    const withRecentUnassigned: Row[] = [
      { id: 'a', created_at: '2026-08-25T00:00:00Z', collection_id: null },
      { id: 'b', created_at: '2026-08-01T00:00:00Z', collection_id: 'c1' },
    ];
    const groups = groupEntries(withRecentUnassigned, collections);
    expect(groups.map((g) => g.label)).toEqual(['취준 소재', '미분류']);
  });

  test('empty input returns no groups', () => {
    expect(groupEntries([], collections)).toEqual([]);
  });
});
