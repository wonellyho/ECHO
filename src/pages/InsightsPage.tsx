import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildInsightRows } from '../lib/buildInsightRows';

interface InsightRow {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

const MIN_ENTRIES_FOR_INSIGHTS = 3;

export function InsightsPage() {
  const [energizers, setEnergizers] = useState<InsightRow[]>([]);
  const [drainers, setDrainers] = useState<InsightRow[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStoredInsights() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: structuredRows, error: structuredError }, { data: insightRows, error: insightError }] = await Promise.all([
        supabase.from('entries_structured').select('entry_id').eq('status', 'done'),
        supabase
          .from('insights')
          .select('id, type, summary, evidence_entry_ids')
          .order('created_at', { ascending: false }),
      ]);
      if (structuredError) throw structuredError;
      if (insightError) throw insightError;

      setEntryCount(structuredRows?.length ?? 0);
      const rows = (insightRows ?? []) as InsightRow[];
      setEnergizers(rows.filter((r) => r.type === 'energizer'));
      setDrainers(rows.filter((r) => r.type === 'drainer'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: structuredRows, error: fetchError } = await supabase
        .from('entries_structured')
        .select('entry_id, situation, role, action, result, emotion, emotion_reason')
        .eq('status', 'done');
      if (fetchError) throw fetchError;

      setEntryCount(structuredRows?.length ?? 0);
      if (!structuredRows || structuredRows.length < MIN_ENTRIES_FOR_INSIGHTS) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: structuredRows }),
      });
      if (!res.ok) throw new Error('인사이트 생성에 실패했습니다.');
      const result = await res.json();

      const { error: deleteError } = await supabase.from('insights').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const rowsToInsert = buildInsightRows(result, user.id);
      const { data: insertedRows, error: insertError } = await supabase
        .from('insights')
        .insert(rowsToInsert)
        .select('id, type, summary, evidence_entry_ids');
      if (insertError) throw insertError;

      const rows = (insertedRows ?? []) as InsightRow[];
      setEnergizers(rows.filter((r) => r.type === 'energizer'));
      setDrainers(rows.filter((r) => r.type === 'drainer'));
    } catch (err) {
      setEnergizers([]);
      setDrainers([]);
      setError(err instanceof Error ? err.message : '인사이트 재생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStoredInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">나의 에너지 패턴</h2>

      {entryCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p className="mt-2 text-sm text-slate-500">
          기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 쌓이면 패턴을 분석해드려요. (현재 {entryCount}개)
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-2 text-sm text-slate-500">분석 중...</p>}

      {energizers.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">⚡ 에너지를 얻는 조건</h3>
          <ul className="mt-2 space-y-2">
            {energizers.map((item) => (
              <li key={item.id} className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drainers.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">🔋 소진되는 조건</h3>
          <ul className="mt-2 space-y-2">
            {drainers.map((item) => (
              <li key={item.id} className="rounded-lg border-l-4 border-slate-400 bg-slate-50 p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={regenerate}
        disabled={loading}
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        다시 분석하기
      </button>
    </div>
  );
}
