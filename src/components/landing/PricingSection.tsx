import { GlassCard } from '../ui/GlassCard';
import { CheckIcon } from '../icons';
import { PrimaryCta, SecondaryCta } from './CtaButtons';
import { ctaTargets } from '../../lib/routes';
import { SectionHeading } from './SectionHeading';
import { Nebula, StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

// 요금제는 ECHO_Business_Model.md를 그대로 따른다.
//
// 원래 랜딩 기획안에는 "30일 무료 체험"이 있었지만 ECHO의 BM은 체험판이 아니라
// **Freemium**이다 — 기록은 계속 무료고, 쌓인 경험을 커리어 자산으로 바꾸는 단계(패턴 분석,
// STARWL 변환, 경험 검색)에서 과금한다. 그래서 문구를 "무료로 시작하기"로 맞췄다.
// 실제 결제 연동은 아직 없으므로 Pro/Interview Pack 버튼은 가입으로 보내고 '준비 중'을 명시한다.

const FREE_FEATURES = ['경험 기록 (텍스트 · 음성)', '기본 AI 구조화', '경험 태그 자동 분류', '별자리 보기', '최근 기록 조회'];

const PRO_FEATURES = [
  '기록 무제한',
  '전체 기록 기반 패턴 분석',
  '자연어로 경험 검색',
  'STARWL 경험 카드 변환',
  '자소서 · 면접 질문에 맞는 경험 추천',
  '월간 · 학기별 「나 사용설명서」 리포트',
];

function FeatureList({ items, accent }: { items: string[]; accent: string }) {
  return (
    <ul className="mt-6 space-y-3" style={{ color: accent }}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-ink-dim">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PricingSection({ isAuthed }: { isAuthed: boolean }) {
  const cta = ctaTargets(isAuthed);
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section id="pricing" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={30} seed={1212} />
      <Nebula className="left-1/2 top-[10%] h-[56vw] w-[56vw] max-h-[460px] max-w-[460px] -translate-x-1/2" color="255, 138, 76" opacity={0.12} />

      <div ref={ref} className="relative mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="당신의 경험을 꾸준히 쌓아보세요."
          description="기록은 계속 무료입니다. 쌓인 경험을 커리어 자산으로 바꾸는 순간에만 비용이 듭니다."
          className={revealClass(shown)}
        />

        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-2 lg:gap-5">
          {/* Free */}
          <div className={revealClass(shown)}>
            <GlassCard className="flex h-full flex-col p-6 sm:p-7">
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-ink-muted">Free</p>
              <p className="mt-4 text-[32px] font-bold leading-none text-ink">0원</p>
              <p className="mt-2 text-[13px] text-ink-dim">기록 습관을 만드는 단계까지, 계속 무료로.</p>
              <FeatureList items={FREE_FEATURES} accent="#9aa8c5" />
              <div className="mt-auto pt-7">
                <SecondaryCta to={cta.start} className="w-full">
                  무료로 시작하기
                </SecondaryCta>
              </div>
            </GlassCard>
          </div>

          {/* Pro — 강조 */}
          <div className={revealClass(shown)} style={revealDelay(1)}>
            <GlassCard tone="strong" active accent="241, 74, 180" className="relative flex h-full flex-col p-6 sm:p-7">
              <span
                className="absolute -top-3 right-6 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                style={{ background: 'var(--echo-gradient)' }}
              >
                가장 인기
              </span>
              <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-echo-coral">Pro</p>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[32px] font-bold leading-none text-ink">4,900원</span>
                <span className="text-[13px] text-ink-dim">/ 월부터</span>
              </p>
              <p className="mt-2 text-[13px] text-ink-dim">한 학기를 통째로 쓰는 학기권(19,000원부터)도 있어요.</p>
              <FeatureList items={PRO_FEATURES} accent="#ff667a" />
              <div className="mt-auto pt-7">
                {/* TODO(결제): 결제 연동 전까지는 가입 플로우로 보낸다. */}
                <PrimaryCta to={cta.start} className="w-full">
                  무료로 시작하기
                </PrimaryCta>
                <p className="mt-3 text-center text-[12px] text-ink-muted">
                  Pro 결제는 준비 중입니다. 지금은 Free로 먼저 기록을 쌓아보세요.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Interview Pack — BM의 단기 상품. 2단 구성을 방해하지 않게 아래 띠로만 둔다. */}
        <div className={`${revealClass(shown)} mt-4`} style={revealDelay(2)}>
          <GlassCard tone="ghost" className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-ink">
                Interview Pack <span className="ml-2 text-[12px] font-medium text-ink-muted">준비 중</span>
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
                취업 시즌에 한 번만. 쌓인 기록에서 협업·갈등·실패·주도성·성취 경험을 자동으로
                골라 STARWL로 정리하고, 예상 면접 질문까지 만들어 드립니다.
              </p>
            </div>
            <p className="shrink-0 text-[15px] font-semibold text-ink sm:text-right">
              9,900원 <span className="text-[12px] font-normal text-ink-muted">/ 1회</span>
            </p>
          </GlassCard>
        </div>

        <p className={`${revealClass(shown)} mt-6 text-center text-[12.5px] text-ink-muted`}>
          대학 취업지원센터 · 부트캠프를 위한 기관 라이선스도 준비하고 있습니다.
        </p>
      </div>
    </section>
  );
}
