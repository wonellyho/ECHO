import type { ReactElement } from 'react';
import {
  ConstellationScreen,
  EntriesCollectionScreen,
  RecordHomeScreen,
  StarWlScreen,
  StructuredScreen,
  VoiceRecordScreen,
} from './AppScreens';

// 앱 화면 쇼케이스(AppShowcase)에 들어가는 순서와 설명.
//
// AppScreens.tsx에 함께 두면 "컴포넌트와 상수를 같이 내보내는 파일"이 되어 Vite의 fast
// refresh가 그 파일 전체를 통째로 다시 마운트한다 — 개발 중 목업이 매번 깜빡인다.

export interface ShowcaseScreen {
  id: string;
  title: string;
  caption: string;
  render: () => ReactElement;
  /** 실사 스크린샷으로 갈아끼울 때 쓸 경로. public/assets/landing/README.md 참고. */
  screenshot?: string;
}

export const SHOWCASE_SCREENS: ShowcaseScreen[] = [
  {
    id: 'record',
    title: '기록하기',
    caption: '경험을 말하거나 적어보세요.',
    render: () => <RecordHomeScreen />,
  },
  {
    id: 'voice',
    title: '음성 기록',
    caption: '말하는 동안 그대로 글이 됩니다.',
    render: () => <VoiceRecordScreen />,
  },
  {
    id: 'structured',
    title: 'AI 구조화',
    caption: 'AI가 상황·행동·결과·감정을 나눠 정리합니다.',
    render: () => <StructuredScreen />,
  },
  {
    id: 'entries',
    title: '내 경험',
    caption: '프로젝트별로 모인 경험 카드를 넘겨봅니다.',
    render: () => <EntriesCollectionScreen />,
  },
  {
    id: 'constellation',
    title: '별자리',
    caption: '비슷한 경험이 태그별 별자리로 모입니다.',
    render: () => <ConstellationScreen />,
  },
  {
    id: 'starwl',
    title: 'STARWL 카드',
    caption: '면접에서 바로 꺼내 쓸 경험 카드로 정리합니다.',
    render: () => <StarWlScreen />,
  },
];
