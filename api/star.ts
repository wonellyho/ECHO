import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLlmJson } from './_lib/llm.js';

interface StarResult {
  situation: string;
  task: string;
  action: string;
  result: string;
}

const SYSTEM_PROMPT = `너는 대학생의 구조화된 경험 기록을 STAR(Situation, Task, Action, Result) 형식의
면접·자소서 소재로 다듬는 도우미다.

규칙:
- 입력으로 주어진 구조화 데이터에 없는 사실을 지어내지 마라. 문장을 다듬고 연결하는 것은 괜찮지만 새로운 사실을 추가하지 마라.
- 각 항목은 2~4문장 정도로, 면접에서 바로 말할 수 있는 자연스러운 한국어 문장으로 작성하라.
- 반드시 아래 JSON 형식으로만 응답하라.

{
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "..."
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
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
    };

    const input = JSON.stringify(structured, null, 2);

    const { data: parsed } = await callLlmJson<StarResult>({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
      maxTokens: 800,
    });
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '알 수 없는 오류' });
  }
}
