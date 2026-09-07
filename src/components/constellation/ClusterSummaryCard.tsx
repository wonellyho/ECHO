import { CLUSTER_COLORS, CLUSTER_LABELS, type ClusterId } from '../../lib/constellation/layout';
import type { GraphInputInsight } from '../../lib/constellation/buildGraph';
import { EvidenceList, type EvidenceState } from './EvidenceList';

export interface ClusterSummaryCardProps {
  cluster: ClusterId;
  insights: GraphInputInsight[];
  activeInsightId: string | null;
  // null이면 선택 기능 자체가 없다는 뜻 — WebGL 폴백처럼 별을 밝게 표시할 화면이 없을 때다.
  // 이때는 버튼이 아니라 div로 그려서 스크린리더가 "눌러도 반응 없는 토글"을 안내하지 않게 한다.
  onSelectInsight: ((id: string | null) => void) | null;
  // 근거 기록 펼치기 — 어느 인사이트가 펼쳐져 있는지, 그 근거 기록을 어디까지 불러왔는지.
  expandedInsightId: string | null;
  evidence: Record<string, EvidenceState>;
  onToggleEvidence: (id: string) => void;
  // null이면 재생성 버튼을 숨긴다 (기록이 부족할 때).
  onRegenerate: (() => void) | null;
  regenerating: boolean;
  // null이면 닫기 버튼을 숨긴다 (WebGL 폴백에서 카드가 화면 본문일 때).
  onClose: (() => void) | null;
  // true면 BottomSheet 안에 들어간다 — 자기 테두리를 그리지 않고, 머리말/꼬리말은 고정하고
  // 인사이트 목록만 스크롤시킨다.
  bare?: boolean;
}

export function ClusterSummaryCard({
  cluster,
  insights,
  activeInsightId,
  onSelectInsight,
  expandedInsightId,
  evidence,
  onToggleEvidence,
  onRegenerate,
  regenerating,
  onClose,
  bare = false,
}: ClusterSummaryCardProps) {
  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: CLUSTER_COLORS[cluster] }}
        />
        <h3 className="text-sm font-semibold text-ink">{CLUSTER_LABELS[cluster]}</h3>
      </div>
      <div className="flex items-center gap-1">
        {/* 카드 한 줄을 통째로 차지하던 큰 버튼 대신 머리말의 작은 아이콘으로 옮겼다 —
            자주 쓰는 기능은 아니지만, 기록이 쌓인 뒤 다시 분석할 길이 아예 없으면 안 된다. */}
        {bare && onRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            aria-label="다시 분석하기"
            title="다시 분석하기"
            className="rounded-full px-2.5 py-1.5 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-50"
          >
            {regenerating ? '분석 중...' : '↻'}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full px-2.5 py-1.5 text-ink-dim transition-colors hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );

  const list =
    insights.length === 0 ? (
      <p className="text-sm text-ink-dim">아직 이 패턴으로 정리된 게 없어요.</p>
    ) : (
      <ul className="space-y-2">
        {insights.map((insight) => {
          const active = insight.id === activeInsightId;
          const expanded = insight.id === expandedInsightId;
          const summary = <p className="text-[15px] leading-relaxed text-ink">{insight.summary}</p>;
          return (
            <li key={insight.id} className="overflow-hidden rounded-2xl border border-hairline bg-[rgba(10,20,40,0.34)]">
              {/* 요약 줄을 누르면 근거 별만 밝게 남는다 (별자리가 있을 때만). */}
              {onSelectInsight ? (
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectInsight(active ? null : insight.id)}
                  className={`w-full p-3 text-left transition-colors ${
                    active ? 'bg-[rgba(167,110,255,0.16)]' : 'hover:bg-[rgba(130,160,220,0.1)]'
                  }`}
                >
                  {summary}
                  {active && <p className="mt-1 text-xs text-cosmic-violet">근거 별만 밝게 표시 중</p>}
                </button>
              ) : (
                <div className="w-full p-3 text-left">{summary}</div>
              )}

              {/* 근거 기록 펼치기. 위 버튼 안에 넣으면 버튼 중첩이라 HTML이 깨진다 — 형제로 둔다. */}
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => onToggleEvidence(insight.id)}
                className="flex w-full items-center justify-between gap-2 px-3 pb-2.5 text-left text-xs text-ink-dim transition-colors hover:text-ink"
              >
                <span>근거 기록 {insight.evidence_entry_ids.length}건</span>
                <span aria-hidden>{expanded ? '접기 ▴' : '펼치기 ▾'}</span>
              </button>

              {expanded && <EvidenceList state={evidence[insight.id]} />}
            </li>
          );
        })}
      </ul>
    );

  if (bare) {
    // 머리말은 위에, 목록만 가운데에서 스크롤 — 시트 높이가 고정이라 머리말이 같이 밀려
    // 올라가면 지금 어느 별무리를 보고 있는지 알 수 없게 된다.
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-4 pb-2 pt-1">{header}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {list}
          {!onRegenerate && (
            <p className="mt-3 text-xs text-ink-muted">
              기록이 3개 이상 정리되면 다시 분석할 수 있어요.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-[rgba(10,20,40,0.45)] p-4 backdrop-blur-xl">
      {header}
      <div className="mt-3">{list}</div>
      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="mt-4 rounded-full border border-hairline px-4 py-2 text-xs font-medium text-ink transition-colors hover:border-hairline-active disabled:opacity-50"
        >
          {regenerating ? '분석 중...' : '다시 분석하기'}
        </button>
      ) : (
        <p className="mt-4 text-xs text-ink-muted">기록이 3개 이상 정리되면 다시 분석할 수 있어요.</p>
      )}
    </div>
  );
}
