import { describe, expect, test } from 'vitest';
import { buildGraph, MAX_EDGES_PER_NODE, type GraphInputEntry, type GraphInputInsight } from './buildGraph';
import type { ExperienceTag } from '../../types';

function entry(id: string, tags: ExperienceTag[] = [], collection_id: string | null = null): GraphInputEntry {
  return { id, label: `기록 ${id}`, tags, collection_id };
}

function insight(
  id: string,
  type: 'energizer' | 'drainer',
  evidence_entry_ids: string[],
): GraphInputInsight {
  return { id, type, summary: `${type} 요약`, evidence_entry_ids };
}

describe('군집 배정', () => {
  test('energizer 근거로 쓰인 기록은 energizer 군집으로 간다', () => {
    const graph = buildGraph([entry('a')], [insight('i1', 'energizer', ['a'])]);
    expect(graph.nodes[0].cluster).toBe('energizer');
  });

  test('drainer 근거로 쓰인 기록은 drainer 군집으로 간다', () => {
    const graph = buildGraph([entry('a')], [insight('i1', 'drainer', ['a'])]);
    expect(graph.nodes[0].cluster).toBe('drainer');
  });

  test('어느 인사이트에도 안 쓰인 기록은 neutral로 간다', () => {
    const graph = buildGraph([entry('a')], [insight('i1', 'energizer', ['b'])]);
    expect(graph.nodes[0].cluster).toBe('neutral');
  });

  test('양쪽 근거인 기록은 energizer 하나로만 간다 — 별이 복제되면 안 된다', () => {
    const graph = buildGraph(
      [entry('a')],
      [insight('i1', 'drainer', ['a']), insight('i2', 'energizer', ['a'])],
    );
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].cluster).toBe('energizer');
  });

  test('인사이트가 없으면 전부 neutral이다', () => {
    const graph = buildGraph([entry('a'), entry('b')], []);
    expect(graph.nodes.map((n) => n.cluster)).toEqual(['neutral', 'neutral']);
    expect(graph.counts).toEqual({ neutral: 2, energizer: 0, drainer: 0 });
  });

  test('실제로 없는 기록을 가리키는 근거 id는 무시한다', () => {
    const graph = buildGraph([entry('a')], [insight('i1', 'energizer', ['ghost'])]);
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].cluster).toBe('neutral');
  });

  test('기록이 하나도 없으면 빈 그래프를 낸다', () => {
    const graph = buildGraph([], [insight('i1', 'energizer', ['a'])]);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.counts).toEqual({ neutral: 0, energizer: 0, drainer: 0 });
  });
});

describe('연결선', () => {
  test('공통 태그가 있으면 잇는다', () => {
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['협업'])], []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].sharedTagCount).toBe(1);
  });

  test('공통 태그도 같은 컬렉션도 아니면 잇지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['갈등'])], []);
    expect(graph.edges).toEqual([]);
  });

  test('같은 컬렉션이면 공통 태그가 없어도 잇고 sameCollection으로 표시한다', () => {
    const graph = buildGraph([entry('a', ['협업'], 'c1'), entry('b', ['갈등'], 'c1')], []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].sameCollection).toBe(true);
  });

  test('컬렉션이 둘 다 null이면 같은 컬렉션으로 치지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'], null), entry('b', ['갈등'], null)], []);
    expect(graph.edges).toEqual([]);
  });

  test('군집이 다르면 태그가 같아도 잇지 않는다', () => {
    const graph = buildGraph(
      [entry('a', ['협업']), entry('b', ['협업'])],
      [insight('i1', 'energizer', ['a'])],
    );
    expect(graph.edges).toEqual([]);
  });

  test('노드 하나가 가지는 연결은 3개를 넘지 않는다', () => {
    const entries = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => entry(id, ['협업']));
    const graph = buildGraph(entries, []);

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
    const graph = buildGraph([entry('a', ['협업']), entry('b', ['협업'])], []);
    const keys = graph.edges.map((e) => `${e.a}|${e.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('자기 자신과는 잇지 않는다', () => {
    const graph = buildGraph([entry('a', ['협업'])], []);
    expect(graph.edges).toEqual([]);
  });

  test('입력 순서가 달라도 같은 연결선이 나온다', () => {
    const entries = ['a', 'b', 'c', 'd', 'e'].map((id) => entry(id, ['협업', '성취']));
    const forward = buildGraph(entries, []);
    const reversed = buildGraph([...entries].reverse(), []);

    const normalize = (edges: { a: string; b: string }[]) =>
      edges.map((e) => `${e.a}|${e.b}`).sort();
    expect(normalize(reversed.edges)).toEqual(normalize(forward.edges));
  });

  test('같은 컬렉션 연결이 태그만 겹치는 연결보다 먼저 자리를 차지한다', () => {
    // a는 b,c,d,e 넷과 태그가 겹치지만 3개만 남는다. b와는 컬렉션까지 같으므로 b는 반드시 살아남는다.
    const entries = [
      entry('a', ['협업'], 'c1'),
      entry('b', ['협업'], 'c1'),
      entry('c', ['협업']),
      entry('d', ['협업']),
      entry('e', ['협업']),
    ];
    const graph = buildGraph(entries, []);
    const hasAB = graph.edges.some(
      (e) => (e.a === 'a' && e.b === 'b') || (e.a === 'b' && e.b === 'a'),
    );
    expect(hasAB).toBe(true);
  });
});

describe('노드 좌표', () => {
  test('각 노드가 좌표를 갖는다', () => {
    const graph = buildGraph([entry('a')], []);
    expect(Number.isFinite(graph.nodes[0].position.x)).toBe(true);
  });

  test('군집 크기가 좌표 계산에 반영된다 — 별이 많으면 더 넓게 퍼진다', () => {
    const one = buildGraph([entry('a')], []);
    const many = buildGraph(
      Array.from({ length: 30 }, (_, i) => entry(`e${i}`)),
      [],
    );
    const target = many.nodes.find((n) => n.id === 'a');
    expect(target).toBeUndefined();
    expect(many.counts.neutral).toBe(30);
    expect(one.counts.neutral).toBe(1);
  });
});
