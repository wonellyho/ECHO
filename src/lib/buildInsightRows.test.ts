import { describe, expect, test } from 'vitest';
import { buildInsightRows } from './buildInsightRows';

describe('buildInsightRows', () => {
  test('maps energizers and drainers into typed insert rows with user_id', () => {
    const result = {
      energizers: [{ summary: '팀원과 함께 문제를 풀 때 에너지를 얻음', evidence_entry_ids: ['e1', 'e2'] }],
      drainers: [{ summary: '역할이 불명확할 때 소진됨', evidence_entry_ids: ['e3'] }],
    };
    const validEntryIds = new Set(['e1', 'e2', 'e3']);

    const rows = buildInsightRows(result, 'user-123', validEntryIds);

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
    const rows = buildInsightRows({ energizers: [], drainers: [] }, 'user-123', new Set());
    expect(rows).toEqual([]);
  });

  test('drops items with a blank or missing summary', () => {
    const result = {
      energizers: [
        { evidence_entry_ids: ['e1'] },
        { summary: '   ', evidence_entry_ids: ['e1'] },
        { summary: '유효한 요약', evidence_entry_ids: ['e1'] },
      ],
      drainers: [],
    } as any;

    const rows = buildInsightRows(result, 'user-123', new Set(['e1']));

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'energizer',
        summary: '유효한 요약',
        evidence_entry_ids: ['e1'],
      },
    ]);
  });

  test('filters out evidence ids that are not in the valid entry id set', () => {
    const result = {
      energizers: [{ summary: '요약', evidence_entry_ids: ['real-1', 'fake-1', 'real-2'] }],
      drainers: [],
    };

    const rows = buildInsightRows(result, 'user-123', new Set(['real-1', 'real-2']));

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'energizer',
        summary: '요약',
        evidence_entry_ids: ['real-1', 'real-2'],
      },
    ]);
  });

  test('drops an item left with zero evidence ids after filtering', () => {
    const result = {
      energizers: [
        { summary: '전부 가짜 근거', evidence_entry_ids: ['fake-1', 'fake-2'] },
        { summary: '근거 없음', evidence_entry_ids: [] },
      ],
      drainers: [{ summary: '실제 근거 있음', evidence_entry_ids: ['real-1'] }],
    };

    const rows = buildInsightRows(result, 'user-123', new Set(['real-1']));

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'drainer',
        summary: '실제 근거 있음',
        evidence_entry_ids: ['real-1'],
      },
    ]);
  });

  test('treats missing energizers/drainers keys as empty arrays instead of throwing', () => {
    const rows = buildInsightRows({ energizers: [{ summary: '요약', evidence_entry_ids: ['e1'] }] } as any, 'user-123', new Set(['e1']));

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'energizer',
        summary: '요약',
        evidence_entry_ids: ['e1'],
      },
    ]);
  });

  test('does not throw when both energizers and drainers keys are missing', () => {
    const rows = buildInsightRows({} as any, 'user-123', new Set());
    expect(rows).toEqual([]);
  });
});
