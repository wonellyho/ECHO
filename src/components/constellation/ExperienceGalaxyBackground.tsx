// 별자리 뒤에 깔리는 우주 배경. 일부러 WebGL을 쓰지 않는다 — 그라데이션과 blur만으로 만들면
// 합성(compositing) 단계에서만 처리돼 GPU 비용이 거의 0이고, WebGL이 없는 기기(폴백 화면)에서도
// 똑같은 분위기를 쓸 수 있다. 움직임은 transform/opacity만 건드려 레이아웃을 재계산시키지 않는다.

export interface ExperienceGalaxyBackgroundProps {
  /** 성운 레이어의 진하기 배수. 0이면 성운 없이 어두운 그라데이션만 남는다. */
  glowIntensity?: number;
  /** 모션 최소화. 성운이 흐르지 않고 그 자리에 멈춘다. */
  reducedMotion?: boolean;
}

// 성운 세 덩어리. 화면을 다 덮지 않도록 위치를 벌려 두고, 별자리 군집(위/좌하/우하)과 대략
// 겹치는 자리에 둬서 군집 주변만 은은하게 밝아 보이게 한다.
const NEBULAE = [
  { left: '12%', top: '58%', size: '58vmax', color: 'rgba(96,116,220,0.20)', duration: '46s', delay: '0s' },
  { left: '84%', top: '62%', size: '52vmax', color: 'rgba(64,150,168,0.16)', duration: '58s', delay: '-14s' },
  { left: '52%', top: '10%', size: '46vmax', color: 'rgba(140,96,200,0.16)', duration: '52s', delay: '-28s' },
];

export function ExperienceGalaxyBackground({
  glowIntensity = 1,
  reducedMotion = false,
}: ExperienceGalaxyBackgroundProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes echo-nebula-drift {
          0%   { transform: translate(-50%, -50%) scale(1)    translate(0, 0); }
          50%  { transform: translate(-50%, -50%) scale(1.12) translate(2%, -3%); }
          100% { transform: translate(-50%, -50%) scale(1)    translate(0, 0); }
        }
      `}</style>

      {/* 가장 뒤: 완전한 검정 대신 짙은 남색에서 검정으로 떨어지는 그라데이션 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 30%, #131a33 0%, #0a0f21 45%, #05070f 100%)',
        }}
      />

      {/* 그 위: 성운/오로라 안개 — blur로 뭉개서 경계선이 보이지 않게 한다 */}
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
            filter: 'blur(28px)',
            opacity: Math.max(0, Math.min(1, glowIntensity)),
            transform: 'translate(-50%, -50%)',
            animation: reducedMotion
              ? undefined
              : `echo-nebula-drift ${nebula.duration} ease-in-out ${nebula.delay} infinite`,
            willChange: reducedMotion ? undefined : 'transform',
          }}
        />
      ))}

      {/* 맨 앞: 아주 옅은 비네트. 가장자리를 눌러 화면 가운데의 별과 카드가 먼저 읽히게 한다 */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(120% 80% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </div>
  );
}
