import type { ExperienceTag } from '../../types';
import { ALL_TAGS } from '../tagColors';
import { CLUSTER_CENTERS, starPosition, type ClusterId, type Vec3 } from './layout';

// 경험 목록을 별자리 그래프로 바꾼다. three.js를 import하지 않는다 —
// 군집 배정과 연결선 규칙이 이 기능에서 가장 틀리기 쉬운 부분이라 WebGL 없이 검증할 수 있어야 한다.
//
// 군집은 태그다: 기록 하나가 태그를 여러 개 가지면 그 기록의 별은 각 태그 군집에 하나씩,
// 중복해서 나타난다("한 카드가 여러 태그에 걸려도 별은 중복돼도 된다" 요청) — 그래서
// 노드 id는 기록 id 하나로 끝나지 않고 `${entryId}::${cluster}`로 군집까지 포함한다.
// 태그가 하나도 없는 기록은 'unassigned' 군집 하나에만 들어간다.

export interface GraphInputEntry {
  id: string;
  label: string;
  collection_id: string | null;
  tags: ExperienceTag[];
}

// InsightsPage가 그대로 들고 있는 인사이트 타입. buildGraph 자체는 더 이상 이걸로 군집을
// 정하지 않지만(태그가 그 역할을 한다), 인사이트 패널/근거 강조 기능은 여전히 이 모양을 쓴다.
export interface GraphInputInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export interface StarNode {
  /** 같은 기록이 여러 태그 군집에 중복으로 나타날 수 있어 군집까지 포함한 고유 id. */
  id: string;
  /** 실제 DB 기록 id — 상세 조회·인사이트 근거 매칭은 전부 이 값을 기준으로 한다. */
  entryId: string;
  label: string;
  cluster: ClusterId;
  tags: ExperienceTag[];
  collection_id: string | null;
  position: Vec3;
}

export interface StarEdge {
  a: string;
  b: string;
  sameCollection: boolean;
}

export interface ConstellationGraph {
  nodes: StarNode[];
  edges: StarEdge[];
  counts: Record<ClusterId, number>;
}

// 한 군집 안에서 별 하나가 가질 수 있는 최대 연결 수. 컬렉션 하나에 기록이 아주 많아지면
// 완전그래프가 돼 화면이 선으로 덮이므로 제한한다.
export const MAX_EDGES_PER_NODE = 3;

const UNASSIGNED: ClusterId = 'unassigned';

// 기록이 속하는 군집(들) — 태그 순서(ALL_TAGS)로 고정해야 다시 그려도 항상 같은 자리에 별이 생긴다.
function clustersFor(entry: GraphInputEntry): ClusterId[] {
  const tags = ALL_TAGS.filter((tag) => entry.tags.includes(tag));
  return tags.length > 0 ? tags : [UNASSIGNED];
}

function emptyCounts(): Record<ClusterId, number> {
  return Object.fromEntries([...ALL_TAGS, UNASSIGNED].map((c) => [c, 0])) as Record<ClusterId, number>;
}

function buildEdges(nodes: StarNode[]): StarEdge[] {
  // 같은 태그 군집 안에서, 같은 컬렉션인 별끼리만 잇는다 — 한 군집의 별은 이미 그 태그를
  // 공유하는 게 당연해서(군집 자체가 그 태그다) "태그 공유" 선은 더 이상 새 정보가 아니다.
  const byCluster = new Map<ClusterId, StarNode[]>();
  for (const node of nodes) {
    const list = byCluster.get(node.cluster) ?? [];
    list.push(node);
    byCluster.set(node.cluster, list);
  }

  const candidates: StarEdge[] = [];
  for (const group of byCluster.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];
        if (first.collection_id === null || first.collection_id !== second.collection_id) continue;
        const [a, b] = first.id < second.id ? [first.id, second.id] : [second.id, first.id];
        candidates.push({ a, b, sameCollection: true });
      }
    }
  }

  // 입력 순서가 달라도 같은 결과가 나오도록 정렬 후 자리를 채운다.
  candidates.sort((x, y) => x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  const degree = new Map<string, number>();
  const edges: StarEdge[] = [];
  for (const candidate of candidates) {
    const degreeA = degree.get(candidate.a) ?? 0;
    const degreeB = degree.get(candidate.b) ?? 0;
    if (degreeA >= MAX_EDGES_PER_NODE || degreeB >= MAX_EDGES_PER_NODE) continue;
    degree.set(candidate.a, degreeA + 1);
    degree.set(candidate.b, degreeB + 1);
    edges.push(candidate);
  }

  return edges;
}

export function buildGraph(entries: GraphInputEntry[]): ConstellationGraph {
  const counts = emptyCounts();

  // 먼저 각 (기록, 군집) 조합을 전부 나열해 군집별 최종 개수를 센 다음, 그 개수를
  // starPosition에 넘긴다 — 군집 크기에 따라 퍼지는 정도가 달라지므로 두 단계로 나눈다.
  const occurrences: { entry: GraphInputEntry; cluster: ClusterId }[] = [];
  for (const entry of entries) {
    for (const cluster of clustersFor(entry)) {
      occurrences.push({ entry, cluster });
      counts[cluster] += 1;
    }
  }

  const nodes: StarNode[] = occurrences.map(({ entry, cluster }) => ({
    id: `${entry.id}::${cluster}`,
    entryId: entry.id,
    label: entry.label,
    cluster,
    tags: entry.tags,
    collection_id: entry.collection_id,
    position: starPosition(entry.id, cluster, counts[cluster]),
  }));

  return { nodes, edges: buildEdges(nodes), counts };
}

/**
 * 사용자가 패턴 탭에서 직접 옮긴 군집(별무리) 위치를 그래프에 반영한다.
 *
 * layout.ts의 CLUSTER_CENTERS(기본 위치)는 건드리지 않는다 — starPosition이 결정적 시드로
 * 계산하는 개별 별의 "군집 중심 기준 상대 좌표"는 그대로 유지한 채, 그래프가 만들어진 뒤에
 * (저장된 위치 - 기본 위치) 오프셋만 통째로 더한다. buildGraph 자체는 계속 순수하고
 * three.js 없이 테스트 가능하게 남는다.
 */
export function applyClusterCenters(
  graph: ConstellationGraph,
  centers: Record<ClusterId, Vec3>,
): ConstellationGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const base = CLUSTER_CENTERS[node.cluster];
      const target = centers[node.cluster];
      if (target.x === base.x && target.y === base.y && target.z === base.z) return node;
      return {
        ...node,
        position: {
          x: node.position.x + (target.x - base.x),
          y: node.position.y + (target.y - base.y),
          z: node.position.z + (target.z - base.z),
        },
      };
    }),
  };
}

/**
 * 사용자가 편집 모드에서 조절한 군집(별무리) 크기를 그래프에 반영한다. 각 별을 그 군집
 * 중심에서 바깥으로(또는 안으로) scale배만큼 밀어낸다 — applyClusterCenters와 마찬가지로
 * buildGraph 자체의 결정적 계산은 건드리지 않고 마지막에 배율만 곱한다.
 */
export function applyClusterScales(
  graph: ConstellationGraph,
  scales: Record<ClusterId, number>,
  centers: Record<ClusterId, Vec3>,
): ConstellationGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const scale = scales[node.cluster] ?? 1;
      if (scale === 1) return node;
      const center = centers[node.cluster];
      return {
        ...node,
        position: {
          x: center.x + (node.position.x - center.x) * scale,
          y: center.y + (node.position.y - center.y) * scale,
          z: center.z + (node.position.z - center.z) * scale,
        },
      };
    }),
  };
}
