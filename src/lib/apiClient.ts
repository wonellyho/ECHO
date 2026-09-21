import { supabase } from './supabaseClient';

// /api 서버 함수를 부르는 단일 창구.
//
// 이 함수들은 호출 한 번마다 LLM 요금이 나가므로 서버가 로그인 여부를 확인한다
// (api/_lib/auth.ts). 그래서 요청마다 지금 세션의 access token을 Authorization 헤더로
// 실어 보내야 한다 — 한 군데서만 하도록 여기로 모았다. fetch를 직접 부르는 화면이
// 생기면 그 화면만 조용히 401을 받게 된다.

export class ApiError extends Error {
  // 생성자 파라미터 프로퍼티(`readonly status: number`)는 이 프로젝트의 tsconfig
  // (erasableSyntaxOnly)에서 금지된다 — 타입을 지우는 것만으로 JS가 되지 않는 문법이라서다.
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * 로그인한 사용자로서 /api 엔드포인트에 JSON을 POST한다.
 *
 * 서버가 돌려준 에러 메시지를 그대로 쓴다 — "요청이 너무 잦습니다", "기록이 너무 깁니다"처럼
 * 사용자가 무엇을 해야 할지 알 수 있는 문장들이라, 화면에서 일반적인 실패 메시지로
 * 덮어버리면 원인을 알 수 없게 된다.
 */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError('로그인이 필요합니다.', 401);
  }

  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // 에러 본문이 JSON이 아닐 수도 있다(게이트웨이 오류 등). 그때는 상태 코드만 가지고 간다.
    let message = `요청에 실패했습니다. (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // 본문 파싱 실패는 무시하고 기본 메시지를 쓴다.
    }
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}
