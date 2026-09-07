import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CLUSTER_CENTERS,
  CLUSTER_COLORS,
  clusterRadius,
  type ClusterId,
  type Vec3,
} from '../../lib/constellation/layout';
import { backdropScale, generateBackdropStars } from '../../lib/constellation/backdrop';
import type { ConstellationGraph } from '../../lib/constellation/buildGraph';

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
// 중심은 작고 아주 밝게, 주변은 넓고 옅게 — 단순한 원(disc)처럼 보이지 않게 하는 핵심이다.
function createStarTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.06, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.14, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(0.28, 'rgba(255,255,255,0.28)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(0.76, 'rgba(255,255,255,0.02)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
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
}: ConstellationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef(new Map<ClusterId, HTMLButtonElement>());

  // 매 프레임 읽어야 하는 값들. state로 두면 프레임마다 리렌더가 돌고, 콜백을 씬에 캡처하면
  // 오래된 클로저를 붙들게 된다 — ref로 최신 값만 넘긴다.
  const selectedIdRef = useRef(selectedId);
  const highlightedIdsRef = useRef(highlightedIds);
  const cameraFocusRef = useRef(cameraFocus);
  const onSelectRef = useRef(onSelect);
  const onWebglFailureRef = useRef(onWebglFailure);
  selectedIdRef.current = selectedId;
  highlightedIdsRef.current = highlightedIds;
  cameraFocusRef.current = cameraFocus;
  onSelectRef.current = onSelect;
  onWebglFailureRef.current = onWebglFailure;

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
    camera.position.set(0, 0, DEFAULT_DISTANCE);

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
    const hazeSprites = (['neutral', 'energizer', 'drainer'] as const)
      .filter((cluster) => graph.counts[cluster] > 0)
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
        const center = CLUSTER_CENTERS[cluster];
        sprite.position.set(center.x, center.y, center.z);
        sprite.scale.setScalar(clusterRadius(graph.counts[cluster]) * 3.4);
        sprite.renderOrder = -1;
        scene.add(sprite);
        return sprite;
      });

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
    const pointer = new THREE.Vector2();
    let pointerDownAt = { x: 0, y: 0, time: 0, id: -1 };
    // 핀치줌 중 손가락 하나를 떼면 그 pointerup은 탭이 아니다 — 제스처 동안 포인터가 두 개
    // 이상 있었는지를 이 Set으로 추적해서, 그런 경우 raycast 자체를 건너뛴다.
    const activePointers = new Set<number>();
    let multiTouchGesture = false;

    function handlePointerDown(event: PointerEvent) {
      activePointers.add(event.pointerId);
      if (activePointers.size > 1) multiTouchGesture = true;
      pointerDownAt = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
    }

    function handlePointerUp(event: PointerEvent) {
      const wasMultiTouch = multiTouchGesture;
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) multiTouchGesture = false;

      // 이 포인터가 gesture를 시작한 그 손가락이 아니거나, 도중에 두 번째 포인터가 있었다면
      // (핀치줌) 탭으로 보지 않는다.
      if (event.pointerId !== pointerDownAt.id || wasMultiTouch) return;

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

    function handlePointerCancel(event: PointerEvent) {
      activePointers.delete(event.pointerId);
      if (activePointers.size === 0) multiTouchGesture = false;
    }

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
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
            CLUSTER_CENTERS[request.cluster],
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
        if (highlighted && !highlighted.includes(node.id)) {
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
      const elapsed = clock.getElapsedTime();
      updateFocus();
      controls.update();
      updateDimming();
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
      document.removeEventListener('visibilitychange', handleVisibility);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
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
    // graph가 바뀌면 씬을 통째로 다시 만든다 — 인사이트 재생성은 드문 일이라 증분 갱신의
    // 복잡도를 감수할 이유가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, density]);

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
          className="absolute left-0 top-0 z-10 flex min-h-[2.5rem] items-center gap-2 whitespace-nowrap rounded-full border border-hairline bg-[rgba(8,15,33,0.72)] px-4 text-[13px] font-semibold text-ink backdrop-blur-xl transition-colors hover:border-hairline-active"
        >
          {label.text}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-3.5 w-3.5 text-ink-muted"
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}
