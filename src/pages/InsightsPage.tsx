import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useNickname, withNickname } from '../lib/useNickname';
import { ROUTES } from '../lib/routes';
import {
  applyClusterCenters,
  applyClusterScales,
  buildGraph,
  type GraphInputEntry,
} from '../lib/constellation/buildGraph';
import {
  CLUSTER_CENTERS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
  CLUSTER_ORDER,
  type ClusterId,
  type Vec3,
} from '../lib/constellation/layout';
import {
  ConstellationCanvas,
  type CameraFocusRequest,
  type ClusterLabel,
} from '../components/constellation/ConstellationCanvas';
import { SpaceScene } from '../components/cosmic/SpaceScene';
import { GlassCard } from '../components/ui/GlassCard';
import { CosmicIconButton, OutlineButton } from '../components/ui/CosmicButton';
import { ChevronDownIcon, ChevronRightIcon, CheckIcon, EditIcon, TargetIcon } from '../components/icons';
import { BottomSheet } from '../components/constellation/BottomSheet';
import { StarDetailCard, type StarDetail } from '../components/constellation/StarDetailCard';
import type { ExperienceTag } from '../types';

// 에너지원/소진요인 인사이트 기능은 뺐다 — 별자리 탭은 태그로 묶인 별무리만 보여준다
// ("인사이트 이런 거 다 없애줘" 요청). entries_structured의 status는 여전히 구조화 여부를
// 아는 데 필요할 수 있어 조회는 유지하되, 화면에서 인사이트 관련 UI는 전부 뺐다.

// 크기를 조절한 적 없는 군집의 기본 배율(1) — cluster_positions.scale 컬럼과 짝이다.
const DEFAULT_CLUSTER_SCALE: Record<ClusterId, number> = Object.fromEntries(
  CLUSTER_ORDER.map((cluster) => [cluster, 1]),
) as Record<ClusterId, number>;

export function InsightsPage() {
  const [entries, setEntries] = useState<GraphInputEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const nickname = useNickname();

  // 사용자가 별자리 탭에서 직접 옮긴 별무리(군집) 위치. 옮긴 적 없는 군집은 layout.ts의 기본
  // CLUSTER_CENTERS를 그대로 쓴다 — loadAll()이 cluster_positions 테이블에서 저장된 값만
  // 덮어쓴다.
  const [clusterCenters, setClusterCenters] = useState<Record<ClusterId, Vec3>>(CLUSTER_CENTERS);
  // 크기 손잡이로 조절한 군집별 배율. 위치와 마찬가지로 조절한 적 없으면 1(기본 크기)이다.
  const [clusterRadiusScale, setClusterRadiusScale] =
    useState<Record<ClusterId, number>>(DEFAULT_CLUSTER_SCALE);
  // "위치 편집" 모드 — 켜져 있으면 성운(haze)을 드래그해 군집 전체를 옮기거나 손잡이로
  // 크기를 조절할 수 있다(ConstellationCanvas 참고).
  const [editMode, setEditMode] = useState(false);
  // 태그별 별 개수 통계 드롭다운 — "시야를 해치지 않게" 요청으로 기본은 접혀 있다.
  const [statsOpen, setStatsOpen] = useState(false);

  const graph = useMemo(
    () => applyClusterScales(applyClusterCenters(buildGraph(entries), clusterCenters), clusterRadiusScale, clusterCenters),
    [entries, clusterCenters, clusterRadiusScale],
  );
  const [detail, setDetail] = useState<StarDetail | null>(null);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph, selectedId],
  );
  const [webglFailed, setWebglFailed] = useState(false);
  // 같은 라벨을 다시 눌러도 다시 이동해야 하므로 값 비교가 아니라 token으로 요청을 구분한다.
  const [cameraFocus, setCameraFocus] = useState<CameraFocusRequest | null>(null);

  // Omit을 유니온에 그냥 씌우면 공통 키만 남으므로(= cluster가 사라진다) 분배되게 감싼다.
  type CameraFocusIntent = CameraFocusRequest extends infer T
    ? T extends CameraFocusRequest
      ? Omit<T, 'token'>
      : never
    : never;

  function requestCamera(next: CameraFocusIntent) {
    setCameraFocus((previous) => ({ ...next, token: (previous?.token ?? 0) + 1 }) as CameraFocusRequest);
  }

  // cluster_positions.scale 컬럼은 schema.sql에 나중에 추가됐다 — 기존 Supabase 프로젝트에서
  // 그 ALTER TABLE을 아직 안 돌렸다면 scale을 포함한 upsert가 "column does not exist"(42703)로
  // 실패한다. "별무리 위치를 옮겼는데 왜 저장 실패가 뜨냐"는 질문의 실제 원인이 이거였다 —
  // 그냥 저장 실패라고만 하지 않고 무엇을 해야 하는지 알려준다.
  function describeClusterSaveError(err: unknown, fallback: string): string {
    const code = (err as { code?: string } | null)?.code;
    if (code === '42703') {
      return 'DB에 cluster_positions.scale 컬럼이 없어 저장에 실패했어요. Supabase SQL Editor에서 "alter table cluster_positions add column if not exists scale double precision not null default 1;"을 한 번 실행해주세요.';
    }
    return err instanceof Error ? err.message : fallback;
  }

  // 편집 모드에서 군집(별무리)을 드래그해 옮긴 뒤 손을 뗐을 때 — 화면에는 즉시 반영하고
  // (낙관적 업데이트), 저장은 백그라운드에서 한다. 실패해도 로컬 위치는 되돌리지 않는다 —
  // 드래그 자체는 이미 화면에서 끝난 동작이라, 조용히 실패하고 다음 저장 때 다시 시도되는
  // 편이 "방금 옮긴 별무리가 눈앞에서 도로 튕겨 돌아가는" 것보다 낫다.
  async function handleClusterMoved(cluster: ClusterId, center: Vec3) {
    setClusterCenters((prev) => ({ ...prev, [cluster]: center }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // upsert는 행 전체를 대체하므로, 옮기지 않은 scale도 함께 넣어야 이전에 조절해둔
      // 크기가 위치만 옮겨도 1로 되돌아가지 않는다.
      const { error: saveError } = await supabase
        .from('cluster_positions')
        .upsert(
          {
            user_id: user.id,
            cluster,
            x: center.x,
            y: center.y,
            z: center.z,
            scale: clusterRadiusScale[cluster] ?? 1,
          },
          { onConflict: 'user_id,cluster' },
        );
      if (saveError) throw saveError;
    } catch (err) {
      setError(describeClusterSaveError(err, '별무리 위치를 저장하지 못했습니다.'));
    }
  }

  // 편집 모드에서 크기 손잡이를 놓았을 때 — handleClusterMoved와 같은 패턴(낙관적 업데이트,
  // 실패해도 되돌리지 않음).
  async function handleClusterResized(cluster: ClusterId, scale: number) {
    setClusterRadiusScale((prev) => ({ ...prev, [cluster]: scale }));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const center = clusterCenters[cluster];
      const { error: saveError } = await supabase
        .from('cluster_positions')
        .upsert(
          { user_id: user.id, cluster, x: center.x, y: center.y, z: center.z, scale },
          { onConflict: 'user_id,cluster' },
        );
      if (saveError) throw saveError;
    } catch (err) {
      setError(describeClusterSaveError(err, '별무리 크기를 저장하지 못했습니다.'));
    }
  }

  // 첫 화면(모든 별무리가 보이는 시점)으로 돌아간다 — 열려 있던 카드도 함께 정리한다.
  function goToOverview() {
    setSelectedId(null);
    setEditMode(false);
    requestCamera({ kind: 'overview' });
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: entryRows, error: entryError },
        { data: tagRows, error: tagError },
        { data: structuredRows, error: structuredError },
        { data: clusterPositionRows, error: clusterPositionError },
      ] = await Promise.all([
        supabase.from('entries').select('id, raw_text, project_title, collection_id').order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation'),
        supabase.from('cluster_positions').select('cluster, x, y, z, scale'),
      ]);
      if (entryError) throw entryError;
      if (tagError) throw tagError;
      if (structuredError) throw structuredError;
      // cluster_positions는 supabase/schema.sql을 아직 안 돌린 환경에선 테이블 자체가(또는
      // scale 컬럼이 아직) 없어 404/에러가 날 수 있다 — 그런 경우 조용히 기본 위치·크기로
      // 폴백한다(전체 화면이 죽으면 안 된다).
      if (!clusterPositionError && clusterPositionRows) {
        const mergedCenters = { ...CLUSTER_CENTERS };
        const mergedScales = { ...DEFAULT_CLUSTER_SCALE };
        clusterPositionRows.forEach((row) => {
          mergedCenters[row.cluster as ClusterId] = { x: row.x, y: row.y, z: row.z };
          mergedScales[row.cluster as ClusterId] = row.scale ?? 1;
        });
        setClusterCenters(mergedCenters);
        setClusterRadiusScale(mergedScales);
      }

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      const situationByEntry = new Map<string, string | null>();
      (structuredRows ?? []).forEach((row) => situationByEntry.set(row.entry_id, row.situation));

      setEntries(
        (entryRows ?? []).map((row) => ({
          id: row.id,
          // 경험 탭 카드와 같은 폴백 순서 — 두 화면에서 같은 기록이 다른 이름으로 보이면 안 된다.
          label: situationByEntry.get(row.id) || row.project_title || row.raw_text.slice(0, 24),
          collection_id: row.collection_id,
          tags: tagsByEntry.get(row.id) ?? [],
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '별자리를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 한 기록이 여러 태그 군집에 별을 중복으로 가질 수 있어(node.id는 군집까지 포함한 합성
  // id), 실제 DB 조회는 항상 node.entryId를 기준으로 한다.
  const selectedEntryId = selectedNode?.entryId ?? null;
  useEffect(() => {
    if (selectedEntryId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    (async () => {
      const [{ data: entry }, { data: structured }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', selectedEntryId).single(),
        supabase
          .from('entries_structured')
          .select('situation, action, result, emotion, status')
          .eq('entry_id', selectedEntryId)
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
  }, [selectedEntryId]);

  // 별무리 라벨 — 태그 6종 + 태그 없는 기록(미분류) 중 실제로 별이 있는 것만 보여준다.
  // 탭하면 그 군집으로 카메라만 이동한다 — 편집 모드는 오른쪽 위 편집 아이콘으로만 켠다
  // ("편집모드가 아닌데 별무리를 눌렀다고 자동으로 편집모드가 되는 건 원치 않는다" 요청).
  const clusterLabels: ClusterLabel[] = CLUSTER_ORDER.filter((cluster) => graph.counts[cluster] > 0).map(
    (cluster) => ({
      cluster,
      text: `${CLUSTER_LABELS[cluster]} ${graph.counts[cluster]}`,
      onTap: () => {
        setSelectedId(null);
        requestCamera({ kind: 'cluster', cluster, raise: false });
      },
    }),
  );

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
            to={ROUTES.app}
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
            {withNickname(nickname, (n) => `${n}의 경험 별자리`, '나의 경험 별자리')}
          </h2>
          <p className="text-xs text-ink-muted">이 기기에서는 별자리를 그릴 수 없어 글로만 보여드려요.</p>
          {CLUSTER_ORDER.filter((cluster) => graph.counts[cluster] > 0).map((cluster) => (
            <GlassCard key={cluster} className="p-4">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CLUSTER_COLORS[cluster] }}
                />
                <h3 className="text-sm font-semibold text-ink">
                  {CLUSTER_LABELS[cluster]} {graph.counts[cluster]}
                </h3>
              </div>
              <ul className="mt-2 space-y-1.5">
                {graph.nodes
                  .filter((node) => node.cluster === cluster)
                  .map((node) => (
                    <li key={node.id}>
                      <Link to={ROUTES.entry(node.entryId)} className="text-sm text-ink-dim hover:text-ink">
                        {node.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            </GlassCard>
          ))}
          {error && <p className="text-sm text-echo-coral">{error}</p>}
        </div>
      </div>
    );
  }

  // 카드가 떠 있으면 화면 아래 40dvh가 가려진다 — 그 위에 떠야 하는 것들이 이 값을 본다.
  const sheetOpen = selectedNode !== null;

  return (
    <div className="relative h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden">
      <SpaceScene variant="pattern" />

      {/* 머리말은 별자리 위에 얹히되 조작을 가로막지 않는다 — 별을 탭하려면 이 영역도
          캔버스로 이벤트가 지나가야 한다. 로고/태그라인 없이 제목만 바로 맨 위에 둬서
          아래 별자리·카드가 스크롤 없이 더 많이 보이게 한다. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1
              className="bg-clip-text text-[27px] font-bold tracking-tight text-transparent"
              style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
            >
              {withNickname(nickname, (n) => `${n}의 경험 별자리`, '나의 경험 별자리')}
            </h1>
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-dim">
              같은 태그를 가진 경험끼리
              <br />
              별무리로 모여 있어요.
            </p>
          </div>
          {/* 별무리 위치 편집 토글 — 부모가 pointer-events-none이라 버튼 자신에게 다시
              pointer-events-auto를 줘야 눌린다(EntriesPage의 편집 버튼과 같은 관례). */}
          <CosmicIconButton
            type="button"
            onClick={() => setEditMode((prev) => !prev)}
            aria-pressed={editMode}
            aria-label={editMode ? '위치 편집 완료' : '별무리 위치 편집'}
            title={editMode ? '위치 편집 완료' : '별무리 위치 편집'}
            className={`pointer-events-auto shrink-0 ${editMode ? 'border-hairline-active text-ink' : ''}`}
          >
            {editMode ? <CheckIcon className="h-4 w-4" /> : <EditIcon className="h-4 w-4" />}
          </CosmicIconButton>
        </div>
        {editMode && (
          <p className="pointer-events-none mt-3 text-[12px] text-ink-dim">
            별무리를 눌러서 드래그하면 위치가 옮겨져요.
          </p>
        )}
      </div>

      <ConstellationCanvas
        graph={graph}
        clusterLabels={clusterLabels}
        selectedId={selectedId}
        highlightedIds={null}
        cameraFocus={cameraFocus}
        clusterCenters={clusterCenters}
        clusterRadiusScale={clusterRadiusScale}
        editMode={editMode}
        onClusterMoved={handleClusterMoved}
        onClusterResized={handleClusterResized}
        // 배경 사진에 이미 별이 가득하다 — 3D 씬의 배경 별까지 원래대로 뿌리면 두 겹이 겹쳐
        // 지저분해진다. 시차를 만들 정도만 남긴다.
        density={0.35}
        onSelect={setSelectedId}
        onWebglFailure={() => setWebglFailed(true)}
      />

      {selectedNode && (
        <BottomSheet>
          <StarDetailCard node={selectedNode} detail={detail} onClose={() => setSelectedId(null)} />
        </BottomSheet>
      )}

      {/* 태그별 별 개수 통계 — 아래 방향키(ConstellationCanvas, bottom-4) 바로 위에 둔다.
          배경을 거의 비우고(blur 없이 낮은 알파) 토글도 텍스트 한 줄뿐이라 시야를 거의
          가리지 않는다("시야 최대한 해치지 않게 심플하게" 요청).
          이전엔 패널을 left-1/2 -translate-x-1/2 + w-max로 "내용만큼 좁게, 가운데 정렬"
          하려 했는데, absolute+overflow-hidden 조합에서 그 shrink-to-fit 너비 계산이
          브라우저에서 안정적으로 되지 않아(40~180px로 제멋대로 좁아짐) 태그가 하나만
          보이는 버그로 이어졌다. inset-x-4로 너비를 화면 폭 기준으로 명확히 고정하고
          grid-cols-7로 7칸을 정확히 나눠 스크롤 없이 한 화면에 다 들어오게 바꿨다. */}
      <button
        type="button"
        onClick={() => setStatsOpen((prev) => !prev)}
        aria-expanded={statsOpen}
        className="absolute bottom-16 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-dim transition-colors hover:border-hairline-active hover:text-ink"
        style={{ background: 'rgba(10, 20, 40, 0.14)' }}
      >
        태그별 통계
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`} />
      </button>

      {statsOpen && (
        <div
          className="fade-in-up-enter absolute inset-x-4 bottom-28 z-10 overflow-hidden rounded-2xl border border-hairline backdrop-blur-sm"
          style={{ background: 'rgba(8, 15, 33, 0.3)' }}
        >
          <div className="grid grid-cols-7 gap-1 p-2">
            {CLUSTER_ORDER.map((cluster) => (
              <div key={cluster} className="flex flex-col items-center gap-1 overflow-hidden">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: CLUSTER_COLORS[cluster] }}
                />
                <span className="w-full truncate text-center text-[10px] text-ink-dim">
                  {CLUSTER_LABELS[cluster]}
                </span>
                <span className="text-xs font-medium text-ink">{graph.counts[cluster]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 가운데 시점으로 되돌아가는 버튼 — 방향키로 옮겨 다니다 다시 전체가 보이는 자리로
          돌아오기 위한 것. 예전엔 "전체 별자리 보기" 텍스트 버튼으로 가운데 아래에 있었는데,
          그 자리는 아래 방향키가 차지하게 됐고 아이콘만 남겨 심플하게 바꿨다(요청사항).
          카드가 열려 있으면 카드(40dvh) 바로 위로 올라간다. */}
      <CosmicIconButton
        type="button"
        onClick={goToOverview}
        aria-label="중앙으로 이동"
        title="중앙으로 이동"
        className={`absolute right-4 z-30 ${sheetOpen ? 'bottom-[calc(40dvh+0.75rem)]' : 'bottom-4'}`}
      >
        <TargetIcon className="h-5 w-5" />
      </CosmicIconButton>

      {error && (
        // 카드(별 상세 z-20)에 가려지면 저장 실패를 알릴 방법이 없다 — 항상 보이도록
        // 오버레이 스택의 맨 위, z-30에 둔다.
        <p className="absolute inset-x-3 top-3 z-30 rounded-2xl border border-[rgba(255,120,140,0.35)] bg-[rgba(48,10,26,0.9)] p-3 text-center text-xs text-echo-coral backdrop-blur-xl">
          {error}
        </p>
      )}
    </div>
  );
}
