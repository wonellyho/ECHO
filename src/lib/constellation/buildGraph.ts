import type { ExperienceTag } from '../../types';
import { starPosition, type ClusterId, type Vec3 } from './layout';

// 경험 목록과 인사이트를 별자리 그래프로 바꾼다. three.js를 import하지 않는다 —
// 군집 배정과 연결선 규칙이 이 기능에서 가장 틀리기 쉬운 부분이라 WebGL 없이 검증할 수 있어야 한다.

export interface GraphInputEntry {
  id: string;
  label: string;
  collection_id: string | null;
  tags: ExperienceTag[];
}

export interface GraphInputInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export interface StarNode {
  id: string;
  label: string;
  cluster: ClusterId;
  tags: ExperienceTag[];
  collection_id: string | null;
  position: Vec3;
}

export interface StarEdge {
  a: string;
  b: string;
  sharedTagCount: number;
  sameCollection: boolean;
}

export interface ConstellationGraph {
  nodes: StarNode[];
  edges: StarEdge[];
  counts: Record<ClusterId, number>;
}

// 태그가 6종뿐이라 제한이 없으면 같은 태그를 가진 별들이 완전그래프를 이루고, 경험 30개만
// 넘어가도 화면이 선으로 덮인다. 별자리는 "몇 개의 의미 있는 연결"이 보일 때만 별자리로 읽힌다.
export const MAX_EDGES_PER_NODE = 3;

// 같은 컬렉션은 사용자가 직접 묶은 것이라 LLM이 붙인 태그보다 강한 신호다. 태그 6종 중
// 최대 6개가 겹쳐도 컬렉션 일치를 못 이기도록 가중치를 넉넉히 벌려 둔다.
const SAME_COLLECTION_WEIGHT = 10;

function assignClusters(
  entries: GraphInputEntry[],
  insights: GraphInputInsight[],
): Map<string, ClusterId> {
  const known = new Set(entries.map((e) => e.id));
  const clusterById = new Map<string, ClusterId>();

  // drainer를 먼저 깔고 energizer로 덮어쓴다 — 양쪽 근거인 기록은 energizer가 이긴다.
  // 별을 복제하면 사용자가 "이게 두 번 세어졌나?" 하고 혼란스러워하고 연결선 개수도 이상해진다.
  for (const type of ['drainer', 'energizer'] as const) {
    for (const insight of insights) {
      if (insight.type !== type) continue;
      for (const entryId of insight.evidence_entry_ids) {
        // 삭제된 기록을 가리키는 근거 id가 남아 있을 수 있다.
        if (known.has(entryId)) clusterById.set(entryId, type);
      }
    }
  }

  return clusterById;
}

function sharedTagCount(a: GraphInputEntry, b: GraphInputEntry): number {
  const other = new Set(b.tags);
  return a.tags.reduce((count, tag) => (other.has(tag) ? count + 1 : count), 0);
}

function buildEdges(entries: GraphInputEntry[], clusterById: Map<string, ClusterId>): StarEdge[] {
  const byCluster = new Map<ClusterId, GraphInputEntry[]>();
  for (const entry of entries) {
    const cluster = clusterById.get(entry.id) ?? 'neutral';
    const list = byCluster.get(cluster) ?? [];
    list.push(entry);
    byCluster.set(cluster, list);
  }

  const candidates: (StarEdge & { score: number })[] = [];
  for (const group of byCluster.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];
        const shared = sharedTagCount(first, second);
        const sameCollection =
          first.collection_id !== null && first.collection_id === second.collection_id;
        if (shared === 0 && !sameCollection) continue;

        // 방향을 id 사전순으로 고정해야 입력 순서가 바뀌어도 같은 결과가 나온다.
        const [a, b] = first.id < second.id ? [first.id, second.id] : [second.id, first.id];
        candidates.push({
          a,
          b,
          sharedTagCount: shared,
          sameCollection,
          score: shared + (sameCollection ? SAME_COLLECTION_WEIGHT : 0),
        });
      }
    }
  }

  // 점수 높은 순으로 자리를 채우고, 동점이면 id 사전순 — 결과가 항상 같아야 새로고침해도
  // 같은 별자리가 나온다.
  candidates.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  const degree = new Map<string, number>();
  const edges: StarEdge[] = [];
  for (const candidate of candidates) {
    const degreeA = degree.get(candidate.a) ?? 0;
    const degreeB = degree.get(candidate.b) ?? 0;
    if (degreeA >= MAX_EDGES_PER_NODE || degreeB >= MAX_EDGES_PER_NODE) continue;
    degree.set(candidate.a, degreeA + 1);
    degree.set(candidate.b, degreeB + 1);
    edges.push({
      a: candidate.a,
      b: candidate.b,
      sharedTagCount: candidate.sharedTagCount,
      sameCollection: candidate.sameCollection,
    });
  }

  return edges;
}

export function buildGraph(
  entries: GraphInputEntry[],
  insights: GraphInputInsight[],
): ConstellationGraph {
  const clusterById = assignClusters(entries, insights);

  const counts: Record<ClusterId, number> = { neutral: 0, energizer: 0, drainer: 0 };
  for (const entry of entries) {
    counts[clusterById.get(entry.id) ?? 'neutral'] += 1;
  }

  const nodes: StarNode[] = entries.map((entry) => {
    const cluster = clusterById.get(entry.id) ?? 'neutral';
    return {
      id: entry.id,
      label: entry.label,
      cluster,
      tags: entry.tags,
      collection_id: entry.collection_id,
      position: starPosition(entry.id, cluster, counts[cluster]),
    };
  });

  return { nodes, edges: buildEdges(entries, clusterById), counts };
}
