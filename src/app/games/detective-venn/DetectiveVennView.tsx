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

// ── Sprite sheet ──────────────────────────────────────────────────────────────
// 1254×1254 transparent-bg sprite sheet
const IMG_W = 1254;
const IMG_H = 1254;
const SPRITE_DATA = {
  pig:       { x: 15,  y: 5,   w: 580, h: 510 },
  boy:       { x: 630, y: 5,   w: 615, h: 510 },
  topsecret: { x: 5,   y: 525, w: 390, h: 325 },
  badge:     { x: 420, y: 515, w: 420, h: 345 },
  magnifier: { x: 855, y: 520, w: 385, h: 330 },
  eye:       { x: 10,  y: 880, w: 390, h: 370 },
  pin:       { x: 425, y: 880, w: 415, h: 370 },
  lightbulb: { x: 855, y: 880, w: 390, h: 370 },
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

const CLUE_COLORS: [string, string, string] = ['#3b82f6', '#22c55e', '#a855f7'];

const DEFAULT_PIG_TEXT   = '嗨！一起找出秘密單字吧！';
const DEFAULT_SHEEP_TEXT = '需要發音時叫我！';
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

// Parse clue text into tokens; words found in wordMap become clickable
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

  // Word map for clickable word lookup in clue text
  const wordMap = useMemo(() => {
    const all: Word[] = [...thisWeek, ...reinforcement, ...custom, ...phonics, ...sightWords];
    const map = new Map<string, Word>();
    for (const w of all) map.set(w.word.toLowerCase(), w);
    return map;
  }, [thisWeek, reinforcement, custom, phonics, sightWords]);

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
  const [showAnswer, setShowAnswer] = useState(false);   // revealed after clicking ?
  const [pigHelpsLeft, setPigHelpsLeft]     = useState(MAX_HELPS); // session-wide
  const [sheepHelpsLeft, setSheepHelpsLeft] = useState(MAX_HELPS); // session-wide
  const [popupWord, setPopupWord] = useState<Word | null>(null);

  const clueTriple = useMemo(() => getClueTriple(currentWord.word), [currentWord]);
  const clues = [clueTriple.A, clueTriple.B, clueTriple.C] as const;

  function loadQuestion() {
    const next = pickNextWord(activeWords, usedIdsRef.current, currentWord.id);
    usedIdsRef.current.add(next.id);
    setCurrentWord(next);
    setPool(makeTiles(next.word.toUpperCase()));
    setPlaced([]); setMood(null); setFeedback('idle');
    setPigText(DEFAULT_PIG_TEXT); setSheepText(DEFAULT_SHEEP_TEXT);
    setShowNext(false); setShowAnswer(false); setQuestionCount((c) => c + 1);
    // pigHelpsLeft & sheepHelpsLeft are NOT reset (session-wide limits)
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
    setPigText(`🔍 ${hint}`);
    speak(hint, 'en-US');
    setPigHelpsLeft((c) => c - 1);
  }
  function handleHelpSheep() {
    if (sheepHelpsLeft <= 0) return;
    const text = currentWord.word;
    setSheepText(`Listen: ${text.toUpperCase()}`);
    speak(text, 'en-US');
    setSheepHelpsLeft((c) => c - 1);
  }
  function handleConfirm() {
    const attempt = placed.map((t) => t.letter).join('');
    if (placed.length === currentWord.word.length && attempt === currentWord.word.toUpperCase()) {
      setMood('happy');
      setPigText('太棒了！成功破案！🎉');
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

  // SVG layout — text boxes positioned within non-overlapping petals
  const circles    = [{ cx: 110, cy: 110 }, { cx: 210, cy: 110 }, { cx: 160, cy: 190 }] as const;
  const labelBoxes = [
    { x: 10,  y: 35,  width: 115, height: 92 },  // A (left petal)
    { x: 195, y: 35,  width: 115, height: 92 },  // B (right petal)
    { x: 95,  y: 220, width: 130, height: 68 },  // C (bottom petal)
  ] as const;

  const clueStyle: React.CSSProperties = {
    color: '#fff',
    WebkitTextStroke: '0.3px rgba(0,0,0,0.7)',
    textShadow: '0 1px 5px rgba(0,0,0,0.95)',
    fontSize: '0.6rem',
    fontWeight: 700,
    lineHeight: 1.35,
    textAlign: 'center',
    display: 'block',
  };

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

        {/* Title + scoreboard */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprite id="magnifier" size={32} />
            <h1 className="text-xl font-bold text-[var(--hero-gold)] sm:text-2xl">豬探長與牧探長</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <Sprite id="badge" size={22} />
            <span className="text-xs font-bold text-white">第 {questionCount} 題　破案 {solvedCount}</span>
          </div>
        </div>

        {/* ── Detective avatars row (outside Venn panel, large) ── */}
        <div className="mt-3 flex items-start justify-between gap-2">
          {/* Pig detective */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => speak(pigText, pigText.startsWith('🔍') ? 'en-US' : 'zh-TW')}
              className={`flex items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--hero-gold)] bg-white shadow-lg h-24 w-24 sm:h-28 sm:w-28 ${moodClass}`}
              aria-label="豬探長"
            >
              <Sprite id="pig" size={88} />
            </button>
            <div className="max-w-[110px] rounded-xl bg-zinc-900/85 px-2 py-1.5 text-center text-[0.58rem] leading-snug text-white shadow sm:max-w-[130px] sm:text-[0.65rem]">
              {pigText}
            </div>
          </div>

          {/* Boy detective */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => speak(sheepText, sheepText.startsWith('Listen') ? 'en-US' : 'zh-TW')}
              className={`flex items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--hero-gold)] bg-white shadow-lg h-24 w-24 sm:h-28 sm:w-28 ${moodClass}`}
              aria-label="牧探長"
            >
              <Sprite id="boy" size={88} />
            </button>
            <div className="max-w-[110px] rounded-xl bg-zinc-900/85 px-2 py-1.5 text-center text-[0.58rem] leading-snug text-white shadow sm:max-w-[130px] sm:text-[0.65rem]">
              {sheepText}
            </div>
          </div>
        </div>

        {/* ── Venn diagram panel ── */}
        <div className="relative mt-2 overflow-hidden rounded-2xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-sky-50 via-white to-fuchsia-50 shadow-md">

          {/* TOP SECRET stamp — decorative */}
          <div className="pointer-events-none absolute right-2 top-2 z-10 opacity-55" style={{ transform: 'rotate(12deg)' }}>
            <Sprite id="topsecret" size={66} />
          </div>

          {/* SVG Venn */}
          <div className="flex items-center justify-center px-3 pt-3 pb-1">
            <svg viewBox="0 0 320 302" className="mx-auto w-full max-w-[380px] sm:max-w-[450px] md:max-w-[500px]">
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
                      cx={circle.cx} cy={circle.cy} r={100}
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
                                onClick={(e) => { e.stopPropagation(); setPopupWord(t.word!); speak(t.word!.word, 'en-US'); }}
                                style={{
                                  color: '#fde68a',
                                  textDecoration: 'underline',
                                  WebkitTextStroke: '0.3px rgba(0,0,0,0.7)',
                                  textShadow: '0 1px 4px rgba(0,0,0,0.95)',
                                  fontSize: 'inherit',
                                  fontWeight: 'inherit',
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

              {/* Centre "?" — clickable to reveal answer area */}
              {!showAnswer && (
                <g
                  className="cursor-pointer"
                  onClick={() => setShowAnswer(true)}
                  role="button"
                  aria-label="點擊開始作答"
                >
                  <circle cx="160" cy="152" r="24" fill="rgba(255,255,255,0.25)" className="animate-pulse" />
                  <text
                    x="160" y="152"
                    textAnchor="middle" dominantBaseline="central"
                    fontSize="36" fontWeight="900" fill="#ffffff"
                    style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))', userSelect: 'none' }}
                  >
                    ?
                  </text>
                </g>
              )}
            </svg>
          </div>

          <p className="pb-2 text-center text-[0.6rem] text-zinc-400 sm:text-xs">
            {showAnswer ? '👆 點顏色圈圈用英文唸出線索' : '👆 點 ❓ 開始作答 · 點圓圈唸線索'}
          </p>
        </div>

        {/* ── Letter tiles (shown only after clicking ?) ── */}
        {showAnswer && (
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
        )}

        {/* ── Action buttons (shown only after clicking ?) ── */}
        {showAnswer && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleHelpPig}
              disabled={pigHelpsLeft <= 0}
              className={`flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow sm:text-sm ${pigHelpsLeft <= 0 ? 'opacity-40' : 'hover:bg-zinc-100'}`}
            >
              <Sprite id="pig" size={22} />
              求助豬探長 {pigHelpsLeft > 0 ? `(${pigHelpsLeft})` : '✗'}
            </button>
            <button
              type="button"
              onClick={handleHelpSheep}
              disabled={sheepHelpsLeft <= 0}
              className={`flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 shadow sm:text-sm ${sheepHelpsLeft <= 0 ? 'opacity-40' : 'hover:bg-zinc-100'}`}
            >
              <Sprite id="boy" size={22} />
              求助牧探長 {sheepHelpsLeft > 0 ? `(${sheepHelpsLeft})` : '✗'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 rounded-xl bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white shadow hover:bg-[var(--hero-red-dark)] sm:px-7 sm:py-2.5 sm:text-base"
            >
              <Sprite id="magnifier" size={22} />
              確認破案
            </button>
            {showNext && (
              <button
                type="button"
                onClick={loadQuestion}
                className="flex items-center gap-2 rounded-xl bg-[var(--hero-gold)] px-5 py-2 text-sm font-bold text-zinc-900 shadow hover:brightness-95 sm:px-7 sm:py-2.5 sm:text-base"
              >
                <Sprite id="badge" size={22} />
                下一題 →
              </button>
            )}
          </div>
        )}

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
              aria-label="關閉"
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
