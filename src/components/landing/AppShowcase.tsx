import { PhoneMockup } from './PhoneMockup';
import { SHOWCASE_SCREENS } from './showcaseScreens';
import { SectionHeading } from './SectionHeading';
import { StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

// 실제 앱 화면 6개.
//
// 레이아웃은 화면 크기별로 갈래를 나누지 않고 **가로 스크롤 스냅 한 가지**로 통일했다.
// 모바일에서는 한 번에 하나씩, 태블릿은 둘, 데스크톱은 셋이 보인다 — 같은 코드가
// 요구사항의 세 경우를 모두 만족하고, 분기가 없으니 어느 폭에서도 깨지지 않는다.

export function AppShowcase() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section id="features" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={24} seed={515} />

      <div ref={ref} className="relative">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Inside ECHO"
            title="기록하고, 정리되고, 다시 꺼내 쓰기까지."
            description="한 번의 기록이 별자리와 면접용 경험 카드가 되는 과정입니다."
            className={revealClass(shown)}
          />
        </div>

        {/* 좌우 여백을 padding으로 주고 스크롤 컨테이너는 화면 전체 폭을 쓴다 —
            그래야 첫 카드가 왼쪽 정렬되면서도 카드가 화면 가장자리까지 이어져 보인다. */}
        <ul
          className="echo-hide-scrollbar mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-6 lg:mt-16 lg:px-8"
        >
          {SHOWCASE_SCREENS.map((screen, i) => (
            <li
              key={screen.id}
              className={`w-[66vw] max-w-[17rem] shrink-0 snap-center sm:w-[38vw] lg:w-[26vw] lg:max-w-[16rem] ${revealClass(shown)}`}
              style={revealDelay(i, 60)}
            >
              <PhoneMockup label={`ECHO ${screen.title} 화면`} screenSrc={screen.screenshot}>
                {screen.render()}
              </PhoneMockup>
              <div className="mt-5 text-center">
                <p className="text-[15px] font-bold text-ink">{screen.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{screen.caption}</p>
              </div>
            </li>
          ))}
          {/* 마지막 카드도 가운데까지 스크롤되도록 꼬리 여백을 둔다. */}
          <li aria-hidden className="w-1 shrink-0 sm:w-[20vw]" />
        </ul>

        <p className="mt-2 px-5 text-center text-[12px] text-ink-muted sm:px-6 lg:hidden">
          옆으로 밀어서 더 보기
        </p>
      </div>
    </section>
  );
}
