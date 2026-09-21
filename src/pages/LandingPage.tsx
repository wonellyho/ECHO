import { useEffect } from 'react';
import { useAuth } from '../lib/useAuth';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { ConstellationSection } from '../components/landing/ConstellationSection';
import { BrandMeaningSection } from '../components/landing/BrandMeaningSection';
import { AppShowcase } from '../components/landing/AppShowcase';
import { ValueSection } from '../components/landing/ValueSection';
import { PricingSection } from '../components/landing/PricingSection';
import { FinalCTA } from '../components/landing/FinalCTA';
import { LandingFooter } from '../components/landing/LandingFooter';

// 서비스 소개 랜딩. "/" 하나만 담당하고 앱 상태는 전혀 건드리지 않는다.
//
// 로그인 여부는 CTA 목적지를 정하는 데만 쓴다(components/landing/CtaButtons.ts의 ctaTargets):
//   로그인 상태  → 모든 CTA가 /app
//   비로그인     → 시작하기는 /signup, 앱 이용하기는 /login
// 랜딩 자체는 로그인 여부와 관계없이 항상 볼 수 있다 — 로그인했다고 자동으로 앱으로
// 보내버리면 사용자가 서비스 소개를 다시 볼 방법이 없어진다.

const PAGE_TITLE = 'ECHO — 경험을 기록하고, 나를 발견하다';
const PAGE_DESCRIPTION =
  '말하거나 적은 경험을 AI가 정리하고 연결해 나만의 별자리와 패턴으로 보여주는 경험 기록 서비스.';

export function LandingPage() {
  const { user } = useAuth();
  const isAuthed = Boolean(user);

  // SPA라 index.html의 <title>은 앱 화면에서도 그대로 남는다. 랜딩에 들어왔을 때만 랜딩용
  // 제목·설명으로 바꾸고 떠날 때 되돌린다.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = PAGE_TITLE;

    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') ?? null;
    description?.setAttribute('content', PAGE_DESCRIPTION);

    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) description?.setAttribute('content', previousDescription);
    };
  }, []);

  return (
    // overflow-x-clip이 핵심이다 — 성운(Nebula)을 섹션 밖으로 밀어 배치하기 때문에, 이게
    // 없으면 모바일에서 가로 스크롤이 생긴다. hidden 대신 clip을 쓰는 이유는 hidden이
    // 스크롤 컨테이너를 만들어 헤더의 sticky/fixed 동작을 망가뜨리기 때문이다.
    <div className="relative min-h-[100dvh] overflow-x-clip bg-space-black text-ink">
      {/* 페이지 전체에 깔리는 바탕 — 위는 거의 검정, 아래로 갈수록 아주 옅은 남색.
          섹션마다 배경을 따로 깔면 이음매가 보인다. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 80% at 50% -10%, rgba(20, 28, 58, 0.9) 0%, rgba(5, 10, 24, 0.9) 45%, #02040d 100%)',
        }}
      />

      {/* 상단 내비게이션 바는 두지 않는다. 랜딩은 메뉴를 고르는 앱이 아니라 위에서 아래로
          한 번 읽히는 문서이고, ECHO 로고는 HeroSection 맨 위에 선다. */}
      <main className="relative">
        <HeroSection isAuthed={isAuthed} />
        {/* 히어로 바로 다음이 실제 앱 화면이다 — 카피로 약속한 것을 설명보다 먼저 보여준다. */}
        <AppShowcase />
        <HowItWorksSection />
        <ConstellationSection />
        {/* 여섯 별자리를 본 직후에 "그래서 왜 ECHO인가"를 말한다. */}
        <BrandMeaningSection />
        <ValueSection />
        <PricingSection isAuthed={isAuthed} />
        <FinalCTA isAuthed={isAuthed} />
      </main>

      <LandingFooter isAuthed={isAuthed} />
    </div>
  );
}
