import { useMemo } from 'react';
import { mulberry32 } from '../../lib/rng';
import { PrimaryCta, SecondaryCta } from './CtaButtons';
import { ctaTargets } from '../../lib/routes';
import { ArrowRightIcon } from '../icons';
import { useReveal, revealClass } from './useReveal';

// 마지막 섹션. 다시 우주를 크게 열어준다.
//
// 배경의 별들은 무작위로 흩뿌린 게 아니라 하나의 별자리처럼 선으로 이어져 있다 — 랜딩이
// 처음에 한 약속("경험을 기록하면 별자리가 만들어집니다")을 마지막에 눈으로 한 번 더 보여준다.

/** 선으로 이어지는 별자리 하나. 좌표는 손으로 잡은 값(%)이다. */
const CONSTELLATION_POINTS = [
  { x: 10, y: 62 },
  { x: 22, y: 40 },
  { x: 34, y: 52 },
  { x: 45, y: 28 },
  { x: 57, y: 46 },
  { x: 68, y: 30 },
  { x: 79, y: 54 },
  { x: 90, y: 38 },
];

function ConstellationBackdrop() {
  const dust = useMemo(() => {
    const random = mulberry32(60606);
    return Array.from({ length: 40 }, () => ({
      left: `${random() * 100}%`,
      top: `${random() * 100}%`,
      size: 0.8 + random() * 1.4,
      opacity: 0.12 + random() * 0.3,
    }));
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dust.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ left: star.left, top: star.top, width: star.size, height: star.size, opacity: star.opacity }}
        />
      ))}

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <polyline
          points={CONSTELLATION_POINTS.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="url(#echo-final-line)"
          strokeWidth="0.15"
          opacity="0.75"
        />
        <defs>
          <linearGradient id="echo-final-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ff8a4c" />
            <stop offset="50%" stopColor="#ff667a" />
            <stop offset="100%" stopColor="#f14ab4" />
          </linearGradient>
        </defs>
      </svg>

      {CONSTELLATION_POINTS.map((point, i) => (
        <span
          key={`node-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            width: 5,
            height: 5,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 14px rgba(255,180,200,0.9)',
            animation: `echo-star-twinkle ${4.5 + i * 0.5}s ease-in-out ${-i * 0.7}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function FinalCTA({ isAuthed }: { isAuthed: boolean }) {
  const cta = ctaTargets(isAuthed);
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="relative overflow-hidden py-24 sm:py-28 lg:py-36">
      <ConstellationBackdrop />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 h-[60%] -translate-y-1/2"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(241,74,180,0.16) 0%, rgba(255,138,76,0.08) 40%, rgba(2,4,13,0) 74%)',
        }}
      />

      <div ref={ref} className={`${revealClass(shown)} relative mx-auto max-w-3xl px-5 text-center sm:px-6`}>
        <h2 className="text-[clamp(1.6rem,6vw,3rem)] font-bold leading-[1.26] tracking-tight text-ink">
          지나간 경험을,
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
          >
            당신을 설명하는 별자리로.
          </span>
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-dim">오늘의 경험부터 기록해보세요.</p>

        <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <PrimaryCta to={cta.start} trailing={<ArrowRightIcon className="h-4 w-4" />}>
            ECHO 시작하기
          </PrimaryCta>
          {!isAuthed && <SecondaryCta to={cta.login}>이미 계정이 있어요</SecondaryCta>}
        </div>
      </div>
    </section>
  );
}
