import { useEffect, useRef } from 'react';
import { buildCloudScene, type CloudLayer } from '../../lib/cosmic/clouds';

// 은하수·성운·먼 은하·성단을 캔버스 한 장에 그린다.
//
// **정적 레이어다.** 리사이즈될 때 한 번만 그리고 rAF 루프를 돌리지 않는다. 반짝임은 위에
// 얹히는 Starfield가 따로 담당한다 — 움직이는 것과 안 움직이는 것을 갈라야 매 프레임 비용이
// 별 몇십 개로 유지된다.
//
// 비용을 더 줄이는 장치가 하나 더 있다: 구름은 어차피 흐릿하므로 **절반 해상도**로 그린 뒤
// 확대해 얹는다. 채우는 픽셀 수가 1/4이 되는데 결과는 눈으로 구분되지 않는다.
// 별은 점이라 해상도가 떨어지면 바로 티가 나므로 원래 해상도로 따로 그린다.

export interface CosmicBackdropProps {
  layers: CloudLayer[];
  /** 화면마다 다른 하늘이 나오게 하는 seed */
  seed: string;
  className?: string;
}

const CLOUD_SCALE = 0.5;

export function CosmicBackdrop({ layers, seed, className = '' }: CosmicBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // layers는 매 렌더 새 배열로 오지만 내용은 그대로다 — 문자열로 지문을 떠서 실제로 바뀔 때만
  // 다시 그린다(안 그러면 리렌더마다 수백 개 그라디언트를 새로 만든다).
  const signature = JSON.stringify(layers);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const canvas: HTMLCanvasElement = element;
    const context2d = canvas.getContext('2d');
    if (!context2d) return;
    const ctx: CanvasRenderingContext2D = context2d;

    const scene = buildCloudScene(JSON.parse(signature) as CloudLayer[], seed);

    // 구름용 저해상도 버퍼
    const cloud = document.createElement('canvas');
    const cloudCtx = cloud.getContext('2d');
    if (!cloudCtx) return;

    function paintBlobs(
      target: CanvasRenderingContext2D,
      blobs: typeof scene.glow,
      width: number,
      height: number,
      unit: number,
      composite: GlobalCompositeOperation,
    ) {
      target.globalCompositeOperation = composite;
      for (const blob of blobs) {
        const x = blob.x * width;
        const y = blob.y * height;
        const r = Math.max(1, blob.radius * unit);
        // 화면 밖으로 완전히 벗어난 블롭은 건너뛴다 — 은하수는 화면 밖까지 이어지도록
        // 넉넉히 생성하므로 실제로 꽤 걸러진다.
        if (x + r < 0 || x - r > width || y + r < 0 || y - r > height) continue;
        const gradient = target.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(${blob.color}, ${blob.alpha})`);
        gradient.addColorStop(0.45, `rgba(${blob.color}, ${blob.alpha * 0.45})`);
        gradient.addColorStop(1, `rgba(${blob.color}, 0)`);
        target.fillStyle = gradient;
        target.fillRect(x - r, y - r, r * 2, r * 2);
      }
      target.globalCompositeOperation = 'source-over';
    }

    // 마지막으로 그린 크기. 모바일에서 주소창이 나타났다 사라질 때마다 ResizeObserver가
    // 계속 울리는데, 그때마다 수백 개 그라디언트를 다시 채우면 스크롤이 눈에 띄게 끊긴다.
    // 폭이 그대로이고 높이 변화가 작으면 다시 그리지 않는다 — 구름은 흐릿해서 티가 안 난다.
    let painted = { width: 0, height: 0 };

    function paint() {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      if (
        painted.width === rect.width &&
        Math.abs(painted.height - rect.height) < painted.height * 0.12
      ) {
        return;
      }
      painted = { width: rect.width, height: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width;
      const height = rect.height;
      // 정규 반지름의 기준. 짧은 쪽이 아니라 대각선을 쓰면 세로로 긴 모바일에서도
      // 띠가 화면을 제대로 가로지른다.
      const unit = Math.hypot(width, height);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // ── 구름 (저해상도 버퍼) ──
      const cw = Math.max(1, Math.round(width * CLOUD_SCALE));
      const ch = Math.max(1, Math.round(height * CLOUD_SCALE));
      cloud.width = cw;
      cloud.height = ch;
      cloudCtx!.setTransform(1, 0, 0, 1, 0, 0);
      cloudCtx!.clearRect(0, 0, cw, ch);
      // 빛을 먼저 더해 쌓고(lighter), 그 위에 암흑성운을 덮어 띠를 갈라 놓는다.
      paintBlobs(cloudCtx!, scene.glow, cw, ch, unit * CLOUD_SCALE, 'lighter');
      paintBlobs(cloudCtx!, scene.dark, cw, ch, unit * CLOUD_SCALE, 'source-over');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cloud, 0, 0, width, height);

      // ── 성단의 연결선 (별보다 먼저 — 선이 별 위를 지나가면 안 된다) ──
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(190, 208, 255, 0.18)';
      ctx.lineWidth = 1;
      for (const link of scene.links) {
        const a = scene.stars[link.from];
        const b = scene.stars[link.to];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x * width, a.y * height);
        ctx.lineTo(b.x * width, b.y * height);
        ctx.stroke();
      }

      // ── 별 (원래 해상도) ──
      for (const star of scene.stars) {
        const x = star.x * width;
        const y = star.y * height;
        if (x < -4 || x > width + 4 || y < -4 || y > height + 4) continue;
        // 중심의 점 + 그 둘레의 옅은 번짐. 균일한 원이면 "점 찍은 배경"이 된다.
        const halo = ctx.createRadialGradient(x, y, 0, x, y, star.radius * 4);
        halo.addColorStop(0, `rgba(${star.color}, ${star.alpha})`);
        halo.addColorStop(0.3, `rgba(${star.color}, ${star.alpha * 0.35})`);
        halo.addColorStop(1, `rgba(${star.color}, 0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(x - star.radius * 4, y - star.radius * 4, star.radius * 8, star.radius * 8);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    paint();

    return () => observer.disconnect();
  }, [signature, seed]);

  return <canvas ref={canvasRef} aria-hidden className={`absolute inset-0 h-full w-full ${className}`} />;
}
