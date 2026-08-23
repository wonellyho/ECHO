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

export function buildInsightRows(result: InsightApiResult, userId: string): InsightInsertRow[] {
  const energizerRows: InsightInsertRow[] = result.energizers.map((item) => ({
    user_id: userId,
    type: 'energizer',
    summary: item.summary,
    evidence_entry_ids: item.evidence_entry_ids,
  }));
  const drainerRows: InsightInsertRow[] = result.drainers.map((item) => ({
    user_id: userId,
    type: 'drainer',
    summary: item.summary,
    evidence_entry_ids: item.evidence_entry_ids,
  }));
  return [...energizerRows, ...drainerRows];
}
