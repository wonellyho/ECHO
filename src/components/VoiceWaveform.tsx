import { memo } from 'react';
import { smoothPath } from '../lib/smoothPath';

// 마이크 볼륨(0~1)의 최근 이력을 부드러운 곡선 파형으로 표시한다. 실제 오디오 레벨 기반(useMicLevel)이며
// 장식용 고정 애니메이션이 아니다. history는 useMicLevel이 이미 정해진 길이로 관리해 넘겨준다.
//
// 같은 history를 진폭 배율과 시간 지연만 달리해 3겹으로 겹쳐 그린다 (design.md 녹화화면 절 참고).
// 겹쳐도 세 겹 전부 같은 실제 음량에서 나오므로 "실제 음량 반영"이라는 원칙은 유지된다.
const LAYERS = [
  { amplitude: 1, delay: 0, className: 'fill-white/60' },
  { amplitude: 0.7, delay: 2, className: 'fill-white/40' },
  { amplitude: 0.45, delay: 4, className: 'fill-white/25' },
];

// history는 매 애니메이션 프레임 새 배열로 교체되므로 참조 비교만으로 충분하다.
// 부모(RecordPage)가 타이머 등 다른 이유로 리렌더될 때 곡선을 다시 계산하지 않도록 memo로 감싼다.
export const VoiceWaveform = memo(function VoiceWaveform({ history }: { history: number[] }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full" aria-hidden="true">
      {LAYERS.map((layer) => {
        // 인덱스가 클수록 최신 표본이다. 오래된 쪽으로 clamp해서 지연시키면 뒤 레이어가 앞
        // 레이어를 따라오는 잔향처럼 보인다 — 나머지 연산으로 감으면 가장 오래된 표본이
        // 최신 쪽 끝에 붙어 오른쪽 가장자리가 튀어버린다.
        const values = history.map(
          (_, index) => history[Math.max(0, index - layer.delay)] * layer.amplitude,
        );
        const d = smoothPath(values);
        if (!d) return null;
        // 곡선 아래를 채우기 위해 우하단 → 좌하단으로 닫는다.
        return <path key={layer.delay} d={`${d} L 100 100 L 0 100 Z`} className={layer.className} />;
      })}
    </svg>
  );
});
