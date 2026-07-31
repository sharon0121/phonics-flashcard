'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { playCollectSound, playErrorSound, playDingSound } from '@/lib/sound';

export interface SlingshotTarget {
  id: string;
  isCorrect: boolean;
  board: ReactNode;
}

export interface SlingshotRound {
  prompt: ReactNode;
  targets: SlingshotTarget[]; // exactly 3
  spokenText?: string;
}

interface SlingshotGameProps {
  makeRound: () => SlingshotRound | null;
  onSave: (name: string, score: number) => string;
  onRename: (id: string, name: string) => void;
  lastPlayerName: string;
  animalEmoji?: string;
  projectileEmoji?: string;
  startLives?: number;
}

// --- Power bar: auto-oscillating "distance" meter, in game-meters ------
const POWER_MIN = 500;
const POWER_MAX = 1000;
const POWER_TICKS = [500, 600, 700, 800, 900, 1000];
// How far the shoot-bar art's frame eats into each end of the track —
// the marker/labels travel within [INSET%, 100-INSET%], not the full width.
const SHOOT_BAR_INSET_PCT = 4;
const OSCILLATE_PERIOD_MS = 3200;
const DISTANCE_TOLERANCE = 50;
const DISTANCE_MIN_GAP = 110;

function currentPowerValue(elapsedMs: number): number {
  const half = OSCILLATE_PERIOD_MS / 2;
  const phase = elapsedMs % OSCILLATE_PERIOD_MS;
  const t = phase < half ? phase / half : 1 - (phase - half) / half;
  return POWER_MIN + t * (POWER_MAX - POWER_MIN);
}

// Gives each of the 3 lanes a distinct target distance, at least
// DISTANCE_MIN_GAP apart so their +-DISTANCE_TOLERANCE hit windows can
// never overlap.
function assignDistances(): number[] {
  const buffer = 40;
  const lo = POWER_MIN + buffer;
  const hi = POWER_MAX - buffer;
  for (let attempt = 0; attempt < 30; attempt++) {
    const values = [0, 1, 2].map(() => lo + Math.random() * (hi - lo));
    values.sort((a, b) => a - b);
    if (values[1] - values[0] >= DISTANCE_MIN_GAP && values[2] - values[1] >= DISTANCE_MIN_GAP) {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      return order.map((i) => values[i]);
    }
  }
  return [550, 750, 950];
}

// --- World layout -------------------------------------------------------
// Lanes get a fresh X position each round (not fixed slots) so the 3
// targets show up in varied left/right arrangements — just kept far
// enough apart that their boards/hit-zones never overlap.
// Kept within what the camera can actually see even for the nearest lane
// (worst case: 500m/z=3 gives ~3.47 world units of visible half-width at
// this fov/aspect) — ±2.3 leaves margin for the crate's own half-width,
// which grew along with the +150% animal/crate size bump.
const LANE_X_MIN = -2.3;
const LANE_X_MAX = 2.3;
const LANE_X_MIN_GAP = 1.8;

function assignLaneX(): number[] {
  for (let attempt = 0; attempt < 30; attempt++) {
    const values = [0, 1, 2].map(() => LANE_X_MIN + Math.random() * (LANE_X_MAX - LANE_X_MIN));
    values.sort((a, b) => a - b);
    if (values[1] - values[0] >= LANE_X_MIN_GAP && values[2] - values[1] >= LANE_X_MIN_GAP) {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      return order.map((i) => values[i]);
    }
  }
  return [-2.2, 0, 2.2];
}

const GROUND_Y = 0;
const CRATE_SIZE = 0.9 * 1.5; // +150% per user request
const CRATE_Y = GROUND_Y + CRATE_SIZE / 2;
const CRATE_TOP_Y = CRATE_Y + CRATE_SIZE / 2;
const LAUNCH_POS = new THREE.Vector3(0, 1.0, -1.3);

// Glossy, bright projectile colors (red / true green / navy) picked at
// random per shot — avoids the flat dark placeholder color.
const PROJECTILE_COLORS = [0xe63946, 0x00a651, 0x1f3a68];

// Crate sprite (billboard) — user-provided art, swapped to the "burst
// open" frame on hit, same idea as the animal's idle/fallen swap. World
// size keeps CRATE_SIZE as the reference height so nothing else moves.
const CRATE_IDLE_SRC = '/games/angry-cow/crate-idle.png';
const CRATE_DESTROYED_SRC = '/games/angry-cow/crate-destroyed.png';
const CRATE_IDLE_PX = { w: 321, h: 346 };
const CRATE_DESTROYED_PX = { w: 233, h: 252 };
const CRATE_SCALE = CRATE_SIZE / CRATE_IDLE_PX.h;

// Target animal sprite (billboard) — test asset provided by the user, cut
// from a 5-frame voxel-giraffe sheet. World size is derived from the
// idle frame's pixel height so the fallen frame (a different aspect
// ratio) keeps the same real-world scale instead of stretching to fit.
const ANIMAL_IDLE_SRC = '/games/angry-cow/animal-idle.png';
const ANIMAL_FALLEN_SRC = '/games/angry-cow/animal-fallen.png';
const ANIMAL_IDLE_PX = { w: 98, h: 254 };
const ANIMAL_FALLEN_PX = { w: 343, h: 126 };
const ANIMAL_WORLD_HEIGHT = 1.1 * 1.5; // +150% per user request
const ANIMAL_SCALE = ANIMAL_WORLD_HEIGHT / ANIMAL_IDLE_PX.h;
const ANIMAL_IDLE_Y = CRATE_TOP_Y + ANIMAL_WORLD_HEIGHT / 2;
const FLIGHT_MS = 850;
const RESULT_PAUSE_MS = 1000;
const MISS_PAUSE_MS = 550;

// game-meters (500-1000) -> world Z depth (3-18)
function distanceToZ(meters: number): number {
  return 3 + ((meters - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 15;
}

// Decorative drifting clouds — cut out from the user-provided sprite sheet,
// each looping left-to-right at its own size/speed/height for a light
// parallax feel ("藍天白雲" — clear sunny sky). Purely visual, no gameplay
// effect. ?v=2 cache-busts the asset URL: browsers/devtools were caching
// the pre-whitened (blue-tinted) PNGs across edits at the same filename.
const CLOUD_ASSET_VERSION = 3;
const CLOUD_SRCS = ['/games/angry-cow/cloud-1.png', '/games/angry-cow/cloud-2.png', '/games/angry-cow/cloud-3.png'].map(
  (src) => `${src}?v=${CLOUD_ASSET_VERSION}`,
);
const CLOUD_SPEED_FACTOR = 5; // 20% speed = 5x duration
// Baseline width or larger only (150%-250%), lots of them so the sky
// reliably reads as 30-45% cloud coverage, never below 30%. `top` is a %
// of the sky strip itself, so 0-95 already means "anywhere in the sky" —
// stratified into bands below so height is never clustered at one level.
const CLOUD_BASE_WIDTH = 140;
const CLOUD_HEIGHT_BANDS = [
  [0, 16],
  [16, 32],
  [32, 48],
  [48, 64],
  [64, 80],
  [80, 95],
];

// Every cloud travels the same -25vw..125vw path (150vw total). Clouds
// sharing a height band ("lane") all move at nearly the same speed and
// are spaced evenly around that lane's own cycle, so a faster cloud can
// never drift close enough to catch up on a slower one — the only way to
// reliably cap overlap at ~20% when clouds drift independently forever,
// rather than relying on pure randomness which drifts into full overlap
// over a long enough time.
interface CloudSpec {
  src: string;
  top: number;
  width: number;
  duration: number;
  delay: number;
}

function generateClouds(): CloudSpec[] {
  const perLane = 2 + Math.floor(Math.random() * 2); // 2-3 clouds per lane
  const clouds: CloudSpec[] = [];
  CLOUD_HEIGHT_BANDS.forEach(([bandLo, bandHi]) => {
    const laneDuration = (32 + Math.random() * 24) * CLOUD_SPEED_FACTOR;
    const slice = 1 / perLane;
    for (let i = 0; i < perLane; i++) {
      // Jitter stays well within its slot (<=20% of the slot width) so
      // neighbors in the same lane can't end up more than ~20% overlapped.
      const jitter = (Math.random() - 0.5) * slice * 0.2;
      const phase = i * slice + jitter;
      clouds.push({
        src: CLOUD_SRCS[Math.floor(Math.random() * CLOUD_SRCS.length)],
        top: bandLo + Math.random() * (bandHi - bandLo),
        width: CLOUD_BASE_WIDTH * (1.5 + Math.random()), // 150%-250% of baseline
        duration: laneDuration,
        delay: -phase * laneDuration,
      });
    }
  });
  return clouds;
}

interface LaneObjects {
  crateMesh: THREE.Sprite;
  targetMesh: THREE.Sprite;
  crateBody: CANNON.Body;
  targetBody: CANNON.Body;
  distanceM: number;
  x: number;
  z: number;
  inWorld: boolean;
}

// 'resolving' covers the settle/pause window after a shot lands (hit or
// miss) until the next round is actually ready — without it, a fast press
// can sneak in during the pause (phase briefly looked "idle" again before
// advanceRound() ran), firing an extra shot against a round that's about
// to be replaced and letting lives drop below 0.
type ShotPhase = 'idle' | 'charging' | 'flying' | 'resolving';

export default function SlingshotGame({
  makeRound,
  onSave,
  onRename,
  lastPlayerName,
  startLives = 5,
}: SlingshotGameProps) {
  const [clouds] = useState(() => generateClouds());
  const [round, setRound] = useState<SlingshotRound | null>(() => makeRound());
  const [lives, setLives] = useState(startLives);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hitFlash, setHitFlash] = useState<'none' | 'correct' | 'wrong'>('none');
  const [nameInput, setNameInput] = useState(lastPlayerName);
  const [renamed, setRenamed] = useState(false);
  const [boardScreenPos, setBoardScreenPos] = useState<Array<{ x: number; y: number } | null>>([null, null, null]);
  const [animalScreenPos, setAnimalScreenPos] = useState<
    Array<{ x: number; y: number; width: number; height: number } | null>
  >([null, null, null]);
  const [distanceLabelPos, setDistanceLabelPos] = useState<
    Array<{ x: number; y: number; text: string } | null>
  >([null, null, null]);
  const [chargingLane, setChargingLane] = useState<number | null>(null);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);
  const [shotDisplay, setShotDisplay] = useState<{ value: number; key: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const powerFillRef = useRef<HTMLDivElement>(null);
  const powerLabelRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const lanesRef = useRef<LaneObjects[]>([]);
  const projectileRef = useRef<THREE.Mesh | null>(null);
  const idleTextureRef = useRef<THREE.Texture | null>(null);
  const fallenTextureRef = useRef<THREE.Texture | null>(null);
  const crateIdleTextureRef = useRef<THREE.Texture | null>(null);
  const crateDestroyedTextureRef = useRef<THREE.Texture | null>(null);

  const roundRef = useRef(round);
  const livesRef = useRef(lives);
  const scoreRef = useRef(score);
  const savedIdRef = useRef<string | null>(null);

  const phaseRef = useRef<ShotPhase>('idle');
  const chargeStartRef = useRef(0);
  const chargingLaneRef = useRef<number | null>(null);
  const flightRef = useRef<{
    startedAt: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    lane: number;
    isHit: boolean;
  } | null>(null);
  const settleUntilRef = useRef(0);
  const pendingAdvanceAtRef = useRef(0);
  const pendingAdvanceKindRef = useRef<'none' | 'nextRound' | 'gameOver'>('none');

  useEffect(() => {
    roundRef.current = round;
  }, [round]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Removes this round's lane meshes/bodies from the scene/world.
  const clearLanes = useCallback(() => {
    const scene = sceneRef.current;
    const world = worldRef.current;
    if (!scene || !world) return;
    lanesRef.current.forEach((lane) => {
      scene.remove(lane.crateMesh, lane.targetMesh);
      if (lane.inWorld) {
        world.removeBody(lane.crateBody);
        world.removeBody(lane.targetBody);
      }
    });
    lanesRef.current = [];
  }, []);

  // Builds fresh lane crate+target meshes/bodies for the current round,
  // one per target, at freshly-assigned distances. Physics bodies are
  // created but NOT added to the cannon world until a lane is actually
  // hit (idle lanes never simulate, so nothing jitters or rolls on its
  // own while the player is aiming).
  const buildLanes = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    clearLanes();

    const distances = assignDistances();
    const xs = assignLaneX();
    const idleHeight = ANIMAL_IDLE_PX.h * ANIMAL_SCALE;
    const idleWidth = ANIMAL_IDLE_PX.w * ANIMAL_SCALE;
    const targetY = CRATE_TOP_Y + idleHeight / 2;
    const crateIdleHeight = CRATE_IDLE_PX.h * CRATE_SCALE;
    const crateIdleWidth = CRATE_IDLE_PX.w * CRATE_SCALE;

    lanesRef.current = xs.map((x, i) => {
      const z = distanceToZ(distances[i]);

      const crateMesh = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: crateIdleTextureRef.current, transparent: true }),
      );
      crateMesh.scale.set(crateIdleWidth, crateIdleHeight, 1);
      crateMesh.position.set(x, CRATE_Y, z);
      scene.add(crateMesh);

      const targetMesh = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: idleTextureRef.current, transparent: true }),
      );
      targetMesh.scale.set(idleWidth, idleHeight, 1);
      targetMesh.position.set(x, targetY, z);
      scene.add(targetMesh);

      const crateBody = new CANNON.Body({ mass: 5, shape: new CANNON.Box(new CANNON.Vec3(0.45, 0.45, 0.45)) });
      crateBody.position.set(x, CRATE_Y, z);
      const targetBody = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(0.42) });
      targetBody.position.set(x, targetY, z);

      return { crateMesh, targetMesh, crateBody, targetBody, distanceM: distances[i], x, z, inWorld: false };
    });

    recomputeBoardPositions();
  }, [clearLanes]);

  // Projects each lane's target position to screen-space percentages so
  // the HTML board overlay sits right above it. Must run only after the
  // camera's aspect ratio matches the actual container size (a stale
  // aspect, e.g. right after construction but before the first resize(),
  // silently pushes every board off-screen).
  const recomputeBoardPositions = useCallback(() => {
    const camera = cameraRef.current;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!camera || !containerRect || lanesRef.current.length === 0) return;

    const project = (x: number, y: number, z: number) => {
      const v = new THREE.Vector3(x, y, z);
      v.project(camera);
      if (v.z > 1) return null;
      return { x: (v.x * 0.5 + 0.5) * 100, y: (1 - (v.y * 0.5 + 0.5)) * 100 };
    };

    const boards = lanesRef.current.map((lane) => {
      const { x, y, z } = lane.targetMesh.position;
      return project(x, y + 0.55, z);
    });
    setBoardScreenPos(boards);

    // Distance label under each animal — lets the player see exactly what
    // power value that lane needs before committing to a shot.
    const distanceLabels = lanesRef.current.map((lane) => {
      const pos = project(lane.x, GROUND_Y, lane.z);
      if (!pos) return null;
      return { x: pos.x, y: pos.y, text: `${Math.round(lane.distanceM)} 公尺` };
    });
    setDistanceLabelPos(distanceLabels);

    // Hit-zone covers the animal AND the crate it's standing on (kids can
    // tap either), spanning from the animal's top edge down to the crate's
    // base on the ground, centered on that combined span.
    const animals = lanesRef.current.map((lane) => {
      const { x, y, z } = lane.targetMesh.position;
      const top = project(x, y + ANIMAL_WORLD_HEIGHT / 2, z);
      const bottom = project(x, GROUND_Y, z);
      if (!top || !bottom) return null;
      // top/bottom.y are % of container height — convert to px before use
      // as a fixed-pixel hit-zone size (a raw % was used as px before,
      // producing an ~8px hit-zone instead of the intended ~80px).
      const heightPx = Math.max(((bottom.y - top.y) / 100) * containerRect.height, 40) * 1.15;
      const widthPx = heightPx * 0.75;
      const centerY = (top.y + bottom.y) / 2;
      return { x: top.x, y: centerY, width: widthPx, height: heightPx };
    });
    setAnimalScreenPos(animals);
  }, []);

  // One-time three.js + cannon-es setup.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8fd0f5);
    scene.fog = new THREE.Fog(0x8fd0f5, 16, 34);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    // Tilted down further than a "neutral" shot so grass dominates the
    // frame and sky is a smaller band, matching the reference photo's
    // proportions (~30% sky / 70% grass) instead of a roughly 50/50 split.
    camera.position.set(0, 1.9, -2);
    camera.lookAt(0, -0.6, 16);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Textures load asynchronously, but three.js repaints once the image
    // data arrives — assigning these placeholder Texture objects to
    // sprite materials immediately (before the image is ready) is safe.
    const textureLoader = new THREE.TextureLoader();
    idleTextureRef.current = textureLoader.load(ANIMAL_IDLE_SRC);
    fallenTextureRef.current = textureLoader.load(ANIMAL_FALLEN_SRC);
    crateIdleTextureRef.current = textureLoader.load(CRATE_IDLE_SRC);
    crateDestroyedTextureRef.current = textureLoader.load(CRATE_DESTROYED_SRC);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x4a7c3a, 0.9);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x5aa84a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    ground.receiveShadow = true;
    scene.add(ground);

    const projectileMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 18),
      new THREE.MeshStandardMaterial({ color: PROJECTILE_COLORS[0], metalness: 0.35, roughness: 0.15 }),
    );
    projectileMesh.visible = false;
    scene.add(projectileMesh);
    projectileRef.current = projectileMesh;

    const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    groundBody.position.set(0, GROUND_Y, 0);
    world.addBody(groundBody);
    worldRef.current = world;

    function resize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      recomputeBoardPositions();
    }
    resize();
    buildLanes();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let lastT = performance.now();
    let rafId: number;
    function tick() {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      // Power bar UI, driven directly (no React re-render) for smoothness.
      // The marker travels within the bar art's inner track, inset from
      // the outer frame on both ends (SHOOT_BAR_INSET_PCT..100-that).
      if (phaseRef.current === 'charging' && powerFillRef.current && powerLabelRef.current) {
        const value = currentPowerValue(now - chargeStartRef.current);
        const pct = ((value - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 100;
        const travel = 100 - SHOOT_BAR_INSET_PCT * 2;
        powerFillRef.current.style.left = `${SHOOT_BAR_INSET_PCT + (pct / 100) * travel}%`;
        powerLabelRef.current.textContent = `${Math.round(value)} 公尺`;
      }

      // Kinematic projectile flight tween.
      if (phaseRef.current === 'flying' && flightRef.current && projectileRef.current) {
        const f = flightRef.current;
        const t = Math.min((now - f.startedAt) / FLIGHT_MS, 1);
        const arc = 2.6 * 4 * t * (1 - t);
        projectileRef.current.position.set(
          f.from.x + (f.to.x - f.from.x) * t,
          f.from.y + (f.to.y - f.from.y) * t + arc,
          f.from.z + (f.to.z - f.from.z) * t,
        );
        if (t >= 1) {
          resolveArrival(f.lane, f.isHit);
        }
      }

      // Physics settle window after a hit (only lanes actually in the
      // world are simulated; everything else stays perfectly still).
      if (now < settleUntilRef.current) {
        world.step(1 / 60, dt, 3);
        lanesRef.current.forEach((lane) => {
          if (!lane.inWorld) return;
          lane.crateMesh.position.copy(lane.crateBody.position as unknown as THREE.Vector3);
          lane.crateMesh.quaternion.copy(lane.crateBody.quaternion as unknown as THREE.Quaternion);
          lane.targetMesh.position.copy(lane.targetBody.position as unknown as THREE.Vector3);
          lane.targetMesh.quaternion.copy(lane.targetBody.quaternion as unknown as THREE.Quaternion);
        });
      }

      if (pendingAdvanceKindRef.current !== 'none' && now >= pendingAdvanceAtRef.current) {
        const kind = pendingAdvanceKindRef.current;
        pendingAdvanceKindRef.current = 'none';
        if (kind === 'nextRound') advanceRound();
        else if (kind === 'gameOver') triggerGameOver();
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resolveArrival(lane: number, isHit: boolean) {
    phaseRef.current = 'resolving';
    if (projectileRef.current) projectileRef.current.visible = false;

    if (!isHit) {
      pendingAdvanceKindRef.current = 'none';
      window.setTimeout(() => {
        // Miss: same round continues, just clears the "flying" lock.
        phaseRef.current = 'idle';
      }, MISS_PAUSE_MS);
      return;
    }

    const laneObj = lanesRef.current[lane];
    const target = roundRef.current?.targets[lane];
    const world = worldRef.current;
    if (laneObj && fallenTextureRef.current) {
      const mat = laneObj.targetMesh.material as THREE.SpriteMaterial;
      mat.map = fallenTextureRef.current;
      mat.needsUpdate = true;
      const fallenHeight = ANIMAL_FALLEN_PX.h * ANIMAL_SCALE;
      const fallenWidth = ANIMAL_FALLEN_PX.w * ANIMAL_SCALE;
      laneObj.targetMesh.scale.set(fallenWidth, fallenHeight, 1);
      laneObj.targetMesh.position.y = CRATE_TOP_Y + fallenHeight / 2;
      laneObj.targetBody.position.y = CRATE_TOP_Y + fallenHeight / 2;
    }
    if (laneObj && crateDestroyedTextureRef.current) {
      const crateMat = laneObj.crateMesh.material as THREE.SpriteMaterial;
      crateMat.map = crateDestroyedTextureRef.current;
      crateMat.needsUpdate = true;
      const destroyedHeight = CRATE_DESTROYED_PX.h * CRATE_SCALE;
      const destroyedWidth = CRATE_DESTROYED_PX.w * CRATE_SCALE;
      laneObj.crateMesh.scale.set(destroyedWidth, destroyedHeight, 1);
      laneObj.crateMesh.position.y = destroyedHeight / 2;
      laneObj.crateBody.position.y = destroyedHeight / 2;
    }
    if (laneObj && world && !laneObj.inWorld) {
      world.addBody(laneObj.crateBody);
      world.addBody(laneObj.targetBody);
      laneObj.inWorld = true;
      const kick = 4 + Math.random() * 2;
      laneObj.crateBody.velocity.set((Math.random() - 0.5) * 2, 3, kick);
      laneObj.crateBody.angularVelocity.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0);
      laneObj.targetBody.velocity.set((Math.random() - 0.5) * 3, 5, kick + 1);
      laneObj.targetBody.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 0);
    }
    settleUntilRef.current = performance.now() + RESULT_PAUSE_MS;

    if (target?.isCorrect) {
      setScore((s) => s + 10);
      setHitFlash('correct');
      playCollectSound();
      window.setTimeout(() => playDingSound(), 120);
    } else {
      const nextLives = livesRef.current - 1;
      setLives(nextLives);
      setHitFlash('wrong');
      playErrorSound();
      if (nextLives <= 0) {
        pendingAdvanceKindRef.current = 'gameOver';
        pendingAdvanceAtRef.current = performance.now() + RESULT_PAUSE_MS;
      }
    }

    if (pendingAdvanceKindRef.current !== 'gameOver') {
      pendingAdvanceKindRef.current = 'nextRound';
      pendingAdvanceAtRef.current = performance.now() + RESULT_PAUSE_MS;
    }
  }

  function advanceRound() {
    setHitFlash('none');
    setRound(makeRound());
    buildLanes();
    phaseRef.current = 'idle';
  }

  function triggerGameOver() {
    setHitFlash('none');
    setGameOver(true);
    const id = onSave(nameInput || lastPlayerName, scoreRef.current);
    savedIdRef.current = id;
  }

  function updateCrosshair(clientX: number, clientY: number) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setCrosshairPos({
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    });
  }

  function startCharge(lane: number, clientX: number, clientY: number) {
    if (gameOver || phaseRef.current !== 'idle') return;
    phaseRef.current = 'charging';
    chargingLaneRef.current = lane;
    chargeStartRef.current = performance.now();
    setChargingLane(lane);
    updateCrosshair(clientX, clientY);
  }

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (phaseRef.current === 'charging') updateCrosshair(e.clientX, e.clientY);
    }
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, []);

  const releaseCharge = useCallback(() => {
    if (phaseRef.current !== 'charging' || chargingLaneRef.current === null) return;
    const lane = chargingLaneRef.current;
    const laneObj = lanesRef.current[lane];
    const power = currentPowerValue(performance.now() - chargeStartRef.current);

    phaseRef.current = 'flying';
    chargingLaneRef.current = null;
    setChargingLane(null);
    setCrosshairPos(null);
    setShotDisplay({ value: Math.round(power), key: performance.now() });

    const isHit = laneObj ? Math.abs(power - laneObj.distanceM) <= DISTANCE_TOLERANCE : false;
    const landingZ = laneObj ? (isHit ? laneObj.z : distanceToZ(power)) : distanceToZ(power);
    const landingY = isHit ? ANIMAL_IDLE_Y : GROUND_Y + 0.22;
    const launchX = laneObj ? laneObj.x : 0;
    const to = new THREE.Vector3(launchX, landingY, landingZ);

    if (projectileRef.current) {
      projectileRef.current.visible = true;
      projectileRef.current.position.copy(LAUNCH_POS);
      const color = PROJECTILE_COLORS[Math.floor(Math.random() * PROJECTILE_COLORS.length)];
      (projectileRef.current.material as THREE.MeshStandardMaterial).color.setHex(color);
    }
    flightRef.current = { startedAt: performance.now(), from: LAUNCH_POS.clone(), to, lane, isHit };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.addEventListener('pointerup', releaseCharge);
    return () => window.removeEventListener('pointerup', releaseCharge);
  }, [releaseCharge]);

  function retry() {
    setLives(startLives);
    setScore(0);
    setGameOver(false);
    setRenamed(false);
    setHitFlash('none');
    savedIdRef.current = null;
    setRound(makeRound());
    buildLanes();
    phaseRef.current = 'idle';
  }

  function handleSaveRename() {
    if (savedIdRef.current) onRename(savedIdRef.current, nameInput);
    setRenamed(true);
  }

  return (
    <div className="relative flex-1 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
      <div className="flex w-full items-center justify-between text-sm font-bold text-[var(--hero-gold)]">
        <span>
          {'❤️'.repeat(Math.max(lives, 0))}
          {'🖤'.repeat(Math.max(startLives - lives, 0))}
        </span>
        <span>🎯 得分 {score}</span>
      </div>

      <div className="mt-3 flex items-center justify-center">
        <div className="rounded-lg bg-white/95 px-6 py-2 text-2xl font-extrabold text-zinc-900 shadow-md">
          {round?.prompt}
        </div>
      </div>

      <div
        className={`relative mx-auto mt-3 aspect-[4/3] w-full max-w-none overflow-hidden rounded-xl border-[6px] border-slate-400 ${
          hitFlash === 'wrong' ? 'stage-shake' : ''
        }`}
      >
        <div ref={containerRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-0 top-0 h-[32%] overflow-hidden">
          {clouds.map((cloud, i) => (
            <img
              key={i}
              src={cloud.src}
              alt=""
              className="cloud-drift"
              style={{
                top: `${cloud.top}%`,
                width: `${cloud.width}px`,
                animationDuration: `${cloud.duration}s`,
                animationDelay: `${cloud.delay}s`,
              }}
            />
          ))}
        </div>

        {round?.targets.map((target, i) => {
          const pos = boardScreenPos[i];
          if (!pos) return null;
          return (
            <div
              key={target.id}
              className={`pointer-events-none absolute flex select-none flex-col items-center gap-1 rounded-lg border-2 px-2 py-1.5 text-center shadow-md transition-transform ${
                chargingLane === i ? 'border-emerald-500 bg-emerald-100 scale-105' : 'border-amber-800 bg-amber-100'
              }`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="pointer-events-auto">{target.board}</div>
            </div>
          );
        })}

        {/* The clickable hit-zone is the animal itself, not its answer board. */}
        {round?.targets.map((target, i) => {
          const pos = animalScreenPos[i];
          if (!pos) return null;
          return (
            <div
              key={`${target.id}-animal`}
              role="button"
              tabIndex={0}
              aria-label="射擊目標"
              onPointerDown={(e) => {
                e.preventDefault();
                startCharge(i, e.clientX, e.clientY);
              }}
              className="absolute select-none"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${pos.width}px`,
                height: `${pos.height}px`,
                transform: 'translate(-50%, -50%)',
                touchAction: 'none',
              }}
            />
          );
        })}

        {round?.targets.map((target, i) => {
          const pos = distanceLabelPos[i];
          if (!pos) return null;
          return (
            <div
              key={`${target.id}-distance`}
              className="pointer-events-none absolute whitespace-nowrap text-[17px] font-bold text-white"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, 2px)',
                textShadow: '0 1px 3px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.6)',
              }}
            >
              {pos.text}
            </div>
          );
        })}

        {chargingLane !== null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 px-6">
            <div className="relative w-full max-w-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/games/angry-cow/shoot-bar.png" alt="" className="w-full select-none" draggable={false} />
              <div
                ref={powerFillRef}
                className="absolute top-1/2 h-[140%] w-[2px] -translate-y-1/2 bg-white mix-blend-difference"
                style={{ left: `${SHOOT_BAR_INSET_PCT}%` }}
              />
            </div>
            <div
              className="flex w-full max-w-xs justify-between text-[10px] text-white/80"
              style={{ paddingLeft: `${SHOOT_BAR_INSET_PCT}%`, paddingRight: `${SHOOT_BAR_INSET_PCT}%` }}
            >
              {POWER_TICKS.map((tick) => (
                <span key={tick}>{tick}</span>
              ))}
            </div>
            <div ref={powerLabelRef} className="text-sm font-bold text-white drop-shadow" />
          </div>
        )}

        {hitFlash === 'correct' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-emerald-300/20">
            <span className="text-6xl">🎉</span>
          </div>
        )}

        {crosshairPos && (
          <svg
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${crosshairPos.x}%`, top: `${crosshairPos.y}%` }}
            width="52"
            height="52"
            viewBox="0 0 52 52"
          >
            <circle cx="26" cy="26" r="16" fill="none" stroke="#ff2d2d" strokeWidth="2.5" />
            <circle cx="26" cy="26" r="2.5" fill="#ff2d2d" />
            <line x1="26" y1="0" x2="26" y2="8" stroke="#ff2d2d" strokeWidth="2.5" />
            <line x1="26" y1="44" x2="26" y2="52" stroke="#ff2d2d" strokeWidth="2.5" />
            <line x1="0" y1="26" x2="8" y2="26" stroke="#ff2d2d" strokeWidth="2.5" />
            <line x1="44" y1="26" x2="52" y2="26" stroke="#ff2d2d" strokeWidth="2.5" />
          </svg>
        )}

        {shotDisplay && (
          <div
            key={shotDisplay.key}
            onAnimationEnd={() => setShotDisplay(null)}
            className="shot-distance-pop pointer-events-none absolute left-1/2 top-[22%] whitespace-nowrap text-4xl font-extrabold text-white"
            style={{ textShadow: '0 2px 6px rgba(0,0,0,0.6), 0 0 14px rgba(0,0,0,0.4)' }}
          >
            {shotDisplay.value} 公尺
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
            <p className="text-2xl font-bold text-white">😵 遊戲結束！</p>
            <p className="text-sm text-zinc-200">得分：{score}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setRenamed(false);
                }}
                maxLength={10}
                placeholder="輸入名字上榜"
                className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
              />
              <button
                type="button"
                onClick={handleSaveRename}
                className="rounded-md bg-[var(--hero-gold)] px-3 py-1 text-xs font-bold text-zinc-900"
              >
                {renamed ? '已更新 ✓' : '更新名字'}
              </button>
            </div>
            <button
              type="button"
              onClick={retry}
              className="mt-2 rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              再試一次
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-zinc-400">按住想射擊的目標蓄力，放手發射！力量表對到目標的距離才會命中。</p>
    </div>
  );
}
