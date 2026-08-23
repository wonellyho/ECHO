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
