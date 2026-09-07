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

// SVG 좌표계: 구체 반지름이 50이고, 나선은 그 바깥 50~118까지 풀려 나간다.
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

const SPIRALS = [
  { from: 56, to: 112, turns: 0.85, squash: 0.34, tilt: 8, duration: 54, particle: '#ffd2b0' },
  { from: 62, to: 124, turns: 0.7, squash: 0.5, tilt: -34, duration: 74, particle: '#dfe7ff' },
  { from: 52, to: 100, turns: 1.05, squash: 0.24, tilt: 62, duration: 96, particle: '#f9c2e2' },
];

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
          const path = spiralPath(spiral.from, spiral.to, spiral.turns, spiral.squash);
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
              {/* offset-path로 입자를 길 위에 태운다. cx/cy가 0이어야 경로 좌표가 그대로 위치가 된다.
                  offset-path를 지원하지 않는 브라우저에서는 입자가 가운데(구체 뒤)에 숨는다 —
                  깨져 보이는 대신 조용히 사라지는 쪽이 낫다. */}
              <circle
                cx={0}
                cy={0}
                r={2.4}
                fill={spiral.particle}
                opacity={0.9}
                style={{
                  offsetPath: `path('${path}')`,
                  animation: `echo-orbit-travel ${spiral.duration}s linear infinite`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* 대기광 — 녹음 중에는 숨 쉬듯 밝아졌다 어두워진다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-26%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,146,96,0.32) 0%, rgba(236,80,150,0.2) 38%, rgba(150,70,200,0.12) 62%, rgba(0,0,0,0) 76%)',
          filter: 'blur(8px)',
          opacity: recording ? undefined : 0.75,
          animation: recording ? 'echo-pulse 2.4s ease-in-out infinite' : undefined,
        }}
      />

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className="relative flex h-full w-full items-center justify-center rounded-full text-white backdrop-blur-sm transition-transform duration-200 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-echo-coral focus-visible:ring-offset-4 focus-visible:ring-offset-space-black"
        style={{
          // 반투명이라 뒤의 별과 지구가 은은하게 비친다. 주황(좌상) → 코럴 → 마젠타 → 보라(우하).
          background:
            'radial-gradient(circle at 32% 24%, rgba(255,198,146,0.9) 0%, rgba(255,126,92,0.84) 26%, rgba(234,72,146,0.8) 56%, rgba(150,62,190,0.74) 80%, rgba(74,34,118,0.66) 100%)',
          boxShadow:
            '0 0 0 1px rgba(255,196,168,0.42), 0 0 40px -6px rgba(255,110,140,0.6), inset 0 -12px 28px -14px rgba(30,0,40,0.85)',
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
