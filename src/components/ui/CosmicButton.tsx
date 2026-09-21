import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ChevronLeftIcon } from '../icons';

// 버튼 4종. 전부 최소 44px 터치 영역과 focus-visible 링을 갖는다 (§22 접근성).

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
      // 알파를 0.07까지 낮췄더니 backdrop-blur-xl(24px)의 강한 블러와 겹쳐 버튼 자체가
      // 잘 안 보이는 얼룩처럼 됐다("편집·컬렉션 모음 버튼이 안 보인다" 피드백) — 카드들처럼
      // 약간 불투명하게 되돌리고 blur도 낮춰 아이콘이 뚜렷하게 보이게 한다. 테두리는 경험
      // 카드의 활성 핑크(EntryCardStack의 rgba(255,170,190) 계열)를 유지한다. 앱 전체 아이콘
      // 버튼(편집, 컬렉션 모음, 삭제·완료 등)이 이 컴포넌트 하나를 공유한다.
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(255,170,190,0.42)] text-ink-dim backdrop-blur-sm transition-colors duration-200 hover:border-[rgba(255,170,190,0.75)] hover:text-ink disabled:opacity-45 ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.3)' }}
    >
      {children}
    </button>
  );
}

/**
 * 뒤로가기 전용 버튼 — 일반 아이콘 버튼보다 존재감을 더 준다. 호버 시 은은한
 * 그라디언트 글로우가 배어 나오고 화살표가 살짝 왼쪽으로 미끄러져 "뒤로 간다"는
 * 방향성을 몸짓으로 보여준다("뒤로가기 버튼 좀더 세련되게" 요청).
 */
export function BackButton({
  onClick,
  className = '',
  ...props
}: Omit<BaseProps, 'onClick'> & { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="뒤로"
      {...props}
      className={`group relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline text-ink-dim backdrop-blur-xl transition-all duration-200 hover:border-hairline-active hover:text-ink active:scale-90 ${FOCUS} ${className}`}
      style={{ background: 'rgba(10, 20, 40, 0.14)' }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-70"
        style={{ background: 'radial-gradient(circle, rgba(190,170,255,0.35), transparent 70%)' }}
      />
      <ChevronLeftIcon className="relative h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
    </button>
  );
}
