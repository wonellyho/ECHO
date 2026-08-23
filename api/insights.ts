import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callClaude, extractJson } from './_lib/anthropic.js';

interface EntryForInsight {
  entry_id: string;
  situation: string | null;
  role: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
}

interface InsightItem {
  summary: string;
  evidence_entry_ids: string[];
}

interface InsightResult {
  energizers: InsightItem[];
  drainers: InsightItem[];
}

const SYSTEM_PROMPT = `너는 대학생의 여러 활동 기록을 보고 반복되는 에너지원(energizer)과
소진 요인(drainer) 패턴을 찾는 도우미다.

규칙:
- 입력된 기록들 중 실제로 근거가 되는 것만 사용해서 패턴을 말하라. 기록에 없는 성격이나 동기를 지어내거나 단정하지 마라.
- 각 패턴 항목에는 반드시 근거가 된 entry_id를 evidence_entry_ids에 포함해라. 근거가 2개 이상 있으면 모두 넣어라.
- 근거가 부족하면(예: 비슷한 패턴이 1번밖에 없으면) 무리해서 만들지 말고 항목 수를 줄여라.
- 반드시 아래 JSON 형식으로만 응답하라.

{
  "energizers": [{ "summary": "...", "evidence_entry_ids": ["..."] }],
  "drainers": [{ "summary": "...", "evidence_entry_ids": ["..."] }]
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { entries } = req.body as { entries?: EntryForInsight[] };
    if (!entries || entries.length === 0) {
      res.status(400).json({ error: 'entries가 필요합니다.' });
      return;
    }

    const input = JSON.stringify(entries, null, 2);

    const raw = await callClaude({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
      maxTokens: 1200,
    });

    const parsed = extractJson<InsightResult>(raw);
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '알 수 없는 오류' });
  }
}
