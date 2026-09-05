import { CLUSTER_COLORS, CLUSTER_LABELS, type ClusterId } from '../../lib/constellation/layout';
import type { GraphInputInsight } from '../../lib/constellation/buildGraph';

export interface ClusterSummaryCardProps {
  cluster: ClusterId;
  insights: GraphInputInsight[];
  activeInsightId: string | null;
  // null이면 선택 기능 자체가 없다는 뜻 — WebGL 폴백처럼 별을 밝게 표시할 화면이 없을 때다.
  // 이때는 버튼이 아니라 div로 그려서 스크린리더가 "눌러도 반응 없는 토글"을 안내하지 않게 한다.
  onSelectInsight: ((id: string | null) => void) | null;
  // null이면 재생성 버튼을 숨긴다 (기록이 부족할 때).
  onRegenerate: (() => void) | null;
  regenerating: boolean;
  // null이면 닫기 버튼을 숨긴다 (WebGL 폴백에서 카드가 화면 본문일 때).
  onClose: (() => void) | null;
}

export function ClusterSummaryCard({
  cluster,
  insights,
  activeInsightId,
  onSelectInsight,
  onRegenerate,
  regenerating,
  onClose,
}: ClusterSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[cluster] }}
          />
          <h3 className="text-sm font-semibold text-slate-100">{CLUSTER_LABELS[cluster]}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        )}
      </div>

      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">아직 이 패턴으로 정리된 게 없어요.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {insights.map((insight) => {
            const active = insight.id === activeInsightId;
            const body = (
              <>
                <p className="text-sm text-slate-100">{insight.summary}</p>
                <p className="mt-1 text-xs text-slate-400">
                  근거 기록 {insight.evidence_entry_ids.length}건
                  {active && ' · 근거 별만 밝게 표시 중'}
                </p>
              </>
            );
            return (
              <li key={insight.id}>
                {onSelectInsight ? (
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectInsight(active ? null : insight.id)}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      active ? 'bg-slate-700' : 'bg-slate-800/60 hover:bg-slate-800'
                    }`}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="w-full rounded-lg bg-slate-800/60 p-3 text-left">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="mt-4 rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {regenerating ? '분석 중...' : '다시 분석하기'}
        </button>
      ) : (
        <p className="mt-4 text-xs text-slate-500">기록이 3개 이상 정리되면 다시 분석할 수 있어요.</p>
      )}
    </div>
  );
}
