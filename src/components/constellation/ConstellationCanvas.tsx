import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CLUSTER_COLORS,
  CLUSTER_ORDER,
  clusterRadius,
  type ClusterId,
  type Vec3,
} from '../../lib/constellation/layout';
import { backdropScale, generateBackdropStars } from '../../lib/constellation/backdrop';
import type { ConstellationGraph } from '../../lib/constellation/buildGraph';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '../icons';

export interface ClusterLabel {
  cluster: ClusterId;
  text: string;
  onTap: () => void;
}

/**
 * 카메라를 옮겨달라는 요청. 같은 대상을 다시 눌러도 다시 이동해야 하므로 값이 아니라
 * token으로 "새 요청인지"를 판단한다.
 *
 * `raise`는 "이 군집을 화면 아래쪽 카드에 가리지 않게 위로 올려 달라"는 뜻이다.
 */
export type CameraFocusRequest =
  | { kind: 'overview'; token: number }
  | { kind: 'cluster'; cluster: ClusterId; raise: boolean; token: number };

export interface ConstellationCanvasProps {
  graph: ConstellationGraph;
  clusterLabels: ClusterLabel[];
  selectedId: string | null;
  highlightedIds: string[] | null;
  cameraFocus: CameraFocusRequest | null;
  /** 배경 별 개수 배수. 0이면 배경 별 없이 경험 별만 남는다. */
  density?: number;
  onSelect: (id: string | null) => void;
  onWebglFailure: () => void;
  /** 군집(별무리)의 현재 3D 중심 위치. graph.nodes의 좌표는 이미 이 값 기준으로 계산돼 있다
   * (InsightsPage의 applyClusterCenters 참고) — 여기서는 성운 스프라이트·카메라 포커스·
   * 라벨 위치를 맞추는 데만 쓴다. */
  clusterCenters: Record<ClusterId, Vec3>;
  /** 군집(별무리)의 현재 크기 배율(기본 1). clusterCenters와 같은 방식으로 편집 모드에서
   * 크기 손잡이로 조절하고 그 결과가 다시 여기로 들어온다. */
  clusterRadiusScale: Record<ClusterId, number>;
  /** true면 성운(haze)을 눌러 군집 전체를 드래그로 옮기거나, 손잡이로 크기를 조절할 수 있다. */
  editMode: boolean;
  /** 드래그가 끝나 군집의 새 위치가 확정됐을 때 호출된다(절대 좌표). */
  onClusterMoved: (cluster: ClusterId, center: Vec3) => void;
  /** 크기 손잡이 드래그가 끝나 군집의 새 배율이 확정됐을 때 호출된다. */
  onClusterResized: (cluster: ClusterId, scale: number) => void;
}

const DIMMED_OPACITY = 0.12;
const AUTO_ROTATE_SPEED = 0.3;
const DEFAULT_DISTANCE = 34;
const STAR_FOCUS_DISTANCE = 6;
// 트윈이 어떤 이유로든 수렴하지 않아도 반드시 끝나게 하는 상한. 이게 없으면 트윈이 매 프레임
// 카메라 위치를 덮어써서 휠 줌·드래그가 영원히 먹지 않는다 (실제로 겪었던 버그).
const FOCUS_MAX_FRAMES = 120;
// 카드(BottomSheet)가 화면 아래 40%를 덮는다. 남는 60%의 한가운데(위에서 30%)에 군집이 오려면
// 화면 높이의 20%, 즉 반높이의 40%만큼 위로 올려야 한다. BottomSheet.SHEET_HEIGHT와 짝이다.
const CARD_RAISE = 0.4;

// 별 하나의 그림. 외부 이미지 파일 없이 런타임에 그려서 CSP나 배포 경로 문제를 아예 없앤다.
// 중심은 작고 아주 밝게, 주변은 넓고 옅게 — 여기까지는 예전과 같지만, 그것만으로는
// "한 점" 같다는 피드백이 있었다. 실제 사진 속 별처럼 십자로 뻗는 회절 스파이크(diffraction
// spike)를 core 위에 더해서 점이 아니라 별로 읽히게 한다 — 주 스파이크(상하좌우) 4개 +
// 보조 스파이크(대각선) 4개, 총 8갈래.
function createStarTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.05, 'rgba(255,255,255,1)');
  glow.addColorStop(0.11, 'rgba(255,255,255,0.7)');
  glow.addColorStop(0.22, 'rgba(255,255,255,0.24)');
  glow.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 스파이크는 core 위에 additive로 덧그린다 — 겹치는 부분이 타서 날아가지 않고 은은하게 밝아진다.
  ctx.globalCompositeOperation = 'lighter';
  function drawSpike(angle: number, length: number, width: number, alpha: number) {
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(angle);
    const grad = ctx.createLinearGradient(-length, 0, length, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-length, -width / 2, length * 2, width);
    ctx.restore();
  }
  drawSpike(0, half * 0.92, 3.2, 0.85);
  drawSpike(Math.PI / 2, half * 0.92, 3.2, 0.85);
  drawSpike(Math.PI / 4, half * 0.58, 1.6, 0.35);
  drawSpike((Math.PI / 4) * 3, half * 0.58, 1.6, 0.35);

  return new THREE.CanvasTexture(canvas);
}

// 선택된 별을 감싸는 얇은 고리. 예전엔 별 텍스처를 크게 키워 썼는데 큰 동심원 얼룩처럼 보였다 —
// 가운데를 비운 링으로 바꿔서 별 자체를 가리지 않게 한다.
function createRingTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.74, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(0.83, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.9, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// 군집 크기 손잡이용 — 돋보기(확대) 아이콘. 이동 손잡이(점)와 구분되게, 그리고 무슨
// 동작인지 바로 알아보게 아이콘 모양으로 그린다("확대 아이콘으로 바꿔줘" 요청).
function createZoomHandleTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;

  // 아이콘 뒤 은은한 후광 — 별이 많은 배경 위에서도 손잡이가 묻히지 않게 한다.
  const glow = ctx.createRadialGradient(half, half, 0, half, half, half);
  glow.addColorStop(0, 'rgba(255,255,255,0.32)');
  glow.addColorStop(0.55, 'rgba(255,255,255,0.1)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // 렌즈(원) + 손잡이(대각선) + 렌즈 안 + 표시 — 흔히 쓰는 "확대" 돋보기 글리프.
  const lensRadius = size * 0.2;
  const lensCenter = { x: half - size * 0.07, y: half - size * 0.07 };
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineCap = 'round';

  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.arc(lensCenter.x, lensCenter.y, lensRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    lensCenter.x + lensRadius * Math.cos(Math.PI / 4),
    lensCenter.y + lensRadius * Math.sin(Math.PI / 4),
  );
  ctx.lineTo(half + size * 0.24, half + size * 0.24);
  ctx.stroke();

  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(lensCenter.x - lensRadius * 0.45, lensCenter.y);
  ctx.lineTo(lensCenter.x + lensRadius * 0.45, lensCenter.y);
  ctx.moveTo(lensCenter.x, lensCenter.y - lensRadius * 0.45);
  ctx.lineTo(lensCenter.x, lensCenter.y + lensRadius * 0.45);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

// 군집 주변에 깔리는 아주 옅은 성운. 스프라이트 3장이라 비용이 사실상 없다.
function createHazeTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(0.7, 'rgba(255,255,255,0.045)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

// 군집을 화면에 적당히 채우는 카메라 거리. fov 55°(half 27.5°, tan≈0.52)에서 반경 r을 담으려면
// 최소 r/0.52 ≈ 1.9r이 필요하고, 여기에 여백을 더한 값이다.
function clusterViewDistance(count: number): number {
  return clusterRadius(count) * 2.4 + 3.5;
}

export function ConstellationCanvas({
  graph,
  clusterLabels,
  selectedId,
  highlightedIds,
  cameraFocus,
  density = 1,
  onSelect,
  onWebglFailure,
  clusterCenters,
  clusterRadiusScale,
  editMode,
  onClusterMoved,
  onClusterResized,
}: ConstellationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<ClusterId, HTMLButtonElement>());
  // 방향키가 부르는 시점 이동 함수. camera/controls는 아래 메인 useEffect 안에서만 살아
  // 있으므로, 그 안에서 만들어 이 ref에 꽂아 두고 버튼 클릭 핸들러는 ref로만 부른다.
  const panRef = useRef<((dx: number, dy: number) => void) | null>(null);
  // 군집(별무리)을 드래그해서 옮기면 clusterCenters·graph가 바뀌어 이 효과가 처음부터 다시
  // 실행된다(씬을 통째로 다시 만든다) — 그때마다 카메라를 기본 위치로 되돌리면 "화면이
  // 새로고침된 것처럼 훅 튄다"("자연스럽게 툭 그 자리에 오게" 요청). 마지막 카메라 위치를
  // 여기 저장해뒀다가 다음 렌더에서 그대로 복원한다.
  const cameraStateRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // 매 프레임 읽어야 하는 값들. state로 두면 프레임마다 리렌더가 돌고, 콜백을 씬에 캡처하면
  // 오래된 클로저를 붙들게 된다 — ref로 최신 값만 넘긴다.
  const selectedIdRef = useRef(selectedId);
  const highlightedIdsRef = useRef(highlightedIds);
  const cameraFocusRef = useRef(cameraFocus);
  const onSelectRef = useRef(onSelect);
  const onWebglFailureRef = useRef(onWebglFailure);
  const editModeRef = useRef(editMode);
  const onClusterMovedRef = useRef(onClusterMoved);
  const onClusterResizedRef = useRef(onClusterResized);
  const clusterRadiusScaleRef = useRef(clusterRadiusScale);
  selectedIdRef.current = selectedId;
  highlightedIdsRef.current = highlightedIds;
  cameraFocusRef.current = cameraFocus;
  onSelectRef.current = onSelect;
  onWebglFailureRef.current = onWebglFailure;
  editModeRef.current = editMode;
  onClusterMovedRef.current = onClusterMoved;
  onClusterResizedRef.current = onClusterResized;
  clusterRadiusScaleRef.current = clusterRadiusScale;

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
    // 배경(그라데이션·성운)은 DOM 레이어가 그린다 — 캔버스는 투명하게 두고 그 위에 겹친다.
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 6;
    controls.maxDistance = 70;
    controls.rotateSpeed = 0.6;
    controls.autoRotate = true;
    controls.autoRotateSpeed = AUTO_ROTATE_SPEED;

    // 군집을 옮긴 직후처럼 이 효과가 다시 실행된 것이면 마지막으로 보던 자리를 그대로
    // 이어서 보여준다. 처음 마운트될 때만 기본 시점(전체 별자리가 보이는 정면)에서 시작한다.
    if (cameraStateRef.current) {
      camera.position.copy(cameraStateRef.current.position);
      controls.target.copy(cameraStateRef.current.target);
    } else {
      camera.position.set(0, 0, DEFAULT_DISTANCE);
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) controls.autoRotate = false;

    const starTexture = createStarTexture();
    const ringTexture = createRingTexture();
    const hazeTexture = createHazeTexture();

    // ---- 배경 별 (깊이감 전용, 클릭 대상 아님) ----
    // 경험 별보다 훨씬 멀리(반지름 78~140) 두므로 카메라를 돌리면 자연스러운 시차가 생긴다.
    // 카메라 최대 거리가 70이라 항상 이 구각 안쪽에 머문다.
    const scale =
      density *
      backdropScale({
        cores: navigator.hardwareConcurrency,
        minViewport: Math.min(window.innerWidth, window.innerHeight),
        reduceMotion,
      });

    interface BackdropLayerObject {
      points: THREE.Points;
      material: THREE.PointsMaterial;
      baseOpacity: number;
      speed: number;
      phase: number;
    }

    const backdropLayers: BackdropLayerObject[] = (
      [
        { count: 520, seed: 0x5eed01, min: 100, max: 140, size: 0.6, opacity: 0.5, speed: 0.22, phase: 0 },
        { count: 180, seed: 0x5eed02, min: 78, max: 100, size: 0.9, opacity: 0.75, speed: 0.35, phase: 1.7 },
      ] as const
    ).map((spec) => {
      const { positions, colors } = generateBackdropStars(
        Math.round(spec.count * scale),
        spec.seed,
        spec.min,
        spec.max,
      );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: spec.size,
        map: starTexture,
        vertexColors: true,
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      // 배경 별은 항상 뒤에 그린다 — 경험 별과 겹칠 때 앞으로 튀어나오면 구분이 무너진다.
      points.renderOrder = -1;
      scene.add(points);
      return { points, material, baseOpacity: spec.opacity, speed: spec.speed, phase: spec.phase };
    });

    // ---- 군집 성운 ----
    // 편집 모드에서는 이 스프라이트가 "군집 전체를 잡는 손잡이"도 겸한다 — 반지름이
    // 군집만큼 넉넉해서 정확히 별 하나를 짚지 않아도 군집을 붙잡을 수 있다.
    const hazeSpriteByCluster = new Map<ClusterId, THREE.Sprite>();
    const hazeSprites = CLUSTER_ORDER.filter((cluster) => graph.counts[cluster] > 0)
      .map((cluster) => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: hazeTexture,
            color: new THREE.Color(CLUSTER_COLORS[cluster]),
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        const center = clusterCenters[cluster];
        sprite.position.set(center.x, center.y, center.z);
        sprite.scale.setScalar(clusterRadius(graph.counts[cluster]) * 3.4);
        sprite.renderOrder = -1;
        sprite.userData.cluster = cluster;
        scene.add(sprite);
        hazeSpriteByCluster.set(cluster, sprite);
        return sprite;
      });

    // ---- 군집을 잡기 위한 보이지 않는 히트 타깃 ----
    // "별무리 박스를 잘 못 잡는다, 근처를 눌러도 인식을 못한다"는 피드백 — 특히 별이 적어
    // 성운이 작거나 화면에서 멀리 있을 때 정확히 그 위를 눌러야만 잡혔다. 화면에 보이는
    // 성운 크기는 그대로 두고, 클릭 판정 영역만 훨씬 넉넉한 투명 스프라이트로 따로 둔다.
    const hazeHitSpriteByCluster = new Map<ClusterId, THREE.Sprite>();
    const hazeHitSprites = CLUSTER_ORDER.filter((cluster) => graph.counts[cluster] > 0).map((cluster) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      const center = clusterCenters[cluster];
      sprite.position.set(center.x, center.y, center.z);
      sprite.scale.setScalar(clusterRadius(graph.counts[cluster]) * 7);
      sprite.userData.cluster = cluster;
      scene.add(sprite);
      hazeHitSpriteByCluster.set(cluster, sprite);
      return sprite;
    });

    // ---- 편집 모드에서 보이는 군집 박스 + 손잡이 ----
    // "편집모드를 누르면 자동으로 박스가 나오면서, 누를 수 있는 작은 팁이 보였으면" 요청 —
    // 예전엔 드래그를 시작해야만 박스가 잠깐 보였는데, 이제 편집 모드인 동안은 모든 군집에
    // 박스와 손잡이가 항상 떠 있다. 단위 정육면체(EdgesGeometry) 하나를 공유하고 군집마다
    // scale/position만 다르게 준다 — geometry를 여러 번 만드는 것보다 훨씬 싸다.
    const clusterBoxGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const handleTexture = createRingTexture();
    const zoomHandleTexture = createZoomHandleTexture();

    interface ClusterHandles {
      box: THREE.LineSegments;
      moveHandle: THREE.Sprite;
      resizeHandle: THREE.Sprite;
    }
    const clusterHandlesByCluster = new Map<ClusterId, ClusterHandles>();
    const visibleClusters = CLUSTER_ORDER.filter((cluster) => graph.counts[cluster] > 0);

    visibleClusters.forEach((cluster) => {
      const center = clusterCenters[cluster];
      const scale = clusterRadiusScaleRef.current[cluster] ?? 1;
      const radius = clusterRadius(graph.counts[cluster]) * scale;
      const color = new THREE.Color(CLUSTER_COLORS[cluster]);

      const box = new THREE.LineSegments(
        clusterBoxGeometry,
        new THREE.LineDashedMaterial({
          color,
          dashSize: 0.22,
          gapSize: 0.16,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
        }),
      );
      // 점선은 정점 사이 누적 거리(computeLineDistances)를 기준으로 그려진다 — 단위 지오메트리
      // 자체에 한 번만 계산해두면 scale이 달라져도(=점선 간격도 함께 늘고 줄어) 다시 계산할
      // 필요가 없다. clone 없이 geometry를 공유하므로 첫 박스에서 한 번만 해도 충분하다.
      if (!clusterBoxGeometry.attributes.lineDistance) box.computeLineDistances();
      box.scale.setScalar(radius * 2);
      box.position.set(center.x, center.y, center.z);
      box.visible = false;
      box.renderOrder = 5;
      scene.add(box);

      // 눌러서 옮기는 손잡이 — 실제 클릭 판정은 훨씬 큰 hazeHitSprite가 맡고, 이건 "여기를
      // 누르면 된다"는 걸 보여주는 작은 표식일 뿐이다("작게 나온 팁" 요청).
      const moveHandle = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: handleTexture,
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      moveHandle.scale.setScalar(1.6);
      moveHandle.position.set(center.x, center.y, center.z);
      moveHandle.visible = false;
      moveHandle.renderOrder = 6;
      scene.add(moveHandle);

      // 크기 조절 손잡이 — 박스 오른쪽 위 모서리에 둔다. 이건 실제 판정 크기 그대로 눌러야
      // 하므로 raycastResizeHandles 배열에 담아 별도로 히트테스트한다.
      const resizeHandle = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: zoomHandleTexture,
          color: 0xffffff,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      resizeHandle.scale.setScalar(1.6);
      resizeHandle.position.set(
        center.x + radius * Math.SQRT1_2,
        center.y + radius * Math.SQRT1_2,
        center.z,
      );
      resizeHandle.visible = false;
      resizeHandle.userData.cluster = cluster;
      resizeHandle.renderOrder = 6;
      scene.add(resizeHandle);

      clusterHandlesByCluster.set(cluster, { box, moveHandle, resizeHandle });
    });
    const resizeHandleSprites = visibleClusters.map(
      (cluster) => clusterHandlesByCluster.get(cluster)!.resizeHandle,
    );

    // ---- 경험 별 ----
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

    const starMaterial = new THREE.PointsMaterial({
      // 배경 별(0.6~0.9)보다 확실히 크게 — 경험 별이 배경에 섞여버리면 안 된다.
      size: 1.15,
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
    const TAG_LINE_OPACITY = 0.1;
    const COLLECTION_LINE_OPACITY = 0.24;

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
        color: 0x8fa6d6,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      return new THREE.LineSegments(geometry, material);
    }

    const tagLines = makeLines(graph.edges.filter((e) => !e.sameCollection), TAG_LINE_OPACITY);
    const collectionLines = makeLines(
      graph.edges.filter((e) => e.sameCollection),
      COLLECTION_LINE_OPACITY,
    );
    scene.add(tagLines, collectionLines);

    // ---- 선택된 별을 감싸는 고리 ----
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: ringTexture,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const HALO_SCALE = 1.8;
    halo.scale.setScalar(HALO_SCALE);
    halo.visible = false;
    scene.add(halo);

    // ---- 별 탭 ----
    const raycaster = new THREE.Raycaster();
    // Points는 기본 임계값이 1이라 손가락 탭에는 너무 빡빡하다.
    raycaster.params.Points = { threshold: 0.7 };
    let pointerDownAt = { x: 0, y: 0, time: 0, id: -1 };
    // 핀치줌 중 손가락 하나를 떼면 그 pointerup은 탭이 아니다 — 제스처 동안 포인터가 두 개
    // 이상 있었는지를 이 Set으로 추적해서, 그런 경우 raycast 자체를 건너뛴다.
    const activePointers = new Set<number>();
    let multiTouchGesture = false;

    // ---- 군집(별무리) 드래그 — 편집 모드에서만 ----
    // "카메라를 향한 평면 위에서 자유롭게 드래그"를 구현한다: 드래그를 시작한 순간의 군집
    // 중심을 지나고 카메라 시선 방향을 법선으로 갖는 평면을 만들고, 포인터가 그 평면과
    // 만나는 지점을 매 프레임 다시 구해 시작점과의 차이(delta)만큼 군집 전체(성운 스프라이트
    // + 그 군집에 속한 별들)를 옮긴다. 카메라가 어느 각도에 있든 "포인터가 화면에서 움직인
    // 만큼 자연스럽게" 따라오는 이유다.
    interface ClusterDrag {
      cluster: ClusterId;
      pointerId: number;
      plane: THREE.Plane;
      startWorldPoint: THREE.Vector3;
      startCenter: THREE.Vector3;
    }
    let clusterDrag: ClusterDrag | null = null;
    const dragPointerNdc = new THREE.Vector2();
    const dragIntersection = new THREE.Vector3();
    const dragDelta = new THREE.Vector3();
    const dragNewCenter = new THREE.Vector3();
    const cameraDirection = new THREE.Vector3();
    const starPositionAttr = starGeometry.getAttribute('position') as THREE.BufferAttribute;
    // 드래그 시작 시점의 각 별 좌표를 기억해둔다 — 매 프레임 delta를 이 기준 좌표에 더해야
    // 한다(누적해서 매번 현재 좌표에 더하면 오차가 쌓이거나 delta가 중복 적용된다).
    let dragStartPositions: Float32Array | null = null;

    // ---- 군집 크기 조절 — 편집 모드에서만 ----
    // 크기 손잡이를 눌러서 중심에서 멀어지거나 가까워지면, 그 거리(반경 기준)만큼 배율을
    // 다시 계산해 그 군집의 별들을 중심 기준으로 방사형으로 밀어낸다("별무리 크기도 조절할
    // 수 있게" 요청).
    interface ClusterResize {
      cluster: ClusterId;
      pointerId: number;
      plane: THREE.Plane;
      center: THREE.Vector3;
      baseRadius: number;
      startScale: number;
    }
    let clusterResize: ClusterResize | null = null;
    let resizeStartPositions: Float32Array | null = null;
    const MIN_CLUSTER_SCALE = 0.4;
    const MAX_CLUSTER_SCALE = 2.5;

    function raycastFromEvent(event: PointerEvent): THREE.Raycaster {
      const rect = renderer.domElement.getBoundingClientRect();
      dragPointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      dragPointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(dragPointerNdc, camera);
      return raycaster;
    }

    function tryBeginClusterResize(event: PointerEvent): boolean {
      if (!editModeRef.current) return false;
      const ray = raycastFromEvent(event);
      const hits = ray.intersectObjects(resizeHandleSprites);
      if (hits.length === 0) return false;
      const cluster = (hits[0].object as THREE.Sprite).userData.cluster as ClusterId;
      const handles = clusterHandlesByCluster.get(cluster);
      if (!handles) return false;

      camera.getWorldDirection(cameraDirection);
      const center = handles.box.position.clone();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDirection, center);

      clusterResize = {
        cluster,
        pointerId: event.pointerId,
        plane,
        center,
        baseRadius: clusterRadius(graph.counts[cluster]),
        startScale: clusterRadiusScaleRef.current[cluster] ?? 1,
      };
      resizeStartPositions = starPositionAttr.array.slice() as Float32Array;
      controls.enabled = false;
      return true;
    }

    function updateClusterResize(event: PointerEvent) {
      if (!clusterResize || event.pointerId !== clusterResize.pointerId) return;
      const ray = raycastFromEvent(event);
      if (!ray.ray.intersectPlane(clusterResize.plane, dragIntersection)) return;
      const distance = dragIntersection.distanceTo(clusterResize.center);
      const newScale = THREE.MathUtils.clamp(
        distance / clusterResize.baseRadius,
        MIN_CLUSTER_SCALE,
        MAX_CLUSTER_SCALE,
      );

      const handles = clusterHandlesByCluster.get(clusterResize.cluster);
      const radius = clusterResize.baseRadius * newScale;
      if (handles) {
        handles.box.scale.setScalar(radius * 2);
        handles.resizeHandle.position.set(
          clusterResize.center.x + radius * Math.SQRT1_2,
          clusterResize.center.y + radius * Math.SQRT1_2,
          clusterResize.center.z,
        );
      }

      if (resizeStartPositions) {
        const ratio = newScale / clusterResize.startScale;
        graph.nodes.forEach((node, i) => {
          if (node.cluster !== clusterResize!.cluster) return;
          starPositionAttr.setXYZ(
            i,
            clusterResize!.center.x + (resizeStartPositions![i * 3] - clusterResize!.center.x) * ratio,
            clusterResize!.center.y + (resizeStartPositions![i * 3 + 1] - clusterResize!.center.y) * ratio,
            clusterResize!.center.z + (resizeStartPositions![i * 3 + 2] - clusterResize!.center.z) * ratio,
          );
        });
        starPositionAttr.needsUpdate = true;
      }
    }

    function endClusterResize() {
      if (!clusterResize) return;
      const { cluster } = clusterResize;
      const handles = clusterHandlesByCluster.get(cluster);
      const finalScale = handles ? handles.box.scale.x / (clusterResize.baseRadius * 2) : clusterResize.startScale;
      clusterResize = null;
      resizeStartPositions = null;
      controls.enabled = true;
      onClusterResizedRef.current(cluster, finalScale);
    }

    function tryBeginClusterDrag(event: PointerEvent): boolean {
      if (!editModeRef.current) return false;
      const ray = raycastFromEvent(event);
      // 보이는 성운이 아니라 훨씬 넉넉한 투명 히트 타깃을 기준으로 판정한다 — 클릭 판정
      // 영역만 크고 위치는 항상 시각 성운과 같다(updateClusterDrag에서 함께 옮긴다).
      const hits = ray.intersectObjects(hazeHitSprites);
      if (hits.length === 0) return false;
      const cluster = (hits[0].object as THREE.Sprite).userData.cluster as ClusterId;
      const sprite = hazeSpriteByCluster.get(cluster);
      if (!sprite) return false;

      camera.getWorldDirection(cameraDirection);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDirection, sprite.position);
      const startWorldPoint = new THREE.Vector3();
      if (!ray.ray.intersectPlane(plane, startWorldPoint)) return false;

      clusterDrag = {
        cluster,
        pointerId: event.pointerId,
        plane,
        startWorldPoint,
        startCenter: sprite.position.clone(),
      };
      dragStartPositions = starPositionAttr.array.slice() as Float32Array;
      // 드래그 중에는 카메라 회전/줌과 완전히 분리한다 — 둘이 같은 제스처를 동시에 해석하면
      // 군집도 어긋나고 카메라도 제멋대로 움직인다.
      controls.enabled = false;
      return true;
    }

    function updateClusterDrag(event: PointerEvent) {
      if (!clusterDrag || event.pointerId !== clusterDrag.pointerId) return;
      const ray = raycastFromEvent(event);
      if (!ray.ray.intersectPlane(clusterDrag.plane, dragIntersection)) return;
      dragDelta.copy(dragIntersection).sub(clusterDrag.startWorldPoint);
      dragNewCenter.copy(clusterDrag.startCenter).add(dragDelta);

      const sprite = hazeSpriteByCluster.get(clusterDrag.cluster);
      if (sprite) sprite.position.copy(dragNewCenter);
      const hitSprite = hazeHitSpriteByCluster.get(clusterDrag.cluster);
      if (hitSprite) hitSprite.position.copy(dragNewCenter);
      const handles = clusterHandlesByCluster.get(clusterDrag.cluster);
      if (handles) {
        handles.box.position.copy(dragNewCenter);
        handles.moveHandle.position.copy(dragNewCenter);
        const radius = handles.box.scale.x / 2;
        handles.resizeHandle.position.set(
          dragNewCenter.x + radius * Math.SQRT1_2,
          dragNewCenter.y + radius * Math.SQRT1_2,
          dragNewCenter.z,
        );
      }

      if (dragStartPositions) {
        graph.nodes.forEach((node, i) => {
          if (node.cluster !== clusterDrag!.cluster) return;
          starPositionAttr.setXYZ(
            i,
            dragStartPositions![i * 3] + dragDelta.x,
            dragStartPositions![i * 3 + 1] + dragDelta.y,
            dragStartPositions![i * 3 + 2] + dragDelta.z,
          );
        });
        starPositionAttr.needsUpdate = true;
      }
    }

    function endClusterDrag() {
      if (!clusterDrag) return;
      const { cluster } = clusterDrag;
      const sprite = hazeSpriteByCluster.get(cluster);
      const finalCenter = sprite ? sprite.position : clusterDrag.startCenter;
      clusterDrag = null;
      dragStartPositions = null;
      controls.enabled = true;
      onClusterMovedRef.current(cluster, { x: finalCenter.x, y: finalCenter.y, z: finalCenter.z });
    }

    function handlePointerDown(event: PointerEvent) {
      activePointers.add(event.pointerId);
      if (activePointers.size > 1) multiTouchGesture = true;
      pointerDownAt = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
      // 크기 손잡이가 이동 히트 타깃보다 작고 그 위에 얹혀 있으므로 먼저 검사한다.
      if (tryBeginClusterResize(event)) return;
      tryBeginClusterDrag(event);
    }

    function handlePointerMove(event: PointerEvent) {
      if (clusterResize) updateClusterResize(event);
      else if (clusterDrag) updateClusterDrag(event);
    }

    function handlePointerUp(event: PointerEvent) {
      const wasMultiTouch = multiTouchGesture;
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) multiTouchGesture = false;

      if (clusterResize && event.pointerId === clusterResize.pointerId) {
        endClusterResize();
        return;
      }
      if (clusterDrag && event.pointerId === clusterDrag.pointerId) {
        endClusterDrag();
        return; // 군집을 옮기고 뗀 것이지 별을 탭한 게 아니다.
      }

      // 이 포인터가 gesture를 시작한 그 손가락이 아니거나, 도중에 두 번째 포인터가 있었다면
      // (핀치줌) 탭으로 보지 않는다.
      if (event.pointerId !== pointerDownAt.id || wasMultiTouch) return;

      // 회전 드래그를 탭으로 오인하지 않도록 이동 거리와 시간을 함께 본다.
      const moved = Math.hypot(event.clientX - pointerDownAt.x, event.clientY - pointerDownAt.y);
      if (moved > 8 || performance.now() - pointerDownAt.time > 500) return;

      const ray = raycastFromEvent(event);
      const hits = ray.intersectObject(stars);
      if (hits.length === 0 || hits[0].index === undefined) {
        onSelectRef.current(null);
        return;
      }
      // 가장 가까운 별 하나만 — 겹쳐 보일 때 뒤엣것이 잡히면 안 된다.
      onSelectRef.current(graph.nodes[hits[0].index].id);
    }

    function handlePointerCancel(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) multiTouchGesture = false;
      if (clusterResize && event.pointerId === clusterResize.pointerId) endClusterResize();
      if (clusterDrag && event.pointerId === clusterDrag.pointerId) endClusterDrag();
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel);

    // ---- WebGL 컨텍스트 유실 ----
    // 컨텍스트를 잃으면 검은 화면만 남는다 — preventDefault로 브라우저의 기본 처리를 막고
    // 기존 텍스트 폴백으로 넘어가게 한다(복구를 시도하지 않는다: 씬을 다시 만드는 것보다
    // 페이지가 이미 갖고 있는 폴백 UI로 내려가는 편이 안전하다).
    function handleContextLost(event: Event) {
      event.preventDefault();
      onWebglFailureRef.current();
    }
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    // ---- 리사이즈 ----
    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    });
    resizeObserver.observe(container);

    // ---- 카메라 이동 ----
    // 별 하나 또는 군집 하나로 카메라를 부드럽게 옮긴다. 목표는 대상 위치 자체가 아니라
    // "대상에서 조금 떨어진 곳"이어야 대상이 화면을 가득 채워버리지 않는다.
    const focusTarget = new THREE.Vector3();
    const focusCamera = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const screenRight = new THREE.Vector3();
    const screenUp = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    let focusing = false;
    let focusFrames = 0;

    /**
     * @param raise 0이면 대상이 화면 한가운데. 0.5면 화면 높이의 절반만큼 위로 올라간다.
     *   아래 40%를 카드가 덮으므로, 남은 60%의 한가운데(위에서 30%)에 오게 하려면 0.4가 필요하다
     *   (화면 높이의 20% = 반높이의 40%).
     */
    function beginFocus(target: Vec3, distance: number, raise = 0) {
      focusTarget.set(target.x, target.y, target.z);
      // 지금 보고 있는 방향을 유지한 채 거리만 좁힌다 — 시점이 갑자기 뒤집히면 방향 감각을 잃는다.
      direction.copy(camera.position).sub(controls.target);
      if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
      direction.normalize();

      if (raise !== 0) {
        // 대상이 화면 위쪽에 보이게 하려면 카메라가 바라보는 지점을 대상보다 "아래"에 둬야 한다.
        // 그 아래쪽은 월드 y축이 아니라 지금 카메라 기준의 화면 아래 방향이어야 한다.
        screenRight.crossVectors(worldUp, direction);
        if (screenRight.lengthSq() < 1e-6) screenRight.set(1, 0, 0); // 정확히 위/아래를 내려다볼 때
        screenRight.normalize();
        screenUp.crossVectors(direction, screenRight).normalize();
        // fov 55°에서 화면 반높이는 거리 × tan(27.5°) ≈ 0.52d.
        focusTarget.addScaledVector(screenUp, -distance * 0.52 * raise);
      }

      focusCamera.copy(focusTarget).addScaledVector(direction, distance);
      focusing = true;
      focusFrames = 0;
      // 트윈 중에는 자동 회전을 멈춘다. 자동 회전이 계속 카메라를 밀면 트윈이 영원히 수렴하지
      // 못하고, 그동안 사용자의 휠·드래그가 매 프레임 덮어써져 화면이 잠긴 것처럼 보인다.
      controls.autoRotate = false;
    }

    function endFocus() {
      focusing = false;
      controls.autoRotate = selectedIdRef.current === null && !reduceMotion;
    }

    let lastFocusedId: string | null = selectedIdRef.current;
    let lastClusterToken = cameraFocusRef.current?.token ?? -1;

    function updateFocus() {
      const id = selectedIdRef.current;
      if (id !== lastFocusedId) {
        lastFocusedId = id;
        const index = id === null ? undefined : nodeIndex.get(id);
        if (index === undefined) {
          // 선택 해제 — 전체가 보이는 원래 거리로 물러난다(보던 방향은 유지).
          beginFocus({ x: 0, y: 0, z: 0 }, DEFAULT_DISTANCE);
        } else {
          // 별 카드도 아래 40%를 덮으므로 별을 그 위로 올린다.
          beginFocus(graph.nodes[index].position, STAR_FOCUS_DISTANCE * 1.25, CARD_RAISE);
        }
        // 별을 보는 동안에는 회전을 잠가 카드와 별이 어긋나지 않게 한다.
        controls.enableRotate = id === null;
        if (reduceMotion) {
          camera.position.copy(focusCamera);
          controls.target.copy(focusTarget);
          endFocus();
        }
      }

      const request = cameraFocusRef.current;
      if (request && request.token !== lastClusterToken) {
        lastClusterToken = request.token;
        // 카메라 요청으로 보는 화면은 언제나 둘러볼 수 있어야 한다.
        controls.enableRotate = true;
        if (request.kind === 'overview') {
          beginFocus({ x: 0, y: 0, z: 0 }, DEFAULT_DISTANCE);
        } else {
          const distance = clusterViewDistance(graph.counts[request.cluster]);
          beginFocus(
            clusterCenters[request.cluster],
            // 카드가 아래 40%를 덮으면 보이는 영역이 좁아지므로 조금 더 물러난다.
            request.raise ? distance * 1.25 : distance,
            request.raise ? CARD_RAISE : 0,
          );
        }
        if (reduceMotion) {
          camera.position.copy(focusCamera);
          controls.target.copy(focusTarget);
          endFocus();
        }
      }

      if (!focusing) return;
      focusFrames += 1;
      camera.position.lerp(focusCamera, 0.08);
      controls.target.lerp(focusTarget, 0.08);
      if (camera.position.distanceTo(focusCamera) < 0.05 || focusFrames > FOCUS_MAX_FRAMES) {
        camera.position.copy(focusCamera);
        controls.target.copy(focusTarget);
        endFocus();
      }
    }

    // 사용자가 직접 돌리거나 줌하기 시작하면 진행 중인 트윈을 즉시 포기한다 — 조작을 트윈이
    // 계속 되돌리면 "화면이 가운데에 고정된" 것처럼 느껴진다.
    function handleControlsStart() {
      if (focusing) endFocus();
    }
    controls.addEventListener('start', handleControlsStart);

    // ---- 방향키로 시점 이동(pan) ----
    // OrbitControls는 enablePan=false라 드래그로는 못 옮긴다(별무리 드래그·별 탭과 제스처가
    // 겹치기 때문) — 대신 화면 가장자리의 단순한 방향키 버튼으로만 카메라와 시선을 함께
    // 옆으로 밀어준다("왼쪽/오른쪽/위/아래로 시점을 움직일 수 있는 방향키" 요청). 화면에 보이는
    // "오른쪽" 방향을 구하려고 카메라의 월드 행렬에서 로컬 X/Y축을 그대로 뽑아 쓴다.
    // 즉시 위치를 바꾸지 않고 beginFocus와 같은 트윈(focusCamera/focusTarget를 향해 매 프레임
    // lerp)에 태워 "부드럽게 스윽 움직이는" 애니메이션이 되게 한다("부드러운 애니메이션" 요청).
    const panRight = new THREE.Vector3();
    const panUp = new THREE.Vector3();
    const panOffset = new THREE.Vector3();
    function pan(dx: number, dy: number) {
      controls.autoRotate = false;
      // 이미 이동 중이면 트윈의 목표 지점을 기준으로 이어서 밀어야, 연달아 눌렀을 때
      // 현재 애니메이션 중인 위치로 순간 이동했다가 다시 미끄러지는 것처럼 보이지 않는다.
      const baseCamera = focusing ? focusCamera : camera.position;
      const baseTarget = focusing ? focusTarget : controls.target;
      const distance = baseCamera.distanceTo(baseTarget);
      panRight.setFromMatrixColumn(camera.matrixWorld, 0);
      panUp.setFromMatrixColumn(camera.matrixWorld, 1);
      // "상하좌우 이동 거리를 절반으로" 요청 — 0.28 → 0.14.
      const amount = distance * 0.14;
      panOffset.set(0, 0, 0).addScaledVector(panRight, dx * amount).addScaledVector(panUp, dy * amount);
      focusCamera.copy(baseCamera).add(panOffset);
      focusTarget.copy(baseTarget).add(panOffset);
      focusing = true;
      focusFrames = 0;
    }
    panRef.current = pan;

    // ---- 루프 ----
    const projected = new THREE.Vector3();
    const clock = new THREE.Clock();
    let frameId = 0;
    let running = true;

    let lastHighlightKey = '__init__';

    function updateDimming() {
      const highlighted = highlightedIdsRef.current;
      const key = highlighted === null ? 'none' : highlighted.join(',');
      if (key === lastHighlightKey) return;
      lastHighlightKey = key;
      const colorAttr = starGeometry.getAttribute('color') as THREE.BufferAttribute;
      graph.nodes.forEach((node, i) => {
        const base = new THREE.Color(CLUSTER_COLORS[node.cluster]);
        // 인사이트 근거는 실제 기록 id(entryId) 목록이다 — 한 기록이 여러 태그 군집에 별을
        // 중복으로 갖고 있으므로, node.id(군집까지 포함한 합성 id)가 아니라 entryId로
        // 매칭해야 그 기록의 별 전부가 함께 밝아진다.
        if (highlighted && !highlighted.includes(node.entryId)) {
          base.multiplyScalar(DIMMED_OPACITY);
        }
        colorAttr.setXYZ(i, base.r, base.g, base.b);
      });
      colorAttr.needsUpdate = true;
      const dimming = highlighted !== null;
      (tagLines.material as THREE.LineBasicMaterial).opacity = dimming ? 0.03 : TAG_LINE_OPACITY;
      (collectionLines.material as THREE.LineBasicMaterial).opacity = dimming
        ? 0.06
        : COLLECTION_LINE_OPACITY;
    }

    function updateHalo(elapsed: number) {
      const id = selectedIdRef.current;
      const index = id === null ? undefined : nodeIndex.get(id);
      if (index === undefined) {
        halo.visible = false;
        return;
      }
      const node = graph.nodes[index];
      halo.position.set(node.position.x, node.position.y, node.position.z);
      halo.material.color = new THREE.Color(CLUSTER_COLORS[node.cluster]);
      // 아주 얕은 호흡. 반짝임이 아니라 "살아 있다" 정도의 변화만 준다.
      const pulse = reduceMotion ? 1 : 1 + Math.sin(elapsed * 1.6) * 0.05;
      halo.scale.setScalar(HALO_SCALE * pulse);
      halo.visible = true;
    }

    // 편집 모드일 때 모든 군집에 박스+손잡이를 보여준다("편집모드를 누르면 자동으로 박스가
    // 나오면서 누를 수 있는 작은 팁이 보였으면" 요청) — 지금 드래그·크기조절 중인 군집은
    // 더 뚜렷하게 강조한다.
    function updateEditHandles() {
      const editing = editModeRef.current;
      const activeCluster = clusterDrag?.cluster ?? clusterResize?.cluster ?? null;
      clusterHandlesByCluster.forEach(({ box, moveHandle, resizeHandle }, cluster) => {
        box.visible = editing;
        moveHandle.visible = editing;
        resizeHandle.visible = editing;
        const active = cluster === activeCluster;
        (box.material as THREE.LineDashedMaterial).opacity = active ? 0.9 : 0.5;
        moveHandle.material.opacity = active ? 1 : 0.75;
        resizeHandle.material.opacity = active ? 1 : 0.75;
      });
    }

    // 배경 별을 레이어별로 아주 느리게 밝아졌다 어두워지게 한다. 별마다 따로 반짝이게 하려면
    // 커스텀 셰이더가 필요한데, 그 비용 대비 효과가 크지 않아 레이어 단위 호흡으로 갈음한다.
    function updateBackdrop(elapsed: number) {
      if (reduceMotion) return;
      for (const layer of backdropLayers) {
        layer.material.opacity = layer.baseOpacity * (0.82 + Math.sin(elapsed * layer.speed + layer.phase) * 0.18);
      }
    }

    function updateLabels() {
      const rect = renderer.domElement.getBoundingClientRect();
      for (const [cluster, element] of labelRefs.current) {
        // 성운 스프라이트 위치를 그대로 쓴다 — 편집 모드에서 드래그하는 동안에도 이 스프라이트가
        // 실시간으로 움직이므로, 라벨이 군집을 계속 따라다니게 하려면 clusterCenters(고정값)
        // 대신 이 위치를 읽어야 한다.
        const center = hazeSpriteByCluster.get(cluster)?.position ?? clusterCenters[cluster];
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
      const elapsed = clock.getElapsedTime();
      updateFocus();
      controls.update();
      updateDimming();
      updateEditHandles();
      updateBackdrop(elapsed);
      updateHalo(elapsed);
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
      panRef.current = null;
      cameraStateRef.current = { position: camera.position.clone(), target: controls.target.clone() };
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      controls.removeEventListener('start', handleControlsStart);
      controls.dispose();
      starGeometry.dispose();
      starMaterial.dispose();
      starTexture.dispose();
      ringTexture.dispose();
      hazeTexture.dispose();
      backdropLayers.forEach((layer) => {
        layer.points.geometry.dispose();
        layer.material.dispose();
      });
      hazeSprites.forEach((sprite) => sprite.material.dispose());
      hazeHitSprites.forEach((sprite) => sprite.material.dispose());
      clusterBoxGeometry.dispose();
      handleTexture.dispose();
      zoomHandleTexture.dispose();
      clusterHandlesByCluster.forEach(({ box, moveHandle, resizeHandle }) => {
        (box.material as THREE.Material).dispose();
        moveHandle.material.dispose();
        resizeHandle.material.dispose();
      });
      tagLines.geometry.dispose();
      (tagLines.material as THREE.Material).dispose();
      collectionLines.geometry.dispose();
      (collectionLines.material as THREE.Material).dispose();
      halo.material.dispose();
      renderer.dispose();
      // dispose()는 three의 캐시만 해제하고 실제 GL 컨텍스트는 남긴다 — /insights를 여러 번
      // 오가면 컨텍스트가 계속 쌓여 모바일 브라우저의 동시 컨텍스트 상한에 걸리고, 그 시점에
      // 브라우저가 아무 컨텍스트나(지금 쓰는 것까지) 강제로 잃게 만든다. 명시적으로 반납한다.
      renderer.forceContextLoss();
      container.removeChild(renderer.domElement);
    };
    // graph나 clusterCenters가 바뀌면 씬을 통째로 다시 만든다 — 인사이트 재생성이나 군집
    // 위치 저장 모두 드문 일이라 증분 갱신의 복잡도를 감수할 이유가 없다. 드래그 "도중"에는
    // clusterCenters가 바뀌지 않으므로(드래그가 끝나야 InsightsPage가 갱신한다) 이 재생성이
    // 매 프레임 일어나지는 않는다 — 위 handlePointerMove 쪽의 명령형 업데이트가 그 사이를 메운다.
    // editMode·onClusterMoved는 ref로만 읽으므로 의도적으로 deps에서 뺀다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, density, clusterCenters]);

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      {clusterLabels.map((label) => {
        const color = CLUSTER_COLORS[label.cluster];
        return (
          <button
            key={label.cluster}
            type="button"
            ref={(element) => {
              if (element) labelRefs.current.set(label.cluster, element);
              else labelRefs.current.delete(label.cluster);
            }}
            onClick={label.onTap}
            // 배경 위에 뜬 칩이 아니라 별자리 라벨처럼 배경에 녹아들게 한다 — 채운 배경·테두리
            // 없이 그 태그 색 글자와 은은한 글로우만 남긴다("배경에 녹아들게" 요청).
            className="absolute left-0 top-0 z-10 whitespace-nowrap text-[13px] font-semibold tracking-wide transition-opacity hover:opacity-75"
            style={{ color, textShadow: `0 0 14px ${color}99, 0 1px 4px rgba(0,0,0,0.85)` }}
          >
            {label.text}
          </button>
        );
      })}

      {/* 시점 이동 방향키 — OrbitControls의 드래그 팬은 별무리 드래그·별 탭 제스처와
          겹쳐서 꺼 뒀다(enablePan=false). 대신 화면 가장자리에 최소한의 방향키만 두고,
          테두리·배경 원 없이 빛나는 흰색 아이콘만 남겨 뒤 배경이 그대로 비치게 한다
          ("테두리 원 모양 없애고 밝게 반짝이는 흰색으로" 요청). 이동 자체는 pan()이
          트윈에 태우므로 버튼은 그저 방향만 알려준다. */}
      {(
        [
          { dir: 'left', dx: -1, dy: 0, Icon: ChevronLeftIcon, position: 'left-3 top-1/2 -translate-y-1/2' },
          { dir: 'right', dx: 1, dy: 0, Icon: ChevronRightIcon, position: 'right-3 top-1/2 -translate-y-1/2' },
          { dir: 'up', dx: 0, dy: 1, Icon: ChevronUpIcon, position: 'left-1/2 top-3 -translate-x-1/2' },
          // "전체 별자리 보기" 버튼이 있던 자리(bottom-4, 가운데)에 아래 방향키가 오도록
          // 맞췄다(요청사항) — 그 버튼은 "중앙으로 이동" 버튼으로 바뀌어 오른쪽으로 옮겨갔다.
          { dir: 'down', dx: 0, dy: -1, Icon: ChevronDownIcon, position: 'left-1/2 bottom-4 -translate-x-1/2' },
        ] as const
      ).map(({ dir, dx, dy, Icon, position }) => (
        <button
          key={dir}
          type="button"
          onClick={() => panRef.current?.(dx, dy)}
          aria-label={`시점 ${dir === 'left' ? '왼쪽' : dir === 'right' ? '오른쪽' : dir === 'up' ? '위' : '아래'}으로 이동`}
          className={`absolute z-10 flex h-9 w-9 items-center justify-center text-white transition-transform hover:scale-110 active:scale-95 ${position}`}
          style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.95)) drop-shadow(0 0 12px rgba(255,255,255,0.55))' }}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
