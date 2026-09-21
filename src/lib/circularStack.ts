// 순환 카드 스택의 인덱스 계산 (CardStackCarousel에서 사용).
//
// 스택은 실제 항목 수보다 훨씬 긴 "가상 인덱스" 공간 위에서 스크롤한다. 화면에 그릴 때는
// 가상 인덱스를 항목 수로 나눈 나머지로 실제 항목을 찾으므로, 목록의 처음과 끝이 이어져
// 위로 올리든 아래로 내리든 카드가 끊기지 않는다.
//
// 항목은 최신순(created_at 내림차순)으로 들어온다. 따라서 첫 카드(가장 최신) 바로 위에는
// 마지막 카드(가장 오래된 기록)가 오는데, 이게 Figma 메모가 요구한 순서다:
// "젤 첫번째 게시글의 바로 위+뒤에 쌓이는건 젤 오래된 기록인거야"

/** 가상 공간이 최소 이 정도 항목 수는 되도록 반복한다 — 끝에 닿는 일이 실질적으로 없게. */
const MIN_VIRTUAL_SLOTS = 600;

/**
 * 항목이 이보다 적으면 순환하지 않는다.
 *
 * 2개일 때 순환시키면 사본이 바로 옆칸(±1)에 오므로 페이드가 그 칸에서 0이 되어야 하고,
 * 결국 가운데 한 장만 보인다 — 순환하지 않을 때보다 오히려 덜 보인다.
 * 3개부터는 위·가운데·아래 세 장이 모두 보이면서 순환이 의미를 갖는다.
 */
export const MIN_ITEMS_FOR_LOOP = 3;

export interface CircularRange {
  /** 순환을 적용할지. 항목이 너무 적으면 false. */
  loop: boolean;
  /** 반복 횟수 (홀수 — 가운데 복사본이 존재하도록). */
  loops: number;
  /** 스크롤 가능한 총 가상 슬롯 수. */
  virtualCount: number;
  /** 가운데 복사본의 시작 가상 인덱스. 초기 위치이자 재중심화의 기준점. */
  baseOffset: number;
}

export function circularRange(itemCount: number): CircularRange {
  if (itemCount < MIN_ITEMS_FOR_LOOP) {
    return { loop: false, loops: 1, virtualCount: Math.max(itemCount, 0), baseOffset: 0 };
  }
  // 홀수로 만들어 정확히 가운데 복사본이 생기게 한다.
  const half = Math.max(1, Math.ceil(MIN_VIRTUAL_SLOTS / itemCount / 2));
  const loops = half * 2 + 1;
  return {
    loop: true,
    loops,
    virtualCount: itemCount * loops,
    baseOffset: half * itemCount,
  };
}

/** 가상 인덱스를 실제 항목 인덱스로 접는다. 음수 가상 인덱스도 올바르게 처리한다. */
export function toRealIndex(virtualIndex: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return ((virtualIndex % itemCount) + itemCount) % itemCount;
}

/**
 * 중앙에서 한 칸 멀어질 때마다 줄일 불투명도.
 *
 * 순환 중에는 같은 항목이 중앙에서 `±itemCount/2` 떨어진 두 자리에 동시에 배치된다.
 * 항목이 화면에 보이는 슬롯 수보다 적으면(예: 기록 5개) 그 두 자리가 **둘 다 보이는 위치**라,
 * 같은 카드가 화면에 두 번 나타난다.
 *
 * 그래서 페이드를 항목 수에 맞춰 가파르게 만든다 — `itemCount/2`칸에서 정확히 투명해지므로
 * 반대편 사본은 항상 보이지 않는다. 부수 효과로 "보이는 카드 수 = 항목 수"가 되어,
 * 기록이 3개면 최신이 가운데, 다음이 아래, 가장 오래된 것이 위에 하나씩만 놓인다.
 *
 * 슬롯을 아예 빼는 방법도 있지만 그러면 스크롤 스냅 지점과 스페이서 높이가 렌더에 따라
 * 달라지고, 사본이 중앙을 지날 때 DOM에서 사라졌다 나타나며 눈에 띄게 튄다.
 */
export function fadeFalloff(itemCount: number, loop: boolean, base = 0.22): number {
  if (!loop || itemCount <= 0) return base;
  // 1 / (itemCount/2) 이면 itemCount/2칸에서 불투명도가 0이 된다.
  return Math.max(base, 2 / itemCount);
}

/**
 * `from`에서 실제 인덱스 `to`로 가는 가장 짧은 부호 있는 이동량(가상 인덱스 단위).
 * 순환 중이므로 뒤로 도는 게 더 가까울 수 있다.
 */
export function shortestWrappedStep(from: number, to: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  const half = Math.floor(itemCount / 2);
  const diff = to - toRealIndex(from, itemCount);
  return ((diff + itemCount + half) % itemCount) - half;
}

/**
 * 기준점에서 너무 멀어졌을 때 되돌릴 거리(가상 인덱스 단위)를 구한다.
 * 항목 수의 배수만큼만 움직이므로 화면에 보이는 카드는 그대로다 — 사용자는 눈치채지 못한다.
 * 되돌릴 필요가 없으면 0.
 *
 * 임계값은 **항목 수의 고정 배수가 아니라 실제로 남은 여유(baseOffset)에 비례**해야 한다.
 * 기준점(baseOffset)은 뒤쪽으로 정확히 그만큼의 여유만 갖는데, 항목이 많아지면
 * `circularRange`의 `half`가 1까지 줄어들어 baseOffset이 itemCount와 같아진다 —
 * 이때 예전처럼 `itemCount * 3`을 임계값으로 쓰면 뒤쪽 여유(itemCount)보다 커서 **영원히
 * 되돌리기가 발동하지 않는다**. 그러면 되돌리기가 없는 채로 계속 한 방향으로 스크롤하다
 * 진짜 DOM 스크롤 끝(가상 인덱스 0 또는 virtualCount-1)에 닿게 되고, 거기서는 우리 계산과
 * 무관하게 브라우저가 스크롤을 강제로 멈춰 카드가 중앙을 벗어난 채 멈추거나 스냅 위치가
 * 어긋나 보인다 — "카드가 많은 컬렉션에서 가끔 카드가 제자리를 못 잡는" 버그의 원인.
 * baseOffset의 절반을 임계값으로 쓰면 항목 수가 아무리 많아 half=1로 줄어도 항상 뒤쪽
 * 여유의 절반이 남은 채로 되돌릴 수 있다.
 */
export function recenterShift(
  currentVirtual: number,
  { loop, baseOffset }: CircularRange,
  itemCount: number,
): number {
  if (!loop || itemCount <= 0) return 0;
  const distance = currentVirtual - baseOffset;
  const threshold = Math.floor(baseOffset / 2);
  if (Math.abs(distance) < threshold) return 0;
  return -Math.round(distance / itemCount) * itemCount;
}
