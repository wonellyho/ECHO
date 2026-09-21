import { GlassCard } from '../ui/GlassCard';
import { MicIcon, PulseIcon, TargetIcon } from '../icons';
import { SectionHeading } from './SectionHeading';
import { StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

const STEPS = [
  {
    n: '01',
    title: '기록하기',
    body: '텍스트 또는 음성으로 오늘의 경험을 남깁니다. 잘 쓰려고 애쓸 필요 없이, 있었던 일과 그때 느낀 감정을 그대로요.',
    Icon: MicIcon,
    accent: '255, 138, 76',
  },
  {
    n: '02',
    title: 'AI가 정리하기',
    body: '상황·역할·행동·결과·감정으로 AI가 구조화하고, 여섯 가지 경험 태그를 자동으로 붙입니다.',
    Icon: TargetIcon,
    accent: '104, 167, 255',
  },
  {
    n: '03',
    title: '별자리로 연결하기',
    body: '비슷한 경험들이 태그별 별자리로 모입니다. 기록이 쌓일수록 별자리가 촘촘해집니다.',
    Icon: PulseIcon,
    accent: '167, 110, 255',
  },
];

export function HowItWorksSection() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section id="how" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={26} seed={303} />

      <div ref={ref} className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="기록에서, 나를 발견하기까지."
          description="세 단계면 충분합니다. 나머지는 ECHO가 합니다."
          className={revealClass(shown)}
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {STEPS.map((step, i) => (
            <li key={step.n} className={revealClass(shown)} style={revealDelay(i)}>
              <GlassCard accent={step.accent} className="h-full p-6">
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background: `rgba(${step.accent}, 0.14)`,
                      boxShadow: `inset 0 0 0 1px rgba(${step.accent}, 0.32)`,
                      color: `rgb(${step.accent})`,
                    }}
                  >
                    <step.Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[13px] font-semibold tracking-widest text-ink-muted">{step.n}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-bold text-ink">{step.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-ink-dim">{step.body}</p>
              </GlassCard>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
