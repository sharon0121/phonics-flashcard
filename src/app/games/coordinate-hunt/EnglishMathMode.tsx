'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  GRID_COLS,
  GRID_ROWS,
  samePosition,
  shuffle,
  type GridPosition,
} from '@/lib/coordinateHunt';
import {
  useCoordTermCounts,
  useCoordMaxValues,
  useCoordTimeLimit,
  ladderTierValue,
} from '@/lib/coordinateHuntSettings';
import { generateProblemSet, type AbacusProblem } from '@/lib/abacus';
import { useAllSentences } from '@/lib/gameSentences';
import type { GameSentence } from '@/data/gameSentences';
import { playDingSound, playErrorSound } from '@/lib/sound';
import DPad from '@/components/DPad';
import SpeakButton from '@/components/SpeakButton';

const START_POSITION: GridPosition = { col: 0, row: 0 };
const MAX_LIVES = 3;

type Stage =
  | 'idle'
  | 'playing'
  | 'roundSuccess'
  | 'assembling'
  | 'sentenceSuccess'
  | 'failed'
  | 'finished';

interface MathRound {
  problem: AbacusProblem;
  gridNumbers: number[];
  answerPos: GridPosition;
}

interface WordTile {
  wordIndex: number;
  text: string;
}

function buildMathGrid(answer: number): { gridNumbers: number[]; answerPos: GridPosition } {
  const total = GRID_COLS * GRID_ROWS;
  const used = new Set([answer]);
  const pool: number[] = [];
  let offset = 1;
  while (pool.length < total - 1 && offset < 500) {
    const below = answer - offset;
    const above = answer + offset;
    if (below >= 1 && !used.has(below)) { used.add(below); pool.push(below); }
    if (pool.length < total - 1 && !used.has(above)) { used.add(above); pool.push(above); }
    offset++;
  }
  const all = shuffle([answer, ...pool.slice(0, total - 1)]);
  const idx = all.indexOf(answer);
  return { gridNumbers: all, answerPos: { col: idx % GRID_COLS, row: Math.floor(idx / GRID_COLS) } };
}

function makeRound(termCount: number, maxValue: number): MathRound {
  const problem = generateProblemSet(1, termCount, maxValue)[0];
  const { gridNumbers, answerPos } = buildMathGrid(problem.answer);
  return { problem, gridNumbers, answerPos };
}

function formatProblem(terms: number[]): string {
  return terms.map((t, i) => (i === 0 ? String(t) : t < 0 ? ` − ${-t}` : ` + ${t}`)).join('') + ' = ?';
}

interface Props {
  onBack: () => void;
}

export default function EnglishMathMode({ onBack }: Props) {
  const allSentences = useAllSentences();
  const termCountOptions = useCoordTermCounts();
  const maxValueOptions = useCoordMaxValues();
  const timeLimit = useCoordTimeLimit();

  // Consecutive-correct-dig streak drives the difficulty ladder (same
  // mechanic as 時空戰術隊/憤怒牛): sort selected values ascending, step up
  // a tier every 10-streak, reset to the easiest tier on a wrong dig.
  const streakRef = useRef(0);
  function nextRoundParams() {
    const sortedTerms = [...termCountOptions].sort((a, b) => a - b);
    const sortedMax = [...maxValueOptions].sort((a, b) => a - b);
    return {
      termCount: ladderTierValue(sortedTerms, streakRef.current),
      maxValue: ladderTierValue(sortedMax, streakRef.current),
    };
  }

  const [stage, setStage] = useState<Stage>('idle');
  const [round, setRound] = useState<MathRound | null>(null);
  const [sentence, setSentence] = useState<GameSentence | null>(null);
  const [wordRevealQueue, setWordRevealQueue] = useState<number[]>([]);
  const [collectedWords, setCollectedWords] = useState<WordTile[]>([]);
  const [assembled, setAssembled] = useState<WordTile[]>([]);
  const [assembleFeedback, setAssembleFeedback] = useState<'idle' | 'wrong'>('idle');
  const [player, setPlayer] = useState<GridPosition>(START_POSITION);
  const [dugCells, setDugCells] = useState<GridPosition[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState<number>(timeLimit);
  const [digFeedback, setDigFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gameActive, setGameActive] = useState(false);

  // Sync display when settings change on idle screen
  useEffect(() => {
    if (stage === 'idle') setTimeLeft(timeLimit);
  }, [timeLimit, stage]);

  // Single continuous interval — never restarts between rounds
  useEffect(() => {
    if (!gameActive) return;
    const id = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [gameActive]);

  // Detect timer hitting 0
  useEffect(() => {
    if (gameActive && timeLeft === 0) {
      setGameActive(false);
      setStage('finished');
    }
  }, [gameActive, timeLeft]);

  useEffect(() => {
    if (stage !== 'roundSuccess') return;
    const allCollected = collectedWords.length >= (sentence?.words.length ?? 0);
    const t = setTimeout(() => {
      setDigFeedback(null);
      if (allCollected) {
        setStage('assembling');
      } else {
        const { termCount, maxValue } = nextRoundParams();
        setRound(makeRound(termCount, maxValue));
        setPlayer(START_POSITION);
        setDugCells([]);
        setStage('playing');
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, collectedWords.length, sentence?.words.length, termCountOptions, maxValueOptions]);

  useEffect(() => {
    if (stage !== 'sentenceSuccess') return;
    const t = setTimeout(() => {
      const sen = allSentences[Math.floor(Math.random() * allSentences.length)];
      setSentence(sen);
      setWordRevealQueue(shuffle(sen.words.map((_, i) => i)));
      setCollectedWords([]);
      setAssembled([]);
      setAssembleFeedback('idle');
      const { termCount, maxValue } = nextRoundParams();
      setRound(makeRound(termCount, maxValue));
      setPlayer(START_POSITION);
      setDugCells([]);
      setDigFeedback(null);
      setStage('playing');
    }, 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, allSentences, termCountOptions, maxValueOptions]);

  function startGame() {
    streakRef.current = 0;
    const sen = allSentences[Math.floor(Math.random() * allSentences.length)];
    setSentence(sen);
    setWordRevealQueue(shuffle(sen.words.map((_, i) => i)));
    setCollectedWords([]);
    setAssembled([]);
    setAssembleFeedback('idle');
    const { termCount, maxValue } = nextRoundParams();
    setRound(makeRound(termCount, maxValue));
    setPlayer(START_POSITION);
    setDugCells([]);
    setScore(0);
    setLives(MAX_LIVES);
    setTimeLeft(timeLimit);
    setDigFeedback(null);
    setGameActive(true);
    setStage('playing');
  }

  const move = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    if (stage !== 'playing' || digFeedback) return;
    setPlayer((prev) => {
      let { col, row } = prev;
      if (dir === 'up') row = Math.max(0, row - 1);
      if (dir === 'down') row = Math.min(GRID_ROWS - 1, row + 1);
      if (dir === 'left') col = Math.max(0, col - 1);
      if (dir === 'right') col = Math.min(GRID_COLS - 1, col + 1);
      return { col, row };
    });
  }, [stage, digFeedback]);

  const handleDig = useCallback(() => {
    if (stage !== 'playing' || digFeedback || !round || !sentence || wordRevealQueue.length === 0) return;
    if (dugCells.some((p) => samePosition(p, player))) return;
    setDugCells((prev) => [...prev, player]);
    if (samePosition(player, round.answerPos)) {
      playDingSound();
      streakRef.current += 1;
      const wordIdx = wordRevealQueue[0];
      setCollectedWords((prev) => [...prev, { wordIndex: wordIdx, text: sentence.words[wordIdx] }]);
      setWordRevealQueue((prev) => prev.slice(1));
      setDigFeedback('correct');
      setStage('roundSuccess');
    } else {
      playErrorSound();
      streakRef.current = 0;
      const newLives = lives - 1;
      setLives(newLives);
      setDigFeedback('wrong');
      setTimeout(() => {
        setDigFeedback(null);
        if (newLives <= 0) { setGameActive(false); setStage('failed'); }
      }, 800);
    }
  }, [stage, digFeedback, round, sentence, wordRevealQueue, dugCells, player, lives]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (stage !== 'playing') return;
      if (e.key === 'ArrowUp') { e.preventDefault(); move('up'); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); move('down'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); move('left'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move('right'); }
      else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); handleDig(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, handleDig, stage]);

  function placeTile(tile: WordTile) {
    if (stage !== 'assembling') return;
    setAssembled((prev) => [...prev, tile]);
  }

  function removeTile(index: number) {
    if (stage !== 'assembling') return;
    setAssembled((prev) => prev.filter((_, i) => i !== index));
  }

  function confirmSentence() {
    if (!sentence || assembled.length !== sentence.words.length) return;
    const isCorrect = assembled.every((tile, i) => tile.wordIndex === i);
    if (isCorrect) {
      playDingSound();
      setScore((s) => s + 1);
      setStage('sentenceSuccess');
    } else {
      playErrorSound();
      setAssembleFeedback('wrong');
      setTimeout(() => { setAssembleFeedback('idle'); setAssembled([]); }, 700);
    }
  }

  const timerColor = timeLeft <= 30 ? 'text-red-500' : timeLeft <= 60 ? 'text-yellow-400' : 'text-emerald-400';
  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  const showMath = stage === 'playing' || stage === 'roundSuccess';
  const lastRevealedWord = stage === 'roundSuccess' && collectedWords.length > 0
    ? collectedWords[collectedWords.length - 1].text : null;
  const placedIndices = new Set(assembled.map((t) => t.wordIndex));
  const pool = collectedWords.filter((t) => !placedIndices.has(t.wordIndex));
  const activeGame = stage !== 'idle' && stage !== 'failed' && stage !== 'finished';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        <Link
          href="/games/coordinate-hunt/settings"
          aria-label="遊戲設定"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-xl shadow hover:bg-white/20"
        >
          ⚙️
        </Link>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-2xl">🧮</span>
        <h2 className="text-xl font-bold text-[var(--hero-gold)]">英數挑戰</h2>
      </div>

      {/* IDLE */}
      {stage === 'idle' && (
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="text-zinc-300">解答心算題收集單字，再把單字排成完整的英文句子！</p>
          <p className="text-sm text-zinc-400">答錯 {MAX_LIVES} 次就挑戰失敗，在時間內盡量完成更多句子！</p>
          <button type="button" onClick={startGame} className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]">
            開始遊戲
          </button>
        </div>
      )}

      {/* Status bar */}
      {activeGame && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-0.5 text-xl">
            {Array.from({ length: MAX_LIVES }, (_, i) => <span key={i}>{i < lives ? '❤️' : '🖤'}</span>)}
          </div>
          <span className={`text-2xl font-bold tabular-nums ${timerColor}`}>{mins}:{secs}</span>
          <span className="text-sm font-bold text-zinc-300">Score: {score}</span>
        </div>
      )}

      {/* MATH PHASE */}
      {showMath && round && sentence && (
        <>
          <div className={`mt-3 rounded-xl border-2 bg-white/95 p-4 transition-colors ${
            digFeedback === 'correct' || stage === 'roundSuccess' ? 'border-emerald-400'
              : digFeedback === 'wrong' ? 'border-red-400' : 'border-[var(--hero-gold)]'
          }`}>
            <p className="text-center text-3xl font-bold tabular-nums text-zinc-900">
              {formatProblem(round.problem.terms)}
            </p>
            {lastRevealedWord && (
              <p className="mt-2 text-center text-lg font-bold text-emerald-500">
                ✨ Got: <span className="rounded-lg bg-emerald-100 px-2 py-0.5">{lastRevealedWord}</span>
              </p>
            )}
            {digFeedback === 'wrong' && <p className="mt-2 text-center text-lg font-bold text-red-500">❌ Try again!</p>}
            <div className="mt-3 border-t border-zinc-200 pt-3">
              <p className="text-xs font-medium text-zinc-500">已收集 {collectedWords.length} / {sentence.words.length} 個單字：</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {collectedWords.length === 0 ? (
                  <span className="text-xs text-zinc-400">答對心算題就能收集單字！</span>
                ) : (
                  collectedWords.map((tile, i) => (
                    <span key={i} className={`rounded-full px-3 py-1 text-sm font-bold ${
                      i === collectedWords.length - 1 && stage === 'roundSuccess'
                        ? 'bg-emerald-400 text-white' : 'bg-[var(--hero-gold)] text-zinc-900'
                    }`}>{tile.text}</span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-center gap-6">
            <div className="inline-block rounded-2xl border-[3px] border-zinc-900 bg-white p-3 shadow-md">
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)` }}>
                {round.gridNumbers.map((num, idx) => {
                  const pos: GridPosition = { col: idx % GRID_COLS, row: Math.floor(idx / GRID_COLS) };
                  const isPlayer = samePosition(player, pos);
                  const wasDug = dugCells.some((p) => samePosition(p, pos));
                  const wasCorrect = wasDug && samePosition(pos, round.answerPos);
                  return (
                    <div key={idx} className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 text-xl font-bold transition-colors sm:h-16 sm:w-16 sm:text-2xl ${
                      isPlayer ? 'border-[var(--hero-gold)] bg-yellow-100 ring-2 ring-[var(--hero-gold)]'
                        : wasCorrect ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                          : wasDug ? 'border-red-200 bg-red-50 text-red-300 line-through'
                            : 'border-zinc-200 bg-zinc-50 text-zinc-800'
                    }`}>
                      {isPlayer ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src="/heroes/cutout-game.png" alt="player" className="h-full w-full animate-bounce object-contain drop-shadow-md" />
                      ) : num}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <DPad
                disabled={stage !== 'playing'}
                onUp={() => move('up')}
                onDown={() => move('down')}
                onLeft={() => move('left')}
                onRight={() => move('right')}
              />
              <button
                type="button"
                disabled={stage !== 'playing' || !!digFeedback}
                onClick={handleDig}
                className="w-full rounded-xl bg-[var(--hero-red)] py-3 text-lg font-bold text-white shadow hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⛏️ Dig!
              </button>
              <p className="text-center text-xs text-zinc-400">Space bar also digs</p>
            </div>
          </div>
        </>
      )}

      {/* ASSEMBLY PHASE */}
      {stage === 'assembling' && sentence && (
        <>
          <div className="mt-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4 text-center">
            <p className="text-sm text-zinc-500">把找到的單字排成正確的句子：</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="text-lg font-bold text-zinc-900">{sentence.zh}</p>
              <SpeakButton text={sentence.zh} lang="zh-TW" className="bg-zinc-100 hover:bg-zinc-200" />
            </div>
          </div>

          <div className={`mt-4 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
            assembleFeedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
          }`}>
            {assembled.length === 0 && <span className="text-sm text-zinc-400">點下面的單字，排出句子</span>}
            {assembled.map((tile, i) => (
              <button key={i} type="button" onClick={() => removeTile(i)}
                className="rounded-lg bg-[var(--hero-gold)] px-3 py-2 text-lg font-bold text-zinc-900 shadow"
              >{tile.text}</button>
            ))}
            {assembleFeedback === 'wrong' && (
              <div className="mt-2 flex w-full flex-col items-center gap-2">
                <div className="animate-bounce text-5xl">💪</div>
                <div className="text-2xl font-bold text-[var(--hero-red)]">Try again!</div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {pool.map((tile) => (
              <button key={tile.wordIndex} type="button" onClick={() => placeTile(tile)}
                className="rounded-lg bg-white px-3 py-2 text-lg font-bold text-zinc-900 shadow hover:bg-zinc-100"
              >{tile.text}</button>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button type="button" disabled={assembled.length !== sentence.words.length} onClick={confirmSentence}
              className="rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >確認</button>
          </div>
        </>
      )}

      {/* SENTENCE SUCCESS */}
      {stage === 'sentenceSuccess' && sentence && (
        <>
          <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border-[3px] border-[var(--hero-gold)] bg-gradient-to-b from-yellow-50 to-white p-6 text-center shadow-lg">
            <div className="animate-bounce text-5xl">🎆🏆🎆</div>
            <div className="text-2xl font-bold text-[var(--hero-red)]">Great Job!</div>
          </div>
          <p className="mt-4 text-center text-xl font-bold text-white">{sentence.en}</p>
          <p className="mt-1 text-center text-sm text-zinc-300">{sentence.zh}</p>
        </>
      )}

      {/* FAILED */}
      {stage === 'failed' && (
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <div className="text-6xl">💀</div>
          <h2 className="text-2xl font-bold text-[var(--hero-red)]">挑戰失敗！</h2>
          <p className="text-zinc-300">答錯 {MAX_LIVES} 次，這次完成了 <span className="text-2xl font-bold text-[var(--hero-gold)]">{score}</span> 句！</p>
          <button type="button" onClick={startGame} className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]">再試一次</button>
        </div>
      )}

      {/* FINISHED */}
      {stage === 'finished' && (
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <div className="animate-bounce text-6xl">⏰</div>
          <h2 className="text-2xl font-bold text-[var(--hero-gold)]">時間到！</h2>
          <p className="text-zinc-300">這次完成了 <span className="text-3xl font-bold text-[var(--hero-gold)]">{score}</span> 句！</p>
          <button type="button" onClick={startGame} className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]">再玩一次</button>
        </div>
      )}
    </div>
  );
}
