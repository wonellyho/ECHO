import { describe, expect, test } from 'vitest';
import { filterEntries } from './entryFilter';
import type { ExperienceTag } from '../types';

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  tags: ExperienceTag[];
}

const entries: EntryRow[] = [
  { id: '1', raw_text: '팀 발표에서 갈등이 있었다', created_at: '', tags: ['갈등'] },
  { id: '2', raw_text: '혼자 문제를 해결했다', created_at: '', tags: ['문제해결'] },
  { id: '3', raw_text: '팀원과 협업해서 갈등을 풀었다', created_at: '', tags: ['협업', '갈등'] },
];

describe('filterEntries', () => {
  test('returns all entries when no tag or query is set', () => {
    expect(filterEntries(entries, null, '')).toEqual(entries);
  });

  test('filters by active tag only', () => {
    const result = filterEntries(entries, '협업', '');
    expect(result.map((e) => e.id)).toEqual(['3']);
  });

  test('filters by keyword only', () => {
    const result = filterEntries(entries, null, '갈등');
    expect(result.map((e) => e.id)).toEqual(['1', '3']);
  });

  test('filters by both tag and keyword (AND, not OR)', () => {
    const result = filterEntries(entries, '갈등', '협업');
    expect(result.map((e) => e.id)).toEqual(['3']);
  });
});
