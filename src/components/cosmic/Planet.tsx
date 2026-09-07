// 천체 두 종류.
//
// Planet — 화면 구석에 걸리는 작은 행성/위성. 크고 또렷하면 천체가 아니라 "빈 원 UI"처럼
//   읽히므로, 가장자리를 살짝 뭉개고 바깥 glow로 감싼다.
// PlanetHorizon — 화면 아래를 가로지르는 거대한 행성의 가장자리(지평선). 레퍼런스의
//   로그인·기록 홈·패턴 화면 아래쪽에 있는 그것. 원의 대부분은 화면 밖에 있고, 위쪽 테두리의
//   밝은 호(rim light)만 보인다.

export interface PlanetProps {
  /** 화면 대비 위치(%) */
  x: number;
  y: number;
  /** 지름 (CSS 길이. 보통 clamp(...)로 준다) */
  size: string;
  /** 빛이 오는 방향 — 화면 안 다른 광원과 어긋나면 붙여 놓은 스티커처럼 보인다 */
  lightFrom?: 'top-left' | 'top-right';
  /** 0~1. 배경은 조연이므로 기본값도 낮게 잡는다 */
  opacity?: number;
  /** 대기 빛 색 */
  glow?: string;
}

export function Planet({
  x,
  y,
  size,
  lightFrom = 'top-left',
  opacity = 0.42,
  glow = 'rgba(150,175,230,0.08)',
}: PlanetProps) {
  const lightPosition = lightFrom === 'top-left' ? '34% 30%' : '66% 30%';
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-full"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        background: `radial-gradient(circle at ${lightPosition}, #c2cbe2 0%, #909bb8 42%, #434c68 70%, #171c2a 100%)`,
        boxShadow: `0 0 26px 8px ${glow}`,
        filter: 'blur(0.4px)',
        opacity,
      }}
    />
  );
}

export interface PlanetHorizonProps {
  /** 지평선(행성 윗면)이 화면 아래에서 얼마나 올라오는지 (%). 클수록 더 많이 보인다. */
  rise?: number;
  /** rim light 색 */
  rim?: string;
  opacity?: number;
}

export function PlanetHorizon({
  rise = 12,
  rim = 'rgba(255,186,120,0.55)',
  opacity = 1,
}: PlanetHorizonProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: '46%', opacity }}>
      {/* 행성 본체 — 화면보다 훨씬 넓은 원이라 위쪽 곡선만 보인다 */}
      <div
        className="absolute rounded-[50%]"
        style={{
          left: '-40%',
          right: '-40%',
          bottom: `${-100 + rise}%`,
          height: '260%',
          background:
            'radial-gradient(120% 80% at 50% 0%, #16203c 0%, #0b1225 38%, #05070f 72%)',
        }}
      />
      {/* rim light — 지평선 위 얇은 빛. 도시 불빛 같은 따뜻한 색이 화면 아래를 받쳐준다 */}
      <div
        className="absolute rounded-[50%]"
        style={{
          left: '-40%',
          right: '-40%',
          bottom: `${-100 + rise}%`,
          height: '260%',
          boxShadow: `0 0 42px 3px ${rim}, inset 0 3px 20px -6px ${rim}`,
          // 테두리만 남기려면 배경은 투명해야 한다.
          border: `1px solid ${rim}`,
          filter: 'blur(1.5px)',
        }}
      />
      {/* 지평선 위로 번지는 대기광 */}
      <div
        className="absolute inset-x-0"
        style={{
          bottom: `${rise + 2}%`,
          height: '30%',
          background: `radial-gradient(70% 100% at 50% 100%, ${rim} 0%, rgba(0,0,0,0) 72%)`,
          filter: 'blur(18px)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}
