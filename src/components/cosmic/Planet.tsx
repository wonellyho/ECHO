// 천체. 각 화면의 "hero celestial object"를 맡는다.
//
// 앞선 시도가 실패한 이유는 크기와 밝기였다. 지름 34~120px에 opacity 0.3~0.5짜리 원은
// 행성이 아니라 구석의 얼룩으로 읽힌다. 레퍼런스의 행성은 **화면 밖으로 잘려 나갈 만큼 크고**,
// 빛을 받는 가장자리(limb)가 또렷하게 빛난다. 그 두 가지가 "행성"으로 읽히게 만드는 전부다.

export interface PlanetProps {
  /** 중심의 화면 대비 위치(%). 화면 밖(음수/100 초과)이어도 된다 — 잘린 가장자리가 목적이다. */
  x: number;
  y: number;
  /** 지름 (CSS 길이) */
  size: string;
  /** 빛이 오는 방향 */
  lightFrom?: 'top-left' | 'top-right' | 'bottom-left';
  opacity?: number;
  /** 대기 rim light 색 */
  rim?: string;
  /** 표면 톤 */
  tone?: 'rock' | 'ice' | 'earth';
}

const TONES = {
  // 달·암석형 위성
  rock: ['#c6cddd', '#8d95ad', '#474f68', '#171b28'],
  // 푸른 얼음 행성
  ice: ['#cfe0f2', '#8fb0cf', '#3f5a7c', '#101a2a'],
  // 밤면에 도시 불빛이 있는 지구형
  earth: ['#a9c4e2', '#5f7fa8', '#26405f', '#080f1c'],
} as const;

export function Planet({
  x,
  y,
  size,
  lightFrom = 'top-left',
  opacity = 0.9,
  rim = 'rgba(190, 214, 255, 0.75)',
  tone = 'rock',
}: PlanetProps) {
  const [c0, c1, c2, c3] = TONES[tone];
  const light =
    lightFrom === 'top-left' ? '30% 26%' : lightFrom === 'top-right' ? '70% 26%' : '30% 74%';
  // rim light는 빛이 오는 쪽 가장자리를 따라 얇게 걸린다.
  const rimAngle = lightFrom === 'top-right' ? '225deg' : lightFrom === 'bottom-left' ? '45deg' : '135deg';

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
        opacity,
      }}
    >
      {/* 본체 — 빛을 받는 면에서 그림자면(terminator)까지 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at ${light}, ${c0} 0%, ${c1} 26%, ${c2} 54%, ${c3} 78%, #05070f 100%)`,
        }}
      />
      {/* 표면 결 — 아주 옅은 띠 두 줄. 완전히 매끈한 구는 플라스틱처럼 보인다. */}
      <div
        className="absolute inset-0 rounded-full mix-blend-overlay"
        style={{
          background:
            'repeating-linear-gradient(112deg, rgba(255,255,255,0.05) 0 6%, rgba(0,0,0,0.06) 6% 13%)',
          opacity: 0.5,
        }}
      />
      {/* 빛을 받는 가장자리의 얇은 rim — 이게 있어야 구(球)로 읽힌다 */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `linear-gradient(${rimAngle}, ${rim} 0%, rgba(0,0,0,0) 22%)`,
          // 안쪽을 파내 테두리만 남긴다.
          mask: 'radial-gradient(circle, transparent 0 96%, #000 97%)',
          WebkitMask: 'radial-gradient(circle, transparent 0 96%, #000 97%)',
        }}
      />
      {/* 대기광 — 바깥으로 번지는 빛 */}
      <div
        className="absolute rounded-full"
        style={{
          inset: '-6%',
          background: `radial-gradient(circle at ${light}, rgba(0,0,0,0) 62%, ${rim} 82%, rgba(0,0,0,0) 100%)`,
          filter: 'blur(10px)',
          opacity: 0.55,
        }}
      />
    </div>
  );
}

export interface PlanetHorizonProps {
  /** 지평선(행성 윗면)이 화면 아래에서 얼마나 올라오는지 (%) */
  rise?: number;
  /** 지평선 위 대기광 색 */
  rim?: string;
  opacity?: number;
  /** 밤면 도시 불빛을 넣을지 (레퍼런스 01·02·07의 아래쪽 행성) */
  cityLights?: boolean;
}

/**
 * 화면 아래를 가로지르는 거대한 행성의 가장자리. 원의 대부분은 화면 밖에 있고,
 * 위쪽 테두리의 밝은 호(rim light)와 그 위로 번지는 대기광만 보인다.
 */
export function PlanetHorizon({
  rise = 12,
  rim = 'rgba(255, 186, 120, 0.85)',
  opacity = 1,
  cityLights = true,
}: PlanetHorizonProps) {
  const ellipse = {
    left: '-45%',
    right: '-45%',
    bottom: `${-100 + rise}%`,
    height: '260%',
  } as const;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
      style={{ height: '48%', opacity }}
    >
      {/* 대기광 — 지평선 위로 번지는 빛. 본체보다 먼저 깔아야 뒤에서 올라오는 것처럼 보인다. */}
      <div
        className="absolute inset-x-0"
        style={{
          bottom: `${rise}%`,
          height: '34%',
          background: `radial-gradient(60% 100% at 50% 100%, ${rim} 0%, rgba(0,0,0,0) 74%)`,
          filter: 'blur(26px)',
          opacity: 0.75,
        }}
      />

      {/* 행성 본체 */}
      <div
        className="absolute rounded-[50%]"
        style={{
          ...ellipse,
          background: 'radial-gradient(120% 82% at 50% 0%, #16223f 0%, #0a1124 34%, #04060f 70%)',
        }}
      />

      {/* 밤면의 도시 불빛 — 반복 그라데이션을 곡면 위쪽에만 마스크로 남긴다 */}
      {cityLights && (
        <div
          className="absolute rounded-[50%]"
          style={{
            ...ellipse,
            background:
              'repeating-radial-gradient(circle at 50% 0%, rgba(255,186,120,0.5) 0 1px, rgba(0,0,0,0) 1px 9px), repeating-linear-gradient(74deg, rgba(255,170,110,0.28) 0 2px, rgba(0,0,0,0) 2px 14px)',
            mask: 'radial-gradient(120% 22% at 50% 0%, #000 0%, transparent 100%)',
            WebkitMask: 'radial-gradient(120% 22% at 50% 0%, #000 0%, transparent 100%)',
            opacity: 0.6,
          }}
        />
      )}

      {/* 지평선 위의 얇고 밝은 테두리 */}
      <div
        className="absolute rounded-[50%]"
        style={{
          ...ellipse,
          border: `1.5px solid ${rim}`,
          boxShadow: `0 0 30px 2px ${rim}`,
          filter: 'blur(0.6px)',
        }}
      />
    </div>
  );
}

/** 위성이 도는 궤도선. 내 정보 화면의 조용한 궤도 공간을 만든다 (레퍼런스 08). */
export function OrbitLine({
  x,
  y,
  size,
  angle = -18,
  opacity = 0.22,
}: {
  x: number;
  y: number;
  /** 긴지름 (CSS 길이) */
  size: string;
  angle?: number;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-[50%] border"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: `calc(${size} * 0.34)`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        borderColor: 'rgba(160, 185, 240, 0.5)',
        opacity,
      }}
    />
  );
}
