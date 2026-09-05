import { Link } from 'react-router-dom';
import { TAG_COLORS } from '../../lib/tagColors';
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
    <div className="absolute inset-x-3 bottom-3 z-20 max-h-[55dvh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[node.cluster] }}
          />
          <h3 className="text-sm font-semibold text-slate-100">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      {node.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {node.tags.map((tag) => (
            <span key={tag} className={`rounded-full px-2 py-0.5 text-xs ${TAG_COLORS[tag]}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {detail === null ? (
        <p className="mt-3 text-sm text-slate-400">불러오는 중...</p>
      ) : ready ? (
        <dl className="mt-3 space-y-2">
          {FIELDS.filter((field) => detail[field.key]).map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-slate-500">{field.label}</dt>
              <dd className="text-sm text-slate-200">{String(detail[field.key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-300">{detail.rawText.slice(0, 160)}</p>
          <p className="mt-2 text-xs text-slate-500">아직 정리 중이에요.</p>
        </>
      )}

      <Link
        to={`/entries/${node.id}`}
        className="mt-4 inline-block rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
      >
        자세히 보기
      </Link>
    </div>
  );
}
