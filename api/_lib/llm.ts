// LLM 호출 공통 헬퍼.
// 기본: OpenRouter 무료 모델로 시도 (비용 0원) → 실패(요청 제한, 네트워크 오류, JSON 형식 오류) 시
// Claude Haiku로 자동 폴백. 두 경로 모두 서버(API 함수)에서만 호출하고 키는 절대 클라이언트로 보내지 않는다.

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// openrouter.ai/models 에서 max_price=0으로 필터링해 현재 사용 가능한 무료 모델을 확인하고
// 필요하면 Vercel 환경변수 OPENROUTER_MODEL로 덮어쓸 것 (무료 모델 라인업은 자주 바뀜).
const DEFAULT_OPENROUTER_MODEL = 'z-ai/glm-5.2:free';
const CLAUDE_FALLBACK_MODEL = 'claude-haiku-4-5-20251001';

interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallLlmParams {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
}

interface CallLlmResult<T> {
  data: T;
  provider: 'openrouter' | 'anthropic';
}

/**
 * 응답에서 JSON을 안전하게 파싱한다. 우선순위:
 * 1. ```json ... ``` 코드펜스
 * 2. 응답 전체가 순수 JSON인 경우
 * 3. reasoning 모델이 JSON 앞뒤에 설명 텍스트를 붙이는 경우 — 첫 '{'부터 마지막 '}'까지를 잘라 파싱
 */
function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return JSON.parse(fenced[1].trim()) as T;

  try {
    return JSON.parse(raw.trim()) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      throw new Error('LLM 응답에서 JSON을 찾을 수 없습니다.');
    }
    return JSON.parse(raw.slice(start, end + 1)) as T;
  }
}

async function callOpenRouter(params: CallLlmParams): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      // OpenRouter 권장 헤더 (없어도 동작하지만 무료 모델 우선순위에 도움)
      'HTTP-Referer': 'https://echo-seven-phi-26.vercel.app',
      'X-Title': 'ECHO',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      messages: [{ role: 'system', content: params.system }, ...params.messages],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter 호출 실패 (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (data.error) throw new Error(`OpenRouter 오류: ${data.error.message}`);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter 응답에 content가 없습니다.');
  return text;
}

async function callAnthropic(params: CallLlmParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_FALLBACK_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude API 호출 실패 (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const textBlock = data.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('Claude 응답에 text가 없습니다.');
  return textBlock.text;
}

/**
 * OpenRouter 무료 모델을 먼저 시도하고, 실패하거나 JSON 파싱에 실패하면 Claude Haiku로 폴백한다.
 * OPENROUTER_API_KEY가 없으면 바로 Claude로 간다.
 */
export async function callLlmJson<T>(params: CallLlmParams): Promise<CallLlmResult<T>> {
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const raw = await callOpenRouter(params);
      return { data: extractJson<T>(raw), provider: 'openrouter' };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[llm] OpenRouter 실패, Claude로 폴백:', err instanceof Error ? err.message : err);
    }
  }

  const raw = await callAnthropic(params);
  return { data: extractJson<T>(raw), provider: 'anthropic' };
}
