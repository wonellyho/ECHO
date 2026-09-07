import { useMemo } from 'react';
import { backgroundDetail } from '../../lib/cosmic/starfield';
import type { CloudLayer } from '../../lib/cosmic/clouds';
import { CosmicBackdrop } from './CosmicBackdrop';
import { Starfield } from './Starfield';
import { OrbitLine, Planet, PlanetHorizon } from './Planet';
import { ShootingStars } from './ShootingStars';

// 앱 전체가 하나의 우주를 공유하되, 화면마다 그 우주의 **다른 영역**을 본다.
//
// 레이어 순서 (뒤 → 앞):
//   1 심우주 그라데이션
//   2 구름 캔버스 — 은하수 / 성운 / 먼 은하 / 성단 (정적, 리사이즈 때만 그림)
//   3 별 캔버스 — 반짝임과 시차 (애니메이션)
//   4 유성
//   5 천체 — 행성 / 지평선 / 궤도선 (DOM, 또렷해야 하므로 CSS)
//   6 상단 스크림 — 제목이 앉는 자리만 눌러 가독성 확보
//   7 비네트
//
// **화면마다 hero celestial object가 하나씩 있다.** 그게 없으면 아무리 별을 뿌려도
// "우주를 테마로 한 다크 UI"에서 벗어나지 못한다 (이전 시도의 실패 원인).
//
// 배경을 밝게 올리면서 가독성은 두 장치로 지킨다:
//  - 카드가 이미 어두운 유리(rgba(10,20,40,0.55) + blur)라 그 위 글자는 배경과 무관하다.
//  - 제목처럼 카드 밖에 놓이는 글자 아래에는 상단 스크림을 깐다. 화면 전체를 어둡게 하는
//    대신 **글자가 있는 곳만** 누르는 방식이라, 하늘은 밝은 채로 남는다.

export type SpaceVariant =
  | 'login'
  | 'record-home'
  | 'recording'
  | 'archive'
  | 'detail'
  | 'detail-starwl'
  | 'pattern'
  | 'profile';

interface PlanetSpec {
  x: number;
  y: number;
  size: string;
  lightFrom?: 'top-left' | 'top-right' | 'bottom-left';
  opacity?: number;
  rim?: string;
  tone?: 'rock' | 'ice' | 'earth';
}

interface VariantConfig {
  base: string;
  clouds: CloudLayer[];
  starDensity: number;
  starScale: number;
  parallax: number;
  planets: PlanetSpec[];
  orbits?: { x: number; y: number; size: string; angle?: number }[];
  horizon: { rise: number; rim: string; opacity?: number; cityLights?: boolean } | null;
  shootingStars: number;
  /** 상단 스크림의 세기(0~1)와 높이(%) — 제목이 놓이는 자리만 누른다 */
  topScrim: number;
  vignette: number;
}

const VIOLET = '150, 108, 214';
const BLUE = '96, 130, 226';
const TEAL = '72, 170, 190';
const ROSE = '212, 112, 150';
const AMBER = '224, 158, 96';

const VARIANTS: Record<SpaceVariant, VariantConfig> = {
  // ── 로그인 ── hero: 우측 상단의 큰 행성 가장자리
  // 은하수가 우상단에서 좌하단으로 대각선을 그리고, 화면 아래는 도시 불빛이 있는 지평선.
  login: {
    base: 'radial-gradient(135% 105% at 68% 6%, #1b2448 0%, #0a1128 40%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -58, offsetY: 0.34, thickness: 0.34, density: 1, brightness: 1 },
      { kind: 'nebula', x: 0.74, y: 0.2, radius: 0.34, color: VIOLET, brightness: 1 },
      { kind: 'nebula', x: 0.28, y: 0.52, radius: 0.3, color: BLUE, brightness: 0.75 },
      { kind: 'cluster', x: 0.16, y: 0.24, radius: 0.1, count: 22, brightness: 0.9, link: true },
    ],
    starDensity: 210,
    starScale: 1,
    parallax: 10,
    planets: [
      // 화면 밖으로 절반 이상 잘려 나가는 크기 — 이게 hero다
      { x: 96, y: 8, size: 'min(62vw, 320px)', lightFrom: 'top-left', tone: 'rock', opacity: 0.95 },
    ],
    horizon: { rise: 11, rim: 'rgba(255, 178, 108, 0.85)' },
    shootingStars: 1,
    topScrim: 0.45,
    vignette: 0.34,
  },

  // ── 기록 홈 ── hero: 대각선 은하수 + 아래쪽 지평선
  'record-home': {
    base: 'radial-gradient(130% 100% at 58% 8%, #182144 0%, #091027 42%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -52, offsetY: 0.24, thickness: 0.32, density: 1, brightness: 1.05 },
      { kind: 'nebula', x: 0.68, y: 0.14, radius: 0.3, color: VIOLET, brightness: 0.9 },
      { kind: 'nebula', x: 0.1, y: 0.46, radius: 0.26, color: TEAL, brightness: 0.6 },
      { kind: 'cluster', x: 0.2, y: 0.66, radius: 0.09, count: 18, brightness: 0.7 },
    ],
    starDensity: 190,
    starScale: 1,
    parallax: 8,
    planets: [
      { x: 88, y: 6, size: 'min(34vw, 170px)', lightFrom: 'top-left', tone: 'rock', opacity: 0.85 },
    ],
    horizon: { rise: 9, rim: 'rgba(255, 182, 116, 0.85)' },
    shootingStars: 1,
    topScrim: 0.45,
    vignette: 0.32,
  },

  // ── 녹음 ── hero: 화면 전체를 채우는 cinematic 우주
  // 앱에서 가장 풍부한 장면 — 은하수·성운 3개·행성·성단이 함께 있다.
  recording: {
    base: 'radial-gradient(140% 110% at 52% 2%, #202a58 0%, #0b1230 40%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -46, offsetY: 0.2, thickness: 0.4, density: 1.25, brightness: 1.2 },
      { kind: 'nebula', x: 0.78, y: 0.12, radius: 0.4, color: VIOLET, brightness: 1.1 },
      { kind: 'nebula', x: 0.16, y: 0.36, radius: 0.34, color: BLUE, brightness: 0.95 },
      { kind: 'nebula', x: 0.52, y: 0.78, radius: 0.34, color: TEAL, brightness: 0.7 },
      { kind: 'cluster', x: 0.24, y: 0.14, radius: 0.11, count: 24, brightness: 1, link: true },
      { kind: 'galaxy', x: 0.12, y: 0.7, size: 0.07, angle: 24, brightness: 0.8 },
    ],
    starDensity: 280,
    starScale: 1.05,
    parallax: 6,
    planets: [
      { x: 94, y: 66, size: 'min(52vw, 260px)', lightFrom: 'top-left', tone: 'ice', opacity: 0.8 },
    ],
    horizon: null,
    shootingStars: 2,
    topScrim: 0.4,
    vignette: 0.4,
  },

  // ── 내 경험 ── 카드가 hero이므로 배경은 절제하되, 카드 **뒤로** 성운과 먼지가 비쳐야 한다
  archive: {
    base: 'radial-gradient(125% 105% at 26% 4%, #1a2044 0%, #0a1026 44%, #03050e 100%)',
    clouds: [
      // 띠를 세로에 가깝게 눕혀 카드 뒤를 대각선으로 지나가게 한다
      { kind: 'milkyway', angle: 68, offsetY: 0.5, thickness: 0.42, density: 0.85, brightness: 0.85 },
      { kind: 'nebula', x: 0.08, y: 0.32, radius: 0.32, color: VIOLET, brightness: 0.95 },
      { kind: 'nebula', x: 0.92, y: 0.68, radius: 0.3, color: BLUE, brightness: 0.8 },
      { kind: 'cluster', x: 0.78, y: 0.22, radius: 0.09, count: 16, brightness: 0.7 },
    ],
    starDensity: 165,
    starScale: 0.95,
    parallax: 6,
    planets: [
      // 오른쪽 위에서 잘려 들어오는 행성 호(arc)
      { x: 92, y: 2, size: 'min(46vw, 230px)', lightFrom: 'top-right', tone: 'ice', opacity: 0.72 },
    ],
    horizon: null,
    shootingStars: 1,
    topScrim: 0.5,
    vignette: 0.36,
  },

  // ── 상세 · 구조화 ── 읽는 화면. 은하수는 흔적만, 성단은 성기게.
  detail: {
    base: 'radial-gradient(125% 100% at 74% 2%, #161d3c 0%, #090f24 46%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -22, offsetY: 0.12, thickness: 0.26, density: 0.7, brightness: 0.6 },
      { kind: 'nebula', x: 0.84, y: 0.16, radius: 0.28, color: VIOLET, brightness: 0.6 },
      { kind: 'cluster', x: 0.42, y: 0.1, radius: 0.1, count: 14, brightness: 0.8, link: true },
    ],
    starDensity: 120,
    starScale: 0.9,
    parallax: 4,
    planets: [
      { x: 90, y: 0, size: 'min(40vw, 200px)', lightFrom: 'top-right', tone: 'rock', opacity: 0.6 },
    ],
    horizon: null,
    shootingStars: 0,
    topScrim: 0.5,
    vignette: 0.4,
  },

  // ── 상세 · STARWL ── 구조화보다 조금 더 대기감 있게. 상단에 은하수 띠.
  'detail-starwl': {
    base: 'radial-gradient(130% 100% at 60% 0%, #1a2247 0%, #0a1128 44%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -30, offsetY: 0.14, thickness: 0.32, density: 0.95, brightness: 0.9 },
      { kind: 'nebula', x: 0.76, y: 0.1, radius: 0.3, color: VIOLET, brightness: 0.85 },
      { kind: 'nebula', x: 0.2, y: 0.86, radius: 0.28, color: AMBER, brightness: 0.45 },
      { kind: 'cluster', x: 0.5, y: 0.08, radius: 0.11, count: 16, brightness: 0.85, link: true },
    ],
    starDensity: 150,
    starScale: 0.92,
    parallax: 4,
    planets: [],
    horizon: { rise: 4, rim: 'rgba(255, 178, 112, 0.6)', opacity: 0.75 },
    shootingStars: 1,
    topScrim: 0.5,
    vignette: 0.4,
  },

  // ── 패턴 ── 가장 우주적으로 보여도 되는 화면.
  // 별자리(3D)가 hero지만, 그 뒤에 먼 은하와 성운 무리가 깔려 광역 우주로 읽혀야 한다.
  pattern: {
    base: 'radial-gradient(140% 110% at 48% 18%, #1b2450 0%, #0a1129 44%, #03050e 100%)',
    clouds: [
      { kind: 'milkyway', angle: -34, offsetY: 0.28, thickness: 0.4, density: 1.15, brightness: 1.15 },
      { kind: 'nebula', x: 0.1, y: 0.56, radius: 0.36, color: BLUE, brightness: 1 },
      { kind: 'nebula', x: 0.88, y: 0.6, radius: 0.32, color: TEAL, brightness: 0.85 },
      { kind: 'nebula', x: 0.56, y: 0.1, radius: 0.32, color: VIOLET, brightness: 0.95 },
      { kind: 'nebula', x: 0.3, y: 0.86, radius: 0.28, color: ROSE, brightness: 0.5 },
      // 먼 은하 — 레퍼런스 07 우상단의 나선은하
      { kind: 'galaxy', x: 0.87, y: 0.19, size: 0.09, angle: -18, brightness: 1 },
    ],
    starDensity: 200,
    starScale: 0.92,
    // 3D 별자리가 자체 시차를 만든다 — 배경까지 따라 움직이면 어지럽다
    parallax: 0,
    planets: [
      { x: 8, y: 27, size: 'min(20vw, 96px)', lightFrom: 'top-right', tone: 'rock', opacity: 0.55 },
      { x: 97, y: 46, size: 'min(26vw, 130px)', lightFrom: 'top-left', tone: 'ice', opacity: 0.5 },
    ],
    horizon: { rise: 6, rim: 'rgba(255, 176, 112, 0.7)', opacity: 0.9 },
    shootingStars: 2,
    topScrim: 0.55,
    vignette: 0.34,
  },

  // ── 내 정보 ── 가장 조용한 화면. hero는 우측 상단의 아주 큰 행성 가장자리.
  // 은하수는 없고, 좌하단에 작은 위성과 궤도선만 둔다.
  profile: {
    base: 'radial-gradient(125% 105% at 82% -4%, #141c40 0%, #080e22 46%, #03050e 100%)',
    clouds: [
      { kind: 'nebula', x: 0.86, y: 0.06, radius: 0.34, color: ROSE, brightness: 0.55 },
      { kind: 'nebula', x: 0.14, y: 0.78, radius: 0.28, color: BLUE, brightness: 0.5 },
      { kind: 'cluster', x: 0.32, y: 0.3, radius: 0.1, count: 14, brightness: 0.6 },
    ],
    starDensity: 135,
    starScale: 0.95,
    parallax: 5,
    planets: [
      // 화면 밖으로 크게 잘려 나가는 행성 — 이 화면의 hero
      { x: 104, y: -8, size: 'min(96vw, 480px)', lightFrom: 'bottom-left', tone: 'earth', opacity: 0.9, rim: 'rgba(255, 190, 140, 0.8)' },
      { x: 10, y: 84, size: 'min(22vw, 100px)', lightFrom: 'top-right', tone: 'rock', opacity: 0.7 },
    ],
    orbits: [{ x: 10, y: 84, size: 'min(70vw, 320px)', angle: -16 }],
    horizon: null,
    shootingStars: 1,
    topScrim: 0.4,
    vignette: 0.3,
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
  const { reducedMotion, lite } = useMemo(
    () => ({
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      lite:
        backgroundDetail({
          cores: navigator.hardwareConcurrency,
          minViewport: Math.min(window.innerWidth, window.innerHeight),
        }) === 'lite',
    }),
    [],
  );

  // 저사양 기기에서는 구름의 도형 개수를 줄인다. 구름은 정적이라 매 프레임 비용은 없지만,
  // 첫 그리기(리사이즈 포함)에서 수백 개의 그라디언트를 채우는 비용은 그대로 든다.
  const clouds = useMemo(
    () =>
      lite
        ? config.clouds.map((layer) =>
            layer.kind === 'milkyway'
              ? { ...layer, density: layer.density * 0.5 }
              : layer.kind === 'nebula'
                ? { ...layer, density: (layer.density ?? 1) * 0.55 }
                : layer,
          )
        : config.clouds,
    [config.clouds, lite],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ background: config.base }} />

      <CosmicBackdrop layers={clouds} seed={variant} />

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

      {config.orbits?.map((orbit) => <OrbitLine key={`${orbit.x}-${orbit.y}`} {...orbit} />)}

      {config.horizon && <PlanetHorizon {...config.horizon} />}

      {/* 상단 스크림 — 화면 전체를 어둡게 하는 대신 제목이 놓이는 자리만 누른다.
          하늘은 밝은 채로 두면서 카드 밖 텍스트의 대비를 확보하는 게 목적이다. */}
      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: '42%',
          background: `linear-gradient(to bottom, rgba(2,4,13,${config.topScrim}) 0%, rgba(2,4,13,${config.topScrim * 0.5}) 46%, rgba(2,4,13,0) 100%)`,
        }}
      />

      {/* 비네트 — 이전보다 훨씬 약하다. 예전엔 천체를 전부 가장자리에 두고 그걸 다시 눌러 지웠다. */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(130% 90% at 50% 45%, rgba(0,0,0,0) 56%, rgba(2,4,13,${config.vignette}) 100%)`,
        }}
      />

      {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(2,4,13,${dim})` }} />}
    </div>
  );
}
