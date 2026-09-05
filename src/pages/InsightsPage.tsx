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
      if (!structuredRows || structuredRows.length < MIN_ENTRIES_FOR_INSIGHTS) return;

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

      const { error: deleteError } = await supabase.from('insights').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const { data: insertedRows, error: insertError } = await supabase
        .from('insights')
        .insert(rowsToInsert)
        .select('id, type, summary, evidence_entry_ids');
      if (insertError) throw insertError;

      setInsights((insertedRows ?? []) as GraphInputInsight[]);
      setActiveInsightId(null);
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
        onSelect={setSelectedId}
        onWebglFailure={() => {}}
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
        <p className="absolute inset-x-4 bottom-20 z-10 rounded-lg bg-red-950/80 p-3 text-center text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
