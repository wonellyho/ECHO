import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { buildInsightRows } from '../lib/buildInsightRows';
import { useNickname, withNickname } from '../lib/useNickname';
import { buildGraph, type GraphInputEntry, type GraphInputInsight } from '../lib/constellation/buildGraph';
import { CLUSTER_LABELS, type ClusterId } from '../lib/constellation/layout';
import {
  ConstellationCanvas,
  type CameraFocusRequest,
  type ClusterLabel,
} from '../components/constellation/ConstellationCanvas';
import { SpaceScene } from '../components/cosmic/SpaceScene';
import { Logo } from '../components/Logo';
import { OutlineButton } from '../components/ui/CosmicButton';
import { ChevronRightIcon } from '../components/icons';
import { BottomSheet } from '../components/constellation/BottomSheet';
import { StarDetailCard, type StarDetail } from '../components/constellation/StarDetailCard';
import { ClusterSummaryCard } from '../components/constellation/ClusterSummaryCard';
import type { EvidenceState } from '../components/constellation/EvidenceList';
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
  // 같은 라벨을 다시 눌러도 다시 이동해야 하므로 값 비교가 아니라 token으로 요청을 구분한다.
  const [cameraFocus, setCameraFocus] = useState<CameraFocusRequest | null>(null);
  const [expandedInsightId, setExpandedInsightId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Record<string, EvidenceState>>({});

  // Omit을 유니온에 그냥 씌우면 공통 키만 남으므로(= cluster가 사라진다) 분배되게 감싼다.
  type CameraFocusIntent = CameraFocusRequest extends infer T
    ? T extends CameraFocusRequest
      ? Omit<T, 'token'>
      : never
    : never;

  function requestCamera(next: CameraFocusIntent) {
    setCameraFocus((previous) => ({ ...next, token: (previous?.token ?? 0) + 1 }) as CameraFocusRequest);
  }

  async function toggleEvidence(insightId: string) {
    if (expandedInsightId === insightId) {
      setExpandedInsightId(null);
      return;
    }
    setExpandedInsightId(insightId);
    // 한 번 불러온 근거는 다시 부르지 않는다 — 접었다 폈다 할 때마다 왕복하면 느리다.
    if (evidence[insightId]?.status === 'ready') return;

    const ids = insights.find((i) => i.id === insightId)?.evidence_entry_ids ?? [];
    if (ids.length === 0) {
      setEvidence((prev) => ({ ...prev, [insightId]: { status: 'ready', entries: [] } }));
      return;
    }

    setEvidence((prev) => ({ ...prev, [insightId]: { status: 'loading' } }));
    try {
      const [
        { data: entryRows, error: entryError },
        { data: structuredRows, error: structuredError },
      ] = await Promise.all([
        supabase.from('entries').select('id, raw_text, audio_url').in('id', ids),
        supabase
          .from('entries_structured')
          .select('entry_id, situation, action, result, emotion, status')
          .in('entry_id', ids),
      ]);
      if (entryError) throw entryError;
      if (structuredError) throw structuredError;

      const entryById = new Map((entryRows ?? []).map((row) => [row.id, row]));
      const structuredById = new Map((structuredRows ?? []).map((row) => [row.entry_id, row]));

      // 근거 id 순서를 그대로 지킨다. 지워진 기록을 가리키는 id는 조용히 건너뛴다.
      const entries = ids.flatMap((id) => {
        const entry = entryById.get(id);
        if (!entry) return [];
        const structured = structuredById.get(id);
        return [
          {
            id,
            rawText: entry.raw_text,
            situation: structured?.situation ?? null,
            action: structured?.action ?? null,
            result: structured?.result ?? null,
            emotion: structured?.emotion ?? null,
            status: (structured?.status ?? null) as 'pending' | 'done' | 'failed' | null,
            hasAudio: entry.audio_url !== null,
          },
        ];
      });

      setEvidence((prev) => ({ ...prev, [insightId]: { status: 'ready', entries } }));
    } catch (err) {
      setEvidence((prev) => ({
        ...prev,
        [insightId]: {
          status: 'error',
          message: err instanceof Error ? err.message : '근거 기록을 불러오지 못했습니다.',
        },
      }));
    }
  }

  // 첫 화면(모든 별무리가 보이는 시점)으로 돌아간다 — 열려 있던 카드도 함께 정리한다.
  function goToOverview() {
    setSelectedId(null);
    setOpenCluster(null);
    setActiveInsightId(null);
    setExpandedInsightId(null);
    requestCamera({ kind: 'overview' });
  }

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
      // 인사이트 id가 통째로 바뀌었으니 이전 근거 캐시는 가리키는 곳이 없다.
      setExpandedInsightId(null);
      setEvidence({});

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
        setSelectedId(null);
        // 전체 경험 군집은 인사이트가 없으므로 요약 카드를 열지 않고, 따라서 시점을 올릴 필요도 없다.
        const opensCard = cluster !== 'neutral';
        setOpenCluster(opensCard ? cluster : null);
        if (!opensCard) setActiveInsightId(null);
        // 카드가 열릴 때는 별무리가 카드 위쪽에 오도록 시점을 올려 준다 — 사용자가 지금 무엇을
        // 고른 건지 보이지 않으면 카드의 내용이 어디서 나온 건지 알 수 없다.
        requestCamera({ kind: 'cluster', cluster, raise: opensCard });
      },
    }));

  if (loading) {
    return <p className="px-5 py-6 text-sm text-ink-dim">별자리를 그리는 중...</p>;
  }

  if (error && entries.length === 0) {
    return (
      <div className="px-5 py-6">
        <p className="text-sm text-echo-coral">{error}</p>
        <OutlineButton type="button" onClick={loadAll} className="mt-4 max-w-xs">
          다시 시도
        </OutlineButton>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="relative min-h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden">
        <SpaceScene variant="pattern" />
        <div className="relative px-5 py-14 text-center">
          <p className="text-[15px] text-ink">아직 별이 하나도 없어요.</p>
          <p className="mt-1.5 text-sm text-ink-dim">첫 기록을 남기면 첫 별이 뜹니다.</p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-[3rem] items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white"
            style={{ background: 'var(--echo-gradient)' }}
          >
            기록하러 가기
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (webglFailed) {
    return (
      <div className="relative min-h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden">
        {/* 별자리는 못 그려도 배경은 CSS/캔버스라 어디서든 뜬다 — 화면 분위기까지 잃지 않게 한다. */}
        <SpaceScene variant="pattern" />
        <div className="relative mx-auto max-w-2xl space-y-4 px-5 py-7 pb-[calc(var(--bottom-nav-total)+1.5rem)]">
          <h2 className="text-[27px] font-bold tracking-tight text-ink">
            {withNickname(nickname, (n) => `${n}의 에너지 패턴`, '나의 에너지 패턴')}
          </h2>
          <p className="text-xs text-ink-muted">
            이 기기에서는 별자리를 그릴 수 없어 글로만 보여드려요.
          </p>
          {(['energizer', 'drainer'] as const).map((cluster) => (
            <ClusterSummaryCard
              key={cluster}
              cluster={cluster}
              insights={insights.filter((i) => i.type === cluster)}
              activeInsightId={null}
              onSelectInsight={null}
              expandedInsightId={expandedInsightId}
              evidence={evidence}
              onToggleEvidence={toggleEvidence}
              onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
              regenerating={regenerating}
              onClose={null}
            />
          ))}
          {error && <p className="text-sm text-echo-coral">{error}</p>}
        </div>
      </div>
    );
  }

  // 카드가 떠 있으면 화면 아래 40dvh가 가려진다 — 그 위에 떠야 하는 것들이 이 값을 본다.
  const sheetOpen = selectedNode !== null || (openCluster !== null && selectedId === null);

  return (
    <div className="relative h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden">
      <SpaceScene variant="pattern" />

      {/* 머리말은 별자리 위에 얹히되 조작을 가로막지 않는다 — 별을 탭하려면 이 영역도
          캔버스로 이벤트가 지나가야 한다. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-7">
        <div className="flex items-start justify-between gap-3">
          <Logo />
          <p className="hidden shrink-0 pt-1 text-right text-[11px] leading-relaxed text-ink-muted min-[380px]:block">
            <span className="block">작은</span>
            <span className="block">경험이 모여</span>
            <span className="block">특별한 나를 만듭니다.</span>
          </p>
        </div>
        <h1
          className="mt-7 bg-clip-text text-[27px] font-bold tracking-tight text-transparent"
          style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
        >
          {withNickname(nickname, (n) => `${n}의 경험 별자리`, '나의 경험 별자리')}
        </h1>
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-dim">
          지금까지의 경험이 모여
          <br />
          오늘의 당신을 이루고 있어요.
        </p>
      </div>

      <ConstellationCanvas
        graph={graph}
        clusterLabels={clusterLabels}
        selectedId={selectedId}
        highlightedIds={highlightedIds}
        cameraFocus={cameraFocus}
        // 배경 사진에 이미 별이 가득하다 — 3D 씬의 배경 별까지 원래대로 뿌리면 두 겹이 겹쳐
        // 지저분해진다. 시차를 만들 정도만 남긴다.
        density={0.35}
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
        <BottomSheet>
          <StarDetailCard node={selectedNode} detail={detail} onClose={() => setSelectedId(null)} />
        </BottomSheet>
      )}

      {openCluster !== null && selectedId === null && (
        <BottomSheet scroll={false}>
          <ClusterSummaryCard
            bare
            cluster={openCluster}
            insights={insights.filter((i) => i.type === openCluster)}
            activeInsightId={activeInsightId}
            onSelectInsight={setActiveInsightId}
            expandedInsightId={expandedInsightId}
            evidence={evidence}
            onToggleEvidence={toggleEvidence}
            onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
            regenerating={regenerating}
            onClose={() => {
              setOpenCluster(null);
              setActiveInsightId(null);
              setExpandedInsightId(null);
            }}
          />
        </BottomSheet>
      )}

      {/* 첫 화면으로 돌아가는 버튼. 카드가 열려 있으면 카드(40dvh) 바로 위로 올라간다 —
          카드 뒤에 깔리면 "다음 라벨을 고르러 나가는" 유일한 통로가 사라진다. */}
      <button
        type="button"
        onClick={goToOverview}
        className={`absolute left-1/2 z-30 flex min-h-[2.75rem] -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-[rgba(8,15,33,0.55)] px-5 text-[13px] font-medium text-ink-dim backdrop-blur-xl transition-colors hover:border-hairline-active hover:text-ink ${
          sheetOpen ? 'bottom-[calc(40dvh+0.75rem)]' : 'bottom-4'
        }`}
      >
        전체 별자리 보기
        <ChevronRightIcon className="h-4 w-4" />
      </button>

      {structuredCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p className="absolute inset-x-4 bottom-14 z-10 rounded-2xl border border-hairline bg-[rgba(8,15,33,0.6)] p-3 text-center text-xs text-ink-dim backdrop-blur-xl">
          기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 정리되면 별무리가 나뉘어요. (현재 {structuredCount}개)
        </p>
      )}

      {structuredCount >= MIN_ENTRIES_FOR_INSIGHTS && insights.length === 0 && (
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="absolute inset-x-4 bottom-14 z-10 min-h-[3rem] rounded-full px-4 text-[15px] font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--echo-gradient)' }}
        >
          {regenerating ? '분석 중...' : '패턴 분석하기'}
        </button>
      )}

      {error && (
        // 카드(별 상세 z-20, 군집 요약 z-20)에 가려지면 재생성 실패를 알릴 방법이 없다 —
        // 어떤 카드가 열려 있어도 항상 보이도록 오버레이 스택의 맨 위, z-30에 둔다.
        <p className="absolute inset-x-3 top-3 z-30 rounded-2xl border border-[rgba(255,120,140,0.35)] bg-[rgba(48,10,26,0.9)] p-3 text-center text-xs text-echo-coral backdrop-blur-xl">
          {error}
        </p>
      )}
    </div>
  );
}
