import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { buildInsightRows } from '../lib/buildInsightRows';
import { useNickname, withNickname } from '../lib/useNickname';
import { buildGraph, type GraphInputEntry, type GraphInputInsight } from '../lib/constellation/buildGraph';
import { CLUSTER_LABELS, type ClusterId } from '../lib/constellation/layout';
import { ConstellationCanvas, type ClusterLabel } from '../components/constellation/ConstellationCanvas';
import { StarDetailCard, type StarDetail } from '../components/constellation/StarDetailCard';
import { ClusterSummaryCard } from '../components/constellation/ClusterSummaryCard';
import type { ExperienceTag } from '../types';

const MIN_ENTRIES_FOR_INSIGHTS = 3;

export function InsightsPage() {
  const [entries, setEntries] = useState<GraphInputEntry[]>([]);
  const [insights, setInsights] = useState<GraphInputInsight[]>([]);
  const [structuredCount, setStructuredCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nickname = useNickname();

  const graph = useMemo(() => buildGraph(entries, insights), [entries, insights]);
  const [detail, setDetail] = useState<StarDetail | null>(null);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph, selectedId],
  );
  const [openCluster, setOpenCluster] = useState<ClusterId | null>(null);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // 인사이트 하나를 고르면 그 근거 별만 밝게 남긴다.
  const highlightedIds = useMemo(() => {
    if (activeInsightId === null) return null;
    return insights.find((i) => i.id === activeInsightId)?.evidence_entry_ids ?? null;
  }, [activeInsightId, insights]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: entryRows, error: entryError },
        { data: tagRows, error: tagError },
        { data: structuredRows, error: structuredError },
        { data: insightRows, error: insightError },
      ] = await Promise.all([
        supabase.from('entries').select('id, raw_text, project_title, collection_id').order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation, status'),
        supabase.from('insights').select('id, type, summary, evidence_entry_ids').order('created_at', { ascending: false }),
      ]);
      if (entryError) throw entryError;
      if (tagError) throw tagError;
      if (structuredError) throw structuredError;
      if (insightError) throw insightError;

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      const situationByEntry = new Map<string, string | null>();
      (structuredRows ?? []).forEach((row) => situationByEntry.set(row.entry_id, row.situation));

      setStructuredCount((structuredRows ?? []).filter((row) => row.status === 'done').length);
      setEntries(
        (entryRows ?? []).map((row) => ({
          id: row.id,
          // 경험 탭 카드와 같은 폴백 순서 — 두 화면에서 같은 기록이 다른 이름으로 보이면 안 된다.
          label: situationByEntry.get(row.id) || row.project_title || row.raw_text.slice(0, 24),
          collection_id: row.collection_id,
          tags: tagsByEntry.get(row.id) ?? [],
        })),
      );
      setInsights((insightRows ?? []) as GraphInputInsight[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '패턴을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
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
      if (!structuredRows || structuredRows.length < MIN_ENTRIES_FOR_INSIGHTS) {
        // 다른 화면에서 기록이 지워져 최신 개수가 화면 상태와 어긋날 수 있다 — 버튼이 말없이
        // "분석 중..."만 반복하지 않도록 최신 개수와 이유를 같이 보여준다.
        const count = structuredRows?.length ?? 0;
        setStructuredCount(count);
        setError(
          `분석하려면 정리된 기록이 최소 ${MIN_ENTRIES_FOR_INSIGHTS}개 필요해요. (현재 ${count}개)`,
        );
        return;
      }

      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: structuredRows }),
      });
      if (!res.ok) throw new Error('인사이트 생성에 실패했습니다.');
      const result = await res.json();

      const validEntryIds = new Set(structuredRows.map((row) => row.entry_id));
      const rowsToInsert = buildInsightRows(result, user.id, validEntryIds);
      if (rowsToInsert.length === 0) throw new Error('인사이트 재생성에 실패했습니다. 다시 시도해주세요.');

      // 삭제를 먼저 하면 삽입이 실패했을 때 DB에 인사이트가 하나도 안 남는다 — "기존 별자리
      // 유지"가 깨진다. 그래서 지울 대상 id를 먼저 기억해두고, 삽입이 성공한 뒤에만 지운다.
      const { data: oldRows, error: oldFetchError } = await supabase
        .from('insights')
        .select('id')
        .eq('user_id', user.id);
      if (oldFetchError) throw oldFetchError;
      const oldIds = (oldRows ?? []).map((row) => row.id);

      const { data: insertedRows, error: insertError } = await supabase
        .from('insights')
        .insert(rowsToInsert)
        .select('id, type, summary, evidence_entry_ids');
      if (insertError) throw insertError;

      setInsights((insertedRows ?? []) as GraphInputInsight[]);
      setActiveInsightId(null);

      if (oldIds.length > 0) {
        const { error: deleteError } = await supabase.from('insights').delete().in('id', oldIds);
        if (deleteError) {
          // 새 인사이트는 이미 화면과 DB에 반영됐으니 상태는 그대로 두고, 청소가 안 됐다는 것만 알린다.
          setError('새 분석은 반영됐지만 이전 기록 정리에 실패했어요.');
        }
      }
    } catch (err) {
      // 실패해도 기존 별자리는 그대로 둔다 — 우주가 통째로 사라지면 손실감이 크다.
      setError(err instanceof Error ? err.message : '인사이트 재생성에 실패했습니다.');
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    (async () => {
      const [{ data: entry }, { data: structured }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', selectedId).single(),
        supabase
          .from('entries_structured')
          .select('situation, action, result, emotion, status')
          .eq('entry_id', selectedId)
          .maybeSingle(),
      ]);
      // 카드를 빠르게 옮겨 다니면 늦게 도착한 응답이 지금 카드를 덮어쓸 수 있다.
      if (cancelled) return;
      setDetail({
        rawText: entry?.raw_text ?? '',
        situation: structured?.situation ?? null,
        action: structured?.action ?? null,
        result: structured?.result ?? null,
        emotion: structured?.emotion ?? null,
        status: (structured?.status as StarDetail['status']) ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const clusterLabels: ClusterLabel[] = (['neutral', 'energizer', 'drainer'] as const)
    .filter((cluster) => graph.counts[cluster] > 0)
    .map((cluster) => ({
      cluster,
      text: `${CLUSTER_LABELS[cluster]} ${graph.counts[cluster]}`,
      onTap: () => {
        // 전체 경험 군집은 인사이트가 없으므로 카드를 열지 않는다.
        if (cluster === 'neutral') return;
        setSelectedId(null);
        setOpenCluster(cluster);
      },
    }));

  if (loading) {
    return <p className="px-4 py-6 text-sm text-slate-400">별자리를 그리는 중...</p>;
  }

  if (error && entries.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={loadAll}
          className="mt-3 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-slate-300">아직 별이 하나도 없어요.</p>
        <p className="mt-1 text-sm text-slate-400">첫 기록을 남기면 첫 별이 뜹니다.</p>
        <Link to="/" className="mt-4 inline-block rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white">
          기록하러 가기
        </Link>
      </div>
    );
  }

  if (webglFailed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-[calc(var(--bottom-nav-total)+1.5rem)]">
        <h2 className="text-xl font-semibold text-slate-50">
          {withNickname(nickname, (n) => `${n}의 에너지 패턴`, '나의 에너지 패턴')}
        </h2>
        <p className="text-xs text-slate-500">
          이 기기에서는 별자리를 그릴 수 없어 글로만 보여드려요.
        </p>
        {(['energizer', 'drainer'] as const).map((cluster) => (
          <ClusterSummaryCard
            key={cluster}
            cluster={cluster}
            insights={insights.filter((i) => i.type === cluster)}
            activeInsightId={null}
            onSelectInsight={null}
            onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
            regenerating={regenerating}
            onClose={null}
          />
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden bg-slate-950">
      <h2 className="pointer-events-none absolute left-4 top-4 z-10 text-sm font-medium text-slate-400">
        {withNickname(nickname, (n) => `${n}의 경험 별자리`, '나의 경험 별자리')}
      </h2>

      <ConstellationCanvas
        graph={graph}
        clusterLabels={clusterLabels}
        selectedId={selectedId}
        highlightedIds={highlightedIds}
        onSelect={(id) => {
          setSelectedId(id);
          // 별 하나를 골랐다면 인사이트 강조/군집 카드는 정리한다 — 안 그러면 별 카드 뒤에서
          // 다른 별들이 계속 어둡게 남고, 별 카드를 닫을 때 군집 카드가 불쑥 다시 뜬다.
          if (id !== null) {
            setActiveInsightId(null);
            setOpenCluster(null);
          }
        }}
        onWebglFailure={() => setWebglFailed(true)}
      />

      {selectedNode && (
        <StarDetailCard node={selectedNode} detail={detail} onClose={() => setSelectedId(null)} />
      )}

      {openCluster !== null && selectedId === null && (
        <div className="absolute inset-x-3 bottom-3 z-20 max-h-[55dvh] overflow-y-auto">
          <ClusterSummaryCard
            cluster={openCluster}
            insights={insights.filter((i) => i.type === openCluster)}
            activeInsightId={activeInsightId}
            onSelectInsight={setActiveInsightId}
            onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
            regenerating={regenerating}
            onClose={() => {
              setOpenCluster(null);
              setActiveInsightId(null);
            }}
          />
        </div>
      )}

      {structuredCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p className="absolute inset-x-4 bottom-4 z-10 rounded-lg bg-slate-900/80 p-3 text-center text-xs text-slate-400">
          기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 정리되면 별무리가 나뉘어요. (현재 {structuredCount}개)
        </p>
      )}

      {structuredCount >= MIN_ENTRIES_FOR_INSIGHTS && insights.length === 0 && (
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="absolute inset-x-4 bottom-4 z-10 rounded-lg bg-slate-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {regenerating ? '분석 중...' : '패턴 분석하기'}
        </button>
      )}

      {error && (
        // 카드(별 상세 z-20, 군집 요약 z-20)에 가려지면 재생성 실패를 알릴 방법이 없다 —
        // 어떤 카드가 열려 있어도 항상 보이도록 오버레이 스택의 맨 위, z-30에 둔다.
        <p className="absolute inset-x-3 top-14 z-30 rounded-lg bg-red-950/90 p-3 text-center text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
