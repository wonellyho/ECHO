import type { VercelRequest, VercelResponse } from '@vercel/node';

// /api 함수의 호출자 인증.
//
// 왜 필요한가: 이 함수들은 호출 한 번마다 LLM 요금이 나간다. 인증이 없으면 인터넷의 누구나
// curl 한 줄로 우리 Anthropic 크레딧을 태울 수 있다 — 계정도, 키도 필요 없이.
//
// 어떻게 확인하는가: 클라이언트가 자기 Supabase 세션의 access token을 Authorization 헤더로
// 보내고, 여기서 그 토큰을 Supabase에 되물어 유효한지 확인한다.
//
// service role key는 쓰지 않는다 (CLAUDE.md의 데이터 흐름 원칙). anon key + 사용자 토큰으로
// "이 토큰의 주인이 누구냐"만 묻는 것이라, 이 함수가 남의 데이터에 접근할 권한을 갖지 않는다.

/**
 * Supabase 접속 정보. Vercel은 프로젝트 환경변수를 접두사와 무관하게 함수의 process.env로
 * 넘겨주므로, 프론트엔드가 이미 쓰고 있는 VITE_* 값을 그대로 재사용할 수 있다 —
 * 배포 설정에 새로 추가할 환경변수가 없다.
 */
function supabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

type AuthResult = { ok: true; user: AuthedUser } | { ok: false; status: number; message: string };

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * 요청의 Authorization 헤더를 검증하고 호출자를 돌려준다.
 *
 * 설정이 빠졌을 때는 **막는 쪽(fail closed)** 으로 간다. 환경변수를 못 읽었다고 인증을
 * 통과시켜 버리면, 설정 실수 한 번이 곧바로 "누구나 쓰는 무료 LLM 프록시"가 된다.
 */
export async function authenticate(req: VercelRequest): Promise<AuthResult> {
  const config = supabaseConfig();
  if (!config) {
    // eslint-disable-next-line no-console
    console.error('[auth] Supabase 환경변수가 없어 인증할 수 없습니다. 요청을 거부합니다.');
    return { ok: false, status: 500, message: '서버 설정이 올바르지 않습니다.' };
  }

  const token = bearerToken(req);
  if (!token) {
    return { ok: false, status: 401, message: '로그인이 필요합니다.' };
  }

  let res: Response;
  try {
    res = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${token}`,
        apikey: config.anonKey,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth] Supabase 인증 확인 실패:', err instanceof Error ? err.message : err);
    return { ok: false, status: 503, message: '인증 서버에 연결할 수 없습니다.' };
  }

  if (!res.ok) {
    // 만료됐거나 위조된 토큰. 어느 쪽인지는 클라이언트에 알려줄 필요가 없다.
    return { ok: false, status: 401, message: '로그인이 만료되었습니다. 다시 로그인해주세요.' };
  }

  const user = (await res.json()) as { id?: string; email?: string | null };
  if (!user.id) {
    return { ok: false, status: 401, message: '로그인이 필요합니다.' };
  }

  return { ok: true, user: { id: user.id, email: user.email ?? null } };
}

/**
 * 핸들러 앞단의 공통 관문. 통과하면 사용자를, 막히면 응답을 이미 보낸 뒤 null을 돌려준다.
 *
 *   const user = await requireUser(req, res);
 *   if (!user) return;
 */
export async function requireUser(
  req: VercelRequest,
  res: VercelResponse,
): Promise<AuthedUser | null> {
  const result = await authenticate(req);
  if (!result.ok) {
    res.status(result.status).json({ error: result.message });
    return null;
  }
  return result.user;
}
