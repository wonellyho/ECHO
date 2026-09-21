import { GlassCard } from '../ui/GlassCard';
import { BulbIcon, ChartIcon, DocumentIcon, HeartIcon } from '../icons';
import { SectionHeading } from './SectionHeading';
import { Nebula, StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

const VALUES = [
  {
    title: '나의 반복 패턴 발견',
    body: '어떤 상황에서 에너지가 오르고 어디서 소진되는지, 기록에 실제로 남은 근거와 함께 보여줍니다.',
    Icon: ChartIcon,
    accent: '167, 110, 255',
  },
  {
    title: '경험 기반 자기이해',
    body: '성격 유형으로 나를 규정하지 않습니다. ECHO는 내가 쓴 문장에 있는 것만 말합니다.',
    Icon: HeartIcon,
    accent: '241, 74, 180',
  },
  {
    title: '면접용 경험 정리',
    body: '기록 하나를 STARWL(상황·과제·행동·결과·이유·배움)로 바꿔, 면접에서 바로 꺼내 쓸 수 있게 합니다.',
    Icon: DocumentIcon,
    accent: '255, 138, 76',
  },
  {
    title: '중요한 경험을 잊지 않기',
    body: '지금은 사소해 보여도 나중에 필요한 경험이 있습니다. 그때 그 자리에 그대로 있습니다.',
    Icon: BulbIcon,
    accent: '104, 167, 255',
  },
];

export function ValueSection() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section className="relative overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={28} seed={909} />
      <Nebula className="right-[-10%] top-[20%] h-[48vw] w-[48vw] max-h-[400px] max-w-[400px]" color="255, 102, 122" opacity={0.13} />

      <div ref={ref} className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Why ECHO"
          title="기록하는 것에서 끝나지 않습니다."
          description="기록이 쌓일수록 ECHO는 당신이 자주 선택하는 행동, 반복되는 강점과 실패, 문제를 해결하는 방식을 보여줍니다."
          className={revealClass(shown)}
        />

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16">
          {VALUES.map((value, i) => (
            <li key={value.title} className={revealClass(shown)} style={revealDelay(i)}>
              <GlassCard accent={value.accent} className="flex h-full gap-4 p-5 sm:p-6">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background: `rgba(${value.accent}, 0.14)`,
                    boxShadow: `inset 0 0 0 1px rgba(${value.accent}, 0.3)`,
                    color: `rgb(${value.accent})`,
                  }}
                >
                  <value.Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold text-ink">{value.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">{value.body}</p>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
