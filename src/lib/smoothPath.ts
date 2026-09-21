// 0~1 값 배열을 부드러운 SVG 곡선 경로(d 문자열)로 변환한다.
// 좌표계는 viewBox "0 0 100 100" 기준 — x는 0~100에 균등 배치하고, y는 아래(100)를 기준선으로
// 삼아 값이 클수록 위로 솟게 한다(y = 100 - value*100). 즉 좌우 대칭 파형이 아니라
// "기준선에서 위로 솟는 산맥" 형태다 (design.md 녹화화면 절 참고).
//
// 각 구간은 Catmull-Rom 스플라인을 cubic bezier로 변환해 잇는다 — 점을 모두 통과하면서도
// 꺾인 곳 없이 이어지므로, 막대 그래프의 각진 느낌 없이 실제 음량 이력을 그대로 표현할 수 있다.
// 면을 채우려면 호출부에서 뒤에 "L 100 100 L 0 100 Z"를 붙인다.

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function smoothPath(values: number[]): string {
  if (values.length === 0) return '';

  const toY = (value: number) => round(100 - value * 100);

  // 점이 하나뿐이면 곡선을 만들 수 없으므로 그 높이의 수평선으로 폴백한다.
  if (values.length === 1) {
    const y = toY(values[0]);
    return `M 0 ${y} L 100 ${y}`;
  }

  const points = values.map((value, index) => ({
    x: round((index / (values.length - 1)) * 100),
    y: toY(value),
  }));

  // 두 점이면 제어점을 잡을 여지가 없으므로 직선으로 잇는다.
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const at = (index: number) => points[Math.min(points.length - 1, Math.max(0, index))];

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);

    const cp1x = round(p1.x + (p2.x - p0.x) / 6);
    const cp1y = round(p1.y + (p2.y - p0.y) / 6);
    const cp2x = round(p2.x - (p3.x - p1.x) / 6);
    const cp2y = round(p2.y - (p3.y - p1.y) / 6);

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}
