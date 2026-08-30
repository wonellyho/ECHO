import { useId } from 'react';

// ECHO 워드마크 + echo 림플 아이콘 (중심 점 + 동심 아크 2줄).
// 그라디언트는 기존 녹음 화면(RecordPage voice 단계)과 동일한 orange-400 → pink-500을 재사용한다
// (design.md 팔레트 원칙 — 새 색 추가하지 않음).
export function Logo({
  variant = 'full',
  className = '',
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const gradientId = useId();

  const icon = (
    <svg viewBox="0 0 40 40" className={`h-8 w-8 shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-orange-400)" />
          <stop offset="100%" stopColor="var(--color-pink-500)" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="3" fill={`url(#${gradientId})`} />
      <path
        d="M14 20a6 6 0 0 1 12 0"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9 20a11 11 0 0 1 22 0"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />
    </svg>
  );

  if (variant === 'icon') {
    return icon;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {icon}
      <span className="text-2xl font-bold tracking-tight text-slate-900">ECHO</span>
    </span>
  );
}
