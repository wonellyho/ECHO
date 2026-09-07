import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardsIcon, MicIcon, PulseIcon, UserIcon } from './icons';

// 하단 네비게이션 — 화면 가장자리에 붙은 막대가 아니라 **떠 있는 유리 dock**이다 (레퍼런스 전체).
// 활성 항목만 독립된 캡슐로 감싸고, 탭마다 glow 색조만 다르게 준다.
//
// 높이는 index.css의 --bottom-nav-height / --bottom-nav-total 한 곳에서만 정의한다.
// 각 화면이 그만큼 아래 여백을 두거나 높이 계산에서 빼야 하므로, 값이 흩어지면 어느 화면에서
// 콘텐츠가 가려도 눈치채기 어렵다.

interface NavItem {
  to: string;
  label: string;
  Icon: (props: { className?: string }) => ReactElement;
  /** 하위 경로까지 활성으로 칠지 (예: /entries/:id에서도 "내 경험"이 활성) */
  matchPrefix?: boolean;
  /** 활성 캡슐의 glow 색조 (rgb 3요소) */
  accent: string;
}

const ITEMS: NavItem[] = [
  { to: '/', label: '기록', Icon: MicIcon, accent: '255, 138, 76' },
  { to: '/entries', label: '내 경험', Icon: CardsIcon, matchPrefix: true, accent: '255, 160, 110' },
  { to: '/insights', label: '패턴', Icon: PulseIcon, accent: '167, 110, 255' },
  { to: '/profile', label: '내 정보', Icon: UserIcon, accent: '241, 74, 180' },
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (item: NavItem) =>
    item.matchPrefix ? location.pathname.startsWith(item.to) : location.pathname === item.to;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-2"
      // iOS 홈 인디케이터에 깔리지 않도록 아래 여백을 더 준다.
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <ul
        className="mx-auto flex max-w-md items-stretch gap-1 rounded-[1.75rem] border border-hairline p-1.5 backdrop-blur-xl"
        style={{
          height: '3.75rem',
          background: 'rgba(8, 15, 33, 0.72)',
          boxShadow: '0 8px 32px -12px rgba(0,0,0,0.9)',
        }}
      >
        {ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <li key={item.to} className="flex-1">
              {/* 기록 탭은 Link를 유지해야 한다 — 이미 "/"에 있을 때 같은 경로로의 이동이
                  replace로 처리되며 새 location.key를 발급하고, RecordPage가 그걸
                  "첫 화면으로 돌아가라" 신호로 쓴다. */}
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 rounded-[1.4rem] border transition-[color,background-color,border-color] duration-200 ${
                  active ? '' : 'border-transparent text-ink-muted hover:text-ink-dim'
                }`}
                style={
                  active
                    ? {
                        // 아이콘이 currentColor를 쓰므로 링크에 색을 주면 아이콘과 라벨이 함께 물든다.
                        color: `rgb(${item.accent})`,
                        borderColor: `rgba(${item.accent}, 0.45)`,
                        background: `rgba(${item.accent}, 0.1)`,
                        boxShadow: `0 0 18px -6px rgba(${item.accent}, 0.7)`,
                      }
                    : undefined
                }
              >
                <item.Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
