import { Link } from 'react-router-dom';
import { Nebula, StarField } from './StarField';
import { TiltedPhonePair } from './TiltedPhonePair';
import { PrimaryCta, SecondaryAnchorCta } from './CtaButtons';
import { ROUTES, ctaTargets } from '../../lib/routes';
import { Logo } from '../Logo';
import { ArrowRightIcon } from '../icons';
import { useReveal, revealClass } from './useReveal';

// 첫 화면.
//
// 상단에 내비게이션 바가 없다. 로고 하나가 페이지의 맨 위에 서고, 그 아래로 바로 이야기가
// 시작된다 — 랜딩이 한 줄로 읽히는 문서이지 메뉴를 고르는 앱이 아니기 때문이다.
//
// 순서가 곧 이야기다 — 로고 → 한 줄 약속(카피) → 그 약속이 실제로 어떻게 생겼는지(기울어진
// 아이폰 두 대: 말하는 화면과 쌓인 화면) → 설명 → 시작하기. 모든 해상도에서 이 순서 하나만
// 쓴다. 화면 크기별로 배치를 뒤집지 않으므로 읽는 순서와 탭 순서가 항상 같다.

export function HeroSection({ isAuthed }: { isAuthed: boolean }) {
  const cta = ctaTargets(isAuthed);
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="relative overflow-hidden pt-10 sm:pt-12 lg:pt-16">
      <StarField count={56} seed={11} />
      <Nebula className="left-[-15%] top-[8%] h-[52vw] w-[52vw] max-h-[420px] max-w-[420px]" color="255, 138, 76" opacity={0.14} />
      <Nebula className="right-[-12%] top-[30%] h-[46vw] w-[46vw] max-h-[380px] max-w-[380px]" color="167, 110, 255" opacity={0.18} />

      <div ref={ref} className="relative mx-auto max-w-5xl px-5 pb-16 text-center sm:px-6 lg:pb-24 lg:px-8">
        {/* 페이지 최상단 — ECHO 로고. */}
        <div className={`${revealClass(shown)} mb-8 flex justify-center sm:mb-10`}>
          <Link to={ROUTES.landing} aria-label="ECHO 홈">
            <Logo size="lg" />
          </Link>
        </div>

        <span
          className={`${revealClass(shown)} inline-flex items-center gap-2 rounded-full border border-hairline px-3.5 py-1.5 text-[11px] font-semibold text-ink-dim backdrop-blur-md sm:text-xs`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--echo-gradient)', boxShadow: '0 0 8px rgba(241,74,180,0.9)' }}
          />
          AI 경험 기록 · 자기이해
        </span>

        <h1
          className={`${revealClass(shown)} mt-5 text-[clamp(1.85rem,6.6vw,3.4rem)] font-bold leading-[1.24] tracking-tight text-ink`}
          style={{ transitionDelay: '60ms' }}
        >
          경험을 기록하면,
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
          >
            나만의 별자리
          </span>
          가 만들어집니다.
        </h1>

        {/* 카피 바로 아래 — 말하는 화면과 정리된 화면이 나란히. */}
        <TiltedPhonePair className={`${revealClass(shown)} mt-10 sm:mt-12`} />

        <p
          className={`${revealClass(shown)} mx-auto mt-10 max-w-xl text-[15px] leading-relaxed text-ink-dim sm:mt-12 sm:text-base`}
          style={{ transitionDelay: '120ms' }}
        >
          말하거나 적기만 하세요. ECHO가 당신의 경험을 정리하고 연결해, 미처 발견하지 못했던
          나의 패턴을 보여드립니다.
        </p>

        <div
          className={`${revealClass(shown)} mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center`}
          style={{ transitionDelay: '160ms' }}
        >
          <PrimaryCta to={cta.start} trailing={<ArrowRightIcon className="h-4 w-4" />}>
            무료로 시작하기
          </PrimaryCta>
          {/* 라우트 이동이 아니라 같은 페이지의 요금제 섹션으로 내려가는 앵커다. */}
          <SecondaryAnchorCta href="#pricing">구독 요금 확인하기</SecondaryAnchorCta>
        </div>

        <p className={`${revealClass(shown)} mt-4 text-[13px] text-ink-muted`} style={{ transitionDelay: '200ms' }}>
          지금 바로 시작할 수 있어요. 기록은 계속 무료입니다.
        </p>
      </div>
    </section>
  );
}
