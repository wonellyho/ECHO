import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface InsightItem {
  summary: string;
  evidence_entry_ids: string[];
}

const MIN_ENTRIES_FOR_INSIGHTS = 3;

export function InsightsPage() {
  const [energizers, setEnergizers] = useState<InsightItem[]>([]);
  const [drainers, setDrainers] = useState<InsightItem[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
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
      setEnergizers(result.energizers ?? []);
      setDrainers(result.drainers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="insights-page">
      <h2>나의 에너지 패턴</h2>

      {entryCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p>기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 쌓이면 패턴을 분석해드려요. (현재 {entryCount}개)</p>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p>분석 중...</p>}

      {energizers.length > 0 && (
        <section>
          <h3>⚡ 에너지를 얻는 조건</h3>
          <ul>
            {energizers.map((item, i) => (
              <li key={i}>
                <p>{item.summary}</p>
                <p className="evidence">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drainers.length > 0 && (
        <section>
          <h3>🔋 소진되는 조건</h3>
          <ul>
            {drainers.map((item, i) => (
              <li key={i}>
                <p>{item.summary}</p>
                <p className="evidence">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={generate} disabled={loading}>
        다시 분석하기
      </button>
    </div>
  );
}
