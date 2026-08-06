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

type Mood = 'happy' | 'sad' | null;

interface Tile {
  id: number;
  letter: string;
}

const CLUE_COLORS = ['#ef4444', '#3b82f6', '#eab308'];

const DEFAULT_PIG_TEXT = '嗨！一起找出秘密單字吧！';
const DEFAULT_SHEEP_TEXT = '需要發音時叫我！';

const CATEGORY_CLUE: Record<string, string> = {
  animal: 'I am an animal.',
  action: 'I am an action word — something you do.',
  adjective: 'I describe what something is like.',
  noun: 'I am a thing you can see or use.',
  custom: 'I am one of your own custom words!',
};

const WORD_LENGTH_RE = /^[A-Za-z]{3,8}$/;

// Very common function words are excluded from the click-for-meaning lookup
// even when they exist in the sight-word bank — a kid doesn't need to look
// up "the" or "have"; the feature is for less-common vocabulary in a clue.
const CLUE_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'can', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'for', 'and', 'but', 'not', 'you', 'your',
  'his', 'her', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'with', 'from', 'about', 'into', 'than', 'then', 'when', 'what', 'who',
  'how', 'why', 'all', 'many', 'some', 'often', 'usually', 'sometimes',
  'listen', 'sound', 'name', 'letters', 'inside', 'often',
]);

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
  // Create the utterance before cancel() so it stays within the user-gesture event.
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  // iOS Safari needs a small delay after cancel() before speak() actually works.
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}

function isEnglishText(text: string) {
  return /^[A-Za-z0-9\s.,!?'"]+$/.test(text.trim());
}

function formatSentenceCase(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

// Blanks out the target word inside its example sentence so it can be used as
// a clue without giving the answer away. Returns null if the word can't be
// safely located (e.g. an irregular inflection the prefix match doesn't
// catch) so the caller can fall back to a category-based clue instead.
function maskSentence(sentence: string, word: string): string | null {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`\\b${escaped}\\b`, 'i');
  if (exact.test(sentence)) return sentence.replace(exact, '____');
  const prefix = new RegExp(`\\b${escaped}\\w*\\b`, 'i');
  if (prefix.test(sentence)) return sentence.replace(prefix, '____');
  return null;
}

function highlightClue(highlight: string): string {
  if (!highlight) return '';
  if (highlight.includes('_')) {
    const letter = highlight.replace('_', '');
    return `I have the "magic e" pattern with '${letter}' in my name!`;
  }
  return `Listen for the "${highlight}" sound in my name!`;
}

function buildClues(word: Word): [string, string, string] {
  const clue1 = formatSentenceCase(word.en);
  const masked = maskSentence(word.sentence, word.word);
  const clue2 = masked ?? formatSentenceCase(CATEGORY_CLUE[word.category] ?? 'I am a word for you to discover.');
  const clue3 = formatSentenceCase(highlightClue(word.highlight) || `I have ${word.word.length} letters in my name.`);
  return [clue1, clue2, clue3];
}

function splitTokens(text: string): string[] {
  return text.match(/[A-Za-z]+|[^A-Za-z]+/g) ?? [text];
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
  const sources = useDetectiveWordSources();
  const thisWeek = useThisWeekClimbWords();
  const reinforcement = useReinforcementClimbWords();
  const phonics = usePhonicsClimbWords();
  const sightWords = useSightWordsClimb();
  const custom = useCustomWords();

  const vocabLookup = useMemo(() => {
    const map = new Map<string, Word>();
    for (const w of [...phonics, ...sightWords, ...thisWeek, ...reinforcement, ...custom]) {
      if (!map.has(w.word.toLowerCase())) map.set(w.word.toLowerCase(), w);
    }
    return map;
  }, [phonics, sightWords, thisWeek, reinforcement, custom]);

  const activeWords = useMemo(() => {
    const tierMap: Record<WordSourceKey, Word[]> = { thisWeek, reinforcement, custom, phonics, sightWords };
    const combined = sources.flatMap((key) => tierMap[key] ?? []);
    const seen = new Set<string>();
    const deduped = combined.filter((w) => {
      if (!WORD_LENGTH_RE.test(w.word)) return false;
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
    if (deduped.length > 0) return deduped;
    return phonics.filter((w) => WORD_LENGTH_RE.test(w.word));
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
  const [vocabPopup, setVocabPopup] = useState<Word | null>(null);

  const clues = useMemo(() => buildClues(currentWord), [currentWord]);

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
    setVocabPopup(null);
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
      setSheepText(`Great job! It's ${currentWord.word.toUpperCase()} (${currentWord.zh})!`);
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

  function bubbleSpeak(text: string) {
    speak(text, isEnglishText(text) ? 'en-US' : 'zh-TW');
  }

  function handleVocabClick(w: Word, e: React.MouseEvent) {
    e.stopPropagation();
    speak(w.word, 'en-US');
    setVocabPopup(w);
  }

  function renderClueTokens(clue: string) {
    return splitTokens(clue).map((tok, i) => {
      const lower = tok.toLowerCase();
      const match = tok.length >= 3 && !CLUE_STOPWORDS.has(lower) ? vocabLookup.get(lower) : undefined;
      if (match && match.word.toLowerCase() !== currentWord.word.toLowerCase()) {
        return (
          <span
            key={i}
            onClick={(e) => handleVocabClick(match, e)}
            className="cursor-pointer underline decoration-dotted decoration-2 underline-offset-2 hover:text-indigo-700"
          >
            {tok}
          </span>
        );
      }
      return <span key={i}>{tok}</span>;
    });
  }

  const avatarMoodClass = mood === 'happy' ? 'cell-pop border-emerald-400' : mood === 'sad' ? 'cell-shake' : '';
  const avatarBaseClass =
    'flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-gradient-to-b from-amber-100 to-amber-200 text-lg shadow transition-shadow sm:h-11 sm:w-11 sm:text-xl';
  const tooltipClass =
    'absolute top-10 w-28 rounded-md bg-zinc-900/90 px-1.5 py-1 text-[0.58rem] leading-tight text-white shadow sm:top-12 sm:w-32 sm:text-[0.65rem]';
  const panelClass = 'rounded-2xl border-2 border-[var(--hero-gold)] bg-white/95 shadow-md';

  return (
    <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 py-2 sm:py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <Link
            href="/games"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
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

        {/* 維恩圖線索區：畫面中最大的區塊 */}
        <div className={`relative mt-3 flex items-center justify-center p-3 sm:p-5 ${panelClass}`}>
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4">
            <button
              type="button"
              onClick={() => bubbleSpeak(pigText)}
              className={`${avatarBaseClass} ${avatarMoodClass}`}
              aria-label="豬探長"
            >
              🐷
            </button>
            <span className={tooltipClass}>{pigText}</span>
          </div>
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
            <button
              type="button"
              onClick={() => bubbleSpeak(sheepText)}
              className={`${avatarBaseClass} ${avatarMoodClass}`}
              aria-label="牧探長"
            >
              🐕
            </button>
            <span className={`${tooltipClass} right-0 text-right`}>{sheepText}</span>
          </div>

          <svg viewBox="0 0 320 300" className="mx-auto w-full max-w-[420px] sm:max-w-[480px] md:max-w-[560px]">
            {clues.map((clue, i) => {
              const circle = [
                { cx: 110, cy: 110 },
                { cx: 210, cy: 110 },
                { cx: 160, cy: 190 },
              ][i];
              const labelBox = [
                { x: 8, y: 48, width: 132, height: 82 },
                { x: 180, y: 48, width: 132, height: 82 },
                { x: 94, y: 216, width: 132, height: 82 },
              ][i];
              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onClick={() => speak(clue.replace(/____/g, currentWord.word), 'en-US')}
                  role="button"
                  aria-label={`朗讀線索：${clue}`}
                >
                  <circle cx={circle.cx} cy={circle.cy} r={100} fill={CLUE_COLORS[i]} fillOpacity="0.72" style={{ mixBlendMode: 'multiply' }} />
                  <foreignObject x={labelBox.x} y={labelBox.y} width={labelBox.width} height={labelBox.height}>
                    <div className="flex h-full w-full items-center justify-center rounded-lg bg-white/10 p-1.5">
                      <span
                        className="text-center text-[0.62rem] leading-tight font-bold text-zinc-900 sm:text-xs md:text-sm"
                        style={{ textShadow: '0 0 3px #fff, 0 0 6px #fff, 0 1px 1px #fff' }}
                      >
                        {renderClueTokens(clue)}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
            <text
              x="160"
              y="137"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="30"
              fontWeight="800"
              fill="#ffffff"
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.7))' }}
            >
              ?
            </text>
          </svg>
        </div>
        <p className="mt-1 text-center text-[0.65rem] text-zinc-400 sm:text-xs">
          👆 點顏色圈圈唸出線索；點線索裡的底線單字可以看意思
        </p>

        {vocabPopup && (
          <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border-2 border-[var(--hero-gold)] bg-white p-3 shadow-xl sm:right-4 sm:left-auto">
            <div className="flex items-start gap-2">
              <span className="text-2xl">{vocabPopup.emoji}</span>
              <div className="flex-1">
                <p className="font-bold text-zinc-900">
                  {vocabPopup.word} <span className="text-zinc-500">{vocabPopup.zhuyin}</span>
                </p>
                <p className="text-sm text-zinc-700">
                  {vocabPopup.zh}　{vocabPopup.en}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVocabPopup(null)}
                className="text-zinc-400 hover:text-zinc-900"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 英文排列組合（欄位縮小） */}
        <div className={`mt-3 flex flex-col items-center gap-2 p-2 sm:p-3 ${panelClass}`}>
          <p className="text-xs font-bold text-zinc-800 sm:text-sm">🔤 排列英文字母</p>

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

          {feedback === 'wrong' && <div className="text-xs font-bold text-[var(--hero-red)]">Try again! 💪</div>}

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

        {/* 操作按鈕 */}
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
