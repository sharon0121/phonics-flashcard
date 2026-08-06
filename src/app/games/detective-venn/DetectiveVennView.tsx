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

type Mood = 'happy' | 'sad' | null;

interface Tile {
  id: number;
  letter: string;
}

// Circle A = red, Circle B = blue, Circle C = yellow
const CLUE_COLORS  = ['#ef4444', '#3b82f6', '#eab308'] as const;
const CLUE_LABELS  = ['A · 外觀感覺', 'B · 在哪裡', 'C · 用途'] as const;
const CLUE_KEYS    = ['A', 'B', 'C'] as const;

const DEFAULT_PIG_TEXT   = '嗨！一起找出秘密單字吧！';
const DEFAULT_SHEEP_TEXT = '需要發音時叫我！';

const WORD_LENGTH_RE = /^[A-Za-z]{3,8}$/;

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
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

function pickNextWord(pool: Word[], usedIds: Set<string>, excludeId?: string): Word {
  let available = pool.filter((w) => !usedIds.has(w.id) && w.id !== excludeId);
  if (available.length === 0) {
    usedIds.clear();
    available = pool.filter((w) => w.id !== excludeId);
  }
  if (available.length === 0) available = pool;
  return available[Math.floor(Math.random() * available.length)];
}

export default function DetectiveVennView() {
  const sources      = useDetectiveWordSources();
  const thisWeek     = useThisWeekClimbWords();
  const reinforcement = useReinforcementClimbWords();
  const phonics      = usePhonicsClimbWords();
  const sightWords   = useSightWordsClimb();
  const custom       = useCustomWords();

  // Only concrete nouns with curated clue data are eligible.
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
    if (deduped.length > 0) return deduped;
    // Fallback: phonics concrete nouns with clues
    return phonics.filter((w) => WORD_LENGTH_RE.test(w.word) && hasClues(w.word));
  }, [sources, thisWeek, reinforcement, custom, phonics, sightWords]);

  const [currentWord, setCurrentWord] = useState<Word>(() => pickNextWord(activeWords, new Set()));
  const usedIdsRef = useRef(new Set<string>([currentWord.id]));
  const [pool, setPool] = useState<Tile[]>(() => makeTiles(currentWord.word.toUpperCase()));
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [questionCount, setQuestionCount] = useState(1);
  const [solvedCount, setSolvedCount] = useState(0);
  const [mood, setMood] = useState<Mood>(null);
  const [pigText, setPigText] = useState(DEFAULT_PIG_TEXT);
  const [sheepText, setSheepText] = useState(DEFAULT_SHEEP_TEXT);
  const [feedback, setFeedback] = useState<'idle' | 'wrong'>('idle');
  const [showNext, setShowNext] = useState(false);

  const clueTriple = useMemo(() => getClueTriple(currentWord.word), [currentWord]);
  // Array ordered [A, B, C] for the three circles
  const clues = [clueTriple.A, clueTriple.B, clueTriple.C] as const;

  function loadQuestion() {
    const next = pickNextWord(activeWords, usedIdsRef.current, currentWord.id);
    usedIdsRef.current.add(next.id);
    setCurrentWord(next);
    setPool(makeTiles(next.word.toUpperCase()));
    setPlaced([]);
    setMood(null);
    setFeedback('idle');
    setPigText(DEFAULT_PIG_TEXT);
    setSheepText(DEFAULT_SHEEP_TEXT);
    setShowNext(false);
    setQuestionCount((c) => c + 1);
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
    const isCorrect = placed.length === currentWord.word.length && attempt === currentWord.word.toUpperCase();

    if (isCorrect) {
      setMood('happy');
      setPigText('太棒了！成功找到答案！');
      setSheepText(`Great job! It's ${currentWord.word.toUpperCase()} — ${currentWord.zh}!`);
      speak('太棒了！成功找到答案！', 'zh-TW');
      setSolvedCount((c) => c + 1);
      setShowNext(true);
      return;
    }

    setMood('sad');
    setFeedback('wrong');
    setPigText('再想一下，線索組合起來是什麼呢？');
    setTimeout(() => {
      setMood(null);
      setFeedback('idle');
      setPool((p) => shuffle([...p, ...placed]));
      setPlaced([]);
    }, 700);
  }

  const avatarMoodClass = mood === 'happy' ? 'cell-pop border-emerald-400' : mood === 'sad' ? 'cell-shake' : '';
  const avatarBaseClass =
    'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-gradient-to-b from-amber-100 to-amber-200 text-lg shadow transition-shadow sm:h-11 sm:w-11 sm:text-xl';
  const tooltipClass =
    'absolute top-10 w-28 rounded-md bg-zinc-900/90 px-1.5 py-1 text-[0.58rem] leading-tight text-white shadow sm:top-12 sm:w-32 sm:text-[0.65rem]';
  const panelClass = 'rounded-2xl border-2 border-[var(--hero-gold)] bg-white/95 shadow-md';

  // SVG geometry — three overlapping circles forming a Venn diagram
  const circles = [
    { cx: 110, cy: 110 },
    { cx: 210, cy: 110 },
    { cx: 160, cy: 190 },
  ] as const;
  const labelBoxes = [
    { x: 8,   y: 48,  width: 132, height: 88 },
    { x: 180, y: 48,  width: 132, height: 88 },
    { x: 94,  y: 220, width: 132, height: 88 },
  ] as const;
  // Center x of each label box for the type badge
  const labelCenterX = [74, 246, 160] as const;

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
          <Link
            href="/games/detective-venn/settings"
            aria-label="遊戲設定"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
          >
            ⚙️
          </Link>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔎</span>
            <h1 className="text-xl font-bold text-[var(--hero-gold)] sm:text-2xl">豬探長與牧探長</h1>
          </div>
          <p className="text-xs font-bold text-zinc-300 sm:text-sm">
            第 {questionCount} 題　｜　已破案：{solvedCount}
          </p>
        </div>

        {/* ── Venn diagram ── */}
        <div className={`relative mt-3 flex items-center justify-center p-3 sm:p-5 ${panelClass}`}>
          {/* Pig detective (top-left) */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
            <button
              type="button"
              onClick={() => speak(pigText, 'zh-TW')}
              className={`${avatarBaseClass} ${avatarMoodClass}`}
              aria-label="豬探長"
            >
              🐷
            </button>
            <span className={tooltipClass}>{pigText}</span>
          </div>

          {/* Sheep detective (top-right) */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <button
              type="button"
              onClick={() => speak(sheepText, sheepText.startsWith('Listen') ? 'en-US' : 'zh-TW')}
              className={`${avatarBaseClass} ${avatarMoodClass}`}
              aria-label="牧探長"
            >
              🐕
            </button>
            <span className={`${tooltipClass} right-0 text-right`}>{sheepText}</span>
          </div>

          <svg viewBox="0 0 320 316" className="mx-auto w-full max-w-[420px] sm:max-w-[480px] md:max-w-[560px]">
            {clues.map((clue, i) => {
              const color = CLUE_COLORS[i];
              const circle = circles[i];
              const box = labelBoxes[i];
              const cx = labelCenterX[i];
              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onClick={() => speak(clue, 'en-US')}
                  role="button"
                  aria-label={`朗讀線索：${clue}`}
                >
                  {/* Coloured circle */}
                  <circle
                    cx={circle.cx}
                    cy={circle.cy}
                    r={100}
                    fill={color}
                    fillOpacity="0.72"
                    style={{ mixBlendMode: 'multiply' }}
                  />

                  {/* Clue type badge */}
                  <text
                    x={cx}
                    y={box.y - 6}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="800"
                    fill={color}
                    opacity="0.95"
                  >
                    {CLUE_LABELS[i]}
                  </text>

                  {/* Clue text box */}
                  <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
                    <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/15 p-1.5">
                      <span
                        className="text-center text-[0.65rem] font-bold leading-snug text-zinc-900 sm:text-[0.75rem] md:text-sm"
                        style={{ textShadow: '0 0 3px #fff, 0 0 6px #fff' }}
                      >
                        {clue}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* Centre "?" */}
            <text
              x="160"
              y="148"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="32"
              fontWeight="900"
              fill="#ffffff"
              style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }}
            >
              ?
            </text>
          </svg>
        </div>

        <p className="mt-1 text-center text-[0.65rem] text-zinc-400 sm:text-xs">
          👆 點顏色圈圈用英文唸出線索
        </p>

        {/* ── Letter tiles ── */}
        <div className={`mt-3 flex flex-col items-center gap-2 p-2 sm:p-3 ${panelClass}`}>
          <p className="text-xs font-bold text-zinc-800 sm:text-sm">🔤 排列英文字母</p>

          {/* Answer slots */}
          <div
            className={`flex gap-1.5 rounded-lg border-2 border-dashed p-2 transition-colors ${
              feedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
            }`}
          >
            {Array.from({ length: currentWord.word.length }, (_, i) => {
              const tile = placed[i];
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!tile}
                  onClick={() => removeTile(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-base font-extrabold shadow sm:h-11 sm:w-11 sm:text-xl md:h-12 md:w-12 md:text-2xl ${
                    tile ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-white/40 text-transparent'
                  }`}
                >
                  {tile ? tile.letter : '_'}
                </button>
              );
            })}
          </div>

          {feedback === 'wrong' && (
            <div className="text-xs font-bold text-[var(--hero-red)]">Try again! 💪</div>
          )}

          {/* Tile pool */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {pool.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => placeTile(tile)}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-base font-extrabold text-zinc-900 shadow hover:bg-zinc-100 sm:h-11 sm:w-11 sm:text-xl md:h-12 md:w-12 md:text-2xl"
              >
                {tile.letter}
              </button>
            ))}
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleHelpPig}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow hover:bg-zinc-100 sm:text-sm"
          >
            🐷 求助豬探長
          </button>
          <button
            type="button"
            onClick={handleHelpSheep}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow hover:bg-zinc-100 sm:text-sm"
          >
            🐕 求助牧探長
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-xl bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[var(--hero-red-dark)] sm:px-7 sm:py-2.5 sm:text-base"
          >
            ✅ 確認破案
          </button>
          {showNext && (
            <button
              type="button"
              onClick={loadQuestion}
              className="rounded-xl bg-[var(--hero-gold)] px-5 py-2 text-sm font-bold text-zinc-900 shadow hover:brightness-95 sm:px-7 sm:py-2.5 sm:text-base"
            >
              下一題 →
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
