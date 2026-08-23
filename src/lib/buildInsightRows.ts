export interface InsightItem {
  summary: string;
  evidence_entry_ids: string[];
}

export interface InsightApiResult {
  energizers: InsightItem[];
  drainers: InsightItem[];
}

export interface InsightInsertRow {
  user_id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

// LLM 인사이트 응답 → DB insert row 변환. energizers/drainers가 배열이 아니면(응답 누락)
// 빈 배열로 처리하고, summary가 없는 항목과 실제로 존재하지 않는 entry_id(근거 없음/환각)는
// 걸러낸다 — 근거 기록이 실재하지 않는 인사이트가 저장되지 않도록 하는 근거성(§7) 방어선.
export function buildInsightRows(
  result: InsightApiResult,
  userId: string,
  validEntryIds: Set<string>,
): InsightInsertRow[] {
  function toRows(items: InsightItem[] | undefined, type: 'energizer' | 'drainer'): InsightInsertRow[] {
    if (!Array.isArray(items)) return [];
    return items
      .filter((item) => typeof item.summary === 'string' && item.summary.trim().length > 0)
      .map((item) => ({
        user_id: userId,
        type,
        summary: item.summary,
        evidence_entry_ids: (item.evidence_entry_ids ?? []).filter((id) => validEntryIds.has(id)),
      }))
      .filter((row) => row.evidence_entry_ids.length > 0);
  }

  return [...toRows(result.energizers, 'energizer'), ...toRows(result.drainers, 'drainer')];
}
