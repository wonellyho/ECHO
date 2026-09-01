// 마이크 주파수 스펙트럼을 "화면에 쓸 수 있는 몇 개의 값"으로 줄이는 순수 함수들.
// AnalyserNode를 직접 다루는 부분(useMicAnalyser)과 그리는 부분(AmbientVoiceField)에서
// 분리해둬서 단위 테스트가 가능하다.

export interface BandEnergies {
  low: number;
  mid: number;
  high: number;
}

// 각 대역이 차지하는 구간을 전체 bin 개수에 대한 비율로 정의한다 (bin 개수와 무관하게 같은
// 주파수 대역을 가리키도록 절대 인덱스가 아니라 비율로 잡았다).
//
// useMicAnalyser의 fftSize 1024 기준 512 bin. bin 폭은 샘플레이트에 따라 다르다 —
// 48kHz면 46.9Hz, 44.1kHz면 43.1Hz. 아래 주파수는 48kHz 기준이다.
//
// | 대역 | bin    | 주파수(48kHz) | 근거                                    |
// |------|--------|---------------|-----------------------------------------|
// | low  | 2~20   | 94~984Hz      | 기본 주파수(F0) + 제1포먼트             |
// | mid  | 20~82  | 938~3844Hz    | F2/F3 — 자음 명료도                     |
// | high | 82~200 | 3844~9375Hz   | 치찰음                                  |
//
// 0번 bin은 DC 성분이라 제외한다 (low의 하한이 0이 아닌 이유).
const BAND_RANGES: Record<keyof BandEnergies, [number, number]> = {
  low: [0.004, 0.04],
  mid: [0.04, 0.16],
  high: [0.16, 0.39],
};

// 남은 잔여 잡음을 마지막으로 다듬는 값. **무음 차단의 주된 장치가 아니다** —
// 그건 useMicAnalyser의 `minDecibels = -75`가 dB 도메인에서 담당한다(잡음이 실제로 존재하는
// 도메인이라 그쪽이 원리적으로 맞는 자리다). 여기서 크게 잘라내면 dB 창과 이중으로 깎여
// 노트북 내장 마이크처럼 입력이 작은 환경에서 말해도 반응이 거의 없어진다.
//
// 주의: 이 값의 의미는 `minDecibels`에 매여 있다. 현재 창(-75 ~ -20dB) 기준으로
// 0.06 ≈ -71.7dB/bin이다. dB 창을 바꾸면 이 값도 다시 계산해야 한다
// (합성 스펙트럼을 넣는 단위 테스트로는 이 어긋남을 잡을 수 없다).
const NOISE_FLOOR = 0.06;

function averageRange(freq: Uint8Array, from: number, to: number): number {
  const start = Math.max(0, Math.floor(freq.length * from));
  const end = Math.min(freq.length, Math.ceil(freq.length * to));
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i += 1) sum += freq[i];
  const average = sum / (end - start) / 255;
  return Math.max(0, (average - NOISE_FLOOR) / (1 - NOISE_FLOOR));
}

// getByteFrequencyData(0~255)를 저/중/고 3개 대역의 평균 에너지(0~1)로 요약한다.
export function bandEnergies(freq: Uint8Array): BandEnergies {
  return {
    low: averageRange(freq, ...BAND_RANGES.low),
    mid: averageRange(freq, ...BAND_RANGES.mid),
    high: averageRange(freq, ...BAND_RANGES.high),
  };
}

// 엔벨로프 팔로워. 올라갈 때(attack)와 내려갈 때(release)의 속도를 다르게 줘서, 원시 스펙트럼을
// 그대로 쓸 때 생기는 이퀄라이저 같은 깜빡임을 없앤다. release를 attack보다 훨씬 느리게 잡으면
// 말이 끊겨도 빛이 천천히 잦아들어 "살아있는" 느낌이 난다.
export function followEnvelope(
  current: number,
  target: number,
  attack: number,
  release: number,
): number {
  const coefficient = target > current ? attack : release;
  return current + (target - current) * coefficient;
}

// 위 계수는 "60fps에서 한 프레임당" 기준이다. 그대로 매 프레임 적용하면 120Hz 화면에서는 두 배
// 빨라져 이퀄라이저처럼 튀고, 30fps로 떨어지면 두 배 느려져 뭉개진다. 실제 경과 시간으로
// 환산해 어느 주사율에서도 같은 시간 상수를 갖게 한다.
// (탭 전환 등으로 프레임이 오래 비었을 때 한 번에 튀지 않도록 상한을 둔다.)
export function envelopeCoefficient(coefficientAt60Fps: number, deltaSeconds: number): number {
  const frames = Math.min(Math.max(deltaSeconds, 0), 0.1) * 60;
  return 1 - Math.pow(1 - coefficientAt60Fps, frames);
}

// 시간에 따라 아주 느리게 오르내리는 0~1 값. 서로 나누어떨어지지 않는 주기를 여러 개 겹쳐
// 눈에 띄는 반복 없이 "숨 쉬는" 움직임을 만든다 (말하지 않을 때도 화면이 죽어 있지 않도록).
export function breathe(seconds: number, periodSeconds: number, phase: number): number {
  const primary = Math.sin((seconds / periodSeconds) * Math.PI * 2 + phase);
  // 무리수 비율(√2)의 두 번째 성분을 섞어 주기가 딱 떨어지지 않게 흐트러뜨린다.
  const secondary = Math.sin((seconds / (periodSeconds * Math.SQRT2)) * Math.PI * 2 + phase * 1.7);
  return (primary * 0.65 + secondary * 0.35 + 1) / 2;
}
