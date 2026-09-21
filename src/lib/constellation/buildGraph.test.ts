import { describe, expect, test } from 'vitest';
import {
  applyClusterCenters,
  applyClusterScales,
  buildGraph,
  MAX_EDGES_PER_NODE,
  type GraphInputEntry,
} from './buildGraph';
import { CLUSTER_CENTERS } from './layout';
import type { ExperienceTag } from '../../types';

function entry(id: string, tags: ExperienceTag[] = [], collection_id: string | null = null): GraphInputEntry {
  return { id, label: `기록 ${id}`, tags, collection_id };
}

describe('군집 배정 (태그 기반)', () => {
  test('태그가 하나면 그 태그 군집에 별 하나가 생긴다', () => {
    const graph = buildGraph([entry('a', ['협업'])]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].cluster).toBe('협업');
    expect(graph.nodes[0].entryId).toBe('a');
  });

  test('태그가 없으면 미분류(unassigned) 군집으로 간다', () => {
    const graph = buildGraph([entry('a')]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].cluster).toBe('unassigned');
  });

  test('태그를 여러 개 가진 기록은 각 태그 군집에 별이 중복으로 생긴다', () => {
    const graph = buildGraph([entry('a', ['협업', '갈등', '성취'])]);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.nodes.map((n) => n.cluster).sort()).toEqual(['갈등', '성취', '협업']);
    // 전부 같은 기록을 가리켜야 상세 조회가 하나로 모인다.
    expect(graph.nodes.every((n) => n.entryId === 'a')).toBe(true);
    // 노드 id는 군집까지 포함해 서로 달라야 한다(중복 렌더 키 충돌 방지).
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(3);
  });

  test('기록이 하나도 없으면 빈 그래프를 낸다', () => {
    const graph = buildGraph([]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.counts.unassigned).toBe(0);
    expect(graph.counts.협업).toBe(0);
  });

  test('counts는 중복을 포함한 실제 별 개수를 센다', () => {
    const graph = buildGraph([entry('a', ['협업', '갈등']), entry('b', ['협업'])]);
    expect(graph.counts.협업).toBe(2);
    expect(graph.counts.갈등).toBe(1);
  });
});

describe('연결선', () => {
  test('같은 군집·같은 컬렉션이면 잇는다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1'), entry('b', ['협업'], 'c1')]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].sameCollection).toBe(true);
  });

  test('컬렉션이 다르면 태그가 같아도 잇지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1'), entry('b', ['협업'], 'c2')]);
    expect(graph.edges).toEqual([]);
  });

  test('컬렉션이 둘 다 null이면 잇지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['협업'])]);
    expect(graph.edges).toEqual([]);
  });

  test('군집이 다르면(같은 컬렉션이어도) 잇지 않는다 — 다른 태그 군집에 속한 별끼리는 화면에서 멀리 떨어져 있다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1'), entry('b', ['갈등'], 'c1')]);
    expect(graph.edges).toEqual([]);
  });

  test('노드 하나가 가지는 연결은 3개를 넘지 않는다', () => {
    const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => entry(id, ['협업'], 'c1'));
    const graph = buildGraph(entries);

    const degree = new Map<string, number>();
    for (const edge of graph.edges) {
      degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
      degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
    }
    for (const count of degree.values()) {
      expect(count).toBeLessThanOrEqual(MAX_EDGES_PER_NODE);
    }
  });

  test('같은 쌍이 두 번 들어가지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1'), entry('b', ['협업'], 'c1')]);
    const keys = graph.edges.map((e) => `${e.a}|${e.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('자기 자신과는 잇지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1')]);
    expect(graph.edges).toEqual([]);
  });

  test('입력 순서가 달라도 같은 연결선이 나온다', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, ['협업'], 'c1'));
    const forward = buildGraph(entries);
    const reversed = buildGraph([...entries].reverse());

    const normalize = (edges: { a: string; b: string }[]) => edges.map((e) => `${e.a}|${e.b}`).sort();
    expect(normalize(reversed.edges)).toEqual(normalize(forward.edges));
  });
});

describe('노드 좌표', () => {
  test('각 노드가 좌표를 갖는다', () => {
    const graph = buildGraph([entry('a', ['협업'])]);
    expect(Number.isFinite(graph.nodes[0].position.x)).toBe(true);
  });

  test('군집 크기가 좌표 계산에 반영된다 — 별이 많으면 더 넓게 퍼진다', () => {
    const one = buildGraph([entry('a')]);
    const many = buildGraph(Array.from({ length: 30 }, (_, i) => entry(`e${i}`)));
    const target = many.nodes.find((n) => n.entryId === 'a');
    expect(target).toBeUndefined();
    expect(many.counts.unassigned).toBe(30);
    expect(one.counts.unassigned).toBe(1);
  });
});

describe('applyClusterCenters', () => {
  test('기본 위치 그대로면 좌표가 바뀌지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'])]);
    const same = applyClusterCenters(graph, CLUSTER_CENTERS);
    expect(same.nodes[0].position).toEqual(graph.nodes[0].position);
  });

  test('군집을 옮기면 그 군집 노드만 옮긴 만큼 그대로 이동한다', () => {
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['갈등'])]);
    const before = { ...graph.nodes.find((n) => n.cluster === '협업')!.position };
    const moved = applyClusterCenters(graph, {
      ...CLUSTER_CENTERS,
      협업: {
        x: CLUSTER_CENTERS.협업.x + 5,
        y: CLUSTER_CENTERS.협업.y - 2,
        z: CLUSTER_CENTERS.협업.z + 1,
      },
    });
    const movedA = moved.nodes.find((n) => n.cluster === '협업')!;
    const movedB = moved.nodes.find((n) => n.cluster === '갈등')!;
    expect(movedA.position).toEqual({ x: before.x + 5, y: before.y - 2, z: before.z + 1 });
    const originalB = graph.nodes.find((n) => n.cluster === '갈등')!.position;
    expect(movedB.position).toEqual(originalB);
  });
});

describe('applyClusterScales', () => {
  test('배율이 1이면 좌표가 바뀌지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'])]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const same = applyClusterScales(graph, { 협업: 1 } as any, CLUSTER_CENTERS);
    expect(same.nodes[0].position).toEqual(graph.nodes[0].position);
  });

  test('배율을 2로 하면 그 군집 중심에서 거리가 2배가 된다', () => {
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['갈등'])]);
    const before = graph.nodes.find((n) => n.cluster === '협업')!.position;
    const center = CLUSTER_CENTERS.협업;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scaled = applyClusterScales(graph, { 협업: 2 } as any, CLUSTER_CENTERS);
    const after = scaled.nodes.find((n) => n.cluster === '협업')!.position;
    expect(after.x - center.x).toBeCloseTo((before.x - center.x) * 2);
    expect(after.y - center.y).toBeCloseTo((before.y - center.y) * 2);
    expect(after.z - center.z).toBeCloseTo((before.z - center.z) * 2);
    // 다른 군집은 영향받지 않는다.
    const originalB = graph.nodes.find((n) => n.cluster === '갈등')!.position;
    const scaledB = scaled.nodes.find((n) => n.cluster === '갈등')!.position;
    expect(scaledB).toEqual(originalB);
  });
});
