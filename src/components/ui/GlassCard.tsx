import type { ReactNode } from 'react';

// 앱 전체가 공유하는 유리 표면.
//
// 중요한 규칙: **기본 카드에는 glow가 거의 없다.** 모든 카드가 빛나면 위계가 사라지고
// 촌스러워진다. selected/active일 때만 테두리를 그라디언트로 바꾸고 아주 약한 outer glow를
// 얹는다. 그림자는 강하게 쓰지 않는다 — 우주에는 그림자를 만들 바닥이 없다.

export type GlassTone = 'default' | 'strong';

export interface GlassCardProps {
  children: ReactNode;
  /** 활성/선택 상태. 테두리가 그라디언트로 바뀌고 약한 glow가 생긴다. */
  active?: boolean;
  /** strong은 텍스트를 많이 담는 카드용 — 배경이 더 불투명해 가독성이 올라간다. */
  tone?: GlassTone;
  /** 강조 색(rgb 3요소 문자열). active glow와 hairline에 쓰인다. */
  accent?: string;
  className?: string;
}

const TONE_BG: Record<GlassTone, string> = {
  default: 'rgba(10, 20, 40, 0.55)',
  strong: 'rgba(15, 26, 50, 0.78)',
};

export function GlassCard({
  children,
  active = false,
  tone = 'default',
  accent = '190, 170, 255',
  className = '',
}: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md transition-[border-color,box-shadow] duration-200 ${className}`}
      style={{
        background: TONE_BG[tone],
        borderColor: active ? `rgba(${accent}, 0.55)` : 'rgba(130, 160, 220, 0.24)',
        boxShadow: active ? `0 0 0 1px rgba(${accent}, 0.18), 0 0 24px -6px rgba(${accent}, 0.4)` : 'none',
      }}
    >
      {children}
    </div>
  );
}

/**
 * 화면 전체를 감싸는 큰 유리 패널 (로그인 컨테이너 등).
 * 카드보다 더 넓은 면적을 덮으므로 blur를 한 단 낮춰 비용을 아낀다.
 */
export function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-3xl border backdrop-blur-sm ${className}`}
      style={{
        background: 'rgba(8, 15, 33, 0.62)',
        borderColor: 'rgba(130, 160, 220, 0.22)',
        boxShadow: '0 0 40px -18px rgba(160, 140, 255, 0.5)',
      }}
    >
      {children}
    </div>
  );
}
