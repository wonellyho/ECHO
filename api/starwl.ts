import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLlmJson } from './_lib/llm.js';
import { requireUser } from './_lib/auth.js';
import { checkRateLimit, LLM_RATE_LIMIT } from './_lib/rateLimit.js';

/**
 * 입력으로 받는 구조화 데이터 전체의 길이 상한(JSON 직렬화 기준).
 * structure.ts의 MAX_RAW_TEXT_LENGTH와 같은 이유 — 입력 길이에 요금이 비례한다.
 * 여기 들어오는 건 이미 구조화된 8개 필드라 원문보다 짧다.
 */
const MAX_INPUT_LENGTH = 8000;

interface StarWlResult {
  situation: string;
  task: string;
  action: string;
  result: string;
  why: string | null;
  learning: string | null;
}

const SYSTEM_PROMPT = `너는 대학생의 구조화된 경험 기록을 STARWL(Situation, Task, Action, Result, Why, Learning) 형식의
면접·자소서 소재로 다듬는 도우미다.

규칙:
- 입력으로 주어진 구조화 데이터에 없는 사실을 지어내지 마라. 문장을 다듬고 연결하는 것은 괜찮지만 새로운 사실을 추가하지 마라.
- situation/task/action/result는 각각 2~4문장 정도로, 면접에서 바로 말할 수 있는 자연스러운 한국어 문장으로 작성하라.
- why는 입력된 역할(role)·갈등(conflict)·감정의 이유(emotion_reason)에 근거해서만, 그 행동을 왜 그렇게 선택했는지 설명하라. 근거가 부족하면 null로 남겨라.
- learning은 입력에 realization(깨달음)이 있으면 그 내용을 자연스러운 문장으로 다듬어 사용하라. realization이 없으면 근거가 부족한 것이므로 null로 남겨라. result나 emotion에서 유추해서 지어내지 마라.
- 반드시 아래 JSON 형식으로만 응답하라. JSON 객체 앞뒤에 설명, 추론 과정, 다른 텍스트를 절대 붙이지 마라.

{
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "...",
  "why": "... 또는 null",
  "learning": "... 또는 null"
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // 이 아래로는 전부 요금이 나가는 경로다 (structure.ts와 같은 관문).
  const user = await requireUser(req, res);
  if (!user) return;

  const limit = checkRateLimit(`${user.id}:starwl`, LLM_RATE_LIMIT);
  if (!limit.allowed) {
    res.setHeader('retry-after', String(limit.retryAfterSeconds));
    res.status(429).json({ error: '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.' });
    return;
  }

  try {
    const structured = req.body as {
      situation?: string | null;
      role?: string | null;
      conflict?: string | null;
      action?: string | null;
      result?: string | null;
      emotion?: string | null;
      emotion_reason?: string | null;
      realization?: string | null;
    };

    const input = JSON.stringify(structured, null, 2);
    if (input.length > MAX_INPUT_LENGTH) {
      res.status(413).json({ error: '변환할 내용이 너무 깁니다.' });
      return;
    }

    const { data: parsed } = await callLlmJson<StarWlResult>({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
      maxTokens: 800,
    });
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '알 수 없는 오류' });
  }
}
