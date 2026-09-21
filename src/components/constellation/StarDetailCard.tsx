import { Link } from 'react-router-dom';
import { TagChip } from '../ui/TagChip';
import { ROUTES } from '../../lib/routes';
import { CLUSTER_COLORS } from '../../lib/constellation/layout';
import type { StarNode } from '../../lib/constellation/buildGraph';

export interface StarDetail {
  situation: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  status: 'pending' | 'done' | 'failed' | null;
  rawText: string;
}

export interface StarDetailCardProps {
  node: StarNode;
  detail: StarDetail | null;
  onClose: () => void;
}

const FIELDS: { key: keyof StarDetail; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
];

export function StarDetailCard({ node, detail, onClose }: StarDetailCardProps) {
  const ready = detail?.status === 'done';

  return (
    // 위치·배경·스크롤은 BottomSheet가 갖는다 — 이 컴포넌트는 내용만 그린다.
    <div className="px-4 pb-6 pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[node.cluster] }}
          />
          <h3 className="text-[15px] font-semibold text-ink">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded-full px-2.5 py-1.5 text-ink-dim transition-colors hover:text-ink"
        >
          ✕
        </button>
      </div>

      {/* 상단바와 본문 사이가 너무 좁아 보였다는 피드백으로 간격을 넉넉히 키웠다. */}
      {node.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {node.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      )}

      {detail === null ? (
        <p className={`text-sm text-ink-dim ${node.tags.length > 0 ? 'mt-3' : 'mt-5'}`}>불러오는 중...</p>
      ) : ready ? (
        // 각 항목을 테두리로 감싸 상황/행동/결과/감정이 서로 뚜렷하게 구분되게 하고,
        // 라벨도 흰색(text-ink)으로 올려 눈에 잘 띄게 했다("글씨가 잘 안 보인다" 피드백).
        <dl className={`space-y-2.5 ${node.tags.length > 0 ? 'mt-3' : 'mt-5'}`}>
          {FIELDS.filter((field) => detail[field.key]).map((field) => (
            <div key={field.key} className="rounded-xl border border-hairline p-3">
              <dt className="text-xs font-semibold text-ink">{field.label}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed text-ink">{String(detail[field.key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className={node.tags.length > 0 ? 'mt-3' : 'mt-5'}>
          <p className="text-[15px] leading-relaxed text-ink">{detail.rawText.slice(0, 160)}</p>
          <p className="mt-2 text-xs text-ink-muted">아직 정리 중이에요.</p>
        </div>
      )}

      {/* 우측 하단에 배치("자세히 보기 버튼은 우측하단에" 요청). */}
      <div className="mt-4 flex justify-end">
        <Link
          to={ROUTES.entry(node.entryId)}
          className="inline-flex min-h-[2.75rem] items-center rounded-full px-5 text-xs font-semibold text-white"
          style={{ background: 'var(--echo-gradient)' }}
        >
          자세히 보기
        </Link>
      </div>
    </div>
  );
}
