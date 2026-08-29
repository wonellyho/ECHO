import type { ExperienceTag } from '../types';

// 태그별 고정 색상 매핑. 목록/상세 화면에서 동일하게 사용해 일관성을 유지한다.
export const TAG_COLORS: Record<ExperienceTag, string> = {
  협업: 'bg-blue-100 text-blue-700',
  갈등: 'bg-red-100 text-red-700',
  주도성: 'bg-amber-100 text-amber-700',
  실패: 'bg-slate-200 text-slate-700',
  성취: 'bg-green-100 text-green-700',
  문제해결: 'bg-violet-100 text-violet-700',
};

export const TAG_COLORS_ACTIVE: Record<ExperienceTag, string> = {
  협업: 'bg-blue-600 text-white',
  갈등: 'bg-red-600 text-white',
  주도성: 'bg-amber-600 text-white',
  실패: 'bg-slate-600 text-white',
  성취: 'bg-green-600 text-white',
  문제해결: 'bg-violet-600 text-white',
};

// 내 경험 탭 카드 스택의 배경 그라디언트 (design.md 참고, ref.jpg 스타일).
// 엔트리의 첫 번째 태그로 카드 색을 결정한다 — 태그가 없으면 NEUTRAL_CARD_GRADIENT.
// 모든 태그가 밝음(400)→중간(500)→어두움(700) 3단 그라디언트로 같은 톤 곡선을 쓰도록 통일해서,
// 색상(hue)은 다르더라도 카드끼리 같은 "패밀리"로 보이게 한다 (그라데이션이 또렷하게 드러나도록 폭도 넓힘).
export const TAG_GRADIENTS: Record<ExperienceTag, string> = {
  협업: 'from-sky-400 via-blue-500 to-blue-700',
  갈등: 'from-rose-400 via-red-500 to-red-700',
  주도성: 'from-amber-300 via-orange-500 to-orange-700',
  실패: 'from-slate-500 via-slate-600 to-slate-800',
  성취: 'from-emerald-300 via-green-500 to-green-700',
  문제해결: 'from-violet-400 via-purple-500 to-purple-700',
};

export const NEUTRAL_CARD_GRADIENT = 'from-slate-300 via-slate-400 to-slate-600';
