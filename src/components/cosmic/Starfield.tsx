import { useEffect, useRef } from 'react';
import { generateStars, starfieldBudget, type Star } from '../../lib/cosmic/starfield';

// 별을 캔버스 한 장에 그린다.
//
// 왜 DOM 요소가 아닌가: 별 200개를 div로 만들면 레이아웃 트리에 200개 노드가 붙고, 반짝임을
// CSS 애니메이션으로 주면 200개 레이어가 매 프레임 합성된다. 모바일에서 이건 즉시 체감된다.
// 왜 three.js가 아닌가: 이 화면들에는 3D 카메라가 없다. WebGL 컨텍스트를 화면마다 하나씩
// 만드는 비용(과 모바일의 동시 컨텍스트 상한)을 치를 이유가 없다.
//
// 그리는 방식도 두 겹이다.
//  - 반짝이지 않는 별은 오프스크린 버퍼에 "한 번만" 그리고, 매 프레임 그 버퍼를 통째로 blit한다.
//  - 반짝이는 별(기본 16%)만 매 프레임 다시 그린다.
// prefers-reduced-motion이면 rAF 루프를 아예 돌리지 않고 한 장만 그리고 끝낸다.

export interface StarfieldProps {
  /** 화면마다 다른 하늘이 나오도록 하는 seed. 같은 화면은 항상 같은 하늘이다. */
  seed: string;
  /** 기준 별 개수. 실제 개수는 기기 사양에 따라 줄어든다. */
  density?: number;
  /** 별 크기 배수 */
  scale?: number;
  /** 마우스/기울기에 따른 시차 세기 (px). 0이면 시차 없음. */
  parallax?: number;
  className?: string;
}

// 별 하나를 그릴 스프라이트. 매 프레임 radial-gradient를 새로 만들면 별 개수만큼 비싸다 —
// 색깔별로 한 번씩만 만들어 두고 drawImage로 찍는다.
const TINTS = ['255,255,255', '186,206,255', '255,236,208'] as const;
const SPRITE_SIZE = 32;

function createSprite(rgb: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  // 중심은 작고 아주 밝게, 주변은 넓고 옅게 — 균일한 원이면 "점 찍은 배경"이 된다.
  gradient.addColorStop(0, `rgba(${rgb},1)`);
  gradient.addColorStop(0.16, `rgba(${rgb},0.85)`);
  gradient.addColorStop(0.34, `rgba(${rgb},0.28)`);
  gradient.addColorStop(0.62, `rgba(${rgb},0.06)`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  sprites: HTMLCanvasElement[],
  star: Star,
  width: number,
  height: number,
  alpha: number,
  offsetX: number,
  offsetY: number,
) {
  // 스프라이트는 중심만 밝고 바깥은 투명하므로, 눈에 보이는 크기는 반지름의 몇 배로 잡아야
  // "빛이 번지는" 느낌이 난다.
  const size = star.radius * 7;
  const x = star.x * width + offsetX * star.depth - size / 2;
  const y = star.y * height + offsetY * star.depth - size / 2;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprites[star.tint], x, y, size, size);
}

export function Starfield({
  seed,
  density = 190,
  scale = 1,
  parallax = 0,
  className = '',
}: StarfieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const canvas: HTMLCanvasElement = element;
    const context2d = canvas.getContext('2d');
    if (!context2d) return;
    // 아래 중첩 함수들에서 쓰려면 타입을 명시한 const로 다시 묶어야 한다 — 좁혀진 타입은
    // 클로저 안까지 따라오지 않는다.
    const ctx: CanvasRenderingContext2D = context2d;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const budget = starfieldBudget({
      base: density,
      viewportWidth: window.innerWidth,
      cores: navigator.hardwareConcurrency,
      reduceMotion,
    });
    const stars = generateStars({ count: budget.count, seed, scale });
    const staticStars = stars.filter((star) => star.phase < 0);
    const twinklers = budget.twinkle ? stars.filter((star) => star.phase >= 0) : stars;

    const sprites = TINTS.map(createSprite);
    const buffer = document.createElement('canvas');
    const bufferCtx = buffer.getContext('2d')!;

    let width = 0;
    let height = 0;
    let dpr = 1;
    // 시차는 목표값을 향해 천천히 따라간다 — 즉시 반영하면 손가락을 따라 화면이 출렁인다.
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    function paintBuffer() {
      if (width === 0 || height === 0) return;
      buffer.width = Math.round(width * dpr);
      buffer.height = Math.round(height * dpr);
      bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bufferCtx.clearRect(0, 0, width, height);
      // 정적 별은 시차만큼 넉넉히 여백을 두고 그리는 대신, 버퍼 자체를 통째로 옮겨서 blit한다.
      for (const star of budget.twinkle ? staticStars : []) {
        drawStar(bufferCtx, sprites, star, width, height, star.alpha, 0, 0);
      }
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintBuffer();
      if (!budget.twinkle) paintStatic();
    }

    // 모션을 끈 경우: 한 장만 그리고 루프를 돌리지 않는다.
    function paintStatic() {
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        drawStar(ctx, sprites, star, width, height, star.alpha, 0, 0);
      }
      ctx.globalAlpha = 1;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let frameId = 0;
    let running = budget.twinkle;

    function handlePointerMove(event: PointerEvent) {
      if (parallax === 0) return;
      // -1~1로 정규화한 뒤 세기를 곱한다. 화면 밖으로 나가도 값이 튀지 않게 클램프한다.
      const nx = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, (event.clientY / window.innerHeight) * 2 - 1));
      targetX = -nx * parallax;
      targetY = -ny * parallax;
    }

    function tick(time: number) {
      if (!running) return;
      frameId = requestAnimationFrame(tick);

      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      ctx.clearRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      // 정적 별 버퍼를 시차만큼 옮겨 통째로 찍는다 (별 개수와 무관하게 드로우콜 1회).
      ctx.drawImage(buffer, currentX * 0.55, currentY * 0.55, width, height);

      const seconds = time / 1000;
      for (const star of twinklers) {
        // 아주 느린 호흡. 0.55~1.0 사이만 오간다 — 깜빡이면 지직거려 보인다.
        const pulse = 0.775 + Math.sin(seconds * 0.55 + star.phase) * 0.225;
        drawStar(ctx, sprites, star, width, height, star.alpha * pulse, currentX, currentY);
      }
      ctx.globalAlpha = 1;
    }

    if (parallax > 0 && budget.twinkle) {
      window.addEventListener('pointermove', handlePointerMove, { passive: true });
    }

    // 탭이 백그라운드로 가면 루프를 멈춘다 (모바일 배터리).
    function handleVisibility() {
      if (!budget.twinkle) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frameId);
      } else if (!running) {
        running = true;
        frameId = requestAnimationFrame(tick);
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    if (budget.twinkle) frameId = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [seed, density, scale, parallax]);

  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full ${className}`} />;
}
