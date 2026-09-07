import type { ReactNode } from 'react';
import { Logo } from './Logo';

// 8개 화면이 공유하는 머리말. 레퍼런스 전체에서 반복되는 구성이다:
//   좌상단 ECHO 워드마크 + YOUR LIFE MATTERS  /  우상단 세로 정렬된 짧은 카피
//   그 아래 큰 제목 + 보조 문구
//
// 우상단 카피는 장식이지 정보가 아니다 — 좁은 화면(360px)에서는 제목과 부딪히므로 숨긴다.

export interface PageHeaderProps {
  /** 큰 제목. 그라디언트 강조가 필요하면 ReactNode로 직접 조립해서 넘긴다. */
  title: ReactNode;
  /** 제목 위 작은 인사 (예: "주인님") */
  eyebrow?: string;
  subtitle?: ReactNode;
  /** 우상단 세로 카피. 줄 단위로 넘긴다. */
  cornerNote?: string[];
  /** 워드마크 자리를 대신 채울 요소 (상세 화면의 뒤로가기 + 로고 + 더보기 등) */
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  subtitle,
  cornerNote,
  leading,
  trailing,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          <Logo />
        </div>
        {trailing ??
          (cornerNote && (
            <p className="hidden shrink-0 pt-1 text-right text-[11px] leading-relaxed text-ink-muted min-[380px]:block">
              {cornerNote.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          ))}
      </div>

      <div className="mt-7">
        {eyebrow && <p className="text-lg font-semibold text-ink-dim">{eyebrow}</p>}
        <h1 className="mt-1 text-[28px] font-bold leading-[1.25] tracking-tight text-ink">{title}</h1>
        {subtitle && <div className="mt-3 text-[13px] leading-relaxed text-ink-dim">{subtitle}</div>}
      </div>
    </header>
  );
}

/** 제목 안에서 그라디언트로 강조할 부분. "오늘의 경험을" 같은 핵심 어구에만 쓴다. */
export function GradientText({ children }: { children: ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(100deg, #ffd6c2 0%, #ffb0c8 42%, #d9b3ff 100%)',
      }}
    >
      {children}
    </span>
  );
}
