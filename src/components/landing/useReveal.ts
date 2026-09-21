import { useEffect, useRef, useState } from 'react';

/**
 * 섹션이 뷰포트에 들어오면 한 번만 true가 된다. 스크롤 페이드인용.
 *
 * scroll 이벤트로 매 프레임 위치를 재는 대신 IntersectionObserver를 쓴다 — 랜딩에만 10개
 * 넘는 요소가 걸리므로 스크롤 핸들러 방식은 저가 안드로이드에서 그대로 프레임 드랍이 된다.
 * prefers-reduced-motion이면 관찰조차 하지 않고 바로 보이는 상태로 시작한다.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: { rootMargin?: string }) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(
    () =>
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      // 화면 아래 12% 지점에 걸치면 이미 시작한다 — 완전히 들어온 뒤에 페이드를 시작하면
      // 사용자는 이미 그 섹션을 읽고 있어서 애니메이션이 방해로 느껴진다.
      { rootMargin: options?.rootMargin ?? '0px 0px -12% 0px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown, options?.rootMargin]);

  return { ref, shown };
}

/**
 * useReveal의 shown을 그대로 넘겨 쓰는 공통 트랜지션 클래스.
 *
 * 지연(stagger)은 클래스가 아니라 인라인 style(revealDelay)로 준다 — Tailwind는 소스를
 * 정적으로 훑어 클래스를 만들므로 `[transition-delay:${n}ms]`처럼 런타임에 조립한 문자열은
 * CSS가 생성되지 않아 조용히 무시된다.
 */
export function revealClass(shown: boolean): string {
  return [
    'transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none',
    shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
  ].join(' ');
}

/** 카드 목록 등에서 순서대로 조금씩 늦게 나타나게 한다. */
export function revealDelay(index: number, stepMs = 90): { transitionDelay: string } {
  return { transitionDelay: `${index * stepMs}ms` };
}
