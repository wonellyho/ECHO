import { useMemo } from 'react';
import { Starfield } from './Starfield';
import { MilkyWay } from './MilkyWay';
import { Nebula, type NebulaBlob } from './Nebula';
import { Planet, PlanetHorizon } from './Planet';
import { ShootingStars } from './ShootingStars';

// 앱 전체가 하나의 우주를 공유하되, 화면마다 그 우주의 다른 영역을 본다.
// 색은 통일하고 은하수 방향 / 성운 위치 / 별 밀도 / 천체 배치만 바꾼다.
//
// 레이어 순서 (뒤 → 앞):
//   1 심우주 그라데이션  2 은하수  3 성운·먼지  4 별(캔버스)  5 천체  6 지평선  7 비네트
// 화면 콘텐츠는 이 전체 위에 얹힌다.
//
// **원칙: 배경보다 위젯이 우선이다.** 어느 레이어도 불투명도가 0.2를 넘지 않고, 비네트가
// 가장자리를 눌러 카드·텍스트가 항상 먼저 읽히게 한다.

export type SpaceVariant =
  | 'login'
  | 'record-home'
  | 'recording'
  | 'archive'
  | 'detail'
  | 'pattern'
  | 'profile';

interface VariantConfig {
  /** 심우주 그라데이션 */
  base: string;
  starDensity: number;
  starScale: number;
  parallax: number;
  milkyWay: { angle: number; offsetY: number; intensity: number } | null;
  nebula: NebulaBlob[];
  nebulaIntensity: number;
  planets: { x: number; y: number; size: string; lightFrom?: 'top-left' | 'top-right'; opacity?: number }[];
  horizon: { rise: number; rim: string; opacity?: number } | null;
  shootingStars: number;
  vignette: number;
}

const BLUE = 'rgba(96,116,220,0.20)';
const TEAL = 'rgba(64,150,168,0.16)';
const VIOLET = 'rgba(140,96,200,0.17)';
const CORAL = 'rgba(220,110,120,0.13)';

const VARIANTS: Record<SpaceVariant, VariantConfig> = {
  // 먼 우주를 처음 바라보는 느낌. 은하수가 오른쪽 위에서 대각선으로 흐르고, 화면 아래는
  // 도시 불빛이 있는 행성의 지평선이 받쳐준다 (레퍼런스 01).
  login: {
    base: 'radial-gradient(130% 100% at 66% 8%, #17203f 0%, #090f24 42%, #03050e 100%)',
    starDensity: 210,
    starScale: 1,
    parallax: 10,
    milkyWay: { angle: -34, offsetY: 26, intensity: 1 },
    nebula: [
      { x: 72, y: 20, size: 58, color: VIOLET, duration: 52, delay: 0 },
      { x: 18, y: 46, size: 46, color: BLUE, duration: 64, delay: -22 },
    ],
    nebulaIntensity: 0.9,
    planets: [{ x: 88, y: 9, size: 'clamp(64px, 15vmin, 120px)', lightFrom: 'top-left', opacity: 0.5 }],
    horizon: { rise: 10, rim: 'rgba(255,178,110,0.5)' },
    shootingStars: 1,
    vignette: 0.5,
  },

  // 지평선과 은하수가 보이는 비교적 열린 공간 (레퍼런스 02).
  'record-home': {
    base: 'radial-gradient(125% 95% at 60% 12%, #141c39 0%, #080e21 45%, #03050e 100%)',
    starDensity: 175,
    starScale: 1,
    parallax: 8,
    milkyWay: { angle: -38, offsetY: 20, intensity: 0.95 },
    nebula: [
      { x: 66, y: 14, size: 52, color: VIOLET, duration: 58, delay: -8 },
      { x: 14, y: 62, size: 44, color: BLUE, duration: 70, delay: -30 },
    ],
    nebulaIntensity: 0.85,
    planets: [{ x: 86, y: 7, size: 'clamp(52px, 12vmin, 96px)', lightFrom: 'top-left', opacity: 0.42 }],
    horizon: { rise: 8, rim: 'rgba(255,182,116,0.5)' },
    shootingStars: 1,
    vignette: 0.45,
  },

  // 가장 몰입감 있는 공간. 별이 가장 촘촘하고 성운도 가장 넓다 (레퍼런스 03).
  // 다만 UI 뒤는 충분히 어두워야 하므로 비네트를 가장 강하게 준다.
  recording: {
    base: 'radial-gradient(135% 105% at 55% 5%, #1a2145 0%, #0a1026 44%, #03050e 100%)',
    starDensity: 260,
    starScale: 1.05,
    parallax: 6,
    milkyWay: { angle: -44, offsetY: 16, intensity: 1 },
    nebula: [
      { x: 74, y: 10, size: 62, color: VIOLET, duration: 56, delay: 0 },
      { x: 20, y: 40, size: 52, color: BLUE, duration: 68, delay: -20 },
      { x: 50, y: 74, size: 46, color: TEAL, duration: 74, delay: -40 },
    ],
    nebulaIntensity: 1,
    planets: [{ x: 92, y: 62, size: 'clamp(90px, 22vmin, 170px)', lightFrom: 'top-left', opacity: 0.34 }],
    horizon: null,
    shootingStars: 2,
    vignette: 0.62,
  },

  // 기록들이 떠 있는 archive galaxy. 카드가 주인공이므로 별은 성기게, 성운은 가장자리로
  // 밀어 카드 뒤가 비도록 한다 (레퍼런스 04).
  archive: {
    base: 'radial-gradient(120% 100% at 30% 6%, #151a35 0%, #090e20 46%, #03050e 100%)',
    starDensity: 150,
    starScale: 0.95,
    parallax: 6,
    milkyWay: { angle: 62, offsetY: 44, intensity: 0.6 },
    nebula: [
      { x: 6, y: 34, size: 50, color: VIOLET, duration: 66, delay: 0 },
      { x: 96, y: 70, size: 46, color: BLUE, duration: 78, delay: -26 },
    ],
    nebulaIntensity: 0.8,
    planets: [{ x: 90, y: 5, size: 'clamp(70px, 17vmin, 130px)', lightFrom: 'top-right', opacity: 0.38 }],
    horizon: null,
    shootingStars: 1,
    vignette: 0.5,
  },

  // 하나의 별을 가까이 관측하는 공간. 정보를 읽는 화면이라 별 밀도를 가장 낮춘다
  // (레퍼런스 05·06).
  detail: {
    base: 'radial-gradient(120% 95% at 72% 4%, #121936 0%, #080d1f 48%, #03050e 100%)',
    starDensity: 95,
    starScale: 0.9,
    parallax: 4,
    milkyWay: { angle: -20, offsetY: 12, intensity: 0.45 },
    nebula: [{ x: 84, y: 16, size: 44, color: VIOLET, duration: 72, delay: 0 }],
    nebulaIntensity: 0.6,
    planets: [{ x: 84, y: 2, size: 'clamp(80px, 20vmin, 150px)', lightFrom: 'top-right', opacity: 0.3 }],
    horizon: null,
    shootingStars: 0,
    vignette: 0.55,
  },

  // 여러 성단과 별자리를 멀리서 보는 광역 우주. 별자리 자체가 주인공이므로 배경 별은
  // 오히려 절제하고 성운으로 깊이만 만든다 (레퍼런스 07).
  pattern: {
    base: 'radial-gradient(130% 100% at 50% 22%, #141b38 0%, #090f22 46%, #03050e 100%)',
    starDensity: 170,
    starScale: 0.9,
    parallax: 0, // 3D 별자리가 자체 시차를 만든다 — 배경까지 움직이면 어지럽다
    milkyWay: { angle: -30, offsetY: 24, intensity: 0.85 },
    nebula: [
      { x: 12, y: 58, size: 56, color: BLUE, duration: 62, delay: 0 },
      { x: 84, y: 62, size: 50, color: TEAL, duration: 74, delay: -18 },
      { x: 54, y: 12, size: 46, color: VIOLET, duration: 68, delay: -34 },
    ],
    nebulaIntensity: 0.9,
    planets: [{ x: 90, y: 12, size: 'clamp(34px, 7vmin, 58px)', lightFrom: 'top-left', opacity: 0.34 }],
    horizon: { rise: 5, rim: 'rgba(255,176,112,0.4)', opacity: 0.8 },
    shootingStars: 1,
    vignette: 0.5,
  },

  // 조용하고 안정적인 궤도. 은하수는 거의 없고, 오른쪽 위 행성 가장자리와 아래쪽 작은
  // 위성만 남긴다 (레퍼런스 08).
  profile: {
    base: 'radial-gradient(120% 100% at 78% 0%, #101736 0%, #070c1e 48%, #03050e 100%)',
    starDensity: 120,
    starScale: 0.95,
    parallax: 5,
    milkyWay: null,
    nebula: [{ x: 88, y: 6, size: 48, color: CORAL, duration: 80, delay: 0 }],
    nebulaIntensity: 0.5,
    planets: [
      { x: 96, y: -4, size: 'clamp(150px, 40vmin, 300px)', lightFrom: 'top-left', opacity: 0.4 },
      { x: 10, y: 84, size: 'clamp(38px, 9vmin, 70px)', lightFrom: 'top-right', opacity: 0.3 },
    ],
    horizon: null,
    shootingStars: 1,
    vignette: 0.45,
  },
};

export interface SpaceSceneProps {
  variant: SpaceVariant;
  /** 배경을 통째로 흐리게 (모달 위 등). 0~1 */
  dim?: number;
}

export function SpaceScene({ variant, dim = 0 }: SpaceSceneProps) {
  const config = VARIANTS[variant];

  // matchMedia와 hardwareConcurrency는 렌더마다 읽을 이유가 없다.
  const { reducedMotion, lite } = useMemo(() => {
    const cores = navigator.hardwareConcurrency;
    return {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      lite: (cores !== undefined && cores <= 4) || window.innerWidth < 480,
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: config.base }} />

      {config.milkyWay && (
        <MilkyWay
          angle={config.milkyWay.angle}
          offsetY={config.milkyWay.offsetY}
          intensity={config.milkyWay.intensity}
          lite={lite}
        />
      )}

      <Nebula
        blobs={config.nebula}
        intensity={config.nebulaIntensity}
        reducedMotion={reducedMotion}
        lite={lite}
      />

      <Starfield
        seed={variant}
        density={config.starDensity}
        scale={config.starScale}
        parallax={config.parallax}
      />

      <ShootingStars count={config.shootingStars} reducedMotion={reducedMotion} />

      {config.planets.map((planet) => (
        <Planet key={`${planet.x}-${planet.y}`} {...planet} />
      ))}

      {config.horizon && <PlanetHorizon {...config.horizon} />}

      {/* 비네트 — 가장자리를 눌러 가운데의 위젯이 먼저 읽히게 한다. 천체와 은하수를 전부
          가장자리에 배치했으므로 이 레이어가 그것들의 밝기 상한 역할도 겸한다. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(125% 85% at 50% 45%, rgba(0,0,0,0) 48%, rgba(2,4,13,${config.vignette}) 100%)`,
        }}
      />

      {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(2,4,13,${dim})` }} />}
    </div>
  );
}
