// 은하수 띠. CSS 그라데이션 3겹을 회전시킨 정지 레이어다 — 움직이지 않으므로 브라우저가
// 합성 결과를 캐시하고, 첫 프레임 이후 비용이 사실상 없다.
//
// 3겹인 이유: 넓고 흐린 겹 → 좁고 밝은 겹 → **어두운 겹**. 마지막 어두운 겹이 실제 은하수의
// 암흑성운(dark lane)처럼 띠를 가로질러 갈라 놓는다. 이게 없으면 그냥 균일한 얼룩으로 보인다.

export interface MilkyWayProps {
  /** 띠의 기울기(deg). 화면마다 다른 방향으로 지나가야 다른 우주 영역처럼 보인다. */
  angle?: number;
  /** 띠 중심의 세로 위치(%). 0=화면 위, 100=화면 아래 */
  offsetY?: number;
  /** 진하기 배수 (0~1) */
  intensity?: number;
  /** lite면 겹 수와 blur 반경을 줄인다 */
  lite?: boolean;
}

const LAYERS = [
  {
    height: '54%',
    top: '0%',
    blur: 46,
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(140,160,230,0.055) 38%, rgba(206,200,240,0.085) 50%, rgba(150,140,215,0.05) 62%, rgba(0,0,0,0) 100%)',
    skipOnLite: false,
  },
  {
    height: '22%',
    top: '16%',
    blur: 26,
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(222,214,250,0.085) 50%, rgba(0,0,0,0) 100%)',
    skipOnLite: false,
  },
  {
    height: '7%',
    top: '22%',
    blur: 20,
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(4,6,15,0.72) 50%, rgba(0,0,0,0) 100%)',
    skipOnLite: true,
  },
];

export function MilkyWay({ angle = -26, offsetY = 30, intensity = 1, lite = false }: MilkyWayProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: '-35%',
        top: `${offsetY - 50}%`,
        width: '170%',
        height: '100%',
        transform: `rotate(${angle}deg)`,
        transformOrigin: 'center',
        opacity: Math.max(0, Math.min(1, intensity)),
      }}
    >
      {LAYERS.filter((layer) => !(lite && layer.skipOnLite)).map((layer) => (
        <div
          key={layer.top + layer.height}
          className="absolute inset-x-0"
          style={{
            top: layer.top,
            height: layer.height,
            background: layer.background,
            // blur 비용은 반경 제곱에 비례한다 — 저사양에서는 반경을 먼저 깎는다.
            filter: `blur(${Math.round(layer.blur * (lite ? 0.6 : 1))}px)`,
          }}
        />
      ))}
    </div>
  );
}
