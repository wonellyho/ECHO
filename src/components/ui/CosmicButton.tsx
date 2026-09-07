import type { ButtonHTMLAttributes, ReactNode } from 'react';

// 버튼 3종. 전부 최소 44px 터치 영역과 focus-visible 링을 갖는다 (§22 접근성).

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement>;

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cosmic-violet focus-visible:ring-offset-2 focus-visible:ring-offset-space-black';

/** primary CTA — orange → coral → magenta 그라디언트 pill. 화면당 하나만 쓴다. */
export function GradientButton({
  children,
  trailing,
  className = '',
  ...props
}: BaseProps & { children: ReactNode; trailing?: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-semibold text-white transition-[opacity,box-shadow] duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${className}`}
      style={{
        background: 'var(--echo-gradient)',
        // luminous edge — 테두리가 자체 발광하는 것처럼 아주 약하게만.
        boxShadow: '0 0 0 1px rgba(255,200,180,0.25), 0 6px 26px -10px rgba(241,74,180,0.75)',
      }}
    >
      <span>{children}</span>
      {trailing}
    </button>
  );
}

/** 보조 버튼 — 유리 표면 위의 외곽선. 로그아웃, OAuth 등. */
export function OutlineButton({
  children,
  leading,
  trailing,
  className = '',
  ...props
}: BaseProps & { children: ReactNode; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex min-h-[3rem] w-full items-center gap-3 rounded-2xl border border-hairline px-4 text-sm font-medium text-ink backdrop-blur-xl transition-colors duration-200 hover:border-hairline-active disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.34)' }}
    >
      {leading}
      <span className="flex-1 text-center">{children}</span>
      {trailing ?? <span className="w-5" aria-hidden />}
    </button>
  );
}

/** 원형 아이콘 버튼 — 뒤로가기, 더보기, 편집 등. 44px 터치 영역을 지킨다. */
export function CosmicIconButton({
  children,
  className = '',
  ...props
}: BaseProps & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hairline text-ink-dim backdrop-blur-xl transition-colors duration-200 hover:border-hairline-active hover:text-ink disabled:opacity-45 ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.32)' }}
    >
      {children}
    </button>
  );
}
