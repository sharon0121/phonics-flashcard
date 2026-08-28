'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  generateSequenceRound,
  effectiveLevel,
  roundTimeMsForLevel,
  type SequenceRound,
  type Lane,
  gateScore,
} from '@/lib/spaceRacer';
import {
  useSpaceRacerLevelCap,
  useSpaceRacerBestScore,
  reportSpaceRacerScore,
  useSpaceRacerQuizWords,
  type LevelCap,
} from '@/lib/spaceRacerSettings';
import { useSpeechRate, SPEECH_RATE_VALUES } from '@/lib/heroClimbSettings';
import { playCollectSound, playCelebrationChime, playExplosionSound, playErrorSound } from '@/lib/sound';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';

// Resolves once the browser actually finishes speaking (or errors) — see
// Puyo/Tetris/Block Puzzle's identical helper for the full rationale: waits
// for real narration length instead of a fixed guessed timeout, and
// deliberately never calls speechSynthesis.cancel() mid-quiz so the word and
// its answer both play out in full.
function speakAsync(text: string, lang: string, rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      resolve();
    };
    const safetyTimer = setTimeout(finish, 8000);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onend = finish;
    utterance.onerror = finish;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish();
    }
  });
}

// ─── Layout constants ───────────────────────────────────────────────────────
const CANVAS_W = 360;
const CANVAS_H = 560;
const LANE_W = CANVAS_W / 3;
const CAR_BASE_Y = CANVAS_H - 90; // resting position near the start line
const GATE_Y = 148; // fixed Y where the answer gates wait, just past the finish line
const GATE_H = 62;
const CAR_DASH_Y = GATE_Y + GATE_H - 10; // where the car arrives when it dashes into the gate
const DASH_MS = 550; // forward dash duration
const RETURN_MS = 420; // return-to-start duration
const ROW_PAUSE_MS = 550; // pause after returning before the next gate appears
const MAX_LIVES = 5;
const LIFE_REGEN_STREAK = 5;
const LANE_COLORS = ['#3b82f6', '#a855f7', '#f59e0b'];

// Every this many milliseconds of actual play (paused/quiz time doesn't
// count), a vocabulary quiz interrupts the game.
const QUIZ_INTERVAL_MS = 120000;
const QUIZ_STREAK_TARGET = 5;

interface QuizQuestion {
  word: Word;
  choices: Word[];
}

interface QuizState {
  question: QuizQuestion;
  streak: number;
  feedback: 'correct' | 'wrong' | null;
  selectedId: string | null;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildQuizQuestion(pool: Word[]): QuizQuestion | null {
  if (pool.length === 0) return null;
  const word = pool[Math.floor(Math.random() * pool.length)];
  const distractorSrc = pool.filter((w) => w.id !== word.id);
  const distractors = shuffleArray(distractorSrc).slice(0, 2);
  const choices = shuffleArray([word, ...distractors]);
  return { word, choices };
}

function laneCenterX(lane: Lane): number {
  return lane * LANE_W + LANE_W / 2;
}

// ─── Live (ref-driven) game state ──────────────────────────────────────────
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
  resolved: boolean;
}

type CarAnim = 'idle' | 'dashing' | 'returning';

interface LiveState {
  phase: 'playing' | 'paused' | 'over';
  lives: number;
  score: number;
  combo: number;
  streak: number;
  roundsPlayed: number; // cumulative rounds resolved, right or wrong — never resets; drives the level ladder
  level: number; // level of the current/upcoming row, for HUD display
  targetLane: Lane;
  carX: number;
  carY: number;
  carAnim: CarAnim;
  animStart: number;
  dashLane: Lane;
  row: GateRow | null;
  nextRowAt: number; // timestamp when the next row should spawn
  roundDeadline: number; // timestamp the current row must be dashed by
  roundDuration: number; // total ms allotted for the current row (for the countdown bar)
  pausedAt: number | null; // timestamp pause began, so resuming can shift roundDeadline forward by however long it was frozen
  roadScroll: number;
  particles: Particle[];
  shakeUntil: number;
  flash: { color: string; until: number } | null;
  feedback: { text: string; color: string; until: number } | null;
}

function freshLiveState(): LiveState {
  return {
    phase: 'playing',
    lives: MAX_LIVES,
    score: 0,
    combo: 0,
    streak: 0,
    roundsPlayed: 0,
    level: 1,
    targetLane: 1,
    carX: laneCenterX(1),
    carY: CAR_BASE_Y,
    carAnim: 'idle',
    animStart: 0,
    dashLane: 1,
    row: null,
    nextRowAt: performance.now() + 500,
    roundDeadline: 0,
    roundDuration: 0,
    pausedAt: null,
    roadScroll: 0,
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

function drawCheckerBand(ctx: CanvasRenderingContext2D, y: number, size: number) {
  const cols = Math.ceil(CANVAS_W / size);
  for (let i = 0; i < cols; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f2f2f2' : '#14161c';
    ctx.fillRect(i * size, y, size, size);
  }
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

  // Track surface (asphalt)
  ctx.fillStyle = '#232530';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Rumble strips down both edges, scrolling to sell forward motion
  const stripSize = 20;
  const stripOffset = live.roadScroll % (stripSize * 2);
  for (const x of [0, CANVAS_W - 10]) {
    for (let y = -stripSize * 2; y < CANVAS_H + stripSize; y += stripSize) {
      const drawY = y + stripOffset;
      const idx = Math.round((drawY - stripOffset) / stripSize);
      ctx.fillStyle = idx % 2 === 0 ? '#dc2626' : '#f2f2f2';
      ctx.fillRect(x, drawY, 10, stripSize);
    }
  }

  // Lane divider dashed lines, also scrolling
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 14]);
  ctx.lineDashOffset = -live.roadScroll;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, CANVAS_H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // Checkered start line (behind the car) + finish line (just above the gates)
  drawCheckerBand(ctx, CAR_BASE_Y + 34, 12);
  drawCheckerBand(ctx, GATE_Y - 14, 12);

  // Sequence prompt
  if (live.row) {
    const { sequence } = live.row.round;
    const text = `${sequence.join(', ')}, ?`;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc33';
    ctx.fillText(text, CANVAS_W / 2, 46);
  }

  // Countdown bar — only while the car is idle and waiting to dash
  if (live.row && !live.row.resolved && live.carAnim === 'idle' && live.roundDuration > 0) {
    const remaining = Math.max(0, live.roundDeadline - now);
    const ratio = Math.min(1, remaining / live.roundDuration);
    const barY = 60;
    const barW = CANVAS_W - 24;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(12, barY, barW, 8);
    ctx.fillStyle = ratio > 0.5 ? '#4ade80' : ratio > 0.2 ? '#ffcc33' : '#ef4444';
    ctx.fillRect(12, barY, barW * ratio, 8);
  }

  // Gate row — static, highlights correct/chosen lane once resolved
  if (live.row) {
    for (let lane = 0; lane < 3; lane++) {
      const gx = lane * LANE_W + 8;
      const gw = LANE_W - 16;
      let fill = LANE_COLORS[lane] + '33';
      let stroke = LANE_COLORS[lane];
      if (live.row.resolved) {
        if (lane === live.row.round.correctLane) {
          fill = 'rgba(74,222,128,0.35)';
          stroke = '#4ade80';
        } else if (lane === live.dashLane) {
          fill = 'rgba(239,68,68,0.35)';
          stroke = '#ef4444';
        }
      }
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(gx, GATE_Y, gw, GATE_H, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(live.row.round.laneValues[lane]), gx + gw / 2, GATE_Y + GATE_H / 2 + 10);
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

  // Car — top-down race car (red body, gold racing stripe, dark windshield/wheels)
  ctx.save();
  ctx.translate(live.carX, live.carY);

  if (live.carAnim === 'dashing') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (const dx of [-10, 0, 10]) {
      ctx.beginPath();
      ctx.moveTo(dx, 22);
      ctx.lineTo(dx, 22 + 16 + Math.random() * 10);
      ctx.stroke();
    }
  }

  // wheels
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-16, -18, 7, 14);
  ctx.fillRect(9, -18, 7, 14);
  ctx.fillRect(-16, 6, 7, 14);
  ctx.fillRect(9, 6, 7, 14);

  // body
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(-13, -24, 26, 48, 8);
  ctx.fill();

  // racing stripe
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(-3, -24, 6, 48);

  // windshield (front, since the car drives "up")
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(-8, -18, 16, 14, 4);
  ctx.fill();

  // spoiler (rear)
  ctx.fillStyle = '#14161c';
  ctx.fillRect(-14, 20, 28, 5);

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
  const levelCap = useSpaceRacerLevelCap();
  const levelCapRef = useRef<LevelCap>(levelCap);
  useEffect(() => {
    levelCapRef.current = levelCap;
  }, [levelCap]);

  const [hud, setHud] = useState({ score: 0, lives: MAX_LIVES, combo: 0, level: 1 });
  const [canDash, setCanDash] = useState(false);

  // Accumulated actual play time since the last vocabulary quiz (paused/quiz
  // time doesn't count) — drives the every-2-minutes quiz interruption.
  const playTimeRef = useRef<number>(0);
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  // True the instant a quiz starts/ends — set synchronously so the game loop
  // never double-triggers a quiz on the frame right after one begins/ends.
  const quizActiveRef = useRef<boolean>(false);
  const quizWords = useSpaceRacerQuizWords();
  const quizWordsRef = useRef<Word[]>(quizWords);
  useEffect(() => {
    quizWordsRef.current = quizWords;
  }, [quizWords]);
  const speechRate = SPEECH_RATE_VALUES[useSpeechRate()];

  // ── Restart ──────────────────────────────────────────────────────────────
  const restart = useCallback(() => {
    liveRef.current = freshLiveState();
    setHud({ score: 0, lives: MAX_LIVES, combo: 0, level: 1 });
    playTimeRef.current = 0;
    quizActiveRef.current = false;
    setQuiz(null);
    bump();
  }, [bump]);

  // ── Resolve the current gate row once the car dashes into it ────────────
  function resolveRow(live: LiveState, now: number, lane: Lane) {
    const row = live.row;
    if (!row || row.resolved) return;
    row.resolved = true;
    live.roundsPlayed += 1;
    const chosenValue = row.round.laneValues[lane];
    const correct = chosenValue === row.round.answer;

    if (correct) {
      const newCombo = live.combo + 1;
      const newStreak = live.streak + 1;
      live.combo = newCombo;
      live.streak = newStreak;
      live.score += gateScore(newCombo);
      live.flash = { color: 'rgba(74,222,128,0.18)', until: now + 250 };
      live.feedback = { text: 'CORRECT!', color: '#4ade80', until: now + 700 };
      spawnBurst(live, laneCenterX(lane), CAR_DASH_Y, '#4ade80', 18);
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
      spawnBurst(live, laneCenterX(lane), CAR_DASH_Y, '#ef4444', 22);
      playExplosionSound();
    }

    reportSpaceRacerScore(live.score);
    setHud({ score: live.score, lives: live.lives, combo: live.combo, level: live.level });

    if (live.lives <= 0) {
      live.phase = 'over';
      live.row = null;
      bump();
    }
  }

  // ── Resolve the current row as a miss because time ran out ───────────────
  function resolveTimeout(live: LiveState, now: number) {
    const row = live.row;
    if (!row || row.resolved) return;
    row.resolved = true;
    live.roundsPlayed += 1;
    live.combo = 0;
    live.streak = 0;
    live.lives = Math.max(0, live.lives - 1);
    live.shakeUntil = now + 350;
    live.flash = { color: 'rgba(239,68,68,0.25)', until: now + 250 };
    live.feedback = { text: `太慢了！答案是 ${row.round.answer}`, color: '#ef4444', until: now + 900 };
    spawnBurst(live, laneCenterX(row.round.correctLane), GATE_Y + GATE_H / 2, '#ef4444', 22);
    playExplosionSound();

    reportSpaceRacerScore(live.score);
    setHud({ score: live.score, lives: live.lives, combo: live.combo, level: live.level });

    if (live.lives <= 0) {
      live.phase = 'over';
      live.row = null;
      bump();
      return;
    }

    live.row = null;
    live.nextRowAt = now + ROW_PAUSE_MS;
  }

  // ── Vocabulary quiz ───────────────────────────────────────────────────────
  const triggerQuiz = useCallback(() => {
    const question = buildQuizQuestion(quizWordsRef.current);
    if (!question) return;
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    quizActiveRef.current = true;
    const live = liveRef.current;
    live.pausedAt = performance.now();
    live.phase = 'paused';
    setQuiz({ question, streak: 0, feedback: null, selectedId: null });
    bump();
  }, [bump]);

  // Not wrapped in useCallback — reads `quiz` straight from the closure so
  // it's always current, and the sound/speech side effects run exactly once
  // per click (a setQuiz updater function can run twice under StrictMode).
  function answerQuiz(choice: Word) {
    if (!quiz || quiz.feedback) return;
    const correct = choice.id === quiz.question.word.id;
    if (correct) {
      playCollectSound();
    } else {
      playErrorSound();
    }
    setQuiz({ ...quiz, feedback: correct ? 'correct' : 'wrong', selectedId: choice.id });
  }

  // Speak the English word aloud whenever a fresh question is shown.
  useEffect(() => {
    if (!quiz || quiz.feedback) return;
    const t = setTimeout(() => {
      speakAsync(quiz.question.word.word, 'en-US', speechRate);
    }, 200);
    return () => clearTimeout(t);
  }, [quiz, speechRate]);

  // Waits for the Chinese answer to actually finish narrating before
  // advancing to the next question or (5 correct in a row) resuming the
  // race — resumes with roundDeadline shifted forward by however long the
  // quiz froze gameplay, so the child never gets an unfair instant timeout
  // the moment they return to a round they were already partway through.
  useEffect(() => {
    if (!quiz?.feedback) return;
    let cancelled = false;
    const wasCorrect = quiz.feedback === 'correct';
    const zhText = quiz.question.word.zh;

    async function run() {
      await new Promise<void>((r) => setTimeout(r, 350));
      if (cancelled) return;
      await speakAsync(zhText, 'zh-TW', 0.9);
      if (cancelled) return;
      await new Promise<void>((r) => setTimeout(r, 300));
      if (cancelled) return;
      setQuiz((prev) => {
        if (!prev) return prev;
        const nextStreak = wasCorrect ? prev.streak + 1 : 0;
        const nextQuestion = nextStreak >= QUIZ_STREAK_TARGET ? null : buildQuizQuestion(quizWordsRef.current);
        if (!nextQuestion) {
          quizActiveRef.current = false;
          const live = liveRef.current;
          const resumeNow = performance.now();
          if (live.pausedAt != null && live.row && !live.row.resolved) {
            live.roundDeadline += resumeNow - live.pausedAt;
          }
          live.pausedAt = null;
          live.phase = 'playing';
          bump();
          return null;
        }
        return { question: nextQuestion, streak: nextStreak, feedback: null, selectedId: null };
      });
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [quiz?.feedback, bump]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const _ctx = ctx as CanvasRenderingContext2D;

    let prevTime: number | null = null;

    function loop(now: number) {
      animRef.current = requestAnimationFrame(loop);
      const live = liveRef.current;

      if (prevTime === null) prevTime = now;
      const dt = now - prevTime;
      prevTime = now;

      // Vocabulary quiz timer — only ticks during actual gameplay, and only
      // fires once the car is idle so it never interrupts mid-dash.
      if (!quizActiveRef.current && live.phase !== 'paused' && live.phase !== 'over') {
        playTimeRef.current += dt;
        if (playTimeRef.current >= QUIZ_INTERVAL_MS && live.carAnim === 'idle') {
          playTimeRef.current = 0;
          triggerQuiz();
        }
      }

      if (live.phase === 'playing') {
        // Ease the car toward its chosen lane
        const target = laneCenterX(live.targetLane);
        live.carX += (target - live.carX) * 0.25;

        // Scrolling road texture — faster while dashing, for a sense of speed
        live.roadScroll = (live.roadScroll + (live.carAnim === 'dashing' ? 14 : 3)) % 10000;

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

        // Spawn a new row once the car is back home and idle
        if (!live.row && live.carAnim === 'idle' && now >= live.nextRowAt) {
          const level = effectiveLevel(live.roundsPlayed, levelCapRef.current);
          live.level = level;
          live.row = { round: generateSequenceRound(level), resolved: false };
          const duration = roundTimeMsForLevel(level);
          live.roundDuration = duration;
          live.roundDeadline = now + duration;
          setHud((h) => (h.level === level ? h : { ...h, level }));
        }

        // Time's up — the car never left the start line, so just resolve
        // the round as a miss (no drive animation needed).
        if (live.row && !live.row.resolved && live.carAnim === 'idle' && now >= live.roundDeadline) {
          resolveTimeout(live, now);
        }

        // Dash / return animation
        if (live.carAnim === 'dashing') {
          const t = Math.min(1, (now - live.animStart) / DASH_MS);
          live.carY = CAR_BASE_Y + (CAR_DASH_Y - CAR_BASE_Y) * t;
          if (t >= 1) {
            resolveRow(live, now, live.dashLane);
            if (live.phase === 'playing') {
              live.carAnim = 'returning';
              live.animStart = now;
            }
          }
        } else if (live.carAnim === 'returning') {
          const t = Math.min(1, (now - live.animStart) / RETURN_MS);
          live.carY = CAR_DASH_Y + (CAR_BASE_Y - CAR_DASH_Y) * t;
          if (t >= 1) {
            live.carAnim = 'idle';
            live.carY = CAR_BASE_Y;
            live.row = null;
            live.nextRowAt = now + ROW_PAUSE_MS;
          }
        }
      }

      const dashReady =
        live.phase === 'playing' && live.carAnim === 'idle' && !!live.row && !live.row.resolved;
      setCanDash(dashReady);

      drawFrame(_ctx, live, now);
    }

    const animRef = { current: 0 };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lane + dash controls ─────────────────────────────────────────────────
  const moveLane = useCallback((delta: -1 | 1) => {
    const live = liveRef.current;
    if (live.phase !== 'playing' || live.carAnim !== 'idle') return;
    live.targetLane = Math.max(0, Math.min(2, live.targetLane + delta)) as Lane;
  }, []);

  const dash = useCallback(() => {
    const live = liveRef.current;
    if (live.phase !== 'playing' || live.carAnim !== 'idle') return;
    if (!live.row || live.row.resolved) return;
    live.carAnim = 'dashing';
    live.animStart = performance.now();
    live.dashLane = live.targetLane;
  }, []);

  const togglePause = useCallback(() => {
    if (quizActiveRef.current) return;
    const live = liveRef.current;
    const now = performance.now();
    if (live.phase === 'paused') {
      if (live.pausedAt != null && live.row && !live.row.resolved) {
        live.roundDeadline += now - live.pausedAt;
      }
      live.pausedAt = null;
      live.phase = 'playing';
    } else if (live.phase === 'playing') {
      live.pausedAt = now;
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
      else if (e.key === ' ') {
        e.preventDefault();
        dash();
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
      else if (e.key === 'Enter' && liveRef.current.phase === 'over') restart();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane, dash, togglePause, restart]);

  // ── Tap/click the track directly to pick a lane (mobile + tablet + desktop) ─
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      const live = liveRef.current;
      if (live.phase !== 'playing' || live.carAnim !== 'idle') return;
      const rect = canvas!.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      live.targetLane = Math.min(2, Math.floor(ratio * 3)) as Lane;
    }
    canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
  }, []);

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
          🏎️ 邏輯數列太空賽車
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

      {/* Level badge */}
      <div className="mb-1 w-full text-center text-xs font-bold" style={{ maxWidth: CANVAS_W, color: '#ffcc33' }}>
        第 {hud.level} 關
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

          {phase === 'paused' && !quiz && (
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

          {quiz && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 rounded-xl p-4"
              style={{ background: 'rgba(11,17,48,0.95)' }}
            >
              <div className="text-xs font-bold" style={{ color: '#94a3b8' }}>
                📚 單字小測驗
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: QUIZ_STREAK_TARGET }, (_, i) => (
                  <span
                    key={i}
                    className="text-2xl transition-all duration-300"
                    style={{
                      opacity: i < quiz.streak ? 1 : 0.25,
                      filter: i < quiz.streak ? 'none' : 'grayscale(1)',
                      transform: i < quiz.streak ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    🏁
                  </span>
                ))}
              </div>
              <div className="text-xs" style={{ color: '#94a3b8' }}>
                集滿 {QUIZ_STREAK_TARGET} 面旗子才能繼續遊戲
              </div>
              <div className="mt-1 text-2xl font-black" style={{ color: '#ffcc33' }}>
                {quiz.question.word.emoji} {quiz.question.word.word}
              </div>
              {quiz.question.word.kk && (
                <div className="text-sm" style={{ color: '#94a3b8' }}>
                  {quiz.question.word.kk}
                </div>
              )}
              <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
                {quiz.question.choices.map((choice) => {
                  const isSelected = quiz.selectedId === choice.id;
                  const isCorrectChoice = choice.id === quiz.question.word.id;
                  const showFeedback = quiz.feedback !== null;
                  let bg = 'rgba(255,255,255,0.08)';
                  if (showFeedback && isSelected) {
                    bg = quiz.feedback === 'correct' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)';
                  } else if (showFeedback && isCorrectChoice) {
                    bg = 'rgba(34,197,94,0.2)';
                  }
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={showFeedback}
                      onClick={() => answerQuiz(choice)}
                      className="flex min-h-[56px] items-center justify-center rounded-lg px-4 py-2 text-lg text-white"
                      style={{ background: bg, border: '1px solid rgba(255,255,255,0.15)' }}
                    >
                      <ZhuyinText zh={choice.zh} zhuyin={choice.zhuyin} className="zhuyin-word-wrap" />
                    </button>
                  );
                })}
              </div>
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

      {/* Dash button */}
      <button
        type="button"
        onClick={dash}
        disabled={!canDash}
        aria-label="衝刺開向答案"
        className="mt-3 w-full rounded-2xl px-6 py-3 text-lg font-black transition-transform active:scale-95 disabled:cursor-not-allowed"
        style={{
          maxWidth: CANVAS_W,
          background: canDash ? '#ffcc33' : 'rgba(255,255,255,0.08)',
          color: canDash ? '#1a1a2e' : '#64748b',
          border: canDash ? '3px solid #ffe27a' : '3px solid rgba(255,255,255,0.12)',
          opacity: canDash ? 1 : 0.6,
        }}
      >
        🏎️ 衝刺！
      </button>

      <p className="mt-3 text-center text-xs text-zinc-500">
        看清楚上方數列的規律，點選跑道或用 ← → 選車道，按「衝刺」開向答案正確的門！空白鍵衝刺、P/Esc 暫停
      </p>
    </div>
  );
}
