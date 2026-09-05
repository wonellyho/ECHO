# 패턴 탭 경험 별자리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 패턴 탭을 텍스트 리스트에서 3D 별자리 우주로 바꾼다 — 경험 = 별, 인사이트 근거 = 별무리, 공통 태그 = 연결선.

**Architecture:** 계산(군집 배정·좌표·연결선)은 three.js를 import하지 않는 순수 함수 두 개(`buildGraph.ts`, `layout.ts`)에 모으고 vitest로 검증한다. 렌더는 `ConstellationCanvas.tsx` 하나가 `useEffect` 안에서 명령형 three.js 씬을 만들고 cleanup에서 dispose한다. React는 캔버스 바깥의 오버레이 카드와 군집 라벨 DOM만 소유하고, 라벨 위치는 매 프레임 ref로 직접 style을 쓴다(state를 쓰면 프레임마다 리렌더된다).

**Tech Stack:** Vite + React 19 + TypeScript, three.js (plain, R3F 없이), Tailwind v4, Supabase, vitest

## Global Constraints

- 스펙 원본: `docs/superpowers/specs/2026-09-05-constellation-insights-design.md`. 어긋나면 스펙이 기준이다.
- 군집은 3종 고정: `neutral` / `energizer` / `drainer`. 한 경험은 정확히 한 군집에만 속한다.
- 양쪽 인사이트의 근거인 경험은 **energizer 우선**.
- 연결선은 **같은 군집 안에서만**, **노드당 최대 3개**.
- 별 좌표는 entry id 해시 기반 **결정적** 계산. `Math.random()` 금지.
- 태그는 `협업/갈등/주도성/실패/성취/문제해결` 6종 고정 (`src/lib/tagColors.ts`의 `ALL_TAGS`).
- 다크 팔레트 유지: 배경 `bg-slate-950`, 카드 `bg-slate-900` + `border-slate-800`, 본문 `text-slate-100`, 보조 `text-slate-400`.
- 하단 네비게이션 높이는 `var(--bottom-nav-total)` 하나로만 참조한다 (하드코딩 금지).
- `service_role` 키를 쓰지 않는다. 프론트에서 anon key + RLS로만 읽는다.
- 테스트 환경에 jsdom이 없다. **컴포넌트 테스트를 쓰지 말 것** — 순수 함수만 vitest로 검증하고 UI는 빌드 + 브라우저 확인으로 검증한다.
- 이 프로젝트의 주석과 UI 문구는 한국어다. 주석은 "무엇을"이 아니라 "왜"를 쓴다.
- 매 태스크 끝에 `npm test`, `npm run lint`, `npm run build` 전부 통과해야 커밋한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/constellation/layout.ts` | entry id → 결정적 3D 좌표, 군집 중심 상수. three.js 무의존 |
| `src/lib/constellation/layout.test.ts` | 결정성·반경 경계 검증 |
| `src/lib/constellation/buildGraph.ts` | entries + insights → `{nodes, edges, counts}`. 군집 배정과 연결선 규칙 전부 |
| `src/lib/constellation/buildGraph.test.ts` | 군집 우선순위·군집 간 선 없음·차수 3 제한 검증 |
| `src/components/constellation/ConstellationCanvas.tsx` | three.js 씬 소유. 별/선 렌더, OrbitControls, raycast, 카메라 포커스, 군집 라벨 위치 갱신 |
| `src/components/constellation/StarDetailCard.tsx` | 선택된 별의 경험 상세 오버레이 |
| `src/components/constellation/ClusterSummaryCard.tsx` | 군집 인사이트 요약 오버레이 (+ WebGL 폴백에서 재사용) |
| `src/pages/InsightsPage.tsx` | Supabase 로딩, 재생성, 선택 상태 조율만 |
| `design.md` | 패턴 탭 절 갱신 |

---

### Task 1: 결정적 별 좌표 (`layout.ts`)

**Files:**
- Create: `src/lib/constellation/layout.ts`
- Test: `src/lib/constellation/layout.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type ClusterId = 'neutral' | 'energizer' | 'drainer'`
  - `interface Vec3 { x: number; y: number; z: number }`
  - `const CLUSTER_CENTERS: Record<ClusterId, Vec3>`
  - `const CLUSTER_COLORS: Record<ClusterId, string>` (hex 문자열)
  - `const CLUSTER_LABELS: Record<ClusterId, string>` (한국어 이름)
  - `function hashId(id: string): number`
  - `function clusterRadius(count: number): number`
  - `function starPosition(entryId: string, cluster: ClusterId, clusterSize: number): Vec3`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `src/lib/constellation/layout.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  CLUSTER_CENTERS,
  CLUSTER_COLORS,
  CLUSTER_LABELS,
  clusterRadius,
  hashId,
  starPosition,
} from './layout';

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

describe('hashId', () => {
  test('같은 문자열은 항상 같은 값', () => {
    expect(hashId('entry-abc')).toBe(hashId('entry-abc'));
  });

  test('다른 문자열은 다른 값', () => {
    expect(hashId('entry-abc')).not.toBe(hashId('entry-abd'));
  });

  test('빈 문자열도 유한한 정수를 낸다', () => {
    const h = hashId('');
    expect(Number.isFinite(h)).toBe(true);
    expect(Number.isInteger(h)).toBe(true);
  });
});

describe('clusterRadius', () => {
  test('별이 많아질수록 반경이 커진다', () => {
    expect(clusterRadius(20)).toBeGreaterThan(clusterRadius(3));
  });

  test('별이 0개여도 0이 아닌 반경을 낸다 (0으로 나누기 방지)', () => {
    expect(clusterRadius(0)).toBeGreaterThan(0);
  });
});

describe('starPosition', () => {
  test('같은 입력이면 항상 같은 좌표 — 새로고침해도 별이 같은 자리에 있어야 한다', () => {
    const a = starPosition('entry-1', 'neutral', 10);
    const b = starPosition('entry-1', 'neutral', 10);
    expect(a).toEqual(b);
  });

  test('다른 기록은 다른 자리에 놓인다', () => {
    const a = starPosition('entry-1', 'neutral', 10);
    const b = starPosition('entry-2', 'neutral', 10);
    expect(distance(a, b)).toBeGreaterThan(0);
  });

  test('같은 id라도 군집이 다르면 그 군집 중심 근처로 간다', () => {
    const e = starPosition('entry-1', 'energizer', 10);
    const d = starPosition('entry-1', 'drainer', 10);
    expect(distance(e, CLUSTER_CENTERS.energizer)).toBeLessThanOrEqual(clusterRadius(10) + 1e-9);
    expect(distance(d, CLUSTER_CENTERS.drainer)).toBeLessThanOrEqual(clusterRadius(10) + 1e-9);
  });

  test('어떤 id를 넣어도 군집 반경을 벗어나지 않는다', () => {
    const radius = clusterRadius(50);
    for (let i = 0; i < 200; i += 1) {
      const pos = starPosition(`entry-${i}`, 'neutral', 50);
      expect(distance(pos, CLUSTER_CENTERS.neutral)).toBeLessThanOrEqual(radius + 1e-9);
    }
  });

  test('좌표에 NaN이 없다', () => {
    const pos = starPosition('한글-아이디-😀', 'drainer', 7);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.y)).toBe(true);
    expect(Number.isFinite(pos.z)).toBe(true);
  });
});

describe('군집 상수', () => {
  test('세 군집이 서로 다른 자리에 있다', () => {
    expect(distance(CLUSTER_CENTERS.neutral, CLUSTER_CENTERS.energizer)).toBeGreaterThan(5);
    expect(distance(CLUSTER_CENTERS.energizer, CLUSTER_CENTERS.drainer)).toBeGreaterThan(5);
  });

  test('세 군집 모두 색과 이름을 갖는다', () => {
    for (const key of ['neutral', 'energizer', 'drainer'] as const) {
      expect(CLUSTER_COLORS[key]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(CLUSTER_LABELS[key].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- layout`
Expected: FAIL — `Failed to resolve import "./layout"`

- [ ] **Step 3: 구현한다**

Create `src/lib/constellation/layout.ts`:

```ts
// 별 하나하나의 3D 좌표를 "결정적으로" 계산한다. Math.random()을 쓰지 않는 게 이 파일의 핵심 —
// 새로고침마다 별이 다른 자리로 가면 "왼쪽 위 저 별이 그때 그 발표 경험" 같은 공간 기억이
// 성립하지 않는다. PRD §8의 성공 기준에 "회상 가능성"이 있고 이 화면이 그걸 직접 겨냥한다.
// three.js를 import하지 않는다 — WebGL 없이 vitest로 검증할 수 있어야 한다.

export type ClusterId = 'neutral' | 'energizer' | 'drainer';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// 세 군집을 삼각 구도로 고정 배치한다. 어느 각도에서 봐도 세 덩어리로 읽히도록 z는 0으로 두고
// xy 평면에 벌려 놓았다 (별 자체는 각 중심 주위 구(球)에 흩어지므로 입체감은 거기서 나온다).
export const CLUSTER_CENTERS: Record<ClusterId, Vec3> = {
  neutral: { x: 0, y: 7, z: 0 },
  energizer: { x: -10, y: -5, z: 0 },
  drainer: { x: 10, y: -5, z: 0 },
};

export const CLUSTER_COLORS: Record<ClusterId, string> = {
  neutral: '#E8EAF2',
  energizer: '#F5B451',
  drainer: '#7C89A8',
};

export const CLUSTER_LABELS: Record<ClusterId, string> = {
  neutral: '전체 경험',
  energizer: '에너지를 얻는 순간',
  drainer: '소진되는 순간',
};

const BASE_RADIUS = 2.2;

// FNV-1a 32비트. 짧고 의존성이 없으며 비슷한 id(uuid는 앞부분이 겹치기 쉽다)도 잘 흩어준다.
export function hashId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// mulberry32 — seed 하나에서 서로 독립적인 난수 여러 개를 순서대로 뽑기 위한 것.
// 좌표 세 축에 같은 해시를 그대로 쓰면 별들이 대각선 위에 줄지어 선다.
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 별이 늘어도 군집 안 밀도가 일정하게 유지되도록 부피에 비례해 반경을 키운다(세제곱근).
export function clusterRadius(count: number): number {
  return BASE_RADIUS * Math.cbrt(Math.max(count, 1));
}

export function starPosition(entryId: string, cluster: ClusterId, clusterSize: number): Vec3 {
  // 군집을 시드에 섞어야 같은 기록이 다른 군집으로 옮겨갔을 때 자리도 따라 바뀐다.
  const random = mulberry32(hashId(`${cluster}:${entryId}`));
  const theta = random() * Math.PI * 2;
  // acos(2v-1)로 φ를 뽑아야 구 표면에 고르게 퍼진다(그냥 v*π를 쓰면 양극에 몰린다).
  const phi = Math.acos(2 * random() - 1);
  // 세제곱근을 씌워야 구 "부피"에 고르게 퍼진다(안 씌우면 중심에 뭉친다).
  const radius = clusterRadius(clusterSize) * Math.cbrt(random());
  const center = CLUSTER_CENTERS[cluster];

  return {
    x: center.x + radius * Math.sin(phi) * Math.cos(theta),
    y: center.y + radius * Math.sin(phi) * Math.sin(theta),
    z: center.z + radius * Math.cos(phi),
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- layout`
Expected: PASS (모든 테스트)

- [ ] **Step 5: 린트와 빌드**

Run: `npm run lint && npm run build`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/constellation/layout.ts src/lib/constellation/layout.test.ts
git commit -m "feat: 별자리 별 좌표를 entry id 해시로 결정적으로 계산"
```

---

### Task 2: 군집 배정과 연결선 (`buildGraph.ts`)

**Files:**
- Create: `src/lib/constellation/buildGraph.ts`
- Test: `src/lib/constellation/buildGraph.test.ts`

**Interfaces:**
- Consumes: Task 1의 `ClusterId`, `Vec3`, `starPosition`, `clusterRadius`
- Produces:
  - `interface GraphInputEntry { id: string; label: string; collection_id: string | null; tags: ExperienceTag[] }`
  - `interface GraphInputInsight { id: string; type: 'energizer' | 'drainer'; summary: string; evidence_entry_ids: string[] }`
  - `interface StarNode { id: string; label: string; cluster: ClusterId; tags: ExperienceTag[]; collection_id: string | null; position: Vec3 }`
  - `interface StarEdge { a: string; b: string; sharedTagCount: number; sameCollection: boolean }`
  - `interface ConstellationGraph { nodes: StarNode[]; edges: StarEdge[]; counts: Record<ClusterId, number> }`
  - `const MAX_EDGES_PER_NODE = 3`
  - `function buildGraph(entries: GraphInputEntry[], insights: GraphInputInsight[]): ConstellationGraph`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `src/lib/constellation/buildGraph.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- buildGraph`
Expected: FAIL — `Failed to resolve import "./buildGraph"`

- [ ] **Step 3: 구현한다**

Create `src/lib/constellation/buildGraph.ts`:

```ts
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
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- buildGraph`
Expected: PASS (모든 테스트)

- [ ] **Step 5: 린트와 빌드**

Run: `npm run lint && npm run build`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/constellation/buildGraph.ts src/lib/constellation/buildGraph.test.ts
git commit -m "feat: 인사이트 근거로 별 군집 배정, 공통 태그로 연결선 생성"
```

---

### Task 3: three.js 우주 렌더 + 패턴 탭 배선

이 태스크가 끝나면 패턴 탭에 실제로 별자리가 뜨고 손가락으로 돌릴 수 있다. 아직 별을 눌러도 아무 일도 일어나지 않는다(Task 4).

**Files:**
- Modify: `package.json` (three 추가)
- Create: `src/components/constellation/ConstellationCanvas.tsx`
- Modify: `src/pages/InsightsPage.tsx` (전체 재작성)

**Interfaces:**
- Consumes: Task 2의 `buildGraph`, `ConstellationGraph`, `StarNode`, `GraphInputEntry`, `GraphInputInsight`; Task 1의 `CLUSTER_COLORS`, `CLUSTER_LABELS`, `CLUSTER_CENTERS`, `ClusterId`
- Produces:
  - `interface ClusterLabel { cluster: ClusterId; text: string; onTap: () => void }`
  - `interface ConstellationCanvasProps { graph: ConstellationGraph; clusterLabels: ClusterLabel[]; selectedId: string | null; highlightedIds: string[] | null; onSelect: (id: string | null) => void; onWebglFailure: () => void }`
  - `function ConstellationCanvas(props: ConstellationCanvasProps): JSX.Element`
  - `InsightsPage`가 노출하는 것은 없음 (라우트 컴포넌트)

- [ ] **Step 1: three.js를 설치한다**

Run:
```bash
npm install three && npm install -D @types/three
```
Expected: `package.json` dependencies에 `three`, devDependencies에 `@types/three`가 추가됨

- [ ] **Step 2: 캔버스 컴포넌트를 만든다**

Create `src/components/constellation/ConstellationCanvas.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CLUSTER_CENTERS, CLUSTER_COLORS, type ClusterId } from '../../lib/constellation/layout';
import type { ConstellationGraph } from '../../lib/constellation/buildGraph';

export interface ClusterLabel {
  cluster: ClusterId;
  text: string;
  onTap: () => void;
}

export interface ConstellationCanvasProps {
  graph: ConstellationGraph;
  clusterLabels: ClusterLabel[];
  selectedId: string | null;
  highlightedIds: string[] | null;
  onSelect: (id: string | null) => void;
  onWebglFailure: () => void;
}

const DIMMED_OPACITY = 0.12;
const AUTO_ROTATE_SPEED = 0.3;

// 별 하나의 그림. 외부 이미지 파일 없이 런타임에 그려서 CSP나 배포 경로 문제를 아예 없앤다.
function createStarTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function ConstellationCanvas({
  graph,
  clusterLabels,
  selectedId,
  highlightedIds,
  onSelect,
  onWebglFailure,
}: ConstellationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<ClusterId, HTMLButtonElement>());

  // 매 프레임 읽어야 하는 값들. state로 두면 프레임마다 리렌더가 돌고, 콜백을 씬에 캡처하면
  // 오래된 클로저를 붙들게 된다 — ref로 최신 값만 넘긴다.
  const selectedIdRef = useRef(selectedId);
  const highlightedIdsRef = useRef(highlightedIds);
  const onSelectRef = useRef(onSelect);
  selectedIdRef.current = selectedId;
  highlightedIdsRef.current = highlightedIds;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onWebglFailure();
      return;
    }

    // 저사양 기기에서 픽셀을 과하게 그리지 않도록 상한을 둔다.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    camera.position.set(0, 0, 34);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 70;
    controls.rotateSpeed = 0.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) controls.autoRotate = false;

    // ---- 별 ----
    const nodeIndex = new Map(graph.nodes.map((node, i) => [node.id, i]));
    const positions = new Float32Array(graph.nodes.length * 3);
    const colors = new Float32Array(graph.nodes.length * 3);
    graph.nodes.forEach((node, i) => {
      positions[i * 3] = node.position.x;
      positions[i * 3 + 1] = node.position.y;
      positions[i * 3 + 2] = node.position.z;
      const color = new THREE.Color(CLUSTER_COLORS[node.cluster]);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    });

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starTexture = createStarTexture();
    const starMaterial = new THREE.PointsMaterial({
      size: 0.9,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // ---- 연결선 ----
    // 같은 컬렉션 선은 더 밝게 보여야 해서 두 벌로 나눠 그린다(선 굵기는 대부분의 플랫폼에서
    // lineWidth가 무시되므로 밝기로만 차이를 준다).
    function makeLines(edges: typeof graph.edges, opacity: number) {
      const points = new Float32Array(edges.length * 6);
      edges.forEach((edge, i) => {
        const a = graph.nodes[nodeIndex.get(edge.a)!].position;
        const b = graph.nodes[nodeIndex.get(edge.b)!].position;
        points.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
      const material = new THREE.LineBasicMaterial({
        color: 0x9fb2d8,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      return new THREE.LineSegments(geometry, material);
    }

    const tagLines = makeLines(graph.edges.filter((e) => !e.sameCollection), 0.15);
    const collectionLines = makeLines(graph.edges.filter((e) => e.sameCollection), 0.35);
    scene.add(tagLines, collectionLines);

    // ---- 선택된 별을 감싸는 고리 ----
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: starTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    halo.scale.setScalar(3);
    halo.visible = false;
    scene.add(halo);

    // ---- 별 탭 ----
    const raycaster = new THREE.Raycaster();
    // Points는 기본 임계값이 1이라 손가락 탭에는 너무 빡빡하다.
    raycaster.params.Points = { threshold: 0.7 };
    const pointer = new THREE.Vector2();
    let pointerDownAt = { x: 0, y: 0, time: 0 };

    function handlePointerDown(event: PointerEvent) {
      pointerDownAt = { x: event.clientX, y: event.clientY, time: performance.now() };
    }

    function handlePointerUp(event: PointerEvent) {
      // 회전 드래그를 탭으로 오인하지 않도록 이동 거리와 시간을 함께 본다.
      const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
      if (moved > 8 || performance.now() - pointerDownAt.time > 500) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObject(stars);
      if (hits.length === 0 || hits[0].index === undefined) {
        onSelectRef.current(null);
        return;
      }
      // 가장 가까운 별 하나만 — 겹쳐 보일 때 뒤엣것이 잡히면 안 된다.
      onSelectRef.current(graph.nodes[hits[0].index].id);
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    // ---- 리사이즈 ----
    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resizeObserver.observe(container);

    // ---- 루프 ----
    const projected = new THREE.Vector3();
    let frameId = 0;
    let running = true;

    function updateDimming() {
      const highlighted = highlightedIdsRef.current;
      const colorAttr = starGeometry.getAttribute('color') as THREE.BufferAttribute;
      graph.nodes.forEach((node, i) => {
        const base = new THREE.Color(CLUSTER_COLORS[node.cluster]);
        if (highlighted && !highlighted.includes(node.id)) {
          base.multiplyScalar(DIMMED_OPACITY);
        }
        colorAttr.setXYZ(i, base.r, base.g, base.b);
      });
      colorAttr.needsUpdate = true;
      const dimming = highlighted !== null;
      (tagLines.material as THREE.LineBasicMaterial).opacity = dimming ? 0.04 : 0.15;
      (collectionLines.material as THREE.LineBasicMaterial).opacity = dimming ? 0.08 : 0.35;
    }

    function updateHalo() {
      const id = selectedIdRef.current;
      const index = id === null ? undefined : nodeIndex.get(id);
      if (index === undefined) {
        halo.visible = false;
        return;
      }
      const node = graph.nodes[index];
      halo.position.set(node.position.x, node.position.y, node.position.z);
      halo.material.color = new THREE.Color(CLUSTER_COLORS[node.cluster]);
      halo.visible = true;
    }

    function updateLabels() {
      const rect = renderer.domElement.getBoundingClientRect();
      for (const [cluster, element] of labelRefs.current) {
        const center = CLUSTER_CENTERS[cluster];
        projected.set(center.x, center.y, center.z).project(camera);
        // 카메라 뒤로 넘어간 라벨은 화면 반대편에 유령처럼 찍히므로 숨긴다.
        const behind = projected.z > 1;
        element.style.opacity = behind ? '0' : '1';
        element.style.pointerEvents = behind ? 'none' : 'auto';
        const x = (projected.x * 0.5 + 0.5) * rect.width;
        const y = (-projected.y * 0.5 + 0.5) * rect.height;
        element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      }
    }

    function tick() {
      if (!running) return;
      frameId = requestAnimationFrame(tick);
      controls.update();
      updateHalo();
      updateLabels();
      renderer.render(scene, camera);
    }

    // 탭이 백그라운드로 가면 루프를 멈춘다 (모바일 배터리).
    function handleVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frameId);
      } else if (!running) {
        running = true;
        tick();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    updateDimming();
    tick();

    return () => {
      running = false;
      cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      starTexture.dispose();
      tagLines.geometry.dispose();
      (tagLines.material as THREE.Material).dispose();
      collectionLines.geometry.dispose();
      (collectionLines.material as THREE.Material).dispose();
      halo.material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // graph가 바뀌면 씬을 통째로 다시 만든다 — 인사이트 재생성은 드문 일이라 증분 갱신의
    // 복잡도를 감수할 이유가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      {clusterLabels.map((label) => (
        <button
          key={label.cluster}
          type="button"
          ref={(element) => {
            if (element) labelRefs.current.set(label.cluster, element);
            else labelRefs.current.delete(label.cluster);
          }}
          onClick={label.onTap}
          className="absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border border-slate-700/70 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-sm"
        >
          {label.text}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 패턴 탭을 별자리로 갈아끼운다**

`src/pages/InsightsPage.tsx` 전체를 아래로 교체한다. 데이터 로딩과 재생성 로직은 기존 것을
가져오되, 엔트리·태그·컬렉션을 함께 불러오고 실패 시 기존 상태를 지우지 않도록 바꾼다.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { buildInsightRows } from '../lib/buildInsightRows';
import { useNickname, withNickname } from '../lib/useNickname';
import { buildGraph, type GraphInputEntry, type GraphInputInsight } from '../lib/constellation/buildGraph';
import { CLUSTER_LABELS } from '../lib/constellation/layout';
import { ConstellationCanvas, type ClusterLabel } from '../components/constellation/ConstellationCanvas';
import type { ExperienceTag } from '../types';

const MIN_ENTRIES_FOR_INSIGHTS = 3;

export function InsightsPage() {
  const [entries, setEntries] = useState<GraphInputEntry[]>([]);
  const [insights, setInsights] = useState<GraphInputInsight[]>([]);
  const [structuredCount, setStructuredCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nickname = useNickname();

  const graph = useMemo(() => buildGraph(entries, insights), [entries, insights]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: entryRows, error: entryError },
        { data: tagRows, error: tagError },
        { data: structuredRows, error: structuredError },
        { data: insightRows, error: insightError },
      ] = await Promise.all([
        supabase.from('entries').select('id, raw_text, project_title, collection_id').order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation, status'),
        supabase.from('insights').select('id, type, summary, evidence_entry_ids').order('created_at', { ascending: false }),
      ]);
      if (entryError) throw entryError;
      if (tagError) throw tagError;
      if (structuredError) throw structuredError;
      if (insightError) throw insightError;

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      const situationByEntry = new Map<string, string | null>();
      (structuredRows ?? []).forEach((row) => situationByEntry.set(row.entry_id, row.situation));

      setStructuredCount((structuredRows ?? []).filter((row) => row.status === 'done').length);
      setEntries(
        (entryRows ?? []).map((row) => ({
          id: row.id,
          // 경험 탭 카드와 같은 폴백 순서 — 두 화면에서 같은 기록이 다른 이름으로 보이면 안 된다.
          label: situationByEntry.get(row.id) || row.project_title || row.raw_text.slice(0, 24),
          collection_id: row.collection_id,
          tags: tagsByEntry.get(row.id) ?? [],
        })),
      );
      setInsights((insightRows ?? []) as GraphInputInsight[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '패턴을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: structuredRows, error: fetchError } = await supabase
        .from('entries_structured')
        .select('entry_id, situation, role, action, result, emotion, emotion_reason')
        .eq('status', 'done');
      if (fetchError) throw fetchError;
      if (!structuredRows || structuredRows.length < MIN_ENTRIES_FOR_INSIGHTS) return;

      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: structuredRows }),
      });
      if (!res.ok) throw new Error('인사이트 생성에 실패했습니다.');
      const result = await res.json();

      const validEntryIds = new Set(structuredRows.map((row) => row.entry_id));
      const rowsToInsert = buildInsightRows(result, user.id, validEntryIds);
      if (rowsToInsert.length === 0) throw new Error('인사이트 재생성에 실패했습니다. 다시 시도해주세요.');

      const { error: deleteError } = await supabase.from('insights').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const { data: insertedRows, error: insertError } = await supabase
        .from('insights')
        .insert(rowsToInsert)
        .select('id, type, summary, evidence_entry_ids');
      if (insertError) throw insertError;

      setInsights((insertedRows ?? []) as GraphInputInsight[]);
    } catch (err) {
      // 실패해도 기존 별자리는 그대로 둔다 — 우주가 통째로 사라지면 손실감이 크다.
      setError(err instanceof Error ? err.message : '인사이트 재생성에 실패했습니다.');
    } finally {
      setRegenerating(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clusterLabels: ClusterLabel[] = (['neutral', 'energizer', 'drainer'] as const)
    .filter((cluster) => graph.counts[cluster] > 0)
    .map((cluster) => ({
      cluster,
      text: `${CLUSTER_LABELS[cluster]} ${graph.counts[cluster]}`,
      onTap: () => {},
    }));

  if (loading) {
    return <p className="px-4 py-6 text-sm text-slate-400">별자리를 그리는 중...</p>;
  }

  if (error && entries.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={loadAll}
          className="mt-3 rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-slate-300">아직 별이 하나도 없어요.</p>
        <p className="mt-1 text-sm text-slate-400">첫 기록을 남기면 첫 별이 뜹니다.</p>
        <Link to="/" className="mt-4 inline-block rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white">
          기록하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-var(--bottom-nav-total))] overflow-hidden bg-slate-950">
      <h2 className="pointer-events-none absolute left-4 top-4 z-10 text-sm font-medium text-slate-400">
        {withNickname(nickname, (n) => `${n}의 경험 별자리`, '나의 경험 별자리')}
      </h2>

      <ConstellationCanvas
        graph={graph}
        clusterLabels={clusterLabels}
        selectedId={selectedId}
        highlightedIds={null}
        onSelect={setSelectedId}
        onWebglFailure={() => {}}
      />

      {structuredCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p className="absolute inset-x-4 bottom-4 z-10 rounded-lg bg-slate-900/80 p-3 text-center text-xs text-slate-400">
          기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 정리되면 별무리가 나뉘어요. (현재 {structuredCount}개)
        </p>
      )}

      {structuredCount >= MIN_ENTRIES_FOR_INSIGHTS && insights.length === 0 && (
        <button
          type="button"
          onClick={regenerate}
          disabled={regenerating}
          className="absolute inset-x-4 bottom-4 z-10 rounded-lg bg-slate-700 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {regenerating ? '분석 중...' : '패턴 분석하기'}
        </button>
      )}

      {error && (
        <p className="absolute inset-x-4 bottom-20 z-10 rounded-lg bg-red-950/80 p-3 text-center text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 순수 함수 테스트가 여전히 통과하는지 확인한다**

Run: `npm test`
Expected: PASS (Task 1·2 테스트 전부. 이 태스크는 새 테스트를 추가하지 않는다 — jsdom이 없어 캔버스 컴포넌트는 단위 테스트할 수 없다)

- [ ] **Step 5: 린트와 빌드**

Run: `npm run lint && npm run build`
Expected: 에러 없음

- [ ] **Step 6: 브라우저에서 눈으로 확인한다**

Run: `npm run dev`
확인:
- 패턴 탭에 어두운 배경 위 별들이 보인다
- 별이 세 덩어리(또는 인사이트가 없으면 한 덩어리)로 나뉘어 있다
- 드래그하면 회전하고, 핀치/휠로 확대·축소된다
- 가만히 두면 아주 천천히 자동 회전한다
- 군집 라벨이 각 덩어리를 따라 움직인다
- 페이지가 세로로 스크롤되지 않고(회전 제스처가 스크롤에 뺏기지 않음) 하단 nav에 우주가 가리지 않는다

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json src/components/constellation/ConstellationCanvas.tsx src/pages/InsightsPage.tsx
git commit -m "feat: 패턴 탭을 three.js 3D 별자리 우주로 교체"
```

---

### Task 4: 별 탭 → 카메라 포커스 + 경험 상세 오버레이

**Files:**
- Create: `src/components/constellation/StarDetailCard.tsx`
- Modify: `src/components/constellation/ConstellationCanvas.tsx` (카메라 포커스 트윈 추가)
- Modify: `src/pages/InsightsPage.tsx` (상세 로딩 + 카드 배선)

**Interfaces:**
- Consumes: Task 3의 `ConstellationCanvas`, `ConstellationCanvasProps`; Task 2의 `StarNode`
- Produces:
  - `interface StarDetail { situation: string \| null; action: string \| null; result: string \| null; emotion: string \| null; status: 'pending' \| 'done' \| 'failed' \| null; rawText: string }`
  - `interface StarDetailCardProps { node: StarNode; detail: StarDetail \| null; onClose: () => void }`
  - `function StarDetailCard(props: StarDetailCardProps): JSX.Element`

- [ ] **Step 1: 상세 카드 컴포넌트를 만든다**

Create `src/components/constellation/StarDetailCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { TAG_COLORS } from '../../lib/tagColors';
import { CLUSTER_COLORS } from '../../lib/constellation/layout';
import type { StarNode } from '../../lib/constellation/buildGraph';

export interface StarDetail {
  situation: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  status: 'pending' | 'done' | 'failed' | null;
  rawText: string;
}

export interface StarDetailCardProps {
  node: StarNode;
  detail: StarDetail | null;
  onClose: () => void;
}

const FIELDS: { key: keyof StarDetail; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
];

export function StarDetailCard({ node, detail, onClose }: StarDetailCardProps) {
  const ready = detail?.status === 'done';

  return (
    <div className="absolute inset-x-3 bottom-3 z-20 max-h-[55dvh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[node.cluster] }}
          />
          <h3 className="text-sm font-semibold text-slate-100">{node.label}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="shrink-0 rounded-md px-2 py-1 text-slate-400 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      {node.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {node.tags.map((tag) => (
            <span key={tag} className={`rounded-full px-2 py-0.5 text-xs ${TAG_COLORS[tag]}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {detail === null ? (
        <p className="mt-3 text-sm text-slate-400">불러오는 중...</p>
      ) : ready ? (
        <dl className="mt-3 space-y-2">
          {FIELDS.filter((field) => detail[field.key]).map((field) => (
            <div key={field.key}>
              <dt className="text-xs text-slate-500">{field.label}</dt>
              <dd className="text-sm text-slate-200">{String(detail[field.key])}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-300">{detail.rawText.slice(0, 160)}</p>
          <p className="mt-2 text-xs text-slate-500">아직 정리 중이에요.</p>
        </>
      )}

      <Link
        to={`/entries/${node.id}`}
        className="mt-4 inline-block rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600"
      >
        자세히 보기
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: 라우트 경로를 확인한다**

Run: `grep -n "entries/" src/App.tsx`
Expected: 상세 페이지 라우트 경로가 보인다. `/entries/:id`가 아니면 Step 1의 `to={...}`를 실제 경로로 고친다.

- [ ] **Step 3: 캔버스에 카메라 포커스 트윈을 넣는다**

`ConstellationCanvas.tsx`의 `useEffect` 안, `const projected = new THREE.Vector3();` 바로 위에 추가:

```ts
    // 선택된 별로 카메라를 부드럽게 이동시킨다. 별 위치 자체가 아니라 "별에서 조금 떨어진 곳"을
    // 목표로 삼아야 별이 화면을 가득 채워버리지 않는다.
    const FOCUS_DISTANCE = 6;
    const focusTarget = new THREE.Vector3();
    const focusCamera = new THREE.Vector3();
    let focusing = false;
    let lastFocusedId: string | null = null;

    function updateFocus() {
      const id = selectedIdRef.current;
      if (id !== lastFocusedId) {
        lastFocusedId = id;
        const index = id === null ? undefined : nodeIndex.get(id);
        if (index === undefined) {
          // 선택 해제 — 전체가 보이는 원래 시야로 돌아간다.
          focusTarget.set(0, 0, 0);
          focusCamera.set(0, 0, 34);
        } else {
          const node = graph.nodes[index];
          focusTarget.set(node.position.x, node.position.y, node.position.z);
          // 지금 보고 있는 방향을 유지한 채 거리만 좁힌다 — 시점이 갑자기 뒤집히면 방향 감각을 잃는다.
          const direction = camera.position.clone().sub(controls.target).normalize();
          focusCamera.copy(focusTarget).add(direction.multiplyScalar(FOCUS_DISTANCE));
        }
        focusing = true;
        // 별을 보는 동안 자동 회전이 돌면 카드와 별이 어긋난다.
        controls.autoRotate = id === null && !reduceMotion;
        if (reduceMotion) {
          camera.position.copy(focusCamera);
          controls.target.copy(focusTarget);
          focusing = false;
        }
      }

      if (!focusing) return;
      camera.position.lerp(focusCamera, 0.08);
      controls.target.lerp(focusTarget, 0.08);
      if (camera.position.distanceTo(focusCamera) < 0.05) {
        camera.position.copy(focusCamera);
        controls.target.copy(focusTarget);
        focusing = false;
      }
    }
```

그리고 `tick()` 안에서 `controls.update()` **앞에** `updateFocus();`를 호출한다:

```ts
    function tick() {
      if (!running) return;
      frameId = requestAnimationFrame(tick);
      updateFocus();
      controls.update();
      updateHalo();
      updateLabels();
      renderer.render(scene, camera);
    }
```

- [ ] **Step 4: 카드가 열려 있을 때 회전을 잠근다**

`ConstellationCanvas.tsx`의 반환 JSX에서 컨테이너 클래스에 조건을 준다 — 캔버스는 그대로 두고,
`updateFocus` 안에서 이미 `controls.autoRotate`를 껐으므로 여기서는 드래그만 막는다.
`updateFocus`의 `focusing = true;` 다음 줄에 추가:

```ts
        controls.enableRotate = id === null;
```

- [ ] **Step 5: `InsightsPage`에 상세 로딩과 카드를 배선한다**

`InsightsPage.tsx` 상단 import에 추가:

```tsx
import { StarDetailCard, type StarDetail } from '../components/constellation/StarDetailCard';
```

상태 선언 아래에 추가:

```tsx
  const [detail, setDetail] = useState<StarDetail | null>(null);
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedId) ?? null,
    [graph, selectedId],
  );
```

`useEffect(() => { loadAll(); ... })` 아래에 상세 로딩 effect를 추가:

```tsx
  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    (async () => {
      const [{ data: entry }, { data: structured }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', selectedId).single(),
        supabase
          .from('entries_structured')
          .select('situation, action, result, emotion, status')
          .eq('entry_id', selectedId)
          .maybeSingle(),
      ]);
      // 카드를 빠르게 옮겨 다니면 늦게 도착한 응답이 지금 카드를 덮어쓸 수 있다.
      if (cancelled) return;
      setDetail({
        rawText: entry?.raw_text ?? '',
        situation: structured?.situation ?? null,
        action: structured?.action ?? null,
        result: structured?.result ?? null,
        emotion: structured?.emotion ?? null,
        status: (structured?.status as StarDetail['status']) ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);
```

`<ConstellationCanvas ... />` 바로 아래에 카드를 추가:

```tsx
      {selectedNode && (
        <StarDetailCard node={selectedNode} detail={detail} onClose={() => setSelectedId(null)} />
      )}
```

- [ ] **Step 6: 테스트·린트·빌드**

Run: `npm test && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 7: 브라우저에서 눈으로 확인한다**

Run: `npm run dev`
확인:
- 별을 탭하면 카메라가 다가가고 고리가 켜지며 카드가 뜬다
- 카드가 열린 동안 드래그해도 회전하지 않는다
- 빈 공간을 탭하거나 ✕를 누르면 원래 시야로 돌아간다
- 드래그로 회전만 하고 손을 뗐을 때는 카드가 뜨지 않는다 (탭/드래그 구분)
- "자세히 보기"가 그 기록의 상세 페이지로 간다
- 구조화가 안 끝난 기록은 원문 앞부분과 "아직 정리 중이에요"가 보인다

- [ ] **Step 8: 커밋**

```bash
git add src/components/constellation src/pages/InsightsPage.tsx
git commit -m "feat: 별 탭하면 카메라 포커스 + 경험 상세 오버레이"
```

---

### Task 5: 군집 요약 오버레이 + 근거 별 하이라이트 + 재생성

**Files:**
- Create: `src/components/constellation/ClusterSummaryCard.tsx`
- Modify: `src/pages/InsightsPage.tsx`
- Modify: `src/components/constellation/ConstellationCanvas.tsx` (`highlightedIds` 반영)

**Interfaces:**
- Consumes: Task 2의 `GraphInputInsight`; Task 1의 `ClusterId`, `CLUSTER_LABELS`, `CLUSTER_COLORS`
- Produces:
  - `interface ClusterSummaryCardProps { cluster: ClusterId; insights: GraphInputInsight[]; activeInsightId: string \| null; onSelectInsight: (id: string \| null) => void; onRegenerate: (() => void) \| null; regenerating: boolean; onClose: (() => void) \| null }`
  - `function ClusterSummaryCard(props: ClusterSummaryCardProps): JSX.Element`

- [ ] **Step 1: 요약 카드 컴포넌트를 만든다**

Create `src/components/constellation/ClusterSummaryCard.tsx`:

```tsx
import { CLUSTER_COLORS, CLUSTER_LABELS, type ClusterId } from '../../lib/constellation/layout';
import type { GraphInputInsight } from '../../lib/constellation/buildGraph';

export interface ClusterSummaryCardProps {
  cluster: ClusterId;
  insights: GraphInputInsight[];
  activeInsightId: string | null;
  onSelectInsight: (id: string | null) => void;
  // null이면 재생성 버튼을 숨긴다 (기록이 부족할 때).
  onRegenerate: (() => void) | null;
  regenerating: boolean;
  // null이면 닫기 버튼을 숨긴다 (WebGL 폴백에서 카드가 화면 본문일 때).
  onClose: (() => void) | null;
}

export function ClusterSummaryCard({
  cluster,
  insights,
  activeInsightId,
  onSelectInsight,
  onRegenerate,
  regenerating,
  onClose,
}: ClusterSummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: CLUSTER_COLORS[cluster] }}
          />
          <h3 className="text-sm font-semibold text-slate-100">{CLUSTER_LABELS[cluster]}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md px-2 py-1 text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        )}
      </div>

      {insights.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">아직 이 패턴으로 정리된 게 없어요.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {insights.map((insight) => {
            const active = insight.id === activeInsightId;
            return (
              <li key={insight.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelectInsight(active ? null : insight.id)}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${
                    active ? 'bg-slate-700' : 'bg-slate-800/60 hover:bg-slate-800'
                  }`}
                >
                  <p className="text-sm text-slate-100">{insight.summary}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    근거 기록 {insight.evidence_entry_ids.length}건
                    {active && ' · 근거 별만 밝게 표시 중'}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {onRegenerate ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="mt-4 rounded-md bg-slate-700 px-3 py-2 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {regenerating ? '분석 중...' : '다시 분석하기'}
        </button>
      ) : (
        <p className="mt-4 text-xs text-slate-500">기록이 3개 이상 정리되면 다시 분석할 수 있어요.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 캔버스가 하이라이트 변경에 반응하게 한다**

Task 3에서 만든 `updateDimming()`은 씬을 만들 때 한 번만 불린다. `highlightedIds`가 바뀔 때도
다시 불려야 한다. `ConstellationCanvas.tsx`의 `tick()`에서 매 프레임 부르면 프레임마다 색을
새로 계산하게 되므로, 값이 바뀐 프레임에만 부르도록 `updateDimming`을 고친다.

`updateDimming` 바로 위에 추가:

```ts
    let lastHighlightKey = '__init__';
```

`updateDimming` 첫 줄을 아래로 바꾼다:

```ts
    function updateDimming() {
      const highlighted = highlightedIdsRef.current;
      const key = highlighted === null ? 'none' : highlighted.join(',');
      if (key === lastHighlightKey) return;
      lastHighlightKey = key;
      const colorAttr = starGeometry.getAttribute('color') as THREE.BufferAttribute;
```

그리고 `tick()` 안에 `updateDimming();`을 `updateHalo();` 앞에 넣는다:

```ts
    function tick() {
      if (!running) return;
      frameId = requestAnimationFrame(tick);
      updateFocus();
      controls.update();
      updateDimming();
      updateHalo();
      updateLabels();
      renderer.render(scene, camera);
    }
```

씬 초기화 부분의 `updateDimming();` 직접 호출은 그대로 둔다 (첫 프레임 전에 색을 맞춘다).

- [ ] **Step 3: `InsightsPage`에 요약 카드를 배선한다**

import에 추가:

```tsx
import { ClusterSummaryCard } from '../components/constellation/ClusterSummaryCard';
import type { ClusterId } from '../lib/constellation/layout';
```

상태에 추가:

```tsx
  const [openCluster, setOpenCluster] = useState<ClusterId | null>(null);
  const [activeInsightId, setActiveInsightId] = useState<string | null>(null);

  // 인사이트 하나를 고르면 그 근거 별만 밝게 남긴다.
  const highlightedIds = useMemo(() => {
    if (activeInsightId === null) return null;
    return insights.find((i) => i.id === activeInsightId)?.evidence_entry_ids ?? null;
  }, [activeInsightId, insights]);
```

`clusterLabels`의 `onTap`을 실제 동작으로 바꾼다:

```tsx
      onTap: () => {
        // 전체 경험 군집은 인사이트가 없으므로 카드를 열지 않는다.
        if (cluster === 'neutral') return;
        setSelectedId(null);
        setOpenCluster(cluster);
      },
```

`<ConstellationCanvas>`의 `highlightedIds` prop을 바꾼다:

```tsx
        highlightedIds={highlightedIds}
```

카드를 렌더한다 (`StarDetailCard` 렌더 아래):

```tsx
      {openCluster !== null && selectedId === null && (
        <div className="absolute inset-x-3 bottom-3 z-20 max-h-[55dvh] overflow-y-auto">
          <ClusterSummaryCard
            cluster={openCluster}
            insights={insights.filter((i) => i.type === openCluster)}
            activeInsightId={activeInsightId}
            onSelectInsight={setActiveInsightId}
            onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
            regenerating={regenerating}
            onClose={() => {
              setOpenCluster(null);
              setActiveInsightId(null);
            }}
          />
        </div>
      )}
```

`regenerate()`의 성공 경로 마지막(`setInsights(...)` 다음)에 추가 — 인사이트 id가 전부 바뀌므로
선택 상태를 비워야 유령 하이라이트가 남지 않는다:

```tsx
      setActiveInsightId(null);
```

- [ ] **Step 4: 테스트·린트·빌드**

Run: `npm test && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 5: 브라우저에서 눈으로 확인한다**

Run: `npm run dev`
확인:
- 에너지원/소진 라벨을 탭하면 그 타입의 요약 문장들이 카드로 뜬다
- 요약 문장을 탭하면 근거 별만 밝게 남고 나머지가 흐려진다. 다시 탭하면 원래대로
- "전체 경험" 라벨은 탭해도 카드가 안 뜬다
- "다시 분석하기"가 동작하고, 도는 동안 버튼이 비활성화된다
- 네트워크를 끊고 재생성해 실패시키면 에러 문구가 뜨지만 **별자리는 그대로 남는다**
- 별 탭과 군집 카드가 동시에 뜨지 않는다

- [ ] **Step 6: 커밋**

```bash
git add src/components/constellation src/pages/InsightsPage.tsx
git commit -m "feat: 군집 라벨 탭하면 인사이트 요약 + 근거 별 하이라이트"
```

---

### Task 6: WebGL 폴백 + 문서 갱신

**Files:**
- Modify: `src/pages/InsightsPage.tsx`
- Modify: `design.md`

**Interfaces:**
- Consumes: Task 5의 `ClusterSummaryCard`; Task 3의 `onWebglFailure` prop
- Produces: 없음 (마무리 태스크)

- [ ] **Step 1: WebGL 실패 시 폴백 화면을 붙인다**

`InsightsPage.tsx` 상태에 추가:

```tsx
  const [webglFailed, setWebglFailed] = useState(false);
```

`<ConstellationCanvas>`의 `onWebglFailure` prop을 바꾼다:

```tsx
        onWebglFailure={() => setWebglFailed(true)}
```

빈 상태 분기(`entries.length === 0`) **다음**, 우주 렌더 **앞**에 폴백 분기를 넣는다.
별자리 대신 같은 요약 카드를 세로로 펼쳐서 정보 손실이 없게 한다:

```tsx
  if (webglFailed) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 pb-[calc(var(--bottom-nav-total)+1.5rem)]">
        <h2 className="text-xl font-semibold text-slate-50">
          {withNickname(nickname, (n) => `${n}의 에너지 패턴`, '나의 에너지 패턴')}
        </h2>
        <p className="text-xs text-slate-500">
          이 기기에서는 별자리를 그릴 수 없어 글로만 보여드려요.
        </p>
        {(['energizer', 'drainer'] as const).map((cluster) => (
          <ClusterSummaryCard
            key={cluster}
            cluster={cluster}
            insights={insights.filter((i) => i.type === cluster)}
            activeInsightId={null}
            onSelectInsight={() => {}}
            onRegenerate={structuredCount >= MIN_ENTRIES_FOR_INSIGHTS ? regenerate : null}
            regenerating={regenerating}
            onClose={null}
          />
        ))}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    );
  }
```

- [ ] **Step 2: 폴백이 실제로 뜨는지 확인한다**

`ConstellationCanvas.tsx`의 `new THREE.WebGLRenderer(...)` 줄을 임시로
`throw new Error('force');`로 바꾸고 `npm run dev`로 패턴 탭을 연다.
Expected: 우주 대신 에너지원/소진 요약 카드 두 장이 세로로 보인다.
확인 후 **원래대로 되돌린다.**

- [ ] **Step 3: `design.md`의 패턴 탭 절을 갱신한다**

Run: `grep -n "패턴\|인사이트\|Insights" design.md`

찾은 절을 아래 내용으로 갱신한다 (절이 없으면 파일 끝에 추가):

```markdown
## 패턴 탭 — 경험 별자리

경험 하나가 별 하나인 3D 우주다 (three.js, plain·R3F 없이 `ConstellationCanvas`가 명령형으로 소유).

- **군집** — `insights.evidence_entry_ids`를 뒤집어 `entry_id → cluster`를 만든다.
  energizer 근거 → 앰버, drainer 근거 → 블루그레이, 나머지 → 중립 화이트.
  양쪽 근거인 기록은 **energizer 우선**으로 한 군집에만 둔다(별 복제 금지).
- **좌표** — `layout.ts`의 `starPosition()`이 entry id 해시(FNV-1a → mulberry32)로 결정적으로
  계산한다. `Math.random()` 금지 — 새로고침해도 같은 별이 같은 자리에 있어야 회상이 된다(PRD §8).
- **연결선** — 같은 군집 안에서만. 공통 태그 1개 이상이거나 같은 컬렉션이면 후보가 되고,
  같은 컬렉션에 가중치 10을 얹어 점수순으로 채우되 **노드당 최대 3개**. 제한이 없으면 태그가
  6종뿐이라 완전그래프가 되어 화면이 선으로 덮인다.
- **군집 라벨** — three.js 스프라이트가 아니라 캔버스 위 HTML 버튼이다. 매 프레임 월드 좌표를
  화면 좌표로 투영해 `style.transform`만 갱신한다(state를 쓰면 프레임마다 리렌더된다).
  한글 폰트가 기존 UI와 같게 렌더되고, 손가락 히트박스가 확보되며, 스크린리더가 읽는다.
- **재생성 실패 시 기존 별자리를 지우지 않는다.** 우주가 통째로 사라지면 손실감이 크다.
- WebGL을 못 쓰는 기기는 `ClusterSummaryCard` 두 장을 세로로 펼친 정적 화면으로 폴백한다.

계산(`src/lib/constellation/`)과 렌더(`src/components/constellation/`)를 갈라 두었다.
군집 배정·연결선 제한·좌표 결정성이 가장 틀리기 쉬운 부분인데, 순수 함수라 WebGL 없이
vitest로 검증된다. 이 프로젝트에는 jsdom이 없으므로 **캔버스 컴포넌트는 단위 테스트하지 않는다.**
```

- [ ] **Step 4: 전체 검증**

Run: `npm test && npm run lint && npm run build`
Expected: 전부 통과

- [ ] **Step 5: 접근성과 저사양 경로를 확인한다**

Run: `npm run dev`
확인:
- OS 설정에서 "동작 줄이기"를 켜면 자동 회전이 멈추고 별 선택이 즉시 전환된다
- 다른 탭으로 갔다가 돌아오면 애니메이션이 멈췄다 다시 돈다 (개발자도구 Performance로 확인)
- 브라우저 창 크기를 바꿔도 우주가 찌그러지지 않는다

- [ ] **Step 6: 커밋**

```bash
git add src/pages/InsightsPage.tsx design.md
git commit -m "feat: WebGL 미지원 기기 폴백 + 별자리 설계 문서화"
```

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| 기능 1 — 3D 별자리, 세 군집, 색 구분, 라벨, 연결선, 회전/줌, 자동 회전, 결정적 좌표 | Task 1·2·3 |
| 기능 1 안 되는 경우 — 기록 0개 / 인사이트 없음 / 3개 미만 / 양쪽 근거 / 태그 없음 / 로드 실패 / reduced-motion / 백그라운드 / WebGL 실패 | Task 2(양쪽 근거), Task 3(0개·없음·3개 미만·실패·reduced-motion·백그라운드), Task 6(WebGL) |
| 기능 2 — 별 탭, 카메라 포커스, 상세 카드, 자세히 보기, 닫기 | Task 4 |
| 기능 2 안 되는 경우 — 미구조화 기록 / 겹친 별 / 카드 중 드래그 잠금 / 태그 없음 | Task 4 |
| 기능 3 — 군집 라벨 탭, 요약, 근거 개수, 하이라이트, 재생성, 갱신 | Task 5 |
| 기능 3 안 되는 경우 — 인사이트 0건 / 재생성 중 / 재생성 실패 시 별자리 보존 / 3개 미만 | Task 3(보존), Task 5(나머지) |
| 결정 사항 — energizer 우선, 결정적 좌표, 연결선 3개 제한, plain three.js, 파일 분리, 라벨 폴백, HTML 라벨, `touch-action: none`, `--bottom-nav-total` | Task 1~6 전반 + Task 6 문서화 |

**타입 일관성 확인 완료**

- `ClusterId` / `Vec3` — Task 1에서 정의, Task 2·3·5에서 그대로 사용
- `GraphInputEntry` / `GraphInputInsight` / `StarNode` / `ConstellationGraph` — Task 2에서 정의, Task 3·4·5에서 그대로 사용
- `ClusterLabel` / `ConstellationCanvasProps` — Task 3에서 정의, Task 4·5·6에서 prop 이름 유지 (`selectedId`, `highlightedIds`, `onSelect`, `onWebglFailure`)
- `StarDetail` — Task 4에서 정의, `InsightsPage`의 로딩 effect가 같은 필드를 채운다
- `ClusterSummaryCardProps` — Task 5에서 정의, Task 6 폴백이 같은 prop 이름으로 재사용

**알려진 전제**

- 상세 페이지 경로를 `/entries/:id`로 가정했다. Task 4 Step 2에서 `src/App.tsx`를 확인해
  다르면 고친다.
- `entries_structured.status` 컬럼이 존재한다고 가정했다 (`src/types/index.ts`의
  `EntryStructured`에 정의되어 있음).
