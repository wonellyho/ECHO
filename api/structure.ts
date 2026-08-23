import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLlmJson } from './_lib/llm.js';

const VALID_TAGS = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'] as const;

interface StructureResult {
  situation: string | null;
  role: string | null;
  conflict: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
  tags: string[];
}

const SYSTEM_PROMPT = `너는 대학생의 활동 경험 기록을 분석하는 도우미다.
사용자가 남긴 짧은 기록(텍스트 또는 음성 전사)을 아래 JSON 스키마로 구조화하라.

규칙:
- 기록에 명시적으로 드러나지 않은 내용은 임의로 추측하거나 단정하지 마라. 근거가 없으면 null로 남겨라.
- 감정과 감정의 이유는 기록에 표현된 것에 근거해야 한다.
- 태그는 다음 중에서만 골라라: 협업, 갈등, 주도성, 실패, 성취, 문제해결. 해당 없으면 빈 배열.
- 반드시 아래 JSON 형식으로만 응답하라. JSON 객체 앞뒤에 설명, 추론 과정, 다른 텍스트를 절대 붙이지 마라.

{
  "situation": "어떤 상황이었는지",
  "role": "본인의 역할",
  "conflict": "문제나 갈등이 있었다면 무엇인지 (없으면 null)",
  "action": "실제로 한 행동",
  "result": "결과",
  "emotion": "느낀 감정",
  "emotion_reason": "그 감정을 느낀 이유",
  "tags": ["태그1", "태그2"]
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { raw_text } = req.body as { raw_text?: string };
    if (!raw_text || !raw_text.trim()) {
      res.status(400).json({ error: 'raw_text가 필요합니다.' });
      return;
    }

    const { data: parsed } = await callLlmJson<StructureResult>({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: raw_text }],
      maxTokens: 800,
    });
    parsed.tags = (parsed.tags ?? []).filter((t) => (VALID_TAGS as readonly string[]).includes(t));

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '알 수 없는 오류' });
  }
}
