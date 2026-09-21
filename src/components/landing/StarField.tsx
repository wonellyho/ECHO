import { useMemo } from 'react';
import { mulberry32 } from '../../lib/rng';

// 랜딩 전용 배경 별. 앱 안에서는 실제 배경 그림(public/bg/*.webp)을 깔지만, 랜딩은 스크롤이
// 아주 길어서 같은 방식으로 깔면 한 장을 세로로 늘려 뭉개지거나 여러 장을 내려받아야 한다.
//
// 그래서 여기서는 "약한 CSS 별 + 성운 그라디언트"만 쓴다. canvas도 three.js도 쓰지 않는다 —
// 랜딩의 별은 주인공이 아니라 배경이고(요구사항: 실제 별자리 UI와 경쟁하지 않게), 저가
// 모바일에서 첫 화면 렌더를 늦출 이유가 없다.

export interface StarFieldProps {
  /** 별 개수. 섹션이 좁을수록 줄인다. */
  count?: number;
  /** 같은 seed면 항상 같은 배치 — 리렌더 때 별이 튀지 않는다. */
  seed?: number;
  className?: string;
}

export function StarField({ count = 48, seed = 20260921, className = '' }: StarFieldProps) {
  const stars = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const size = 0.8 + random() * 1.7;
      return {
        left: `${random() * 100}%`,
        top: `${random() * 100}%`,
        size,
        // 작은 별일수록 흐리게 — 크기와 밝기가 따로 놀면 스티커를 뿌린 것처럼 보인다.
        opacity: 0.18 + (size / 2.5) * 0.45,
        // 큰 별만 깜빡인다. 랜딩 전체에 별이 200개 넘게 깔리는데 전부 애니메이션을 걸면
        // 그만큼 합성 레이어가 생겨서 저사양 모바일에서 스크롤이 끊긴다. 어차피 작고 흐린
        // 별의 깜빡임은 눈에 보이지도 않는다.
        twinkles: size > 1.9,
        duration: `${5 + random() * 7}s`,
        delay: `${-random() * 8}s`,
      };
    });
  }, [count, seed]);

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {stars.map((star, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            boxShadow: `0 0 ${star.size * 2.5}px rgba(210, 225, 255, 0.55)`,
            animation: star.twinkles
              ? `echo-star-twinkle ${star.duration} ease-in-out ${star.delay} infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 성운 한 덩어리. 섹션마다 위치와 색만 바꿔 배경에 깊이를 준다.
 * 앱 배경 그림의 색조(주황~마젠타, 코스믹 바이올렛·블루)와 같은 계열만 쓴다.
 */
export function Nebula({
  className = '',
  color = '167, 110, 255',
  opacity = 0.16,
}: {
  className?: string;
  color?: string;
  opacity?: number;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full ${className}`}
      style={{
        background: `radial-gradient(circle, rgba(${color}, ${opacity}) 0%, rgba(${color}, ${opacity * 0.4}) 38%, rgba(2,4,13,0) 70%)`,
        filter: 'blur(28px)',
      }}
    />
  );
}
