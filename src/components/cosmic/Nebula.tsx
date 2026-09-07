// 성운/우주 먼지. 화면에서 유일하게 "움직이는" 배경 레이어다.
// transform만 애니메이션하므로 레이아웃을 다시 계산하지 않고 합성 단계에서만 처리된다.

export interface NebulaBlob {
  /** 화면 대비 위치(%) */
  x: number;
  y: number;
  /** vmax 단위 지름 */
  size: number;
  color: string;
  /** 한 바퀴 도는 데 걸리는 시간(초). 겹마다 달라야 같이 숨 쉬는 것처럼 보이지 않는다. */
  duration: number;
  delay: number;
}

export interface NebulaProps {
  blobs: NebulaBlob[];
  intensity?: number;
  reducedMotion?: boolean;
  lite?: boolean;
}

export function Nebula({ blobs, intensity = 1, reducedMotion = false, lite = false }: NebulaProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((blob) => (
        <div
          key={`${blob.x}-${blob.y}-${blob.color}`}
          className="absolute rounded-full"
          style={{
            left: `${blob.x}%`,
            top: `${blob.y}%`,
            width: `${blob.size}vmax`,
            height: `${blob.size}vmax`,
            background: `radial-gradient(circle, ${blob.color} 0%, rgba(0,0,0,0) 68%)`,
            filter: `blur(${lite ? 18 : 28}px)`,
            opacity: Math.max(0, Math.min(1, intensity)),
            transform: 'translate(-50%, -50%)',
            animation: reducedMotion
              ? undefined
              : `echo-nebula-drift ${blob.duration}s ease-in-out ${blob.delay}s infinite`,
            willChange: reducedMotion ? undefined : 'transform',
          }}
        />
      ))}
    </div>
  );
}
