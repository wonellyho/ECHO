import { useEffect, useRef, type RefObject } from 'react';
import {
  bandEnergies,
  breathe,
  envelopeCoefficient,
  followEnvelope,
  type BandEnergies,
} from '../lib/voiceEnergy';

// 영화 Her의 인터페이스 같은 "배경에서 조용히 살아 있는" 음성 시각화.
// 오디오 편집기식 파형(가로로 흐르는 이력 그래프)이 아니라, 크게 번진 빛 덩어리들이
// 각자 다른 주파수 대역에 반응해 부풀고 떠다니는 형태다.
//
// 설계 원칙:
// - 말하지 않을 때도 아주 느리게 숨 쉰다 (breathe) — 화면이 죽어 보이지 않게
// - 말하면 해당 대역의 덩어리가 부푼다 (실제 AnalyserNode 데이터, 가짜 루프 애니메이션 아님)
// - 어택은 빠르고 릴리즈는 느려서(followEnvelope) 이퀄라이저처럼 튀지 않는다
// - **모든 덩어리 색은 바탕보다 밝아야 한다.** 덩어리가 배경을 밝히기만 하므로, 합성 결과의
//   가장 어두운 지점은 항상 바탕 그라디언트 자체가 된다 → 그 한 곳만 대비를 확인하면
//   덩어리가 어디로 움직이든 위에 얹힌 어두운 텍스트의 가독성이 보장된다.
//   여기에 어두운 색을 넣으면 이 보장이 깨진다.

// 어택(차오름)은 빠르게, 릴리즈(잦아듦)는 훨씬 느리게. 60fps 한 프레임 기준값이며,
// 실제 적용 시엔 envelopeCoefficient로 주사율에 맞춰 환산한다.
const ATTACK = 0.14;
const RELEASE = 0.035;

interface BlobSpec {
  band: keyof BandEnergies;
  /** 컨테이너 너비 대비 지름 비율. */
  size: number;
  /** 컨테이너 기준 중심 위치 (0~1). */
  x: number;
  y: number;
  /** 자기 크기 대비 떠다니는 폭. */
  driftX: number;
  driftY: number;
  /** 서로 나누어떨어지지 않는 주기 — 전체 패턴이 눈에 띄게 반복되지 않도록. */
  periodX: number;
  periodY: number;
  periodScale: number;
  phase: number;
  /** 음성 에너지가 크기에 반영되는 정도. */
  gain: number;
  color: string;
  baseOpacity: number;
}

// 위치·크기·주기·대역을 전부 다르게 줘서 좌우 대칭이 아니라 유기적으로 어긋나 보이게 한다.
const BLOBS: BlobSpec[] = [
  {
    band: 'low',
    size: 1.15,
    x: 0.3,
    y: 0.36,
    driftX: 0.07,
    driftY: 0.05,
    periodX: 11.3,
    periodY: 17.9,
    periodScale: 8.9,
    phase: 0,
    gain: 0.5,
    color: 'rgba(255, 236, 210, 0.55)',
    baseOpacity: 0.85,
  },
  {
    band: 'mid',
    size: 0.92,
    x: 0.74,
    y: 0.28,
    driftX: 0.06,
    driftY: 0.08,
    periodX: 13.7,
    periodY: 10.9,
    periodScale: 12.3,
    phase: 1.7,
    gain: 0.42,
    color: 'rgba(255, 246, 232, 0.45)',
    baseOpacity: 0.8,
  },
  {
    band: 'high',
    size: 0.7,
    x: 0.52,
    y: 0.62,
    driftX: 0.09,
    driftY: 0.045,
    periodX: 8.9,
    periodY: 15.1,
    periodScale: 10.3,
    phase: 3.2,
    gain: 0.34,
    color: 'rgba(255, 228, 178, 0.5)',
    baseOpacity: 0.75,
  },
  {
    band: 'low',
    size: 0.8,
    x: 0.4,
    y: 0.12,
    driftX: 0.05,
    driftY: 0.065,
    periodX: 19.1,
    periodY: 12.7,
    periodScale: 14.9,
    phase: 4.8,
    gain: 0.28,
    color: 'rgba(255, 240, 245, 0.36)',
    baseOpacity: 0.7,
  },
];

export function AmbientVoiceField({
  analyserRef,
}: {
  analyserRef: RefObject<AnalyserNode | null>;
}) {
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const elements = blobRefs.current;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 움직임을 줄이도록 설정한 사용자에게는 애니메이션 없이 초기 상태 그대로 둔다
    // (인라인 style에 이미 baseOpacity가 들어가 있으므로 여기서 더 할 일이 없다).
    if (prefersReducedMotion) return;

    const energies: BandEnergies = { low: 0, mid: 0, high: 0 };
    // getByteFrequencyData의 타입 정의가 ArrayBuffer 기반 Uint8Array를 요구하므로 명시한다.
    let spectrum: Uint8Array<ArrayBuffer> | null = null;
    let raf = 0;
    const startedAt = performance.now();
    let lastNow = startedAt;

    const frame = (now: number) => {
      const seconds = (now - startedAt) / 1000;
      const deltaSeconds = (now - lastNow) / 1000;
      lastNow = now;
      const analyser = analyserRef.current;

      // 마이크가 꺼져 있으면 목표를 0으로 둬서 빛이 천천히 잦아든다 (뚝 끊기지 않게).
      let target: BandEnergies = { low: 0, mid: 0, high: 0 };
      if (analyser) {
        if (!spectrum || spectrum.length !== analyser.frequencyBinCount) {
          spectrum = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(spectrum);
        target = bandEnergies(spectrum);
      }
      const attack = envelopeCoefficient(ATTACK, deltaSeconds);
      const release = envelopeCoefficient(RELEASE, deltaSeconds);
      energies.low = followEnvelope(energies.low, target.low, attack, release);
      energies.mid = followEnvelope(energies.mid, target.mid, attack, release);
      energies.high = followEnvelope(energies.high, target.high, attack, release);

      for (let i = 0; i < BLOBS.length; i += 1) {
        const el = elements[i];
        if (!el) continue;
        const blob = BLOBS[i];
        const energy = energies[blob.band];

        // 떠다니는 위치: 아주 느린 두 축의 흔들림.
        const driftX = (breathe(seconds, blob.periodX, blob.phase) - 0.5) * 2 * blob.driftX * 100;
        const driftY =
          (breathe(seconds, blob.periodY, blob.phase + 2.1) - 0.5) * 2 * blob.driftY * 100;

        // 크기: 숨 쉬는 기본 진폭 + 음성 에너지. 두 축을 각각 다른 위상으로 흔들어
        // 완전한 원이 아니라 눌렸다 펴지는 형태가 되게 한다 (균일 확대는 기계적으로 보인다).
        const breathX = breathe(seconds, blob.periodScale, blob.phase + 0.9);
        const breathY = breathe(seconds, blob.periodScale * 1.31, blob.phase + 2.7);
        const scaleX = 0.9 + breathX * 0.16 + energy * blob.gain;
        const scaleY = 0.9 + breathY * 0.16 + energy * blob.gain;

        // 눌린 타원을 조금씩 기울여, 축이 화면과 나란한 "정직한" 도형으로 읽히지 않게 한다.
        // border-radius를 매 프레임 바꾸는 방법도 있지만 그건 페인트를 무효화해서 44px 블러를
        // 매 프레임 다시 계산하게 만든다. transform은 합성 단계에서만 처리되므로 공짜다.
        const tilt = (breathe(seconds, blob.periodScale * 0.77, blob.phase + 5.1) - 0.5) * 24;

        el.style.transform = `translate3d(${driftX}%, ${driftY}%, 0) rotate(${tilt.toFixed(2)}deg) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
        // 숨 쉬는 성분을 밝기에도 섞어, 말이 없을 때도 빛이 아주 느리게 짙어졌다 옅어진다.
        // 세로 신축과 다른 위상을 써야 "밝을 때 항상 길쭉하다"는 상관관계가 눈에 띄지 않는다.
        // baseOpacity에 곱해 내리는 형태라 최대치는 baseOpacity + 0.15로 고정된다 —
        // 배경 합성의 최악값이 커지지 않아야 그 위 텍스트의 대비 보장이 유지된다.
        const breathOpacity = breathe(seconds, blob.periodScale * 1.63, blob.phase + 3.9);
        el.style.opacity = (blob.baseOpacity * (0.88 + breathOpacity * 0.12) + energy * 0.15).toFixed(3);
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {BLOBS.map((blob, index) => (
        <div
          key={index}
          ref={(el) => {
            blobRefs.current[index] = el;
          }}
          className="absolute rounded-full"
          style={{
            width: `${blob.size * 100}%`,
            aspectRatio: '1 / 1',
            left: `${blob.x * 100}%`,
            top: `${blob.y * 100}%`,
            marginLeft: `-${blob.size * 50}%`,
            marginTop: `-${blob.size * 50}%`,
            background: `radial-gradient(circle at 50% 50%, ${blob.color} 0%, transparent 68%)`,
            filter: 'blur(44px)',
            opacity: blob.baseOpacity,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  );
}
