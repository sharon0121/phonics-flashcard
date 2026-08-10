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
import { hasClues, getClueTriple, getCategoryHint } from '@/lib/detectiveVennClues';
import { useDetectiveVennHistory, recordDetectiveCompletion } from '@/lib/detectiveVennHistory';
import { playCelebrationChime } from '@/lib/sound';

// ── Sprite sheet (1254×1254, transparent bg) ──────────────────────────────────
const IMG_W = 1254;
const IMG_H = 1254;
const SPRITE_DATA = {
  badge:     { x: 418, y: 502, w: 418, h: 375 },
  magnifier: { x: 836, y: 502, w: 418, h: 375 },
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

// ── Types ─────────────────────────────────────────────────────────────────────
type Mood = 'happy' | 'sad' | null;
interface Tile { id: number; letter: string; }

// Lighter pastel colors — dark text stays readable on top
const CLUE_COLORS: [string, string, string] = ['#60a5fa', '#4ade80', '#c084fc'];

const WORD_LENGTH_RE     = /^[A-Za-z]{3,8}$/;
const MAX_HELPS          = 5;

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
// Name fragments used by common platforms (Windows/Edge, Chrome, macOS/iOS) to
// mark a male voice — the Web Speech API has no gender field, so this is a
// best-effort match. If the device has no male voice for the language, the
// system default voice is used instead.
const MALE_VOICE_HINTS = ['male', 'yunjhe', 'yunjian', 'yunyang', 'yunxi', 'kangkang', 'boy', 'daniel', 'alex', 'fred', 'david', 'mark'];

function pickVoice(lang: string, preferMale: boolean): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const short = lang.slice(0, 2).toLowerCase();
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(short));
  if (!preferMale) return matches[0];
  return matches.find((v) => MALE_VOICE_HINTS.some((h) => v.name.toLowerCase().includes(h))) ?? matches[0];
}

function speak(text: string, lang: string, preferMale = false) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang; u.rate = 0.92;
  const voice = pickVoice(lang, preferMale);
  if (voice) u.voice = voice;
  window.speechSynthesis.cancel();
  setTimeout(() => window.speechSynthesis.speak(u), 50);
}
// Draws from `preferredPool` (words not yet mastered) whenever it has options,
// so a word cleared from the trophy record in Settings comes right back into
// rotation; falls back to the full pool once everything has been solved once.
function pickNextWord(pool: Word[], usedIds: Set<string>, excludeId?: string, preferredPool?: Word[]): Word {
  const base = preferredPool && preferredPool.length > 0 ? preferredPool : pool;
  let available = base.filter((w) => !usedIds.has(w.id) && w.id !== excludeId);
  if (available.length === 0) { usedIds.clear(); available = base.filter((w) => w.id !== excludeId); }
  if (available.length === 0) available = base;
  return available[Math.floor(Math.random() * available.length)];
}

function parseClueTokens(text: string, wordMap: Map<string, Word>) {
  const result: Array<{ text: string; word?: Word }> = [];
  const re = /[A-Za-z']+|[^A-Za-z']+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const token = m[0];
    const w = wordMap.get(token.toLowerCase().replace(/^'+|'+$/g, ''));
    result.push({ text: token, word: w });
  }
  return result;
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
      if (!hasClues(w.word)) return false;
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    return deduped.length > 0 ? deduped : phonics.filter((w) => WORD_LENGTH_RE.test(w.word) && hasClues(w.word));
  }, [sources, thisWeek, reinforcement, custom, phonics, sightWords]);

  const wordMap = useMemo(() => {
    const all: Word[] = [...thisWeek, ...reinforcement, ...custom, ...phonics, ...sightWords];
    const map = new Map<string, Word>();
    for (const w of all) map.set(w.word.toLowerCase(), w);
    return map;
  }, [thisWeek, reinforcement, custom, phonics, sightWords]);

  // Words the child hasn't solved yet (or that a parent cleared in Settings)
  // are drawn preferentially — see pickNextWord.
  const history = useDetectiveVennHistory();
  const masteredWords = useMemo(() => new Set(history.map((r) => r.word.toLowerCase())), [history]);
  const notMasteredWords = useMemo(
    () => activeWords.filter((w) => !masteredWords.has(w.word.toLowerCase())),
    [activeWords, masteredWords],
  );

  const [currentWord, setCurrentWord] = useState<Word>(() =>
    pickNextWord(activeWords, new Set(), undefined, notMasteredWords),
  );
  const usedIdsRef = useRef(new Set<string>([currentWord.id]));
  const [pool, setPool]       = useState<Tile[]>(() => makeTiles(currentWord.word.toUpperCase()));
  const [placed, setPlaced]   = useState<Tile[]>([]);
  const [questionCount, setQuestionCount] = useState(1);
  const [mood, setMood]         = useState<Mood>(null);
  const [feedback, setFeedback] = useState<'idle' | 'wrong'>('idle');
  const [showNext, setShowNext] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [pigHelpsLeft, setPigHelpsLeft]     = useState(MAX_HELPS);
  const [sheepHelpsLeft, setSheepHelpsLeft] = useState(MAX_HELPS);
  const [popupWord, setPopupWord] = useState<Word | null>(null);

  const clueTriple = useMemo(() => getClueTriple(currentWord.word), [currentWord]);
  const clues = [clueTriple.A, clueTriple.B, clueTriple.C] as const;

  function loadQuestion() {
    const next = pickNextWord(activeWords, usedIdsRef.current, currentWord.id, notMasteredWords);
    usedIdsRef.current.add(next.id);
    setCurrentWord(next);
    setPool(makeTiles(next.word.toUpperCase()));
    setPlaced([]); setMood(null); setFeedback('idle');
    setShowNext(false); setShowAnswer(false); setQuestionCount((c) => c + 1);
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
    if (pigHelpsLeft <= 0) return;
    const hint = getCategoryHint(currentWord.word);
    speak(hint, 'en-US');
    setPigHelpsLeft((c) => c - 1);
  }
  function handleHelpSheep() {
    if (sheepHelpsLeft <= 0) return;
    speak(currentWord.word, 'en-US', true);
    setSheepHelpsLeft((c) => c - 1);
  }
  function handleConfirm() {
    const attempt = placed.map((t) => t.letter).join('');
    if (placed.length === currentWord.word.length && attempt === currentWord.word.toUpperCase()) {
      setMood('happy');
      setShowNext(true);
      recordDetectiveCompletion(currentWord.word, currentWord.zh, Date.now());
      playCelebrationChime();
    } else {
      setMood('sad');
      setFeedback('wrong');
      setTimeout(() => {
        setMood(null); setFeedback('idle');
        setPool((p) => shuffle([...p, ...placed]));
        setPlaced([]);
      }, 700);
    }
  }

  const moodClass = mood === 'happy' ? 'cell-pop' : mood === 'sad' ? 'cell-shake' : '';

  // ── SVG layout — larger circles for more text space ──────────────────────────
  const circles    = [{ cx: 120, cy: 130, r: 115 }, { cx: 240, cy: 130, r: 115 }, { cx: 180, cy: 218, r: 115 }] as const;
  const labelBoxes = [
    { x: 16,  y: 32,  width: 122, height: 112 }, // A left petal (center ~77, 88)
    { x: 222, y: 32,  width: 122, height: 112 }, // B right petal (center ~283, 88)
    { x: 100, y: 246, width: 160, height: 82  }, // C bottom petal (center ~180, 287)
  ] as const;

  const clueStyle: React.CSSProperties = {
    color: '#1e293b',
    fontSize: '0.78rem',
    fontWeight: 700,
    lineHeight: 1.45,
    textAlign: 'center',
    display: 'block',
  };

  return (
    <main className="relative mx-auto w-full max-w-5xl flex-1 px-3 py-2 sm:py-6">
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
          <div className="flex items-center gap-2">
            {/* Scoreboard */}
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
              <Sprite id="badge" size={20} />
              <span className="text-xs font-bold text-white">第 {questionCount} 題　🏆 {history.length}</span>
            </div>
            <Link href="/games/detective-venn/settings" aria-label="遊戲設定"
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-lg shadow hover:bg-white/20">
              ⚙️
            </Link>
          </div>
        </div>

        {/* Title */}
        <h1 className="mt-1.5 text-xl font-bold text-[var(--hero-gold)] sm:text-2xl">
          🔎 豬探長與牧探長
        </h1>

        {/* ── Venn panel + answer area: side-by-side from md up, stacked below it ── */}
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start">

        {/* ── Big Venn panel (detectives inside at bottom corners) ── */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 shadow-lg lg:w-[36rem] lg:shrink-0">

          {/* Celebration overlay — sits directly on the Venn diagram, no extra section */}
          {mood === 'happy' && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div className="animate-bounce rounded-2xl border-[3px] border-[var(--hero-gold)] bg-white/95 px-6 py-4 text-center shadow-xl">
                <div className="text-4xl">🎆🏆🎆</div>
                <div className="mt-1 text-lg font-bold text-[var(--hero-red)]">🎉 破案成功！</div>
              </div>
            </div>
          )}

          {/* SVG Venn — takes full panel width, bottom padding reserves space for the detectives */}
          <div className="px-1 pt-2 pb-32 sm:px-2 sm:pt-3 sm:pb-44 md:pb-56 lg:pb-80">
            <svg viewBox="0 0 360 335" className="w-full">
              {clues.map((clue, i) => {
                const color  = CLUE_COLORS[i];
                const circle = circles[i];
                const box    = labelBoxes[i];
                const tokens = parseClueTokens(clue, wordMap);
                return (
                  <g
                    key={i}
                    className="cursor-pointer"
                    onClick={() => speak(clue, 'en-US')}
                    role="button"
                    aria-label={`朗讀線索：${clue}`}
                  >
                    <circle
                      cx={circle.cx} cy={circle.cy} r={circle.r}
                      fill={color} fillOpacity="0.45"
                      style={{ mixBlendMode: 'multiply' }}
                    />
                    <foreignObject x={box.x} y={box.y} width={box.width} height={box.height}>
                      <div
                        className="flex h-full w-full flex-col items-center justify-center p-1"
                        style={{ background: 'transparent' }}
                      >
                        <span style={clueStyle}>
                          {tokens.map((t, j) =>
                            t.word ? (
                              <button
                                key={j}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPopupWord(t.word!);
                                  speak(t.word!.word, 'en-US');
                                }}
                                style={{
                                  color: '#1d4ed8',
                                  textDecoration: 'underline',
                                  fontWeight: 800,
                                  fontSize: 'inherit',
                                  lineHeight: 'inherit',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                {t.text}
                              </button>
                            ) : (
                              <span key={j}>{t.text}</span>
                            )
                          )}
                        </span>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

              {/* Centre "?" — click to reveal answer area */}
              {!showAnswer && (
                <g
                  className="cursor-pointer"
                  onClick={() => setShowAnswer(true)}
                  role="button"
                  aria-label="點擊開始作答"
                >
                  <circle cx="180" cy="160" r="26" fill="rgba(255,255,255,0.35)" className="animate-pulse" />
                  <text
                    x="180" y="160"
                    textAnchor="middle" dominantBaseline="central"
                    fontSize="38" fontWeight="900" fill="#1e293b"
                    style={{ filter: 'drop-shadow(0 1px 3px rgba(255,255,255,0.9))', userSelect: 'none' }}
                  >
                    ?
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Pig detective — bottom-left, half-body cutout, click for a hint */}
          <button
            type="button"
            onClick={handleHelpPig}
            disabled={pigHelpsLeft <= 0}
            className={`absolute bottom-0 left-0 z-20 transition-opacity ${pigHelpsLeft <= 0 ? 'opacity-40' : ''} ${moodClass}`}
            aria-label="豬探長：點擊獲得提示"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/detective/pig-detective.png"
              alt=""
              className="h-36 w-auto drop-shadow-lg sm:h-48 md:h-64 lg:h-96"
            />
            <span className="absolute -right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hero-red)] text-xs font-extrabold text-white shadow sm:h-7 sm:w-7 sm:text-sm">
              {pigHelpsLeft}
            </span>
          </button>

          {/* Boy detective — bottom-right, half-body cutout, click for a hint */}
          <button
            type="button"
            onClick={handleHelpSheep}
            disabled={sheepHelpsLeft <= 0}
            className={`absolute bottom-0 right-0 z-20 transition-opacity ${sheepHelpsLeft <= 0 ? 'opacity-40' : ''} ${moodClass}`}
            aria-label="牧探長：點擊獲得提示"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/detective/boy-detective.png"
              alt=""
              className="h-36 w-auto drop-shadow-lg sm:h-48 md:h-64 lg:h-96"
            />
            <span className="absolute -left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--hero-red)] text-xs font-extrabold text-white shadow sm:h-7 sm:w-7 sm:text-sm">
              {sheepHelpsLeft}
            </span>
          </button>

          <p className="pb-2 text-center text-[0.58rem] text-zinc-400 sm:text-xs">
            {showAnswer ? '👆 點圓圈唸線索 · 點偵探求助' : '👆 點 ❓ 開始作答 · 點圓圈唸線索'}
          </p>
        </div>

        {/* ── Answer column: tiles + buttons, beside the panel from md up ── */}
        {showAnswer && (
          <div className="flex flex-col items-center gap-2 lg:w-72 lg:shrink-0">
            <div className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-[var(--hero-gold)] bg-white/95 p-2 shadow-md sm:p-3">
              <p className="text-xs font-bold text-zinc-800 sm:text-sm">🔤 排列英文字母，拼出秘密單字！</p>

              {/* Answer slots */}
              <div className={`flex flex-wrap justify-center gap-1.5 rounded-lg border-2 border-dashed p-2 transition-colors ${
                feedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
              }`}>
                {Array.from({ length: currentWord.word.length }, (_, i) => {
                  const tile = placed[i];
                  return (
                    <button key={i} type="button" disabled={!tile} onClick={() => removeTile(i)}
                      className={`flex h-10 w-10 items-center justify-center rounded-md text-lg font-extrabold shadow sm:h-12 sm:w-12 sm:text-2xl ${
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
                    className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-lg font-extrabold text-zinc-900 shadow hover:bg-zinc-100 sm:h-12 sm:w-12 sm:text-2xl">
                    {tile.letter}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Action buttons (confirm + next only) ── */}
            <div className="flex items-center justify-center gap-3">
              {!showNext && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex items-center gap-2 rounded-xl bg-[var(--hero-red)] px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-[var(--hero-red-dark)] sm:px-8 sm:py-3 sm:text-base"
                >
                  <Sprite id="magnifier" size={22} />
                  確認破案
                </button>
              )}
              {showNext && (
                <button
                  type="button"
                  onClick={loadQuestion}
                  className="flex items-center gap-2 rounded-xl bg-[var(--hero-gold)] px-6 py-2.5 text-sm font-bold text-zinc-900 shadow hover:brightness-95 sm:px-8 sm:py-3 sm:text-base"
                >
                  <Sprite id="badge" size={22} />
                  下一題 →
                </button>
              )}
            </div>
          </div>
        )}

        </div>

      </div>

      {/* ── Word lookup popup ── */}
      {popupWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPopupWord(null)}
        >
          <div
            className="relative mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPopupWord(null)}
              className="absolute right-3 top-3 text-lg text-zinc-400 hover:text-zinc-700"
            >
              ✕
            </button>
            <p className="text-3xl font-extrabold text-zinc-900">{popupWord.word}</p>
            <p className="text-sm text-zinc-500">{popupWord.kk}</p>
            <p className="mt-1 text-xl font-bold text-zinc-700">{popupWord.zh}</p>
            <p className="mt-1 text-sm text-zinc-500">{popupWord.en}</p>
            <button
              type="button"
              onClick={() => speak(popupWord.word, 'en-US')}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--hero-gold)] py-2.5 text-sm font-bold text-zinc-900 shadow hover:brightness-95"
            >
              🔊 唸英文
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
