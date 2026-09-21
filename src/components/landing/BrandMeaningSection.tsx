import { GlassCard } from '../ui/GlassCard';
import { SectionHeading } from './SectionHeading';
import { Nebula, StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

// ECHO라는 이름이 무슨 뜻인지.
//
// 이 섹션은 기능 설명이 아니라 **서비스의 전제**를 말한다. 그래서 별자리 섹션 바로 다음에
// 둔다 — 여섯 개의 별자리를 이미 본 사람에게 "그래서 이걸 왜 ECHO라고 부르는가"가 가장
// 잘 읽히는 자리다.
//
// ECHO는 두 겹의 이름이다.
//   1) 머리글자: Experience Capture & Human Observation
//   2) 단어 그대로의 메아리: 지나간 것이 사라지지 않고 되돌아온다

const MEANINGS = [
  {
    mark: 'EC',
    title: 'Experience Capture',
    korean: '경험을 붙잡기',
    body: '경험은 생각보다 빨리 흐려집니다. 그 자리에서, 지나가기 전에 텍스트나 음성으로 붙잡아 둡니다.',
    accent: '255, 138, 76',
  },
  {
    mark: 'HO',
    title: 'Human Observation',
    korean: '나를 관찰하기',
    body: '쌓인 기록을 한 발 떨어져 봅니다. 나는 어떤 상황에서, 어떻게 행동하는 사람인가.',
    accent: '167, 110, 255',
  },
];

const SCALE = [
  { label: '하나의 경험', body: '별 하나' },
  { label: '비슷한 경험들', body: '여섯 개의 별자리' },
  { label: '쌓인 시간', body: '나라는 우주' },
];

/** 메아리 — 가운데에서 바깥으로 퍼져 나가는 고리. 이 섹션의 이름값을 하는 장식이다. */
function EchoRipples() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border"
          style={{
            width: `${34 + i * 22}%`,
            aspectRatio: '1 / 1',
            borderColor: `rgba(190, 170, 255, ${0.16 - i * 0.045})`,
            // 퍼지는 움직임은 주지 않는다. 계속 번지는 고리는 배경이 아니라 로딩 인디케이터처럼
            // 읽히고, 이 섹션에서 읽어야 할 것은 글이다.
          }}
        />
      ))}
    </div>
  );
}

export function BrandMeaningSection() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section id="about" className="relative scroll-mt-12 overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={22} seed={4949} />
      <Nebula
        className="left-1/2 top-1/2 h-[64vw] w-[64vw] max-h-[560px] max-w-[560px] -translate-x-1/2 -translate-y-1/2"
        color="241, 74, 180"
        opacity={0.1}
      />
      <EchoRipples />

      <div ref={ref} className="relative mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What ECHO means"
          title={
            <>
              경험은 지나가지만,
              <br />
              그 안의 나는 다시 울려 돌아온다.
            </>
          }
          description="경험은 흘러가도 완전히 사라지지 않습니다. 기록으로 남아 나중에 다시 돌아오고, 비슷한 경험이 반복되면서 비로소 패턴이 보입니다. 메아리처럼요."
          className={revealClass(shown)}
        />

        {/* 머리글자 — ECHO = Experience Capture & Human Observation */}
        <p
          className={`${revealClass(shown)} mt-12 text-center text-[13px] font-semibold tracking-[0.2em] text-ink-muted sm:text-sm lg:mt-16`}
          style={revealDelay(1)}
        >
          <span className="text-ink">E</span>xperience <span className="text-ink">C</span>apture
          <span className="mx-2 text-ink-muted">&amp;</span>
          <span className="text-ink">H</span>uman <span className="text-ink">O</span>bservation
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {MEANINGS.map((meaning, i) => (
            <li key={meaning.mark} className={revealClass(shown)} style={revealDelay(i + 2)}>
              <GlassCard accent={meaning.accent} className="flex h-full gap-4 p-5 sm:p-6">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[15px] font-bold tracking-tight"
                  style={{
                    background: `rgba(${meaning.accent}, 0.14)`,
                    boxShadow: `inset 0 0 0 1px rgba(${meaning.accent}, 0.32)`,
                    color: `rgb(${meaning.accent})`,
                  }}
                >
                  {meaning.mark}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-ink">
                    {meaning.title}
                    <span className="ml-2 text-[13px] font-medium text-ink-dim">{meaning.korean}</span>
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">{meaning.body}</p>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>

        {/* 별 하나 → 별자리 → 우주. 별자리 컨셉이 이름의 뜻과 어떻게 맞물리는지. */}
        <ol className={`${revealClass(shown)} mt-4 grid gap-3 sm:grid-cols-3`} style={revealDelay(4)}>
          {SCALE.map((step, i) => (
            <li key={step.label}>
              <GlassCard tone="ghost" className="relative flex h-full flex-col items-center p-5 text-center">
                {/* 단계가 커질수록 별이 많아진다 — 글자 없이도 "쌓인다"가 읽히게. */}
                <span className="flex h-7 items-center gap-1" aria-hidden>
                  {Array.from({ length: [1, 5, 11][i] }, (_, dot) => (
                    <span
                      key={dot}
                      className="rounded-full bg-white"
                      style={{
                        width: i === 0 ? 7 : i === 1 ? 4 : 2.5,
                        height: i === 0 ? 7 : i === 1 ? 4 : 2.5,
                        opacity: 0.55 + (dot % 3) * 0.15,
                        boxShadow: '0 0 8px rgba(210,225,255,0.7)',
                      }}
                    />
                  ))}
                </span>
                <p className="mt-3 text-[12px] text-ink-muted">{step.label}</p>
                <p className="mt-1 text-[15px] font-bold text-ink">{step.body}</p>
              </GlassCard>
            </li>
          ))}
        </ol>

        <p
          className={`${revealClass(shown)} mt-10 text-center text-[clamp(1.05rem,3.4vw,1.5rem)] font-bold leading-relaxed tracking-tight`}
          style={revealDelay(5)}
        >
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
          >
            경험을 기록하고, 나를 발견하다.
          </span>
        </p>
      </div>
    </section>
  );
}
