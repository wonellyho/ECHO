import type { ReactNode } from 'react';

// 별자리 위에 올라오는 카드의 껍데기. 아래에서 위로 올라오고, 화면 높이의 고정 비율만 차지하며,
// 넘치는 내용은 시트 안에서만 스크롤한다.
//
// 높이를 고정하는 이유: 별 카드와 군집 카드의 내용 길이가 제각각인데 높이가 매번 달라지면
// 그 위에 떠 있는 "전체 보기" 버튼과 카메라가 비워 둬야 할 영역이 계속 흔들린다.
// 이 값이 바뀌면 InsightsPage의 버튼 위치(bottom-[calc(40dvh+...)])와 카메라가 군집을
// 위로 올리는 양(RAISE_RATIO)도 같이 바꿔야 한다.
export const SHEET_HEIGHT = '40dvh';

export interface BottomSheetProps {
  /**
   * false면 시트가 스크롤을 맡지 않고 내용에 넘긴다 — 머리말은 고정하고 가운데 목록만
   * 스크롤시켜야 하는 카드가 직접 영역을 나눌 수 있게.
   */
  scroll?: boolean;
  children: ReactNode;
}

export function BottomSheet({ scroll = true, children }: BottomSheetProps) {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 border-t border-hairline bg-[rgba(8,15,33,0.55)] backdrop-blur-xl"
      style={{
        height: SHEET_HEIGHT,
        borderTopLeftRadius: '1rem',
        borderTopRightRadius: '1rem',
        // transform만 애니메이션한다 — 레이아웃을 다시 계산하지 않는다.
        animation: reducedMotion ? undefined : 'echo-sheet-up 280ms cubic-bezier(0.22, 0.61, 0.36, 1)',
      }}
    >
      <style>{`
        @keyframes echo-sheet-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* 시트임을 알려주는 손잡이 */}
      <div aria-hidden className="flex justify-center pt-2">
        <span className="h-1 w-9 rounded-full bg-[rgba(130,160,220,0.4)]" />
      </div>

      {/*
        스크롤은 브라우저 기본 스크롤에 맡긴다 — 내 경험 탭의 카드 스택과 같은 방식이라
        모바일 관성(momentum)이 그대로 살아 있고 커스텀 물리 엔진이 필요 없다.
        overscroll-y-contain: 시트 끝까지 내려도 뒤의 페이지가 따라 스크롤되지 않는다.
      */}
      <div
        className={`h-[calc(100%-0.75rem)] ${
          scroll
            ? 'overflow-y-auto overscroll-y-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'overflow-hidden'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
