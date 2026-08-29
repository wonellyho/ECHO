import { describe, expect, test } from 'vitest';
import { groupEntries } from './entryGrouping';

interface Row {
  id: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
}

const collections = [
  { id: 'c1', name: '취준 소재' },
  { id: 'c2', name: '3학년 1학기' },
];

// EntriesPage 쿼리와 동일하게 이미 created_at 내림차순으로 정렬된 상태를 가정한다.
const entries: Row[] = [
  { id: '1', created_at: '2026-08-20T00:00:00Z', project_title: 'ECHO', collection_id: 'c1' },
  { id: '2', created_at: '2026-08-10T00:00:00Z', project_title: 'ECHO', collection_id: null },
  { id: '3', created_at: '2026-07-15T00:00:00Z', project_title: null, collection_id: 'c2' },
  { id: '4', created_at: '2026-07-01T00:00:00Z', project_title: null, collection_id: null },
];

describe('groupEntries', () => {
  test('groups by month, newest month first', () => {
    const groups = groupEntries(entries, 'month', collections);
    expect(groups.map((g) => g.label)).toEqual(['2026년 8월', '2026년 7월']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['1', '2']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['3', '4']);
  });

  test('groups by project, unassigned goes to 미분류 and stays last', () => {
    const groups = groupEntries(entries, 'project', collections);
    expect(groups.map((g) => g.label)).toEqual(['ECHO', '미분류']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['1', '2']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['3', '4']);
  });

  test('groups by collection using name lookup, unassigned falls to 미분류', () => {
    const groups = groupEntries(entries, 'collection', collections);
    expect(groups.map((g) => g.label)).toEqual(['취준 소재', '3학년 1학기', '미분류']);
  });

  test('미분류 stays last even if its most recent entry is newest', () => {
    const withRecentUnassigned: Row[] = [
      { id: 'a', created_at: '2026-08-25T00:00:00Z', project_title: null, collection_id: null },
      { id: 'b', created_at: '2026-08-01T00:00:00Z', project_title: 'ECHO', collection_id: null },
    ];
    const groups = groupEntries(withRecentUnassigned, 'project', collections);
    expect(groups.map((g) => g.label)).toEqual(['ECHO', '미분류']);
  });
});
