import type { ReactNode } from 'react';

// 녹음 버튼. 그냥 원형 버튼이 아니라 **작은 행성(에너지 코어)** 처럼 보여야 한다 (레퍼런스 02·03).
//   - 본체: 왼쪽 위에서 빛을 받는 반투명 구체. 주황 → 코럴 → 마젠타 → 보라가 은은하게 섞인다.
//   - 둘레: 동심원이 아니라 **바깥으로 휘어나가는 나선** 3줄이 아주 느리게 돈다.
//   - 나선 끝: 작은 빛 입자
//
// 나선은 SVG path 하나로 그린다. 원을 여러 개 겹치면 아무리 기울여도 동심원으로 읽히는데,
// 아르키메데스 나선(r = a + bθ)은 실제로 바깥으로 풀려 나가므로 궤도처럼 보인다.
//
// 회전은 나선 그룹 3개에만 건다 — 요소마다 애니메이션을 걸면 합성 레이어가 그만큼 늘어난다.
// prefers-reduced-motion에서는 회전이 멈춘 채 그대로 보인다(§20).

export type OrbState = 'idle' | 'recording' | 'paused' | 'processing';

export interface RecordOrbProps {
  /** 구체의 지름 (CSS 길이) */
  size: string;
  state?: OrbState;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label': string;
}

// SVG 좌표계: 구체 반지름이 50이고, 나선은 그 바깥 ORBIT_SHAPE.from~to까지 풀려 나간다.
const ORBIT_BOX = 260;

/** 아르키메데스 나선. 시작 반지름에서 끝 반지름까지 turns 바퀴를 돌며 풀려 나간다. */
function spiralPath(from: number, to: number, turns: number, squash: number): string {
  const steps = 72;
  const total = turns * Math.PI * 2;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * total;
    const r = from + (to - from) * t;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r * squash;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

// 세 궤도를 "같은 모양, 120도씩 돌려 배치"로 통일했다 — 예전엔 궤도마다 from/to/turns/squash가
// 다 달라서(휘어짐 정도, 길이가 제각각) 한쪽으로 쏠려 보였다("궤도가 대칭이 되게" 요청).
// 이제는 모양(from/to/turns/squash)은 세 궤도가 동일하고 tilt만 0/120/240으로 고르게 벌려
// 삼각 대칭(triskelion)을 이룬다. duration·twinkleDuration·particle 색만 살짝 다르게 둬서
// 완전히 기계적으로 똑같아 보이지 않게 한다.
const ORBIT_SHAPE = { from: 58, to: 112, turns: 0.8, squash: 0.4 };
// twinkleDuration을 늘려 깜빡이는 속도 자체도 늦췄다 — 진폭(echo-star-twinkle 키프레임)과
// 속도 둘 다 줄여야 "과하다"는 느낌이 실제로 가라앉는다.
const SPIRALS = [
  { tilt: 0, duration: 62, twinkleDuration: 4.4, twinkleDelay: 0, particle: '#ffd2b0' },
  { tilt: 120, duration: 74, twinkleDuration: 5.2, twinkleDelay: -1, particle: '#dfe7ff' },
  { tilt: 240, duration: 86, twinkleDuration: 3.8, twinkleDelay: -1.8, particle: '#f9c2e2' },
];

// 예전의 오목한 곡선 4갈래는 뭉툭한 물방울/도형처럼 보였다("별모양이 인위적임" 피드백).
// 실제 별처럼 보이려면 얇고 뾰족한 스파이크가 필요해서, 곡선 대신 뾰족한 직선 꼭짓점을
// 번갈아 잇는 **별 모양 다각형**(바깥 꼭짓점=스파이크 끝, 안쪽 꼭짓점=허리)으로 바꿨다 —
// 안쪽 반지름을 바깥의 1/4 정도로 아주 좁게 잡아야 허리가 잘록해지고 끝이 바늘처럼 뾰족해진다.
// 4갈래 별(꼭짓점 8개)이라 ConstellationCanvas의 회절 스파이크 별과도 같은 어휘를 쓴다.
function starPolygonPath(outerR: number, innerR: number, points: number): string {
  const step = Math.PI / points;
  let d = '';
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outerR : innerR;
    // -90도에서 시작해 한 꼭짓점이 정확히 위(궤도 진행 방향과 무관하게 항상 "위")를 향하게 한다.
    const angle = -Math.PI / 2 + i * step;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d.trim()} Z`;
}

const STAR_R = 4.2;
const SPARKLE_PATH = starPolygonPath(STAR_R, STAR_R * 0.26, 4);
// 별 뒤에 까는 아주 옅고 부드러운 후광 — 뾰족한 다각형만 있으면 종이를 오려 붙인 것처럼
// 납작해 보인다. 흐린 원 하나를 겹치면 실제 별빛이 번지는 느낌이 난다.
const GLOW_R = STAR_R * 2.2;

export function RecordOrb({
  size,
  state = 'idle',
  icon,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: RecordOrbProps) {
  const recording = state === 'recording';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* 나선 궤도 — 구체보다 훨씬 넓게 퍼지므로 별도 박스에 담아 가운데 정렬한다. */}
      <svg
        aria-hidden
        viewBox={`${-ORBIT_BOX / 2} ${-ORBIT_BOX / 2} ${ORBIT_BOX} ${ORBIT_BOX}`}
        className="pointer-events-none absolute"
        style={{ width: `calc(${size} * 2.6)`, height: `calc(${size} * 2.6)`, overflow: 'visible' }}
      >
        {SPIRALS.map((spiral) => {
          const path = spiralPath(ORBIT_SHAPE.from, ORBIT_SHAPE.to, ORBIT_SHAPE.turns, ORBIT_SHAPE.squash);
          return (
            // 궤도 자체는 **돌지 않는다.** 기울어진 궤도면을 통째로 회전시키면 궤도가 접시처럼
            // 흔들려 어지럽다. 실제 궤도처럼 길은 고정하고 그 위를 입자만 지나간다.
            <g key={spiral.tilt} transform={`rotate(${spiral.tilt})`}>
              <path
                d={path}
                fill="none"
                stroke="rgba(196, 206, 246, 0.26)"
                strokeWidth={1}
                strokeLinecap="round"
              />
              {/* offset-path로 별을 길 위에 태운다. 별 자체의 중심이 (0,0)이라 경로 좌표가
                  그대로 위치가 된다. transformBox: fill-box로 별 자신의 중심을 기준 삼아야
                  twinkle의 scale이 엉뚱한 곳을 축으로 커지지 않는다.
                  offset-path를 지원하지 않는 브라우저에서는 별이 가운데(구체 뒤)에 숨는다 —
                  깨져 보이는 대신 조용히 사라지는 쪽이 낫다.
                  후광(blur)과 뾰족한 별 다각형을 별개 요소로 겹친다 — 같은 path 문자열로
                  offset-path를 줘서 완전히 같은 자리를 함께 움직인다. */}
              <circle
                cx={0}
                cy={0}
                r={GLOW_R}
                fill={spiral.particle}
                opacity={0.35}
                style={{
                  filter: 'blur(2px)',
                  offsetPath: `path('${path}')`,
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `echo-orbit-travel ${spiral.duration}s linear infinite, echo-star-twinkle ${spiral.twinkleDuration}s ease-in-out infinite`,
                  animationDelay: `0s, ${spiral.twinkleDelay}s`,
                }}
              />
              <path
                d={SPARKLE_PATH}
                fill={spiral.particle}
                style={{
                  offsetPath: `path('${path}')`,
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: `echo-orbit-travel ${spiral.duration}s linear infinite, echo-star-twinkle ${spiral.twinkleDuration}s ease-in-out infinite`,
                  animationDelay: `0s, ${spiral.twinkleDelay}s`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* 대기광 — 녹음 중에는 숨 쉬듯 밝아졌다 어두워진다. "블러 다 없애 달라"는 요청으로
          filter: blur를 뺐다 — 그라디언트 스톱 자체가 이미 부드럽게 퍼지므로 blur 없이도
          흐릿한 빛 번짐으로 읽힌다. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-26%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,146,96,0.32) 0%, rgba(236,80,150,0.2) 38%, rgba(150,70,200,0.12) 62%, rgba(0,0,0,0) 76%)',
          opacity: recording ? undefined : 0.75,
          animation: recording ? 'echo-pulse 2.4s ease-in-out infinite' : undefined,
        }}
      />

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        // backdrop-blur를 뺐다 — 뒤 배경(별·지구)이 그대로 비쳐야 한다는 요청.
        className="relative flex h-full w-full items-center justify-center rounded-full text-white transition-transform duration-200 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-echo-coral focus-visible:ring-offset-4 focus-visible:ring-offset-space-black"
        style={{
          // 뒤 배경이 너무 비쳐 눌러야 활성화될 것처럼(=비활성 버튼처럼) 보인다는 피드백으로
          // 알파를 다시 끌어올렸다. 주황(좌상) → 코럴 → 마젠타 → 보라(우하) 흐름은 그대로 유지.
          background:
            'radial-gradient(circle at 32% 24%, rgba(255,204,156,0.86) 0%, rgba(255,128,94,0.82) 26%, rgba(234,74,148,0.8) 56%, rgba(150,64,192,0.78) 80%, rgba(74,36,120,0.74) 100%)',
          boxShadow:
            '0 0 0 1px rgba(255,196,168,0.4), 0 0 40px -8px rgba(255,110,140,0.55), inset 0 -12px 28px -14px rgba(30,0,40,0.55)',
        }}
      >
        {/* 좌상단 하이라이트 — 구(球)로 읽히게 하는 마지막 한 겹 */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 42%)',
          }}
        />
        <span className="relative">{icon}</span>
      </button>
    </div>
  );
}
