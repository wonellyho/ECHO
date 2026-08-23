// Anthropic API 호출 헬퍼 (서버 전용, API 키는 여기서만 사용)
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// 비용 최소화: 구조화/태깅처럼 짧고 정형화된 작업은 Haiku급 모델 사용
export const CHEAP_MODEL = 'claude-haiku-4-5-20251001';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function callClaude(params: {
  system: string;
  messages: ClaudeMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model ?? CHEAP_MODEL,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Claude API 호출 실패 (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const textBlock = data.content.find((b) => b.type === 'text');
  return textBlock?.text ?? '';
}

/** 응답에서 ```json ... ``` 또는 순수 JSON을 안전하게 파싱 */
export function extractJson<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced ? fenced[1] : raw;
  return JSON.parse(jsonText.trim()) as T;
}
