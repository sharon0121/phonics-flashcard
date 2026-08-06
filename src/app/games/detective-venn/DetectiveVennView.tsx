'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import HeroMascot from '@/components/HeroMascot';
import type { Word } from '@/lib/types';
import {
  useThisWeekClimbWords,
  useReinforcementClimbWords,
  usePhonicsClimbWords,
  useSightWordsClimb,
  type WordSourceKey,
} from '@/lib/heroClimbSettings';
import { useCustomWords } from '@/lib/customWords';
import { useDetectiveWordSources } from '@/lib/detectiveVennSettings';
import { hasClues, getClueTriple } from '@/lib/detectiveVennClues';

// ── Sprite sheet ──────────────────────────────────────────────────────────────
// Full sprite sheet: /public/detective/sprites.png (~1080×1080)
// Layout: row0=pig(left)+boy(right), row1=topsecret+badge+magnifier, row2=eye+pin+lightbulb
const IMG_W = 1080;
const IMG_H = 1080;
const SPRITE_DATA = {
  pig:       { x: 40,  y: 15,  w: 470, h: 370 },
  boy:       { x: 570, y: 15,  w: 470, h: 370 },
  topsecret: { x: 10,  y: 395, w: 335, h: 270 },
  badge:     { x: 365, y: 385, w: 350, h: 290 },
  magnifier: { x: 725, y: 395, w: 335, h: 270 },
  eye:       { x: 10,  y: 700, w: 335, h: 340 },
  pin:       { x: 365, y: 700, w: 335, h: 340 },
  lightbulb: { x: 725, y: 700, w: 335, h: 340 },
} as const;

type SpriteId = keyof typeof SPRITE_DATA;

function Sprite({ id, size }: { id: SpriteId; size: number }) {
  const s = SPRITE_DATA[id];
  const scale = size / Math.max(s.w, s.h);
  const scaledW = s.w * scale;
  const scaledH = s.h * scale;
  const ox = (size - scaledW) / 2;
  const oy = (size - scaledH) / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        backgroundImage: "url('/detective/sprites.png')",
        backgroundSize: `${IMG_W * scale}px ${IMG_H * scale}px`,
        backgroundPosition: `${-s.x * scale + ox}px ${-s.y * scale + oy}px`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

// ── Game types ────────────────────────────────────────────────────────────────
type Mood = 'happy' | 'sad' | null;
interface Tile { id: number; letter: string; }

const CLUE_COLORS: [string, string, string] = ['#3b82f6', '#22c55e', '#a855f7'];
const CLUE_ICONS: [SpriteId, SpriteId, SpriteId] = ['eye', 'pin', 'lightbulb'];
const CLUE_LABELS = ['外觀感覺', '在哪裡', '用途'] as const;

const DEFAULT_PIG_TEXT   = '嗨！一起找出秘密單字吧！';
const DEFAULT_SHEEP_TEXT = '需要發音時叫我！';
const WORD_LENGTH_RE     = /^[A-Za-z]{3,8}$/;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeTiles(word: string): Tile[] {
  return shuffle(word.split('').map((letter, id) => ({ id, letter })));
}
function speak(text: string, lang: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = 0.92;
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.speak(u), 50);
}
function pickNextWord(pool: Word[], usedIds: Set<string>, excludeId?: string): Word {
  let available = pool.filter((w) => !usedIds.has(w.id) && w.id !== excludeId);
  if (available.length === 0) { usedIds.clear(); available = pool.filter((w) => w.id !== excludeId); }
  if (available.length === 0) available = pool;
  return available[Math.floor(Math.random() * available.length)];
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DetectiveVennView() {
  const sources       = useDetectiveWordSources();
  const thisWeek      = useThisWeekClimbWords();
  const reinforcement = useReinforcementClimbWords();
  const phonics       = usePhonicsClimbWords();
  const sightWords    = useSightWordsClimb();
  const custom        = useCustomWords();

  const activeWords = useMemo(() => {
    const tierMap: Record<WordSourceKey, Word[]> = { thisWeek, reinforcement, custom, phonics, sightWords };
    const combined = sources.flatMap((key) => tierMap[key] ?? []);
    const seen = new Set<string>();
    const deduped = combined.filter((w) => {
      if (!WORD_LENGTH_RE.test(w.word)) return false;
      if (w.category !== 'animal' && w.category !== 'noun') return false;
      if (!hasClues(w.word)) return false;
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    return deduped.length > 0 ? deduped : phonics.filter((w) => WORD_LENGTH_RE.test(w.word) && hasClues(w.word));
  }, [sources, thisWeek, reinforcement, custom, phonics, sightWords]);

  const [currentWord, setCurrentWord] = useState<Word>(() => pickNextWord(activeWords, new Set()));
  const usedIdsRef = useRef(new Set<string>([currentWord.id]));
  const [pool, setPool]       = useState<Tile[]>(() => makeTiles(currentWord.word.toUpperCase()));
  const [placed, setPlaced]   = useState<Tile[]>([]);
  const [questionCount, setQuestionCount] = useState(1);
  const [solvedCount, setSolvedCount]     = useState(0);
  const [mood, setMood]         = useState<Mood>(null);
  const [pigText, setPigText]   = useState(DEFAULT_PIG_TEXT);
  const [sheepText, setSheepText] = useState(DEFAULT_SHEEP_TEXT);
  const [feedback, setFeedback] = useState<'idle' | 'wrong'>('idle');
  const [showNext, setShowNext] = useState(false);

  const clueTriple = useMemo(() => getClueTriple(currentWord.word), [currentWord]);
  const clues = [clueTriple.A, clueTriple.B, clueTriple.C] as const;

  function loadQuestion() {
    const next = pickNextWord(activeWords, usedIdsRef.current, currentWord.id);
    usedIdsRef.current.add(next.id);
    setCurrentWord(next);
    setPool(makeTiles(next.word.toUpperCase()));
    setPlaced([]); setMood(null); setFeedback('idle');
    setPigText(DEFAULT_PIG_TEXT); setSheepText(DEFAULT_SHEEP_TEXT);
    setShowNext(false); setQuestionCount((c) => c + 1);
  }

  function placeTile(tile: Tile) {
    if (placed.length >= currentWord.word.length) return;
    setPool((p) => p.filter((t) => t.id !== tile.id));
    setPlaced((p) => [...p, tile]);
  }
  function removeTile(index: number) {
    const tile = placed[index];
    if (!tile) return;
    setPlaced((p) => p.filter((_, i) => i !== index));
    setPool((p) => [...p, tile]);
  }

  function handleHelpPig() {
    const nextIndex = placed.length;
    if (nextIndex >= currentWord.word.length) return;
    const neededLetter = currentWord.word[nextIndex].toUpperCase();
    const tile = pool.find((t) => t.letter === neededLetter);
    if (!tile) return;
    placeTile(tile);
    setPigText(`提示：下一個字母是「${neededLetter}」！`);
  }
  function handleHelpSheep() {
    setSheepText(`Listen: ${currentWord.word.toUpperCase()}`);
    speak(currentWord.word, 'en-US');
  }
  function handleConfirm() {
    const attempt = placed.map((t) => t.letter).join('');
    if (placed.length === currentWord.word.length && attempt === currentWord.word.toUpperCase()) {
      setMood('happy');
      setPigText('太棒了！成功破案！');
      setSheepText(`Great! It's ${currentWord.word.toUpperCase()} — ${currentWord.zh}!`);
      speak('太棒了！成功破案！', 'zh-TW');
      setSolvedCount((c) => c + 1);
      setShowNext(true);
    } else {
      setMood('sad');
      setFeedback('wrong');
      setPigText('再想一下，三個線索合起來是什麼？');
      setTimeout(() => {
        setMood(null); setFeedback('idle');
        setPool((p) => shuffle([...p, ...placed]));
        setPlaced([]);
      }, 700);
    }
  }

  const moodClass = mood === 'happy' ? 'cell-pop' : mood === 'sad' ? 'cell-shake' : '';

  // SVG layout
  const circles    = [{ cx: 110, cy: 110 }, { cx: 210, cy: 110 }, { cx: 160, cy: 190 }] as const;
  const labelBoxes = [
    { x: 5,   y: 42,  width: 136, height: 100 },
    { x: 179, y: 42,  width: 136, height: 100 },
    { x: 92,  y: 218, width: 136, height: 100 },
  ] as const;

  return (
    <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-2 sm:py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <Link
            href="/games"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
            </svg>
            Back
          </Link>
          <Link href="/games/detective-venn/settings" aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20">
            ⚙️
          </Link>
        </div>

        {/* Title row */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprite id="magnifier" size={34} />
            <h1 className="text-xl font-bold text-[var(--hero-gold)] sm:text-2xl">豬探長與牧探長</h1>
          </div>
          {/* Scoreboard */}
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <Sprite id="badge" size={24} />
            <span className="text-xs font-bold text-white">
              第 {questionCount} 題　破案 {solvedCount}
            </span>
          </div>
        </div>

        {/* ── Venn diagram panel ── */}
        <div className="relative mt-3 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/95 shadow-md">

          {/* TOP SECRET stamp — decorative */}
          <div className="pointer-events-none absolute right-2 top-2 z-10 opacity-70" style={{ transform: 'rotate(12deg)' }}>
            <Sprite id="topsecret" size={72} />
          </div>

          {/* Pig detective (left) */}
          <div className="absolute left-2 top-2 sm:left-3 sm:top-3 z-20">
            <button
              type="button"
              onClick={() => speak(pigText, 'zh-TW')}
              className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-[var(--hero-gold)] bg-white shadow transition-shadow h-12 w-12 sm:h-14 sm:w-14 ${moodClass}`}
              aria-label="豬探長"
            >
              <Sprite id="pig" size={52} />
            </button>
            <div className="mt-0.5 max-w-[90px] rounded-lg bg-zinc-900/80 px-1.5 py-1 text-[0.55rem] leading-tight text-white shadow">
              {pigText}
            </div>
          </div>

          {/* Boy (sheep) detective (right) */}
          <div className="absolute right-2 top-2 sm:right-3 sm:top-3 z-20">
            <button
              type="button"
              onClick={() => speak(sheepText, sheepText.startsWith('Listen') ? 'en-US' : 'zh-TW')}
              className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-[var(--hero-gold)] bg-white shadow transition-shadow h-12 w-12 sm:h-14 sm:w-14 ${moodClass}`}
              aria-label="牧探長"
            >
              <Sprite id="boy" size={52} />
            </button>
            <div className="mt-0.5 max-w-[90px] rounded-lg bg-zinc-900/80 px-1.5 py-1 text-right text-[0.55rem] leading-tight text-white shadow">
              {sheepText}
            </div>
          </div>

          {/* SVG Venn */}
          <div className="flex items-center justify-center p-3 pt-16 sm:p-5 sm:pt-18">
            <svg viewBox="0 0 320 324" className="mx-auto w-full max-w-[400px] sm:max-w-[460px] md:max-w-[520px]">
              {clues.map((clue, i) => {
                const color  = CLUE_COLORS[i];
                const icon   = CLUE_ICONS[i];
                const label  = CLUE_LABELS[i];
                const circle = circles[i];
                const box    = labelBoxes[i];
                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onClick={() => speak(clue, 'en-US')}
                    role="button"
                    aria-label={`朗讀線索：${clue}`}
                  >
                    {/* Circle */}
                    <circle cx={circle.cx} cy={circle.cy} r={100}
                      fill={color} fillOpacity="0.65"
                      style={{ mixBlendMode: 'multiply' }} />

                    {/* Clue box with icon + text */}
                    <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-xl p-1.5"
                        style={{ background: 'rgba(255,255,255,0.82)' }}>
                        <Sprite id={icon} size={26} />
                        <span className="text-[0.5rem] font-extrabold leading-none sm:text-[0.6rem]"
                          style={{ color }}>
                          {label}
                        </span>
                        <span
                          className="text-center text-[0.58rem] font-bold leading-snug text-zinc-800 sm:text-[0.68rem]"
                          style={{ textShadow: '0 0 2px #fff' }}
                        >
                          {clue}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

              {/* Centre "?" */}
              <text x="160" y="153" textAnchor="middle" dominantBaseline="central"
                fontSize="34" fontWeight="900" fill="#ffffff"
                style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }}>
                ?
              </text>
            </svg>
          </div>

          <p className="pb-2 text-center text-[0.62rem] text-zinc-400 sm:text-xs">
            👆 點顏色圈圈用英文唸出線索
          </p>
        </div>

        {/* ── Letter tiles ── */}
        <div className="mt-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/95 p-2 shadow-md sm:p-3">
          <p className="text-xs font-bold text-zinc-800 sm:text-sm">🔤 排列英文字母，拼出秘密單字！</p>

          {/* Answer slots */}
          <div className={`flex gap-1.5 rounded-lg border-2 border-dashed p-2 transition-colors ${
            feedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
          }`}>
            {Array.from({ length: currentWord.word.length }, (_, i) => {
              const tile = placed[i];
              return (
                <button key={i} type="button" disabled={!tile} onClick={() => removeTile(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-base font-extrabold shadow sm:h-11 sm:w-11 sm:text-xl md:h-12 md:w-12 md:text-2xl ${
                    tile ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-white/40 text-transparent'
                  }`}>
                  {tile ? tile.letter : '_'}
                </button>
              );
            })}
          </div>

          {feedback === 'wrong' && <div className="text-xs font-bold text-[var(--hero-red)]">Try again! 💪</div>}

          {/* Tile pool */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {pool.map((tile) => (
              <button key={tile.id} type="button" onClick={() => placeTile(tile)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-base font-extrabold text-zinc-900 shadow hover:bg-zinc-100 sm:h-11 sm:w-11 sm:text-xl md:h-12 md:w-12 md:text-2xl">
                {tile.letter}
              </button>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button type="button" onClick={handleHelpPig}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow hover:bg-zinc-100 sm:text-sm">
            <Sprite id="pig" size={22} />
            求助豬探長
          </button>
          <button type="button" onClick={handleHelpSheep}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow hover:bg-zinc-100 sm:text-sm">
            <Sprite id="boy" size={22} />
            求助牧探長
          </button>
          <button type="button" onClick={handleConfirm}
            className="flex items-center gap-2 rounded-xl bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[var(--hero-red-dark)] sm:px-7 sm:py-2.5 sm:text-base">
            <Sprite id="magnifier" size={22} />
            確認破案
          </button>
          {showNext && (
            <button type="button" onClick={loadQuestion}
              className="flex items-center gap-2 rounded-xl bg-[var(--hero-gold)] px-5 py-2 text-sm font-bold text-zinc-900 shadow hover:brightness-95 sm:px-7 sm:py-2.5 sm:text-base">
              <Sprite id="badge" size={22} />
              下一題 →
            </button>
          )}
        </div>

      </div>
    </main>
  );
}
