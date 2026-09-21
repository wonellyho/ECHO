import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// 랜딩의 CTA는 앱의 GradientButton/OutlineButton과 같은 모양이어야 한다 — 다만 앱 버튼은
// w-full 고정에 <button>이라 링크로 쓸 수 없어서, 같은 토큰으로 <Link>판을 따로 둔다.

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmic-violet focus-visible:ring-offset-2 focus-visible:ring-offset-space-black';

export function PrimaryCta({
  to,
  children,
  trailing,
  className = '',
}: {
  to: string;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white transition-[opacity,transform] duration-200 hover:opacity-95 active:scale-[0.98] ${FOCUS} ${className}`}
      style={{
        background: 'var(--echo-gradient)',
        boxShadow: '0 0 0 1px rgba(255,200,180,0.25), 0 10px 34px -12px rgba(241,74,180,0.85)',
      }}
    >
      {children}
      {trailing}
    </Link>
  );
}

/**
 * 같은 페이지 안의 섹션으로 내려가는 보조 CTA ("구독 요금 확인하기" → #pricing).
 *
 * react-router의 <Link to="#pricing">이 아니라 평범한 <a href>를 쓴다 — 라우터를 거치면
 * 해시만 바뀐 새 location이 push되어 뒤로가기 기록이 지저분해지고, 브라우저가 알아서
 * 해주는 앵커 스크롤(+ index.css의 scroll-behavior: smooth)을 굳이 다시 구현해야 한다.
 */
export function SecondaryAnchorCta({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border border-hairline px-7 text-[15px] font-medium text-ink backdrop-blur-xl transition-colors duration-200 hover:border-hairline-active ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.34)' }}
    >
      {children}
    </a>
  );
}

export function SecondaryCta({
  to,
  children,
  className = '',
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full border border-hairline px-7 text-[15px] font-medium text-ink backdrop-blur-xl transition-colors duration-200 hover:border-hairline-active ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.34)' }}
    >
      {children}
    </Link>
  );
}
