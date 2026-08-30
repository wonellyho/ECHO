import type { SupabaseClient } from '@supabase/supabase-js';

// 로그인 화면의 소셜 로그인 버튼이 호출하는 얇은 래퍼.
// Supabase 프로젝트에 provider(Google/Kakao)가 등록되기 전까지는 signInWithOAuth가
// 에러를 반환하는데, 그 에러를 그대로 호출부에 돌려줘서 기존 에러 배너에 표시하게 한다.
export type SocialProvider = 'google' | 'kakao';

type AuthOnlyClient = Pick<SupabaseClient, 'auth'>;

export async function signInWithProvider(
  client: AuthOnlyClient,
  provider: SocialProvider,
): Promise<{ error: Error | null }> {
  const { error } = await client.auth.signInWithOAuth({ provider });
  return { error };
}
