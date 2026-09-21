import type { ReactNode } from 'react';

// 앱 전체가 공유하는 유리 표면.
//
// 중요한 규칙: **기본 카드에는 glow가 거의 없다.** 모든 카드가 빛나면 위계가 사라지고
// 촌스러워진다. selected/active일 때만 테두리를 그라디언트로 바꾸고 아주 약한 outer glow를
// 얹는다. 그림자는 강하게 쓰지 않는다 — 우주에는 그림자를 만들 바닥이 없다.

export type GlassTone = 'default' | 'strong' | 'ghost';

export interface GlassCardProps {
  children: ReactNode;
  /** 활성/선택 상태. 테두리가 그라디언트로 바뀌고 약한 glow가 생긴다. */
  active?: boolean;
  /** strong은 텍스트를 많이 담는 카드용 — 배경이 더 불투명해 가독성이 올라간다. */
  tone?: GlassTone;
  /** 강조 색(rgb 3요소 문자열). active glow와 hairline에 쓰인다. */
  accent?: string;
  /**
   * false면 backdrop-blur를 아예 걸지 않는다 — 뒤 배경이 뭉개지지 않고 오롯이 비쳐야 하는
   * 화면(내 경험 탭 편집 모드, 기록 홈 등)에서 쓴다. 기본은 true(기존 동작 유지).
   */
  blur?: boolean;
  className?: string;
}

// 카드는 기본적으로 **투명하다**. 배경 사진이 카드 너머로 비쳐야 "우주 위에 떠 있는 유리"로
// 보인다. 불투명도를 낮추면서 가독성을 지키는 방법은 blur를 함께 올리는 것 —
// 낮은 알파 + 강한 blur가 유리로 읽히고, 뒤의 별이 뭉개져 글자를 방해하지 않는다.
const TONE_BG: Record<GlassTone, string> = {
  default: 'rgba(10, 20, 40, 0.38)',
  // 긴 본문을 담는 카드만 한 단 진하게 (기록 원문, 별 상세 등).
  strong: 'rgba(12, 22, 44, 0.58)',
  // 거의 순수한 유리 — 테두리와 blur만으로 카드임을 알리고 안쪽은 뒤 배경이 그대로 비친다
  // ("카드도 투명하게" 요청). 짧은 라벨 위주 카드에만 쓴다 — 본문이 길면 배경 사진 위에서
  // 글자가 묻힌다.
  ghost: 'rgba(10, 20, 40, 0.1)',
};

export function GlassCard({
  children,
  active = false,
  tone = 'default',
  accent = '190, 170, 255',
  blur = true,
  className = '',
}: GlassCardProps) {
  return (
    <div
      className={`rounded-2xl border transition-[border-color,box-shadow] duration-200 ${blur ? 'backdrop-blur-xl' : ''} ${className}`}
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
export function GlassPanel({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  /** ghost는 배경을 거의 비워 뒤가 훨씬 또렷하게 비친다 — 로그인 화면 카드 요청. */
  tone?: 'default' | 'ghost';
  className?: string;
}) {
  // backdrop-blur는 알파를 아무리 낮춰도 어느 정도든 뒤 배경을 뭉개 "배경이 하나도 안
  // 보인다"는 결과를 낳았다 — sm(8px)까지 낮췄는데도 여전히 부족하다는 피드백으로,
  // ghost 톤은 blur를 아예 없애고 알파도 거의 0으로 낮췄다. 진짜 유리라기보다는 테두리와
  // 아주 옅은 색조만 남기는 쪽에 가깝다.
  return (
    <div
      className={`rounded-3xl border ${tone === 'ghost' ? '' : 'backdrop-blur-xl'} ${className}`}
      style={{
        background: tone === 'ghost' ? 'rgba(10, 20, 40, 0.05)' : 'rgba(8, 15, 33, 0.42)',
        borderColor: 'rgba(130, 160, 220, 0.22)',
        boxShadow: '0 0 40px -18px rgba(160, 140, 255, 0.5)',
      }}
    >
      {children}
    </div>
  );
}
