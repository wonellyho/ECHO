import { useId } from 'react';

// ECHO 워드마크. 레퍼런스의 로고는 "무지개 아치 + 넓게 자간을 준 ECHO + YOUR LIFE MATTERS"다.
// 아치는 동심원 3겹이며 바깥으로 갈수록 옅어진다 — 소리가 퍼져 나가는(echo) 모양이자,
// 경험이 쌓여 커진다는 은유이기도 하다.
export function Logo({
  variant = 'full',
  className = '',
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const gradientId = useId();

  const icon = (
    <svg viewBox="0 0 44 26" className={`h-7 w-11 shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-echo-orange)" />
          <stop offset="50%" stopColor="var(--color-echo-coral)" />
          <stop offset="100%" stopColor="var(--color-cosmic-violet)" />
        </linearGradient>
      </defs>
      {/* 바깥에서 안쪽으로 3겹. 굵기는 같고 불투명도만 다르게 해서 아치가 번져 보이게 한다. */}
      <path d="M3 24a19 19 0 0 1 38 0" stroke={`url(#${gradientId})`} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      <path d="M9.5 24a12.5 12.5 0 0 1 25 0" stroke={`url(#${gradientId})`} strokeWidth={3.2} strokeLinecap="round" fill="none" opacity={0.62} />
      <path d="M16 24a6 6 0 0 1 12 0" stroke={`url(#${gradientId})`} strokeWidth={3.2} strokeLinecap="round" fill="none" opacity={0.35} />
    </svg>
  );

  if (variant === 'icon') {
    return icon;
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="min-w-0">
        <span className="block text-[22px] font-light leading-none tracking-[0.22em] text-ink">
          ECHO
        </span>
        <span className="mt-1 block text-[8px] font-medium leading-none tracking-[0.3em] text-ink-muted">
          YOUR LIFE MATTERS
        </span>
      </span>
    </span>
  );
}
