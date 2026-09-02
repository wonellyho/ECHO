import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CardsIcon, MicIcon, PulseIcon, UserIcon } from './icons';

// 하단 아이콘 네비게이션 (Figma 메모 "nav바 옵션들이 아래에 배치" + 카드 레퍼런스 이미지).
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
}

const ITEMS: NavItem[] = [
  { to: '/', label: '기록', Icon: MicIcon },
  { to: '/entries', label: '내 경험', Icon: CardsIcon, matchPrefix: true },
  { to: '/insights', label: '패턴', Icon: PulseIcon },
  { to: '/profile', label: '내 정보', Icon: UserIcon },
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (item: NavItem) =>
    item.matchPrefix ? location.pathname.startsWith(item.to) : location.pathname === item.to;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950"
      // iOS 홈 인디케이터에 깔리지 않도록 아래 여백을 더 준다.
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul
        className="mx-auto flex max-w-md items-stretch"
        style={{ height: 'var(--bottom-nav-height)' }}
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
                className={`flex h-full flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-slate-50' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <item.Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
