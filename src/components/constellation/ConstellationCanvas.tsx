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
