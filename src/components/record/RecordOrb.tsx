import type { ReactNode } from 'react';

// 녹음 버튼. 그냥 원형 버튼이 아니라 **작은 행성(에너지 코어)** 처럼 보여야 한다 (레퍼런스 02·03).
//   - 본체: 왼쪽 위에서 빛을 받는 구체 + 바깥 대기광
//   - 둘레: 기울기가 다른 궤도 링 3개가 아주 느리게 돈다
//   - 궤도 위: 아주 작은 빛 입자 몇 개
//
// 궤도와 입자는 하나의 회전하는 컨테이너 안에 있다 — 요소마다 애니메이션을 걸면 합성 레이어가
// 그만큼 늘어난다. 컨테이너 3개만 돌리면 레이어도 3개다.
// prefers-reduced-motion에서는 회전이 멈춘 채 그대로 보인다(§20).

export type OrbState = 'idle' | 'recording' | 'paused' | 'processing';

export interface RecordOrbProps {
  /** 지름 (CSS 길이) */
  size: string;
  state?: OrbState;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  'aria-label': string;
}

// 궤도 3개. 기울기와 주기가 다 달라야 궤도가 하나로 겹쳐 보이지 않는다.
const ORBITS = [
  { inset: -14, tilt: 68, duration: 46, particles: [0, 180] },
  { inset: -26, tilt: -52, duration: 62, particles: [72] },
  { inset: -38, tilt: 22, duration: 84, particles: [140, 300] },
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
      {ORBITS.map((orbit) => (
        <div
          key={orbit.tilt}
          aria-hidden
          className="pointer-events-none absolute rounded-full border"
          style={{
            inset: `${orbit.inset}%`,
            borderColor: 'rgba(180, 190, 235, 0.18)',
            // 원을 기울여 타원처럼 보이게 한다. rotateX가 실제 원근을 만든다.
            transform: `rotateX(${orbit.tilt}deg)`,
            animation: `echo-orbit ${orbit.duration}s linear infinite`,
            transformStyle: 'preserve-3d',
          }}
        >
          {orbit.particles.map((angle) => (
            <span
              key={angle}
              className="absolute block h-1.5 w-1.5 rounded-full"
              style={{
                top: '50%',
                left: '50%',
                background: '#dfe7ff',
                boxShadow: '0 0 8px 2px rgba(180, 200, 255, 0.65)',
                transform: `rotate(${angle}deg) translateX(calc(${size} * 0.5 * ${1 - orbit.inset / 50})) translate(-50%, -50%)`,
              }}
            />
          ))}
        </div>
      ))}

      {/* 대기광 — 녹음 중에는 숨 쉬듯 밝아졌다 어두워진다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[-18%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(255,138,110,0.34) 0%, rgba(241,74,180,0.16) 42%, rgba(0,0,0,0) 70%)',
          filter: 'blur(6px)',
          opacity: recording ? undefined : 0.6,
          animation: recording ? 'echo-pulse 2.4s ease-in-out infinite' : undefined,
        }}
      />

      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className="relative flex h-full w-full items-center justify-center rounded-full text-white transition-transform duration-200 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-echo-coral focus-visible:ring-offset-4 focus-visible:ring-offset-space-black"
        style={{
          background:
            'radial-gradient(circle at 34% 26%, #ffb28a 0%, #ff7a63 32%, #d8467f 62%, #6b2560 88%, #2a1030 100%)',
          boxShadow:
            '0 0 0 1px rgba(255,190,160,0.45), 0 0 34px -4px rgba(255,120,120,0.55), inset 0 -10px 24px -12px rgba(0,0,0,0.8)',
        }}
      >
        {icon}
      </button>
    </div>
  );
}
