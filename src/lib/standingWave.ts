// 녹화 화면 음량 곡선의 형태를 계산하는 순수 함수들 (VoiceWaveform.tsx에서 사용).
//
// 형태는 Figma `녹화화면` 프레임을 따른다 — 얇은 가로선이 화면을 가로지르고, 그 위로 좁은
// 봉우리들이 솟아오르며, 선 아래로는 희미하게 반사된다. 선 아래를 통째로 채우지 않는다.
//
// 핵심 요구사항은 "흐르지 않고 가운데만 일렁인다"이다. 오디오 편집기처럼 이력을 오른쪽에서
// 왼쪽으로 미는 방식이 아니라, **정상파(standing wave)** 로 만든다 — 각 성분이
// `sin(kx)·cos(ωt)` 꼴이라 공간 모양과 시간 진동이 분리돼 있어, 패턴이 옆으로 이동하지 않고
// 제자리에서 진폭만 오르내린다. (`sin(kx − ωt)` 꼴로 쓰면 진행파가 되어 옆으로 흘러간다.)

/** 봉우리를 이룰 표본점 개수. 좁은 봉우리를 매끄럽게 그리려면 이전보다 촘촘해야 한다. */
export const WAVE_POINTS = 72;
/** 봉우리를 얼마나 뾰족하게 만들지. 클수록 좁고 날카로워진다. */
const SHARPNESS = 1.7;

// 가장자리에서 0, 가운데에서 1이 되는 창 함수. 봉우리가 화면 폭 대부분에 걸치되 양 끝에서는
// 선에 붙도록 완만하게(지수 0.7) 떨어뜨린다 — 지수가 크면 가운데에만 뭉쳐 보인다.
function centerWindow(u: number): number {
  return Math.sin(Math.PI * u) ** 0.7;
}

// 공간 주파수가 다른 정상파 3개의 합. 시간 주파수를 서로 나누어떨어지지 않게 잡아
// 전체 패턴이 규칙적으로 반복되지 않게 한다.
function standingRipple(u: number, seconds: number, phase: number): number {
  const x = u * Math.PI * 2;
  return (
    0.55 * Math.sin(x * 4) * Math.cos(seconds * 0.9 + phase) +
    0.3 * Math.sin(x * 6.5) * Math.cos(seconds * 0.62 + phase * 1.7) +
    0.15 * Math.sin(x * 9) * Math.cos(seconds * 1.27 + phase * 0.6)
  );
}

/**
 * 가로선 위로 솟는 봉우리 높이 배열을 만든다 (0이 선 위, 1이 최대 높이).
 *
 * 정상파의 절댓값을 쓰기 때문에 마디(진폭 0인 지점)가 고정되고, 그 사이에 좁은 봉우리가
 * 생긴다 — 부호를 그대로 쓰면 선 아래로 파고드는 넓은 물결이 되어 Figma 형태와 달라진다.
 *
 * @param drive 전체 진폭 (0이면 봉우리 없이 완전히 평평한 선)
 * @param amplitude 이 겹의 배율
 * @param phase 이 겹의 시간 위상
 */
export function wavePeaks(
  seconds: number,
  drive: number,
  amplitude: number,
  phase: number,
): number[] {
  const peaks = new Array<number>(WAVE_POINTS);
  for (let i = 0; i < WAVE_POINTS; i += 1) {
    const u = i / (WAVE_POINTS - 1);
    const ripple = Math.abs(standingRipple(u, seconds, phase)) ** SHARPNESS;
    peaks[i] = Math.max(0, Math.min(1, drive * amplitude * centerWindow(u) * ripple));
  }
  return peaks;
}
