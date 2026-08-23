import { describe, expect, test } from 'vitest';
import { buildInsightRows } from './buildInsightRows';

describe('buildInsightRows', () => {
  test('maps energizers and drainers into typed insert rows with user_id', () => {
    const result = {
      energizers: [{ summary: '팀원과 함께 문제를 풀 때 에너지를 얻음', evidence_entry_ids: ['e1', 'e2'] }],
      drainers: [{ summary: '역할이 불명확할 때 소진됨', evidence_entry_ids: ['e3'] }],
    };

    const rows = buildInsightRows(result, 'user-123');

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'energizer',
        summary: '팀원과 함께 문제를 풀 때 에너지를 얻음',
        evidence_entry_ids: ['e1', 'e2'],
      },
      {
        user_id: 'user-123',
        type: 'drainer',
        summary: '역할이 불명확할 때 소진됨',
        evidence_entry_ids: ['e3'],
      },
    ]);
  });

  test('returns empty array when there are no energizers or drainers', () => {
    const rows = buildInsightRows({ energizers: [], drainers: [] }, 'user-123');
    expect(rows).toEqual([]);
  });
});
