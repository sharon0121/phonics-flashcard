'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
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
const DISTANCE_TOLERANCE = 100;
const DISTANCE_MIN_GAP = 210;

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
  const buffer = 20;
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
// Centre lane at 50% of screen width; left/right lanes ±20% away.
// Shuffled each round so the correct-answer lane appears in a random column.
// World-space X is computed per-lane from its Z depth + screen fraction
// via camera unprojection (screenFracToWorldX).
const LANE_FRACS = [0.3, 0.5, 0.7] as const;

function assignLaneFracs(): number[] {
  return ([...LANE_FRACS] as number[]).sort(() => Math.random() - 0.5);
}

// Returns the world-space X coordinate that will appear at the given
// horizontal screen fraction (0=left edge, 1=right edge) for an object
// at worldZ depth, accounting for the camera's perspective and pose.
function screenFracToWorldX(
  camera: THREE.PerspectiveCamera,
  frac: number,
  worldZ: number,
): number {
  const ndcX = frac * 2 - 1;
  const near = new THREE.Vector3(ndcX, 0, -1).unproject(camera);
  const far  = new THREE.Vector3(ndcX, 0,  1).unproject(camera);
  const dir  = far.clone().sub(near).normalize();
  const t    = (worldZ - near.z) / dir.z;
  return near.x + t * dir.x;
}

const GROUND_Y = 0;
const CRATE_SIZE = 0.9 * 0.75; // per-crate world size = 0.675 (50% of original)
// Two BoxGeometry crates stacked: exact centres, no transparent-padding gaps.
const BOTTOM_CRATE_Y = GROUND_Y + CRATE_SIZE / 2;  // = 0.675 (box centre)
const CRATE_Y        = GROUND_Y + CRATE_SIZE;       // = 1.35  (physics body centre of 2-stack)
const CRATE_VISUAL_TOP_Y = GROUND_Y + CRATE_SIZE * 2; // = 2.7  (exact top of 2-stack)
const LAUNCH_POS = new THREE.Vector3(0, 1.0, -1.3);

const PROJECTILE_COLOR = 0xff1a1a; // bright red, glossy

// Procedural wooden-crate texture — drawn on a canvas so there is zero
// transparent padding and BoxGeometry cubes stack perfectly flush.
function createCrateBoxTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d')!;

  // Wood base
  ctx.fillStyle = '#b8843a';
  ctx.fillRect(0, 0, S, S);

  // Subtle horizontal grain
  ctx.strokeStyle = 'rgba(80,45,5,0.12)';
  ctx.lineWidth = 1;
  for (let y = 10; y < S; y += 16) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
  }

  // Board-divider lines
  ctx.strokeStyle = '#7a5010';
  ctx.lineWidth = 3;
  [S * 0.34, S * 0.66].forEach(v => {
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(S, v); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, S); ctx.stroke();
  });

  // X brace
  ctx.strokeStyle = '#5c3608';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(S * 0.07, S * 0.07); ctx.lineTo(S * 0.93, S * 0.93);
  ctx.moveTo(S * 0.93, S * 0.07); ctx.lineTo(S * 0.07, S * 0.93);
  ctx.stroke();

  // Outer frame
  ctx.strokeStyle = '#4a2a06';
  ctx.lineWidth = 9;
  ctx.strokeRect(4, 4, S - 8, S - 8);

  // Corner nail dots
  ctx.fillStyle = '#3a2006';
  [[0.11, 0.11], [0.89, 0.11], [0.11, 0.89], [0.89, 0.89]].forEach(([fx, fy]) => {
    ctx.beginPath(); ctx.arc(fx * S, fy * S, 5, 0, Math.PI * 2); ctx.fill();
  });

  return new THREE.CanvasTexture(cv);
}

// Giraffe is now a procedural 3D model (no PNG sprite). The unit-height
// model spans y=0 (feet) to y≈1.0 (horns). Scale × ANIMAL_WORLD_HEIGHT to
// get the desired world size; dScale (0.9–1.1) adjusts per distance lane.
const ANIMAL_WORLD_HEIGHT = 1.1 * 1.5; // world height at dScale=1.0

// Creates a low-poly 3D giraffe centred at its feet (y=0 in local space).
// The group is scaled to ANIMAL_WORLD_HEIGHT × dScale in buildLanes.
function createGiraffe3D(): THREE.Group {
  const grp = new THREE.Group();

  const mk = (
    geo: THREE.BufferGeometry,
    mat: THREE.MeshStandardMaterial,
    x: number, y: number, z: number,
    rx = 0, ry = 0, rz = 0,
  ) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    grp.add(m);
  };

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFFCC00, roughness: 0.45, metalness: 0.05, emissive: 0xFFCC00, emissiveIntensity: 0.08 });
  const spotMat = new THREE.MeshStandardMaterial({ color: 0xA0420A, roughness: 0.6  });
  const eyeMat  = new THREE.MeshStandardMaterial({ color: 0x110808, roughness: 0.9  });
  const hornMat = new THREE.MeshStandardMaterial({ color: 0xE8A020, roughness: 0.55 });
  const hoofMat = new THREE.MeshStandardMaterial({ color: 0x3A2008, roughness: 0.9  });

  // Hooves + Legs (4×)
  const hoofGeo = new THREE.BoxGeometry(0.075, 0.035, 0.085);
  const legGeo  = new THREE.BoxGeometry(0.065, 0.265, 0.065);
  for (const [lx, lz] of [[-0.10, 0.09], [0.10, 0.09], [-0.10, -0.09], [0.10, -0.09]] as [number,number][]) {
    mk(hoofGeo, hoofMat, lx, 0.017,  lz);
    mk(legGeo,  bodyMat, lx, 0.168, lz);
  }

  // Body
  mk(new THREE.BoxGeometry(0.34, 0.22, 0.26), bodyMat, 0, 0.40, 0);
  // Body spots
  mk(new THREE.BoxGeometry(0.10, 0.10, 0.27), spotMat, -0.09, 0.43,  0);
  mk(new THREE.BoxGeometry(0.08, 0.08, 0.27), spotMat,  0.10, 0.37,  0);
  mk(new THREE.BoxGeometry(0.07, 0.11, 0.27), spotMat, -0.03, 0.32,  0);

  // Neck (slightly tilted forward)
  mk(new THREE.BoxGeometry(0.11, 0.36, 0.11), bodyMat, 0.04, 0.67, 0.01, 0, 0, -0.06);
  // Neck spots
  mk(new THREE.BoxGeometry(0.12, 0.12, 0.12), spotMat, 0.03, 0.59, 0.01);
  mk(new THREE.BoxGeometry(0.11, 0.10, 0.11), spotMat, 0.05, 0.74, 0.01);

  // Head
  mk(new THREE.BoxGeometry(0.17, 0.13, 0.14), bodyMat, 0.03, 0.87, 0.01);
  // Muzzle
  mk(new THREE.BoxGeometry(0.11, 0.09, 0.09), bodyMat, 0.03, 0.81, 0.10);
  // Nostrils
  mk(new THREE.BoxGeometry(0.025, 0.015, 0.02), spotMat, -0.01, 0.786, 0.154);
  mk(new THREE.BoxGeometry(0.025, 0.015, 0.02), spotMat,  0.07, 0.786, 0.154);
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.018, 8, 6);
  mk(eyeGeo, eyeMat, -0.05 + 0.03, 0.88, 0.08);
  mk(eyeGeo, eyeMat,  0.05 + 0.03, 0.88, 0.08);
  // Ears
  mk(new THREE.BoxGeometry(0.04, 0.065, 0.025), bodyMat, -0.10 + 0.03, 0.92, 0.01);
  mk(new THREE.BoxGeometry(0.04, 0.065, 0.025), bodyMat,  0.10 + 0.03, 0.92, 0.01);

  // Ossicones (horns) — tip at y≈1.0
  const hornGeo = new THREE.CylinderGeometry(0.010, 0.020, 0.075, 6);
  mk(hornGeo, hornMat, -0.03 + 0.03, 0.975, 0.005);
  mk(hornGeo, hornMat,  0.03 + 0.03, 0.975, 0.005);

  // Tail
  mk(new THREE.CylinderGeometry(0.015, 0.010, 0.13, 5), bodyMat, 0, 0.39, -0.155, 0.4, 0, 0);

  return grp;
}
const FLIGHT_MS = 850;
const RESULT_PAUSE_MS = 1000;
const MISS_PAUSE_MS = 550;

// game-meters (500-1000) -> world Z depth (3-7)
// Compressed range keeps all targets visually close (matching reference
// image proportions) while the power-bar mechanic still spans the full range.
function distanceToZ(meters: number): number {
  return 3 + ((meters - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 4;
}

// Two clean cloud PNG assets; each cloud picks one at random.
const CLOUD_SRCS = ['/games/angry-cow/cloud-a.webp', '/games/angry-cow/cloud-b.jpg'];

interface CloudSpec {
  srcIndex: number; // 0 = cloud-1.png, 1 = cloud-2.png
  top: number;      // % from top within sky strip
  width: number;    // display width in px
  duration: number; // full-cross drift duration in seconds
  delay: number;    // negative = already mid-flight on page load
}

function generateClouds(): CloudSpec[] {
  // 7 vertical bands × 2 clouds each = 14 total, no overlaps.
  // Within each band the two clouds are phase-shifted by exactly 0.5 (half
  // period), so they stay ~75 vw apart at all times and never collide.
  const clouds: CloudSpec[] = [];
  const NUM_BANDS = 7;
  for (let band = 0; band < NUM_BANDS; band++) {
    const top = 5 + (band / (NUM_BANDS - 1)) * 80;
    const duration = (65 + Math.random() * 55) * 5 / 0.3 / 1.3 / 1.3 / 1.3 / 1.3;
    const phase0 = Math.random(); // random start phase for first cloud in band
    for (let slot = 0; slot < 2; slot++) {
      const phase = slot === 0 ? phase0 : (phase0 + 0.5) % 1;
      clouds.push({
        srcIndex: Math.floor(Math.random() * CLOUD_SRCS.length),
        top: top + (Math.random() - 0.5) * 3,
        width: Math.round((252 + Math.floor(Math.random() * 204)) * 0.3),
        duration,
        delay: -(phase * duration),
      });
    }
  }
  return clouds;
}


interface LaneObjects {
  bottomCrateMesh: THREE.Mesh;  // lower crate — BoxGeometry, no transparent padding
  crateMesh: THREE.Mesh;        // upper crate — real 3D rotation on hit
  targetMesh: THREE.Group;      // giraffe — procedural 3D model, feet at y=0 in local space
  crateBody: CANNON.Body;
  targetBody: CANNON.Body;
  distanceM: number;
  x: number;
  z: number;
  inWorld: boolean;
  distanceScaleFactor: number; // 0.9 at 500M → 1.1 at 1000M
  animalCenterY: number;       // world Y of physics body centre (for projectile landing)
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
  const [cloudUrls, setCloudUrls] = useState<string[]>([]);
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
  const skyDistanceRef = useRef<HTMLDivElement>(null);
  // Raw client coords of the initial pointerdown — used to aim the ball at
  // exactly where the user clicked rather than at the lane's centre X.
  const clickClientRef = useRef<{ x: number; y: number } | null>(null);
  // Procedural crate texture (created once, shared across all crate meshes).
  const crateBoxTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const worldRef = useRef<CANNON.World | null>(null);
  const lanesRef = useRef<LaneObjects[]>([]);
  const projectileRef = useRef<THREE.Mesh | null>(null);
  const ballBodyRef   = useRef<CANNON.Body | null>(null);

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

  // Load cloud images and remove white background.
  // If the image already has an alpha channel (e.g. WebP with transparency),
  // use it as-is. Otherwise flood-fill from 4 corners with a very tight
  // threshold (252) so only near-pure-white background is erased — never
  // the cloud's own bright highlight areas.
  useEffect(() => {
    let loaded = 0;
    const urls: string[] = new Array(CLOUD_SRCS.length);
    CLOUD_SRCS.forEach((src, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const cv = document.createElement('canvas');
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, cv.width, cv.height);
        const { data, width, height } = id;

        // Check if image already has transparency — if so skip processing.
        let hasAlpha = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] < 255) { hasAlpha = true; break; }
        }

        if (!hasAlpha) {
          // Flood-fill from all 4 corners. Only spread through pixels where
          // every channel ≥ 252 (essentially pure white background). This
          // stops immediately at any cloud edge or highlight gradient.
          const visited = new Uint8Array(width * height);
          const stack: number[] = [];
          for (const [cx, cy] of [[0,0],[width-1,0],[0,height-1],[width-1,height-1]] as [number,number][]) {
            const si = cy * width + cx;
            if (!visited[si]) { visited[si] = 1; stack.push(cx, cy); }
          }
          while (stack.length > 0) {
            const py = stack.pop()!;
            const px = stack.pop()!;
            const di = (py * width + px) * 4;
            if (data[di] < 252 || data[di + 1] < 252 || data[di + 2] < 252) continue;
            data[di + 3] = 0;
            for (const [nx, ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]] as [number,number][]) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const ni = ny * width + nx;
                if (!visited[ni]) { visited[ni] = 1; stack.push(nx, ny); }
              }
            }
          }
          ctx.putImageData(id, 0, 0);
        }

        urls[idx] = cv.toDataURL('image/png');
        if (++loaded === CLOUD_SRCS.length) setCloudUrls([...urls]);
      };
      img.src = src;
    });
  }, []);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  // Speak the prompt whenever a new round starts.
  useEffect(() => {
    if (!round?.spokenText) return;
    const utt = new SpeechSynthesisUtterance(round.spokenText);
    utt.lang = 'en-US';
    utt.rate = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
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
      scene.remove(lane.bottomCrateMesh, lane.crateMesh, lane.targetMesh);
      if (lane.inWorld) {
        world.removeBody(lane.crateBody);
        world.removeBody(lane.targetBody);
      }
    });
    lanesRef.current = [];
    // Remove ball physics body and hide mesh from previous round.
    if (ballBodyRef.current) {
      world.removeBody(ballBodyRef.current);
      ballBodyRef.current = null;
    }
    if (projectileRef.current) projectileRef.current.visible = false;
  }, []);

  // Builds fresh lane crate+target meshes/bodies for the current round,
  // one per target, at freshly-assigned distances. Physics bodies are
  // created but NOT added to the cannon world until a lane is actually
  // hit (idle lanes never simulate, so nothing jitters or rolls on its
  // own while the player is aiming).
  const buildLanes = useCallback(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) return;
    clearLanes();

    const distances = assignDistances();
    const fracs = assignLaneFracs();

    // Shared BoxGeometry for all crates — exact cube, zero padding issues.
    const crateGeo = new THREE.BoxGeometry(CRATE_SIZE, CRATE_SIZE, CRATE_SIZE);

    lanesRef.current = fracs.map((frac, i) => {
      const distanceM = distances[i];
      const z = distanceToZ(distanceM);
      const x = screenFracToWorldX(camera, frac, z);

      // Animal scale: 90% at 500 M, 100% at 750 M, 110% at 1000 M.
      const dScale = 0.9 + (distanceM - 500) / 500 * 0.2;

      // --- Bottom crate (BoxGeometry) ---
      // Center sits exactly at BOTTOM_CRATE_Y = CRATE_SIZE/2, so its bottom
      // face is flush with GROUND_Y and its top face is at CRATE_SIZE.
      const crateTex = crateBoxTextureRef.current;
      const bottomCrateMesh = new THREE.Mesh(
        crateGeo,
        new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85, metalness: 0 }),
      );
      bottomCrateMesh.castShadow = true;
      bottomCrateMesh.position.set(x, BOTTOM_CRATE_Y, z);
      scene.add(bottomCrateMesh);

      // --- Top crate (BoxGeometry) ---
      // Center at CRATE_SIZE * 1.5, bottom face flush with bottom crate top.
      const crateMesh = new THREE.Mesh(
        crateGeo,
        new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85, metalness: 0 }),
      );
      crateMesh.castShadow = true;
      crateMesh.position.set(x, CRATE_SIZE * 1.5, z);
      scene.add(crateMesh);

      // --- 3D Giraffe (procedural Group, local y=0 = feet, y=1.0 = top) ---
      const targetMesh = createGiraffe3D();
      targetMesh.scale.setScalar(ANIMAL_WORLD_HEIGHT * dScale);
      targetMesh.position.set(x, CRATE_VISUAL_TOP_Y, z);
      scene.add(targetMesh);

      const animalCenterY = CRATE_VISUAL_TOP_Y + (ANIMAL_WORLD_HEIGHT * dScale) / 2;

      // Physics: single body for the whole 2-crate stack
      const crateBody = new CANNON.Body({
        mass: 5,
        shape: new CANNON.Box(new CANNON.Vec3(CRATE_SIZE / 2, CRATE_SIZE, CRATE_SIZE / 2)),
      });
      crateBody.position.set(x, CRATE_Y, z);
      const targetBody = new CANNON.Body({ mass: 1, shape: new CANNON.Sphere(0.42) });
      targetBody.position.set(x, animalCenterY, z);

      return { bottomCrateMesh, crateMesh, targetMesh, crateBody, targetBody, distanceM, x, z, inWorld: false, distanceScaleFactor: dScale, animalCenterY };
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

    // Board answer card: project below ground so the card sits in the grass
    // with a clear gap from the crate base.
    const boards = lanesRef.current.map((lane) => {
      return project(lane.x, GROUND_Y - 0.3, lane.z);
    });
    setBoardScreenPos(boards);

    // Distance label ABOVE the giraffe head.
    const distanceLabels = lanesRef.current.map((lane) => {
      const topY = CRATE_VISUAL_TOP_Y + ANIMAL_WORLD_HEIGHT * lane.distanceScaleFactor + 0.35;
      const pos = project(lane.x, topY, lane.z);
      if (!pos) return null;
      return { x: pos.x, y: pos.y, text: `${Math.round(lane.distanceM)} 公尺` };
    });
    setDistanceLabelPos(distanceLabels);

    // Hit-zone covers the animal AND the crate it's standing on (kids can
    // tap either), spanning from the animal's top edge down to the crate's
    // base on the ground, centered on that combined span.
    const animals = lanesRef.current.map((lane) => {
      const { x, y, z } = lane.targetMesh.position;
      // y is sprite bottom; top of sprite = y + scale.y
      const top = project(x, y + lane.targetMesh.scale.y, z);
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
    sceneRef.current = scene;

    // FOV 60° + pitch 4.1° down → horizon at ~43% from top, matching the
    // background image's fence/horizon line position.
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 1.9, -2);
    camera.lookAt(0, 0.6, 16);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Crates use a procedural canvas texture — no PNG, no transparent padding.
    crateBoxTextureRef.current = createCrateBoxTexture();

    const hemi = new THREE.HemisphereLight(0xffffff, 0x88cc66, 1.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    scene.add(sun);
    // Front fill light — illuminates camera-facing surfaces of the 3D giraffe.
    // Without this the -Z normals receive almost zero directional light and
    // the bright yellow body looks washed-out dark.
    const fill = new THREE.DirectionalLight(0xfffce8, 1.3);
    fill.position.set(0, 4, -6);
    scene.add(fill);

    const projectileMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 18),
      new THREE.MeshStandardMaterial({ color: PROJECTILE_COLOR, metalness: 0.4, roughness: 0.06 }),
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
        // Dark mask covers right portion; 100-pct reveals the gradient from left
        powerFillRef.current.style.width = `${100 - pct}%`;
        powerLabelRef.current.textContent = `${Math.round(value)} 公尺`;
        if (skyDistanceRef.current) {
          skyDistanceRef.current.textContent = `${Math.round(value)} 公尺`;
          skyDistanceRef.current.style.opacity = '1';
        }
      } else if (skyDistanceRef.current) {
        skyDistanceRef.current.style.opacity = '0';
      }

      // Kinematic projectile flight tween.
      if (phaseRef.current === 'flying' && flightRef.current && projectileRef.current) {
        const f = flightRef.current;
        const t = Math.min((now - f.startedAt) / FLIGHT_MS, 1);
        const arc = 2.6 * 0.7 * 4 * t * (1 - t); // arc reduced 30%
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
          // Both crate sprites follow the shared physics body.
          // Top crate = body centre + half stack; bottom = body centre - half stack.
          const bx = lane.crateBody.position.x;
          const by = lane.crateBody.position.y;
          const bz = lane.crateBody.position.z;
          const cq = lane.crateBody.quaternion as unknown as THREE.Quaternion;
          lane.crateMesh.position.set(bx, by + CRATE_SIZE / 2, bz);
          lane.crateMesh.quaternion.copy(cq);
          lane.bottomCrateMesh.position.set(bx, by - CRATE_SIZE / 2, bz);
          lane.bottomCrateMesh.quaternion.copy(cq);
          // Giraffe Group: local y=0 is feet; body tracks center = feet + halfH.
          lane.targetMesh.position.set(
            lane.targetBody.position.x,
            lane.targetBody.position.y - lane.targetMesh.scale.y / 2,
            lane.targetBody.position.z,
          );
          lane.targetMesh.quaternion.copy(lane.targetBody.quaternion as unknown as THREE.Quaternion);
        });
        // Sync ball mesh to its physics body (active after a hit).
        if (ballBodyRef.current && projectileRef.current) {
          const bp = ballBodyRef.current.position;
          projectileRef.current.position.set(bp.x, bp.y, bp.z);
        }
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
    // Miss: hide ball immediately. Hit: ball stays visible and gets physics.
    if (!isHit && projectileRef.current) projectileRef.current.visible = false;

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
    // Crates are BoxGeometry (THREE.Mesh) — no texture swap needed.
    // The physics tumble is the entire visual effect; just darken the top
    // crate material slightly to hint at damage.
    if (laneObj) {
      const mat = laneObj.crateMesh.material as THREE.MeshStandardMaterial;
      mat.color.set(0x6b4010);
    }
    if (laneObj && world && !laneObj.inWorld) {
      world.addBody(laneObj.crateBody);
      world.addBody(laneObj.targetBody);
      laneObj.inWorld = true;
      // Knockback away from camera (+z) — the player shoots from the front,
      // so the giraffe should fly backward deeper into the scene.
      const kick = (3 + Math.random() * 2) * 1.69;
      const side = (Math.random() < 0.5 ? 1 : -1) * (3 + Math.random() * 2) * 1.69;
      laneObj.crateBody.velocity.set(side, (3 + Math.random() * 2) * 1.69, kick * 0.8);
      laneObj.crateBody.angularVelocity.set(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 15,
      );
      laneObj.targetBody.velocity.set(side * 0.5, (8 + Math.random() * 4) * 1.69, kick * 1.2);
      laneObj.targetBody.angularVelocity.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 18,
      );
    }
    // Give the ball a physics body so it bounces and rolls after hitting.
    const proj = projectileRef.current;
    if (proj && world) {
      const ballBody = new CANNON.Body({ mass: 0.5, shape: new CANNON.Sphere(0.22) });
      ballBody.position.set(proj.position.x, proj.position.y, proj.position.z);
      if (flightRef.current) {
        const f = flightRef.current;
        const dir = new THREE.Vector3().subVectors(f.to, f.from).normalize();
        ballBody.velocity.set(dir.x * 5, Math.max(dir.y * 2, 0.5), dir.z * 4);
      }
      world.addBody(ballBody);
      ballBodyRef.current = ballBody;
    }
    // Physics window + advance: 2.8 s so crates and giraffe fully tumble on screen.
    settleUntilRef.current = performance.now() + 2800;

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
        pendingAdvanceAtRef.current = performance.now() + 2800;
      }
    }

    if (pendingAdvanceKindRef.current !== 'gameOver') {
      pendingAdvanceKindRef.current = 'nextRound';
      pendingAdvanceAtRef.current = performance.now() + 2800;
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
    clickClientRef.current = { x: clientX, y: clientY };
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
    const landingY = isHit ? (laneObj?.animalCenterY ?? CRATE_VISUAL_TOP_Y) : GROUND_Y + 0.22;

    // Compute landing X from the exact click position so the ball goes where
    // the user aimed — no left/right drift from lane centre.
    let launchX = laneObj ? laneObj.x : 0;
    const cam = cameraRef.current;
    const cont = containerRef.current;
    if (cam && cont && clickClientRef.current) {
      const rect = cont.getBoundingClientRect();
      const cx = clickClientRef.current.x;
      const cy = clickClientRef.current.y;
      const ndcX = ((cx - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((cy - rect.top) / rect.height) * 2 + 1;
      const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(cam);
      const far  = new THREE.Vector3(ndcX, ndcY,  1).unproject(cam);
      const dir  = far.clone().sub(near).normalize();
      if (Math.abs(dir.z) > 0.001) {
        const t = (landingZ - near.z) / dir.z;
        launchX = near.x + t * dir.x;
      }
    }
    clickClientRef.current = null;

    const to = new THREE.Vector3(launchX, landingY, landingZ);

    if (projectileRef.current) {
      projectileRef.current.visible = true;
      projectileRef.current.position.copy(LAUNCH_POS);
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

      <div
        className={`relative mx-auto mt-3 aspect-[4/3] w-full overflow-hidden rounded-xl border-[6px] border-slate-400 ${
          hitFlash === 'wrong' ? 'stage-shake' : ''
        }`}
        style={{ backgroundImage: "url('/games/angry-cow/bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        {/* Prompt — large centered banner at the very top of the game frame */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex items-start justify-center">
          <div className="rounded-xl bg-white/60 px-6 py-3 text-[3.6rem] font-black text-zinc-900 shadow-lg">
            {round?.prompt}
          </div>
        </div>

        {/* Sky cloud layer — rendered before the Three.js canvas so it stays behind all 3D objects */}
        {cloudUrls.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[43%] overflow-hidden">
            {clouds.map((cloud, i) => {
              const url = cloudUrls[cloud.srcIndex];
              if (!url) return null;
              return (
                <div
                  key={i}
                  className="cloud-drift"
                  style={{
                    backgroundImage: `url('${url}')`,
                    backgroundSize: '100% 100%',
                    width: `${cloud.width}px`,
                    height: `${Math.round(cloud.width * 0.67)}px`,
                    top: `${cloud.top}%`,
                    animationDuration: `${cloud.duration}s`,
                    animationDelay: `${cloud.delay}s`,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Real-time distance display in the sky while charging — inline style
            ensures identical centering as the shot-distance-pop animation */}
        <div
          ref={skyDistanceRef}
          className="pointer-events-none absolute whitespace-nowrap text-5xl font-black text-white transition-opacity duration-100"
          style={{ opacity: 0, left: '50%', top: '15%', transform: 'translate(-50%, -50%)', textShadow: '0 2px 8px rgba(0,0,0,0.55), 0 0 20px rgba(0,0,0,0.3)' }}
        />

        <div ref={containerRef} className="absolute inset-0" />

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

        {/* Board answer — rendered AFTER hitzone so it sits on top in z-order.
            Outer div passes pointer events through (pointer-events-none);
            inner div re-enables them so the SpeakButton can be clicked. */}
        {round?.targets.map((target, i) => {
          const pos = boardScreenPos[i];
          if (!pos) return null;
          return (
            <div
              key={target.id}
              className="pointer-events-none absolute flex select-none items-center justify-center text-center"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: `translate(-50%, 0%) ${chargingLane === i ? 'translateY(-4px)' : ''}`,
                transition: 'transform 0.12s ease',
              }}
            >
              <div className="pointer-events-auto flex flex-col items-center justify-center gap-0.5">
                {target.board}
              </div>
            </div>
          );
        })}

        {round?.targets.map((target, i) => {
          const pos = distanceLabelPos[i];
          if (!pos) return null;
          return (
            <div
              key={`${target.id}-distance`}
              className="pointer-events-none absolute whitespace-nowrap rounded-md bg-black/40 px-2 py-0.5 text-[23px] font-bold text-white"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}
            >
              {pos.text}
            </div>
          );
        })}

        {chargingLane !== null && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-1 px-8">
            {/* Colorful gradient power bar */}
            <div className="relative h-6 w-full max-w-xs overflow-hidden rounded-full border-2 border-white/50 shadow-lg"
              style={{ background: '#1a1a2e' }}>
              {/* Full gradient — revealed left-to-right as power increases */}
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: 'linear-gradient(to right, #22c55e, #a3e635, #facc15, #f97316, #ef4444)' }}
              />
              {/* Dark mask from the right — shrinks to reveal gradient */}
              <div
                ref={powerFillRef}
                className="absolute inset-y-0 right-0 rounded-r-full"
                style={{ width: '100%', background: 'rgba(10,10,20,0.88)' }}
              />
              {/* Subtle tick lines */}
              {POWER_TICKS.slice(1, -1).map((tick) => (
                <div
                  key={tick}
                  className="pointer-events-none absolute inset-y-0 w-px bg-white/20"
                  style={{ left: `${((tick - POWER_MIN) / (POWER_MAX - POWER_MIN)) * 100}%` }}
                />
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
            className="shot-distance-pop pointer-events-none absolute whitespace-nowrap text-5xl font-black text-white"
            style={{ left: '50%', top: '15%', textShadow: '0 2px 6px rgba(0,0,0,0.6), 0 0 14px rgba(0,0,0,0.4)' }}
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
