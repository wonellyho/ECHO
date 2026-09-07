import type { CardColorKey, ExperienceTag } from '../types';

// 고정된 6종 태그 — 목록 필터, 상세 화면 수동 선택 등에서 공용으로 쓴다 (DB CHECK 제약과 동일).
export const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

// 태그별 고정 색상 매핑. 목록/상세 화면에서 동일하게 사용해 일관성을 유지한다.
// (카드 배경색과는 별개 — 카드 배경은 아래 CARD_COLOR_* 참고. 이건 필터 칩/배지 색이다.)
export const TAG_COLORS: Record<ExperienceTag, string> = {
  협업: 'bg-blue-500/15 text-blue-300',
  갈등: 'bg-red-500/15 text-red-300',
  주도성: 'bg-amber-500/15 text-amber-300',
  실패: 'bg-slate-500/20 text-slate-300',
  성취: 'bg-green-500/15 text-green-300',
  문제해결: 'bg-violet-500/15 text-violet-300',
};

export const TAG_COLORS_ACTIVE: Record<ExperienceTag, string> = {
  협업: 'bg-blue-600 text-white',
  갈등: 'bg-red-600 text-white',
  주도성: 'bg-amber-600 text-white',
  실패: 'bg-slate-600 text-white',
  성취: 'bg-green-600 text-white',
  문제해결: 'bg-violet-600 text-white',
};

// 태그의 기준 색(hex). 우주 배경 위의 "유리 캡슐" 칩은 배경을 채우는 대신 테두리와 글자에만
// 색을 쓰므로 rgb 값이 직접 필요하다 — Tailwind 클래스로는 알파를 자유롭게 조절할 수 없다.
// 위 TAG_COLORS(채운 배지)와 같은 계열을 유지한다.
export const TAG_HEX: Record<ExperienceTag, string> = {
  협업: '#5B9BFF',
  갈등: '#FF6B84',
  주도성: '#F2B33D',
  실패: '#9AA8C5',
  성취: '#3FCC96',
  문제해결: '#A76EFF',
};

// 카드 배경색 5종 (2026-09-02, 사용자 요청). 이전엔 태그의 첫 번째 값으로 카드 색을 자동 결정했지만,
// 지금은 저장 시점에 사용자가 이 5색 팔레트 중 하나를 직접 고른다 — RecordPage의 "카드 색상" 선택
// 칸(CARD_COLOR_KEYS 순서로 스와치 렌더)과 DB의 entries.card_color CHECK 제약이 이 5개 키와
// 정확히 같아야 한다.
export const CARD_COLOR_KEYS: CardColorKey[] = ['navy', 'rose', 'plum', 'coral', 'slate'];

export const CARD_COLOR_LABELS: Record<CardColorKey, string> = {
  navy: '네이비',
  rose: '로즈',
  plum: '플럼',
  coral: '코럴',
  slate: '슬레이트',
};

// 팔레트 스와치(RecordPage)에 그대로 쓰는 기준 색 — 사용자가 준 5개 hex 그대로.
export const CARD_COLOR_HEX: Record<CardColorKey, string> = {
  navy: '#393960',
  rose: '#EAAEA5',
  plum: '#96709A',
  coral: '#E58F91',
  slate: '#5D628C',
};

// 카드 배경 그라디언트. "은은하게"라는 요청대로, 예전(짙은 남색 → 옅은 파스텔)처럼 색상 자체가
// 바뀌는 큰 대비가 아니라, 같은 색을 화이트 쪽으로 16% 섞은 밝은 변형으로만 이어지는 좁은 범위의
// 그라디언트다. to-br 방향은 EntryCardStack의 스크림 축과 맞춰야 한다(그 파일 주석 참고) — 다만
// to-br 스크림은 좌상단에서 알파가 0이라 그 자체만으론 밝은 색(rose/coral)에서 대비가 부족했고,
// 시작 스톱을 30%로 올려 보정했다(EntryCardStack 주석 참고). 카드 색을 새로 추가/조정할 땐
// 그 보정이 여전히 충분한지 반드시 같이 확인할 것 — "스크림이 있으니 안전하다"고 가정하지 말 것.
//
// 클래스명은 전부 리터럴로 쓴다 — Tailwind는 소스 텍스트를 정적으로 스캔해 클래스를 생성하므로,
// 템플릿 리터럴로 조립하면 스캐너가 못 잡아 CSS 자체가 생성되지 않는다(조용히 무배경으로 깨짐).
export const CARD_COLOR_GRADIENTS: Record<CardColorKey, string> = {
  navy: 'from-[#393960] to-[#595979]',
  rose: 'from-[#EAAEA5] to-[#EDBBB3]',
  plum: 'from-[#96709A] to-[#A787AA]',
  coral: 'from-[#E58F91] to-[#E9A1A3]',
  slate: 'from-[#5D628C] to-[#777B9E]',
};

// card_color가 없는 옛 기록(이 기능 도입 전에 저장됨)의 폴백.
export const DEFAULT_CARD_COLOR: CardColorKey = 'navy';
