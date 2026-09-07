// 유성. 자주 보이면 배경이 주인공이 되어버리므로 아주 드물게만 지나간다
// (기본 주기 22~34초, 실제로 보이는 건 그중 1초 남짓).
//
// 요소 1~2개짜리 CSS 애니메이션이다. transform/opacity만 바꾸므로 합성 단계에서 끝난다.

export interface ShootingStarsProps {
  /** 몇 줄기나 (0~2 권장) */
  count?: number;
  /** 진행 방향(deg) */
  angle?: number;
  reducedMotion?: boolean;
}

const TRACKS = [
  { top: '14%', left: '8%', duration: 26, delay: 4 },
  { top: '32%', left: '46%', duration: 34, delay: 17 },
];

export function ShootingStars({ count = 1, angle = 28, reducedMotion = false }: ShootingStarsProps) {
  // 모션을 끈 사용자에게는 아예 렌더하지 않는다 — 정지한 유성은 그냥 이상한 선이다.
  if (reducedMotion || count <= 0) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {TRACKS.slice(0, Math.min(count, TRACKS.length)).map((track) => (
        <span
          key={track.left}
          className="absolute block h-px"
          style={
            {
              top: track.top,
              left: track.left,
              width: '120px',
              // 각도는 커스텀 속성으로 넘긴다 — keyframes가 transform을 통째로 덮어쓰므로
              // 인라인 transform으로는 각도가 살아남지 못한다.
              '--angle': `${angle}deg`,
              background:
                'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(226,236,255,0.85) 85%, #ffffff 100%)',
              opacity: 0,
              animation: `echo-shooting-star ${track.duration}s linear ${track.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
