import { useAuth } from './useAuth';

// 내 정보 화면에서 저장한 닉네임을 읽는다 (Supabase Auth의 user_metadata, ProfilePage 참고).
// 아직 설정하지 않았으면 빈 문자열이므로, 화면 제목은 아래 헬퍼로 폴백 문구를 쓴다.
export function useNickname(): string {
  const { user } = useAuth();
  return readNickname(user?.user_metadata);
}

// user_metadata는 클라이언트가 쓸 수 있는 자유 형식이라 문자열이라는 보장이 없다.
// 숫자나 객체가 들어 있어도 화면이 깨지지 않도록 타입을 확인하고 넘긴다.
export function readNickname(metadata: unknown): string {
  if (typeof metadata !== 'object' || metadata === null) return '';
  const value = (metadata as Record<string, unknown>).nickname;
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 닉네임이 있으면 개인화된 제목을, 없으면 기존 문구를 돌려준다.
 *
 * @example withNickname('원호', (n) => `${n}의 경험 기록`, '내 경험 기록') // '원호의 경험 기록'
 */
export function withNickname(
  nickname: string,
  personalized: (nickname: string) => string,
  fallback: string,
): string {
  return nickname ? personalized(nickname) : fallback;
}
