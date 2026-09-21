import { useMemo } from 'react';
import { GlassCard } from '../ui/GlassCard';
import { TAG_HEX, ALL_TAGS } from '../../lib/tagColors';
import { mulberry32 } from '../../lib/rng';
import type { ExperienceTag } from '../../types';
import { PhoneMockup } from './PhoneMockup';
import { ConstellationScreen } from './AppScreens';
import { SectionHeading } from './SectionHeading';
import { Nebula, StarField } from './StarField';
import { useReveal, revealClass, revealDelay } from './useReveal';

// 랜딩에서 가장 중요한 product showcase.
//
// 태그를 칩으로만 나열하면 "그냥 카테고리"로 읽힌다. 각 태그를 **작은 별무리**로 그려서
// 제품에서 태그가 실제로 어떻게 생겼는지 먼저 보여주고, 옆에 실제 화면 목업을 둔다.

const TAG_COPY: Record<ExperienceTag, string> = {
  협업: '누구와, 어떤 방식으로 함께 일할 때 잘 풀렸는지',
  갈등: '부딪혔을 때 내가 반복해서 꺼내는 해결 방식',
  주도성: '시키지 않아도 먼저 움직였던 순간들',
  실패: '무너진 자리에서 반복되는 패턴 찾기',
  성취: '가장 나답게 잘 해냈던 경험 모아보기',
  문제해결: '면접에서 바로 쓸 수 있는 사례로 정리하기',
};

/** 태그 카드 안에 들어가는 미니 별무리. 태그마다 seed가 달라 모양이 다르다. */
function MiniConstellation({ tag }: { tag: ExperienceTag }) {
  const color = TAG_HEX[tag];
  const stars = useMemo(() => {
    const random = mulberry32(700 + tag.length * 31 + tag.charCodeAt(0) * 7);
    return Array.from({ length: 6 }, () => ({
      x: 12 + random() * 76,
      y: 16 + random() * 68,
      r: 1.1 + random() * 1.7,
    }));
  }, [tag]);

  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14 shrink-0" aria-hidden>
      <circle cx="50" cy="50" r="34" fill={color} opacity="0.1" />
      <polyline
        points={stars.map((s) => `${s.x},${s.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.55"
      />
      {stars.map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y} r={star.r} fill="#fff">
          <animate
            attributeName="opacity"
            values="0.65;1;0.65"
            dur={`${3 + i * 0.6}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

export function ConstellationSection() {
  const { ref, shown } = useReveal<HTMLDivElement>();

  return (
    <section id="constellation" className="relative scroll-mt-20 overflow-hidden py-20 sm:py-24 lg:py-28">
      <StarField count={34} seed={77} />
      <Nebula className="left-1/2 top-[6%] h-[60vw] w-[60vw] max-h-[520px] max-w-[520px] -translate-x-1/2" color="167, 110, 255" opacity={0.14} />

      <div ref={ref} className="relative mx-auto max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Constellation"
          title={
            <>
              당신의 경험은
              <br />
              여섯 개의 별자리로 모입니다.
            </>
          }
          description="협업, 갈등, 주도성, 실패, 성취, 문제해결. ECHO는 흩어진 경험을 연결해 내가 어떤 상황에서 어떻게 행동해왔는지 보여줍니다."
          className={revealClass(shown)}
        />

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-[1fr_minmax(0,20rem)] lg:items-center lg:gap-14">
          <ul className="grid gap-3 sm:grid-cols-2">
            {ALL_TAGS.map((tag, i) => (
              <li key={tag} className={revealClass(shown)} style={revealDelay(i, 70)}>
                <GlassCard accent={hexToRgb(TAG_HEX[tag])} className="flex h-full items-center gap-3 p-4">
                  <MiniConstellation tag={tag} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold" style={{ color: TAG_HEX[tag] }}>
                      #{tag}
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-dim">{TAG_COPY[tag]}</p>
                  </div>
                </GlassCard>
              </li>
            ))}
          </ul>

          <div
            className={`${revealClass(shown)} mx-auto w-full max-w-[15rem] sm:max-w-[17rem] lg:max-w-none`}
            style={{ transitionDelay: '200ms' }}
          >
            <PhoneMockup label="ECHO 별자리 탭 — 태그별로 모인 경험">
              <ConstellationScreen />
            </PhoneMockup>
          </div>
        </div>
      </div>
    </section>
  );
}

function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)).join(', ');
}
