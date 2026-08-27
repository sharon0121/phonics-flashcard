'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { generateSequenceRound, gateScore, type SequenceRound, type Lane } from '@/lib/spaceRacer';
import {
  useSpaceRacerStepTiers,
  useSpaceRacerBestScore,
  reportSpaceRacerScore,
  ladderTierValue,
  type StepTier,
} from '@/lib/spaceRacerSettings';
import { playCollectSound, playCelebrationChime, playExplosionSound } from '@/lib/sound';

// ─── Layout constants ───────────────────────────────────────────────────────
const CANVAS_W = 360;
const CANVAS_H = 560;
const LANE_W = CANVAS_W / 3;
const SHIP_Y = CANVAS_H - 84;
const GATE_START_Y = -70;
const GATE_H = 62;
const GATE_TRAVEL_MS = 4200; // constant regardless of tier — this tests math, not reflexes
const ROW_PAUSE_MS = 900; // pause between a gate resolving and the next one spawning
const MAX_LIVES = 5;
const LIFE_REGEN_STREAK = 5;
const LANE_COLORS = ['#3b82f6', '#a855f7', '#f59e0b'];

function laneCenterX(lane: Lane): number {
  return lane * LANE_W + LANE_W / 2;
}

// ─── Live (ref-driven) game state ──────────────────────────────────────────
interface Star {
  x: number;
  y: number;
  speed: number;
  r: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface GateRow {
  round: SequenceRound;
  spawnTime: number;
  resolved: boolean;
}

interface LiveState {
  phase: 'playing' | 'paused' | 'over';
  lives: number;
  score: number;
  combo: number;
  streak: number;
  targetLane: Lane;
  shipX: number;
  row: GateRow | null;
  nextRowAt: number; // timestamp when the next row should spawn
  stars: Star[];
  particles: Particle[];
  shakeUntil: number;
  flash: { color: string; until: number } | null;
  feedback: { text: string; color: string; until: number } | null;
}

function makeStars(): Star[] {
  return Array.from({ length: 60 }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    speed: 0.4 + Math.random() * 1.6,
    r: 0.6 + Math.random() * 1.6,
  }));
}

function freshLiveState(): LiveState {
  return {
    phase: 'playing',
    lives: MAX_LIVES,
    score: 0,
    combo: 0,
    streak: 0,
    targetLane: 1,
    shipX: laneCenterX(1),
    row: null,
    nextRowAt: performance.now() + 700,
    stars: makeStars(),
    particles: [],
    shakeUntil: 0,
    flash: null,
    feedback: null,
  };
}

function spawnBurst(live: LiveState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3;
    live.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 400 + Math.random() * 300,
      maxLife: 700,
      color,
      size: 2 + Math.random() * 3,
    });
  }
  if (live.particles.length > 250) live.particles = live.particles.slice(-250);
}

// ─── Drawing ────────────────────────────────────────────────────────────────
function drawFrame(ctx: CanvasRenderingContext2D, live: LiveState, now: number) {
  let shakeX = 0;
  let shakeY = 0;
  if (now < live.shakeUntil) {
    const mag = 6 * ((live.shakeUntil - now) / 350);
    shakeX = (Math.random() * 2 - 1) * mag;
    shakeY = (Math.random() * 2 - 1) * mag;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  ctx.fillStyle = '#0b1130';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const s of live.stars) {
    ctx.globalAlpha = 0.4 + Math.random() * 0.3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Lane divider lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, CANVAS_H);
    ctx.stroke();
  }

  // Finish line
  ctx.strokeStyle = 'rgba(255,204,51,0.5)';
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, SHIP_Y + GATE_H / 2);
  ctx.lineTo(CANVAS_W, SHIP_Y + GATE_H / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sequence prompt
  if (live.row) {
    const { sequence } = live.row.round;
    const text = `${sequence.join(', ')}, ?`;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc33';
    ctx.fillText(text, CANVAS_W / 2, 46);
  }

  // Gate row
  if (live.row && !live.row.resolved) {
    const elapsed = now - live.row.spawnTime;
    const t = Math.min(1, elapsed / GATE_TRAVEL_MS);
    const y = GATE_START_Y + (SHIP_Y - GATE_START_Y) * t;
    for (let lane = 0; lane < 3; lane++) {
      const gx = lane * LANE_W + 8;
      const gw = LANE_W - 16;
      ctx.fillStyle = LANE_COLORS[lane] + '33';
      ctx.strokeStyle = LANE_COLORS[lane];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gx, y, gw, GATE_H, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(live.row.round.laneValues[lane]), gx + gw / 2, y + GATE_H / 2 + 10);
    }
  }

  // Feedback flash
  if (live.flash && now < live.flash.until) {
    ctx.fillStyle = live.flash.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Particles
  for (const p of live.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ship (simple rocket triangle + flame)
  const shipY = SHIP_Y;
  ctx.save();
  ctx.translate(live.shipX, shipY);
  // flame
  ctx.fillStyle = 'rgba(255,150,50,0.85)';
  ctx.beginPath();
  ctx.moveTo(-10, 20);
  ctx.lineTo(10, 20);
  ctx.lineTo(0, 20 + 14 + Math.random() * 8);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(18, 20);
  ctx.lineTo(-18, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, -4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Feedback text (CORRECT!/WRONG!)
  if (live.feedback && now < live.feedback.until) {
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = live.feedback.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.strokeText(live.feedback.text, CANVAS_W / 2, CANVAS_H / 2 - 40);
    ctx.fillText(live.feedback.text, CANVAS_W / 2, CANVAS_H / 2 - 40);
  }

  ctx.restore();
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function SpaceRacerView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<LiveState>(freshLiveState());

  const [phase, setPhase] = useState<LiveState['phase']>('playing');
  const bump = useCallback(() => {
    setPhase(liveRef.current.phase);
  }, []);

  const bestScore = useSpaceRacerBestScore();
  const stepTiers = useSpaceRacerStepTiers();
  const stepTiersRef = useRef(stepTiers);
  useEffect(() => {
    stepTiersRef.current = stepTiers;
  }, [stepTiers]);

  const [hud, setHud] = useState({ score: 0, lives: MAX_LIVES, combo: 0 });

  // ── Restart ──────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    liveRef.current = freshLiveState();
    setHud({ score: 0, lives: MAX_LIVES, combo: 0 });
    bump();
  }, [bump]);

  // ── Resolve the current gate row once it reaches the finish line ─────────
  function resolveRow(live: LiveState, now: number) {
    const row = live.row;
    if (!row) return;
    row.resolved = true;
    const chosenValue = row.round.laneValues[live.targetLane];
    const correct = chosenValue === row.round.answer;

    if (correct) {
      const newCombo = live.combo + 1;
      const newStreak = live.streak + 1;
      live.combo = newCombo;
      live.streak = newStreak;
      live.score += gateScore(newCombo);
      live.flash = { color: 'rgba(74,222,128,0.18)', until: now + 250 };
      live.feedback = { text: 'CORRECT!', color: '#4ade80', until: now + 700 };
      spawnBurst(live, laneCenterX(live.targetLane), SHIP_Y, '#4ade80', 18);
      playCollectSound();
      if (newStreak > 0 && newStreak % LIFE_REGEN_STREAK === 0 && live.lives < MAX_LIVES) {
        live.lives = Math.min(MAX_LIVES, live.lives + 1);
        playCelebrationChime();
      }
    } else {
      live.combo = 0;
      live.streak = 0;
      live.lives = Math.max(0, live.lives - 1);
      live.shakeUntil = now + 350;
      live.flash = { color: 'rgba(239,68,68,0.25)', until: now + 250 };
      live.feedback = { text: `答案是 ${row.round.answer}`, color: '#ef4444', until: now + 900 };
      spawnBurst(live, laneCenterX(live.targetLane), SHIP_Y, '#ef4444', 22);
      playExplosionSound();
    }

    reportSpaceRacerScore(live.score);
    setHud({ score: live.score, lives: live.lives, combo: live.combo });

    if (live.lives <= 0) {
      live.phase = 'over';
      live.row = null;
      bump();
      return;
    }

    live.row = null;
    live.nextRowAt = now + ROW_PAUSE_MS;
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const _ctx = ctx as CanvasRenderingContext2D;

    function loop(now: number) {
      animRef.current = requestAnimationFrame(loop);
      const live = liveRef.current;

      if (live.phase === 'playing') {
        // Ease the ship toward its target lane
        const target = laneCenterX(live.targetLane);
        live.shipX += (target - live.shipX) * 0.22;

        // Particle physics
        if (live.particles.length > 0) {
          live.particles = live.particles.filter((p) => {
            p.life -= 16;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            return p.life > 0;
          });
        }

        // Star drift
        for (const s of live.stars) {
          s.y += s.speed;
          if (s.y > CANVAS_H) {
            s.y = 0;
            s.x = Math.random() * CANVAS_W;
          }
        }

        // Spawn a new row if it's time
        if (!live.row && now >= live.nextRowAt) {
          const tiers = [...stepTiersRef.current].sort((a, b) => a - b);
          const step = ladderTierValue(tiers, live.streak) as StepTier;
          live.row = { round: generateSequenceRound(step), spawnTime: now, resolved: false };
        }

        // Resolve the row once it reaches the finish line
        if (live.row && !live.row.resolved) {
          const elapsed = now - live.row.spawnTime;
          if (elapsed >= GATE_TRAVEL_MS) {
            resolveRow(live, now);
          }
        }
      }

      drawFrame(_ctx, live, now);
    }

    const animRef = { current: 0 };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lane controls ────────────────────────────────────────────────────────
  const moveLane = useCallback((delta: -1 | 1) => {
    const live = liveRef.current;
    if (live.phase !== 'playing') return;
    live.targetLane = Math.max(0, Math.min(2, live.targetLane + delta)) as Lane;
  }, []);

  const togglePause = useCallback(() => {
    const live = liveRef.current;
    if (live.phase === 'paused') {
      live.phase = 'playing';
    } else if (live.phase === 'playing') {
      live.phase = 'paused';
    } else {
      return;
    }
    bump();
  }, [bump]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') moveLane(-1);
      else if (e.key === 'ArrowRight') moveLane(1);
      else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
      else if (e.key === 'Enter' && liveRef.current.phase === 'over') restart();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane, togglePause, restart]);

  // ── Touch swipe on canvas ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let startX = 0;
    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      startX = e.touches[0].clientX;
    }
    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 30) moveLane(dx > 0 ? 1 : -1);
    }
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [moveLane]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-2"
      style={{ backgroundColor: '#0b1130' }}
    >
      {/* Header */}
      <div className="mb-3 flex w-full max-w-2xl items-center justify-between px-2">
        <Link
          href="/games"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          Back
        </Link>
        <span style={{ color: '#ffcc33' }} className="text-sm font-bold sm:text-lg">
          🚀 邏輯數列太空賽車
        </span>
        <div className="flex items-center gap-2">
          <Link
            href="/games/space-racer/settings"
            aria-label="遊戲設定"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
          >
            ⚙️
          </Link>
          {phase !== 'over' && (
            <button
              type="button"
              onClick={togglePause}
              title={phase === 'paused' ? '繼續' : '暫停'}
              aria-label={phase === 'paused' ? '繼續' : '暫停'}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base text-zinc-200 hover:bg-white/20"
            >
              {phase === 'paused' ? '▶' : '⏸'}
            </button>
          )}
        </div>
      </div>

      {/* Score row */}
      <div className="mb-2 flex w-full max-w-2xl items-center justify-between gap-3" style={{ maxWidth: CANVAS_W }}>
        <div
          className="flex-1 rounded-xl px-3 py-1.5 text-center text-sm font-black"
          style={{ background: 'rgba(34,197,94,0.18)', color: '#4ade80', border: '2px solid rgba(34,197,94,0.4)' }}
        >
          👑 {bestScore.toLocaleString()}
        </div>
        <div
          className="flex-1 rounded-xl px-3 py-1.5 text-center text-sm font-black text-white"
          style={{ background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.15)' }}
        >
          {hud.score.toLocaleString()}
        </div>
        <div className="flex items-center gap-0.5 text-sm" aria-label={`${hud.lives} lives left`}>
          {Array.from({ length: MAX_LIVES }, (_, i) => (
            <span key={i}>{i < hud.lives ? '❤️' : '🖤'}</span>
          ))}
        </div>
      </div>

      {/* Board + touch controls */}
      <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          aria-label="往左變換車道"
          onClick={() => moveLane(-1)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-20 sm:w-20 sm:text-4xl"
          style={{ touchAction: 'none' }}
        >
          ⬅️
        </button>

        <div className="relative" style={{ maxWidth: CANVAS_W }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block h-auto w-full rounded-xl"
            style={{ border: '2px solid #2d3a6e', touchAction: 'none' }}
          />

          {phase === 'paused' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/80">
              <p className="text-3xl font-black" style={{ color: '#ffcc33' }}>
                PAUSED
              </p>
              <button
                type="button"
                onClick={togglePause}
                className="rounded-full px-6 py-2 text-sm font-bold text-zinc-900"
                style={{ background: '#ffcc33' }}
              >
                ▶ 繼續
              </button>
            </div>
          )}

          {phase === 'over' && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/85">
              <p className="text-3xl font-black text-red-400">GAME OVER</p>
              <p className="text-lg text-zinc-300">
                Score: <span className="font-bold text-white">{hud.score.toLocaleString()}</span>
              </p>
              {bestScore > 0 && (
                <p className="text-sm text-zinc-400">
                  Best: <span style={{ color: '#ffcc33' }}>{bestScore.toLocaleString()}</span>
                </p>
              )}
              <button
                type="button"
                onClick={restart}
                className="rounded-full px-6 py-2 text-sm font-bold text-zinc-900"
                style={{ background: '#ffcc33' }}
              >
                🔄 Play Again
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="往右變換車道"
          onClick={() => moveLane(1)}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl text-white select-none hover:bg-white/20 active:scale-90 active:bg-white/25 sm:h-20 sm:w-20 sm:text-4xl"
          style={{ touchAction: 'none' }}
        >
          ➡️
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-zinc-500">
        看清楚上方數列的規律，開船撞向答案正確的門！← → 移動、P/Esc 暫停
      </p>
    </div>
  );
}
