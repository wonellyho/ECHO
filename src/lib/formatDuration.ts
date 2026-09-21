// 녹음 경과 시간을 "M:SS"로 포맷한다 (예: 6초 → "0:06", 10분 30초 → "10:30").
// 시간 단위(H:MM:SS)는 만들지 않는다 — 녹음 상한은 없지만 실제 사용은 분 단위이고,
// 필요해지면 그때 넓힌다.
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
