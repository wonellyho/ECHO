import type { ReactNode } from 'react';

// 섹션 제목 묶음. 섹션마다 따로 쓰면 여백과 글자 크기가 조금씩 어긋나서 스크롤할 때
// 리듬이 깨진다.

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-2xl ${alignment} ${className}`}>
      {eyebrow && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cosmic-violet sm:text-xs">
          {eyebrow}
        </p>
      )}
      <h2 className="mt-3 text-[clamp(1.5rem,5vw,2.5rem)] font-bold leading-[1.28] tracking-tight text-ink">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-[14px] leading-relaxed text-ink-dim sm:text-[15px]">{description}</p>
      )}
    </div>
  );
}
