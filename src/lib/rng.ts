// 결정적 난수. 우주 배경의 별 배치와 경험 별자리 좌표가 함께 쓴다.
//
// Math.random()을 쓰지 않는 게 핵심이다. 새로고침할 때마다 하늘이 다시 그려지면
// "저 자리 저 별"이라는 공간 기억이 성립하지 않는다 (PRD §8 회상 가능성).
// 배경 별도 마찬가지다 — 화면을 오갈 때마다 별이 재배치되면 같은 화면으로 돌아왔다는
// 느낌 자체가 사라진다.

/** FNV-1a 32비트. 짧고 의존성이 없으며 비슷한 문자열(uuid 앞부분)도 잘 흩어준다. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 — seed 하나에서 서로 독립적인 난수 여러 개를 순서대로 뽑는다.
 * 좌표 여러 축에 같은 해시를 그대로 쓰면 값들이 대각선 위에 줄지어 선다.
 */
export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
