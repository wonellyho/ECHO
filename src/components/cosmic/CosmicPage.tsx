import type { ReactNode } from 'react';
import { SpaceScene, type SpaceVariant } from './SpaceScene';

// 화면 하나의 껍데기. 우주 배경을 깔고 그 위에 콘텐츠를 모바일 폭으로 가운데 정렬한다.
//
// 이 프로젝트는 mobile-first다 — 태블릿/데스크톱에서는 레이아웃을 새로 짜지 않고
// 모바일 캔버스를 가운데에 두고 배경만 화면 전체로 넓힌다(§21).

export interface CosmicPageProps {
  variant: SpaceVariant;
  children: ReactNode;
  /**
   * true면 화면 높이에 딱 맞추고 페이지 자체는 스크롤하지 않는다 (녹음·패턴 화면).
   * false면 내용만큼 늘어나며 아래에 네비게이션 여백을 둔다.
   */
  fullHeight?: boolean;
  /** 콘텐츠 폭 상한. 기본은 모바일 캔버스(28rem). */
  width?: 'default' | 'wide';
  /**
   * 네비게이션 위에 또 다른 고정 바가 떠 있을 때 그만큼 아래 여백을 더 준다(px).
   * 내 경험 탭의 "일괄 컬렉션 추가" 바처럼 높이가 변하는 요소가 있어 고정값을 쓸 수 없다.
   */
  bottomExtra?: number;
  className?: string;
}

export function CosmicPage({
  variant,
  children,
  fullHeight = false,
  width = 'default',
  bottomExtra = 0,
  className = '',
}: CosmicPageProps) {
  return (
    <div
      className={`relative overflow-hidden ${
        fullHeight ? 'h-[calc(100dvh-var(--bottom-nav-total))]' : 'min-h-[100dvh]'
      }`}
    >
      <SpaceScene variant={variant} />
      <div
        className={`relative mx-auto w-full px-5 ${width === 'wide' ? 'max-w-2xl' : 'max-w-md'} ${
          fullHeight ? 'flex h-full flex-col' : 'pt-7'
        } ${className}`}
        style={
          fullHeight
            ? undefined
            : { paddingBottom: `calc(var(--bottom-nav-total) + 1.5rem + ${bottomExtra}px)` }
        }
      >
        {children}
      </div>
    </div>
  );
}
