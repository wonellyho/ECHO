import { useMemo } from 'react';
import { backgroundDetail } from '../../lib/constellation/backdrop';

// 별자리 뒤에 깔리는 우주 배경. 일부러 WebGL을 쓰지 않는다 — 그라데이션과 blur만으로 만들면
// 합성(compositing) 단계에서만 처리돼 GPU 비용이 사실상 0이고, WebGL이 없는 기기(폴백 화면)에서도
// 똑같은 분위기를 쓸 수 있다.
//
// 비용의 원천은 별 개수가 아니라 "큰 면적에 걸린 blur 레이어 수"다. 그래서 움직이는 레이어는
// 성운 3장뿐이고(그것도 transform만 바꿔 레이아웃을 재계산시키지 않는다), 은하수·먼지·천체는
// 전부 정지 상태다 — 정지한 blur는 합성 결과가 캐시되므로 첫 프레임 이후 비용이 없다.
//
// 이 배경은 어디까지나 조연이다. 모든 레이어의 불투명도가 0.2를 넘지 않는 이유가 그것 —
// 분석 카드와 경험 별이 항상 먼저 읽혀야 한다.

export interface ExperienceGalaxyBackgroundProps {
  /** 성운/은하수의 진하기 배수. 0이면 어두운 그라데이션만 남는다. */
  glowIntensity?: number;
  /** 모션 최소화. 성운이 흐르지 않고 그 자리에 멈춘다. */
  reducedMotion?: boolean;
  /** 기기 사양 판정을 덮어쓰고 싶을 때만. 기본은 backgroundDetail()이 정한다. */
  detail?: 'full' | 'lite';
}

// 성운 세 덩어리. 화면을 다 덮지 않도록 위치를 벌려 두고, 별자리 군집(위/좌하/우하)과 대략
// 겹치는 자리에 둬서 군집 주변만 은은하게 밝아 보이게 한다.
const NEBULAE = [
  { left: '12%', top: '58%', size: '58vmax', color: 'rgba(96,116,220,0.20)', duration: '46s', delay: '0s' },
  { left: '84%', top: '62%', size: '52vmax', color: 'rgba(64,150,168,0.16)', duration: '58s', delay: '-14s' },
  { left: '52%', top: '10%', size: '46vmax', color: 'rgba(140,96,200,0.16)', duration: '52s', delay: '-28s' },
];

// 은하수 띠를 이루는 겹들. 넓고 흐린 것부터 좁고 조금 밝은 것까지 포개서 "띠"로 읽히게 한다.
// 마지막 한 겹은 어두운 색이다 — 실제 은하수의 암흑성운(dark lane)처럼 띠를 가로질러
// 살짝 갈라 놓아야 균일한 얼룩처럼 보이지 않는다.
const MILKY_WAY_LAYERS = [
  {
    height: '52%',
    top: '4%',
    blur: '46px',
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(140,160,230,0.05) 40%, rgba(198,205,240,0.075) 50%, rgba(140,160,230,0.045) 60%, rgba(0,0,0,0) 100%)',
    liteOnly: false,
  },
  {
    height: '22%',
    top: '19%',
    blur: '26px',
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(214,218,248,0.075) 50%, rgba(0,0,0,0) 100%)',
    liteOnly: false,
  },
  {
    height: '7%',
    top: '25%',
    blur: '20px',
    background:
      'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(6,8,17,0.75) 50%, rgba(0,0,0,0) 100%)',
    liteOnly: true, // lite에서는 생략 (겹 수를 줄이는 게 목적)
  },
];

export function ExperienceGalaxyBackground({
  glowIntensity = 1,
  reducedMotion = false,
  detail,
}: ExperienceGalaxyBackgroundProps) {
  const resolvedDetail = useMemo(
    () =>
      detail ??
      backgroundDetail({
        cores: navigator.hardwareConcurrency,
        minViewport: Math.min(window.innerWidth, window.innerHeight),
        reduceMotion: reducedMotion,
      }),
    [detail, reducedMotion],
  );
  const lite = resolvedDetail === 'lite';
  const glow = Math.max(0, Math.min(1, glowIntensity));

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes echo-nebula-drift {
          0%   { transform: translate(-50%, -50%) scale(1)    translate(0, 0); }
          50%  { transform: translate(-50%, -50%) scale(1.12) translate(2%, -3%); }
          100% { transform: translate(-50%, -50%) scale(1)    translate(0, 0); }
        }
      `}</style>

      {/* 1. 가장 뒤: 완전한 검정 대신 짙은 남색에서 검정으로 떨어지는 그라데이션 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 30%, #131a33 0%, #0a0f21 45%, #05070f 100%)',
        }}
      />

      {/* 2. 은하수 띠 — 화면을 대각선으로 가로지른다. 정지 레이어라 합성 결과가 캐시된다. */}
      <div
        className="absolute"
        style={{
          left: '-30%',
          top: '2%',
          width: '160%',
          height: '96%',
          transform: 'rotate(-26deg)',
          transformOrigin: 'center',
          opacity: glow * (lite ? 0.75 : 1),
        }}
      >
        {MILKY_WAY_LAYERS.filter((layer) => !(lite && layer.liteOnly)).map((layer) => (
          <div
            key={layer.top + layer.height}
            className="absolute inset-x-0"
            style={{
              top: layer.top,
              height: layer.height,
              background: layer.background,
              // lite에서는 blur 반경을 줄인다 — blur 비용은 반경 제곱에 비례한다.
              filter: `blur(${lite ? `${Math.round(parseInt(layer.blur, 10) * 0.6)}px` : layer.blur})`,
            }}
          />
        ))}
      </div>

      {/* 3. 성운/우주 먼지 — 움직이는 유일한 레이어. blur로 뭉개서 경계선이 보이지 않게 한다 */}
      {NEBULAE.map((nebula) => (
        <div
          key={nebula.left + nebula.top}
          className="absolute rounded-full"
          style={{
            left: nebula.left,
            top: nebula.top,
            width: nebula.size,
            height: nebula.size,
            background: `radial-gradient(circle, ${nebula.color} 0%, rgba(0,0,0,0) 68%)`,
            filter: `blur(${lite ? '18px' : '28px'})`,
            opacity: glow,
            transform: 'translate(-50%, -50%)',
            animation: reducedMotion
              ? undefined
              : `echo-nebula-drift ${nebula.duration} ease-in-out ${nebula.delay} infinite`,
            willChange: reducedMotion ? undefined : 'transform',
          }}
        />
      ))}

      {/*
        4. 천체 (1~2개만). 오른쪽 위의 먼 달 — 빛은 왼쪽 위에서 온다.
        크고 또렷하면 별이 아니라 UI 요소(빈 원)처럼 읽힌다. 그래서 작게, 옅게, 가장자리를
        살짝 뭉개고, 바깥 glow로 감싸서 "멀리 있는 천체"로 읽히게 한다.
      */}
      <div
        className="absolute"
        style={{
          right: '11%',
          top: '13%',
          width: 'clamp(18px, 3.4vmin, 30px)',
          height: 'clamp(18px, 3.4vmin, 30px)',
          borderRadius: '9999px',
          background:
            'radial-gradient(circle at 36% 32%, #b8c2da 0%, #8b95b2 44%, #3f4864 72%, #191e2c 100%)',
          boxShadow: '0 0 18px 7px rgba(150,175,230,0.07)',
          filter: 'blur(0.4px)',
          opacity: 0.34,
        }}
      />

      {/* 반대편 가장자리의 먼 은하. lite에서는 이 하나를 생략해 천체를 1개로 줄인다 */}
      {!lite && (
        <div
          className="absolute"
          style={{
            left: '3%',
            top: '46%',
            width: 'clamp(90px, 17vmin, 165px)',
            height: 'clamp(32px, 6vmin, 58px)',
            transform: 'translateY(-50%) rotate(-18deg)',
            background:
              'radial-gradient(ellipse at center, rgba(220,222,250,0.20) 0%, rgba(148,138,208,0.09) 42%, rgba(0,0,0,0) 74%)',
            filter: 'blur(5px)',
            opacity: 0.85,
          }}
        />
      )}

      {/* 5. 맨 앞: 비네트. 가장자리를 눌러 화면 가운데의 별과 카드가 먼저 읽히게 한다.
             은하수·천체가 전부 가장자리에 있으므로 이 레이어가 그것들의 상한 역할도 한다 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62) 100%)',
        }}
      />
    </div>
  );
}
