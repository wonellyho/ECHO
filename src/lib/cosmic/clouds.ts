// 성운·은하수·성단의 "모양"을 계산한다. 캔버스도 DOM도 모르는 순수 계산이라 vitest로 검증된다.
//
// 왜 CSS 그라데이션이 아닌가: radial-gradient는 매끈한 원만 그린다. 실제 은하수를 은하수처럼
// 보이게 하는 건 밝기가 아니라 **불규칙한 얼룩과 그 사이를 가로지르는 암흑 먼지띠**인데,
// 매끈한 원 몇 개로는 원리적으로 그 구조가 나오지 않는다. 대신 소프트 블롭 수백 개를 축을 따라
// 흩뿌려 겹쳐 쌓으면 뭉치고 갈라지는 구조가 저절로 생긴다.
//
// 이 계산 결과는 전부 정적이다 — 화면 크기가 바뀔 때만 다시 그리고, 매 프레임 도는 루프가 없다.

import { hashString, mulberry32 } from '../rng';

/** 0~1 정규 좌표. 반지름은 min(width, height) 기준 비율이다. */
export interface CloudBlob {
  x: number;
  y: number;
  radius: number;
  /** 'r, g, b' */
  color: string;
  alpha: number;
}

export interface CloudStar {
  x: number;
  y: number;
  /** CSS px */
  radius: number;
  alpha: number;
  color: string;
}

/** 성단 안에서 밝은 별끼리 잇는 선 — 배경에도 "별자리처럼 묶인 무리"가 보여야 한다. */
export interface CloudLink {
  from: number;
  to: number;
}

export interface CloudScene {
  /** 더해서(additive) 그리는 빛 */
  glow: CloudBlob[];
  /** 덮어서 그리는 암흑성운. glow 위에 올려 띠를 갈라 놓는다. */
  dark: CloudBlob[];
  stars: CloudStar[];
  links: CloudLink[];
}

export type CloudLayer =
  | {
      kind: 'milkyway';
      /** 띠의 기울기(deg) */
      angle: number;
      /** 띠 중심의 세로 위치 (0~1) */
      offsetY: number;
      /** 띠의 폭 (0~1, 화면 짧은 쪽 기준) */
      thickness: number;
      /** 블롭 개수 배수 */
      density: number;
      brightness: number;
    }
  | {
      kind: 'nebula';
      x: number;
      y: number;
      radius: number;
      /** 'r, g, b' */
      color: string;
      brightness: number;
      density?: number;
    }
  | {
      kind: 'galaxy';
      x: number;
      y: number;
      size: number;
      angle: number;
      brightness: number;
    }
  | {
      kind: 'cluster';
      x: number;
      y: number;
      radius: number;
      count: number;
      brightness: number;
      /** 밝은 별끼리 선으로 묶을지 */
      link?: boolean;
      color?: string;
    };

// 은하수의 별구름 색. 실제 은하수는 흰색이 아니라 오래된 별의 미색과 성간먼지의 적갈색,
// 젊은 별의 푸른빛이 섞여 있다.
const MILKY_PALETTE = ['226, 205, 180', '196, 178, 222', '168, 190, 245', '236, 220, 205'];
const STAR_PALETTE = ['255, 255, 255', '196, 214, 255', '255, 232, 206'];

/** Box-Muller. 블롭을 축 주위에 정규분포로 흩어야 가장자리가 자연스럽게 옅어진다. */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pick<T>(random: () => number, list: T[]): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

function milkyway(layer: Extract<CloudLayer, { kind: 'milkyway' }>, random: () => number): CloudScene {
  const glow: CloudBlob[] = [];
  const dark: CloudBlob[] = [];
  const stars: CloudStar[] = [];

  const radians = (layer.angle * Math.PI) / 180;
  const ax = Math.cos(radians);
  const ay = Math.sin(radians);
  // 축에 수직인 방향
  const px = -ay;
  const py = ax;

  const count = Math.round(120 * layer.density);

  for (let i = 0; i < count; i += 1) {
    // 축을 따라 화면 밖까지 넉넉히 (띠가 화면 안에서 끊기면 안 된다)
    const along = (random() - 0.5) * 2.4;
    // 수직 방향은 정규분포 — 가운데가 진하고 가장자리로 갈수록 옅어진다
    const across = gaussian(random) * layer.thickness * 0.55;
    // 세 번에 한 번은 띠 한가운데에 몰아 밝은 심(core)을 만든다
    const core = i % 3 === 0;
    const spread = core ? 0.45 : 1;

    glow.push({
      x: 0.5 + ax * along + px * across * spread,
      y: layer.offsetY + ay * along + py * across * spread,
      radius: layer.thickness * (core ? 0.3 : 0.55) * (0.5 + random()),
      color: pick(random, MILKY_PALETTE),
      alpha: layer.brightness * (core ? 0.15 : 0.075) * (0.6 + random() * 0.8),
    });
  }

  // 암흑성운(dust lane) — 띠를 가로질러 갈라 놓는다. 이게 없으면 균일한 얼룩으로 보인다.
  const darkCount = Math.round(46 * layer.density);
  for (let i = 0; i < darkCount; i += 1) {
    const along = (random() - 0.5) * 2.4;
    // 먼지띠는 중심선에서 살짝 치우쳐 있다 — 정확히 가운데면 띠가 두 쪽으로 반듯이 갈린다
    const across = (gaussian(random) * 0.3 - 0.12) * layer.thickness;
    dark.push({
      x: 0.5 + ax * along + px * across,
      y: layer.offsetY + ay * along + py * across,
      radius: layer.thickness * 0.36 * (0.4 + random()),
      color: '4, 6, 16',
      alpha: 0.42 * (0.5 + random() * 0.8),
    });
  }

  // 띠를 따라 촘촘한 잔별. 실제로 은하수를 은하수로 읽히게 하는 결정적 요소다 —
  // 뿌연 빛만 있으면 그냥 안개로 보인다.
  const starCount = Math.round(320 * layer.density);
  for (let i = 0; i < starCount; i += 1) {
    const along = (random() - 0.5) * 2.4;
    const across = gaussian(random) * layer.thickness * 0.4;
    stars.push({
      x: 0.5 + ax * along + px * across,
      y: layer.offsetY + ay * along + py * across,
      radius: 0.3 + random() * 0.7,
      alpha: layer.brightness * (0.25 + random() * 0.6),
      color: pick(random, STAR_PALETTE),
    });
  }

  return { glow, dark, stars, links: [] };
}

function nebula(layer: Extract<CloudLayer, { kind: 'nebula' }>, random: () => number): CloudScene {
  const glow: CloudBlob[] = [];
  const count = Math.round(34 * (layer.density ?? 1));

  for (let i = 0; i < count; i += 1) {
    // 원 안에 고르게가 아니라 중심에 몰리게 — 성운은 가운데가 진하다
    const angle = random() * Math.PI * 2;
    const distance = layer.radius * random() ** 1.6;
    glow.push({
      x: layer.x + Math.cos(angle) * distance,
      y: layer.y + Math.sin(angle) * distance * 0.78,
      radius: layer.radius * (0.24 + random() * 0.5),
      color: layer.color,
      alpha: layer.brightness * 0.09 * (0.5 + random()),
    });
  }

  return { glow, dark: [], stars: [], links: [] };
}

function galaxy(layer: Extract<CloudLayer, { kind: 'galaxy' }>, random: () => number): CloudScene {
  const glow: CloudBlob[] = [];
  const stars: CloudStar[] = [];
  const radians = (layer.angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  // 두 개의 나선 팔 — 각도에 따라 반지름이 커지는 로그나선
  for (let arm = 0; arm < 2; arm += 1) {
    for (let i = 0; i < 26; i += 1) {
      const t = i / 26;
      const theta = arm * Math.PI + t * Math.PI * 1.7;
      const r = layer.size * (0.14 + t * 0.86);
      // 타원으로 눌러 비스듬히 본 원반처럼 만든다
      const lx = Math.cos(theta) * r;
      const ly = Math.sin(theta) * r * 0.42;
      glow.push({
        x: layer.x + lx * cos - ly * sin,
        y: layer.y + lx * sin + ly * cos,
        radius: layer.size * (0.2 - t * 0.1),
        color: t < 0.4 ? '236, 222, 200' : '176, 192, 244',
        alpha: layer.brightness * 0.13 * (1 - t * 0.5),
      });
    }
  }

  // 밝은 핵
  glow.push({
    x: layer.x,
    y: layer.y,
    radius: layer.size * 0.3,
    color: '255, 240, 214',
    alpha: layer.brightness * 0.36,
  });
  stars.push({
    x: layer.x,
    y: layer.y,
    radius: 1.4,
    alpha: layer.brightness * 0.9,
    color: '255, 246, 226',
  });

  void random;
  return { glow, dark: [], stars, links: [] };
}

function cluster(layer: Extract<CloudLayer, { kind: 'cluster' }>, random: () => number): CloudScene {
  const stars: CloudStar[] = [];
  const links: CloudLink[] = [];

  // 무리 전체를 감싸는 아주 옅은 후광 — 성단 주변에는 늘 가스가 남아 있다
  const glow: CloudBlob[] = [
    {
      x: layer.x,
      y: layer.y,
      radius: layer.radius * 1.5,
      color: layer.color ?? '190, 200, 250',
      alpha: layer.brightness * 0.1,
    },
  ];

  for (let i = 0; i < layer.count; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = layer.radius * random() ** 0.7;
    // 앞쪽 5개는 "밝은 구성원" — 별자리처럼 이 별들만 선으로 잇는다
    const bright = i < 5;
    stars.push({
      x: layer.x + Math.cos(angle) * distance,
      y: layer.y + Math.sin(angle) * distance,
      radius: bright ? 1.1 + random() * 0.8 : 0.35 + random() * 0.55,
      alpha: layer.brightness * (bright ? 0.85 : 0.3 + random() * 0.4),
      color: pick(random, STAR_PALETTE),
    });
  }

  if (layer.link) {
    // 밝은 별들을 한 줄로 잇는다. 완전그래프로 이으면 그물이 되어 별자리로 안 읽힌다.
    for (let i = 0; i + 1 < Math.min(5, layer.count); i += 1) {
      links.push({ from: i, to: i + 1 });
    }
  }

  return { glow, dark: [], stars, links };
}

/**
 * 레이어 목록을 실제로 그릴 도형들로 바꾼다.
 * seed가 같으면 항상 같은 하늘이 나온다 — 화면을 오갈 때마다 성운 모양이 바뀌면
 * 같은 장소로 돌아왔다는 감각 자체가 사라진다.
 */
export function buildCloudScene(layers: CloudLayer[], seed: string): CloudScene {
  const scene: CloudScene = { glow: [], dark: [], stars: [], links: [] };

  layers.forEach((layer, index) => {
    // 레이어마다 독립된 시드 — 순서가 바뀌어도 각 레이어의 모양은 그대로다
    const random = mulberry32(hashString(`${seed}:${index}:${layer.kind}`));
    let part: CloudScene;
    if (layer.kind === 'milkyway') part = milkyway(layer, random);
    else if (layer.kind === 'nebula') part = nebula(layer, random);
    else if (layer.kind === 'galaxy') part = galaxy(layer, random);
    else part = cluster(layer, random);

    // links는 자기 레이어의 stars 인덱스를 가리키므로, 합칠 때 오프셋을 더해야 한다.
    const offset = scene.stars.length;
    scene.glow.push(...part.glow);
    scene.dark.push(...part.dark);
    scene.stars.push(...part.stars);
    scene.links.push(...part.links.map((link) => ({ from: link.from + offset, to: link.to + offset })));
  });

  return scene;
}
