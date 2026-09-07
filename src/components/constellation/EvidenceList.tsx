import { Link } from 'react-router-dom';

// 인사이트 한 줄을 펼쳤을 때 그 아래 붙는 근거 기록들. 경험 탭에서 보던 것과 같은 내용을
// 그대로 보여준다 — 구조화 결과가 있으면 상황/행동/결과/감정, 없으면 녹음·타이핑 원문.
// PRD §7 근거성: 인사이트는 항상 그 근거가 된 원본 기록에 닿을 수 있어야 한다.

export interface EvidenceEntry {
  id: string;
  rawText: string;
  situation: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  status: 'pending' | 'done' | 'failed' | null;
  hasAudio: boolean;
}

export type EvidenceState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: EvidenceEntry[] };

const FIELDS: { key: keyof EvidenceEntry; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
];

export function EvidenceList({ state }: { state: EvidenceState | undefined }) {
  if (state === undefined || state.status === 'loading') {
    return <p className="px-3 pb-3 text-xs text-slate-500">근거 기록을 불러오는 중...</p>;
  }

  if (state.status === 'error') {
    return <p className="px-3 pb-3 text-xs text-red-400">{state.message}</p>;
  }

  if (state.entries.length === 0) {
    return (
      <p className="px-3 pb-3 text-xs text-slate-500">
        근거가 된 기록을 찾지 못했어요. 지워진 기록일 수 있어요.
      </p>
    );
  }

  return (
    <ul className="space-y-2 px-3 pb-3">
      {state.entries.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-700/60 bg-slate-900/70 p-3">
          {entry.status === 'done' ? (
            <dl className="space-y-1.5">
              {FIELDS.filter((field) => entry[field.key]).map((field) => (
                <div key={field.key}>
                  <dt className="text-[11px] text-slate-500">{field.label}</dt>
                  <dd className="text-xs text-slate-200">{String(entry[field.key])}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <>
              <p className="text-xs text-slate-300">{entry.rawText.slice(0, 200)}</p>
              <p className="mt-1 text-[11px] text-slate-500">아직 정리 중이에요.</p>
            </>
          )}

          <div className="mt-2 flex items-center gap-3">
            <Link
              to={`/entries/${entry.id}`}
              className="text-[11px] font-medium text-slate-300 underline underline-offset-2 hover:text-slate-100"
            >
              원본 기록 보기
            </Link>
            {entry.hasAudio && <span className="text-[11px] text-slate-500">녹음 있음</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}
