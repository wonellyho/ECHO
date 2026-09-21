// 커서 위치에서 녹음을 이어갈 때 조각들을 이어붙이는 순수 함수들 (useSpeechInput.ts에서 사용).
//
// "커서 앞부분(prefix) + 새로 인식된 말(recognized) + 커서 뒤에 남아있던 부분(suffix)"을
// 하나로 합친다. 각 경계마다 공백이 이미 있으면 더 넣지 않는다 — 안 그러면 일시정지→이어
// 녹음을 반복할 때마다 공백이 계속 쌓인다.

function needsSpace(a: string, b: string): boolean {
  if (!a || !b) return false;
  return !/\s$/.test(a) && !/^\s/.test(b);
}

export function joinWithSpace(a: string, b: string): string {
  return needsSpace(a, b) ? `${a} ${b}` : `${a}${b}`;
}

export function mergeAtCursor(prefix: string, recognized: string, suffix: string): string {
  return joinWithSpace(joinWithSpace(prefix, recognized), suffix);
}
