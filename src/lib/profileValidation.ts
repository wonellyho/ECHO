// 닉네임 최대 길이. 하단 네비게이션이나 목록에서 줄바꿈을 일으키지 않을 정도로 잡았다.
export const NICKNAME_MAX_LENGTH = 20;

// 닉네임이 저장 가능한 상태인지 판단한다 (공백만 있는 경우는 저장 불가).
export function canSubmitNickname(nickname: string): boolean {
  const trimmed = nickname.trim();
  return trimmed.length > 0 && trimmed.length <= NICKNAME_MAX_LENGTH;
}

// 저장할 값으로 정규화한다 — 앞뒤 공백은 버린다.
export function normalizeNickname(nickname: string): string {
  return nickname.trim();
}
