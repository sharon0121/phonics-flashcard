'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  GRID_COLS,
  GRID_ROWS,
  COLUMN_LABELS,
  formatCoordinate,
  samePosition,
  cellKey,
  buildWordMap,
  positionsByWordIndex,
  shuffle,
  type GridPosition,
} from '@/lib/coordinateHunt';
import { useAllSentences } from '@/lib/gameSentences';
import type { GameSentence } from '@/data/gameSentences';
import { playDingSound, playErrorSound } from '@/lib/sound';
import ScoreCelebration from '@/components/ScoreCelebration';
import HeroMascot from '@/components/HeroMascot';

const TOTAL_SENTENCES = 3;
const START_POSITION: GridPosition = { col: 1, row: 1 };

type Direction = 'north' | 'south' | 'left' | 'right';
type Stage = 'hunting' | 'assembling' | 'sentenceSuccess' | 'finished';

interface WordTile {
  wordIndex: number;
  text: string;
}

function pickRandomSentence(pool: GameSentence[]): GameSentence {
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CoordinateHuntView() {
  const allSentences = useAllSentences();

  const [sentencesDone, setSentencesDone] = useState(0);
  const [sentence, setSentence] = useState<GameSentence>(() => pickRandomSentence(allSentences));
  const [wordMap, setWordMap] = useState(() => buildWordMap(sentence.words.length));
  const [hintQueue, setHintQueue] = useState<number[]>(() =>
    shuffle(sentence.words.map((_, i) => i)),
  );
  const [player, setPlayer] = useState<GridPosition>(START_POSITION);
  const [dugCells, setDugCells] = useState<GridPosition[]>([]);
  const [foundWords, setFoundWords] = useState<WordTile[]>([]);
  const [justFound, setJustFound] = useState<string | null>(null);
  const [digMessage, setDigMessage] = useState<string | null>(null);
  const [assembled, setAssembled] = useState<WordTile[]>([]);
  const [assembleFeedback, setAssembleFeedback] = useState<'idle' | 'wrong'>('idle');
  const [stage, setStage] = useState<Stage>('hunting');

  function startSentence(next: GameSentence) {
    setSentence(next);
    setWordMap(buildWordMap(next.words.length));
    setHintQueue(shuffle(next.words.map((_, i) => i)));
    setPlayer(START_POSITION);
    setDugCells([]);
    setFoundWords([]);
    setJustFound(null);
    setDigMessage(null);
    setAssembled([]);
    setAssembleFeedback('idle');
    setStage('hunting');
  }

  const move = useCallback(
    (dir: Direction) => {
      if (stage !== 'hunting' || justFound) return;
      setPlayer((prev) => {
        let { col, row } = prev;
        if (dir === 'north') row = Math.max(0, row - 1);
        if (dir === 'south') row = Math.min(GRID_ROWS - 1, row + 1);
        if (dir === 'left') col = Math.max(0, col - 1);
        if (dir === 'right') col = Math.min(GRID_COLS - 1, col + 1);
        return { col, row };
      });
      setDigMessage(null);
    },
    [stage, justFound],
  );

  const handleDig = useCallback(() => {
    if (stage !== 'hunting' || justFound) return;
    if (dugCells.some((p) => samePosition(p, player))) {
      setDigMessage('這裡已經挖過了喔，換個地方試試看！');
      return;
    }
    setDugCells((prev) => [...prev, player]);
    const wordIndex = wordMap.get(cellKey(player));
    if (wordIndex !== undefined) {
      const word = sentence.words[wordIndex];
      playDingSound();
      const nextFound = [...foundWords, { wordIndex, text: word }];
      setFoundWords(nextFound);
      setHintQueue((prev) => prev.filter((i) => i !== wordIndex));
      setJustFound(word);
      setTimeout(() => {
        setJustFound(null);
        if (nextFound.length >= sentence.words.length) {
          setStage('assembling');
        }
      }, 700);
    } else {
      setDigMessage('這裡沒有寶藏，換個地方試試看！');
    }
  }, [stage, justFound, dugCells, player, wordMap, sentence, foundWords]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (stage !== 'hunting') return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        move('north');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        move('south');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        move('right');
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        handleDig();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    if (assembled.length !== sentence.words.length) return;
    const isCorrect = assembled.every((tile, i) => tile.wordIndex === i);
    if (isCorrect) {
      setStage('sentenceSuccess');
      setTimeout(() => {
        const nextDone = sentencesDone + 1;
        setSentencesDone(nextDone);
        if (nextDone >= TOTAL_SENTENCES) {
          setStage('finished');
        } else {
          startSentence(pickRandomSentence(allSentences));
        }
      }, 1600);
    } else {
      playErrorSound();
      setAssembleFeedback('wrong');
      setTimeout(() => {
        setAssembleFeedback('idle');
        setAssembled([]);
      }, 700);
    }
  }

  function startNewGame() {
    setSentencesDone(0);
    startSentence(pickRandomSentence(allSentences));
  }

  const dirButtonClass =
    'flex items-center justify-center rounded-xl bg-white text-sm font-bold text-zinc-900 shadow transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50';

  const placedIndices = new Set(assembled.map((t) => t.wordIndex));
  const pool = foundWords.filter((t) => !placedIndices.has(t.wordIndex));
  const posByIndex = positionsByWordIndex(wordMap);
  const hintPos = hintQueue.length > 0 ? posByIndex.get(hintQueue[0]) : undefined;

  return (
    <main className="relative mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <HeroMascot src="/heroes/cutout-game.png" alt="" />
      <div className="relative z-10">
      <div className="flex items-center justify-between">
        <Link href="/games" className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/20">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
        <Link href="/games/coordinate-hunt/settings" className="text-sm font-medium text-zinc-300 hover:underline">
          ⚙️ 句子管理
        </Link>
      </div>
      <h1 className="mt-2 text-2xl font-bold text-[var(--hero-gold)]">🗺️ 座標寶藏迷宮</h1>
      <p className="text-xs font-semibold tracking-wide text-zinc-400 uppercase">Coordinate Treasure Hunt</p>
      <p className="mt-1 text-sm text-zinc-300">挖出所有藏起來的單字，再把它們排成一句話！</p>

      {stage !== 'finished' && (
        <div className="mt-4 text-sm font-medium text-zinc-300">
          第 {sentencesDone + 1} / {TOTAL_SENTENCES} 句
        </div>
      )}

      {stage === 'hunting' && (
        <>
          <div className="mt-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4 text-center">
            <p className="text-sm font-bold text-zinc-900">
              已挖到 {foundWords.length} / {sentence.words.length} 個單字
            </p>
            {hintPos && (
              <p className="mt-1 text-lg font-bold text-[var(--hero-red)]">
                🔍 Go to {formatCoordinate(hintPos)}!
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {foundWords.length === 0 && <span className="text-xs text-zinc-400">還沒挖到任何單字</span>}
              {foundWords.map((tile, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[var(--hero-gold)] px-3 py-1 text-sm font-bold text-zinc-900"
                >
                  {tile.text}
                </span>
              ))}
            </div>
            <div className="mt-2 flex min-h-[1.75rem] items-center justify-center">
              {justFound && <p className="text-lg font-bold text-emerald-500">✨ 挖到了：{justFound}！</p>}
              {!justFound && digMessage && <p className="text-sm font-medium text-zinc-500">{digMessage}</p>}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-start justify-center gap-8">
            <div className="inline-block rounded-2xl border-[3px] border-zinc-900 bg-white p-4 shadow-md">
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `2.5rem repeat(${GRID_COLS}, 4.5rem)` }}
              >
                <div />
                {COLUMN_LABELS.map((label) => (
                  <div key={label} className="flex items-center justify-center text-base font-bold text-zinc-400">
                    {label}
                  </div>
                ))}
                {Array.from({ length: GRID_ROWS }, (_, row) => (
                  <Fragment key={row}>
                    <div className="flex items-center justify-center text-base font-bold text-zinc-400">
                      {row + 1}
                    </div>
                    {Array.from({ length: GRID_COLS }, (_, col) => {
                      const pos = { col, row };
                      const isPlayer = player.col === col && player.row === row;
                      const wasDug = dugCells.some((p) => samePosition(p, pos));
                      const hadWord = wasDug && wordMap.has(cellKey(pos));
                      return (
                        <div
                          key={col}
                          className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-lg border-2 text-3xl ${
                            isPlayer
                              ? 'border-[var(--hero-gold)] bg-yellow-50'
                              : wasDug
                                ? 'border-zinc-300 bg-zinc-100'
                                : 'border-zinc-200 bg-zinc-50'
                          }`}
                        >
                          {isPlayer ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src="/heroes/cutout-game.png"
                              alt="player"
                              className="h-full w-full animate-bounce object-contain drop-shadow-md"
                            />
                          ) : hadWord ? (
                            '✅'
                          ) : wasDug ? (
                            <span className="text-zinc-300">・</span>
                          ) : (
                            ''
                          )}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="grid w-40 grid-cols-3 grid-rows-3 gap-2">
                <div />
                <button
                  type="button"
                  disabled={stage !== 'hunting'}
                  onClick={() => move('north')}
                  className={`${dirButtonClass} h-12 flex-col`}
                >
                  <span className="text-lg">⬆️</span>North
                </button>
                <div />
                <button
                  type="button"
                  disabled={stage !== 'hunting'}
                  onClick={() => move('left')}
                  className={`${dirButtonClass} h-12 flex-col`}
                >
                  <span className="text-lg">⬅️</span>Left
                </button>
                <div />
                <button
                  type="button"
                  disabled={stage !== 'hunting'}
                  onClick={() => move('right')}
                  className={`${dirButtonClass} h-12 flex-col`}
                >
                  <span className="text-lg">➡️</span>Right
                </button>
                <div />
                <button
                  type="button"
                  disabled={stage !== 'hunting'}
                  onClick={() => move('south')}
                  className={`${dirButtonClass} h-12 flex-col`}
                >
                  <span className="text-lg">⬇️</span>South
                </button>
                <div />
              </div>

              <button
                type="button"
                disabled={stage !== 'hunting' || !!justFound}
                onClick={handleDig}
                className="w-full rounded-xl bg-[var(--hero-red)] py-3 text-lg font-bold text-white shadow hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                ⛏️ 挖寶
              </button>
              <p className="text-center text-xs text-zinc-400">
                目前位置：{formatCoordinate(player)}
              </p>
            </div>
          </div>
        </>
      )}

      {stage === 'assembling' && (
        <>
          <div className="mt-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4 text-center">
            <p className="text-sm text-zinc-500">請把單字排成正確的句子：</p>
            <p className="mt-1 text-lg font-bold text-zinc-900">{sentence.zh}</p>
          </div>

          <div
            className={`mt-4 flex min-h-16 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
              assembleFeedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
            }`}
          >
            {assembled.length === 0 && <span className="text-sm text-zinc-400">點下面的單字，排出句子</span>}
            {assembled.map((tile, i) => (
              <button
                key={i}
                type="button"
                onClick={() => removeTile(i)}
                className="rounded-lg bg-[var(--hero-gold)] px-3 py-2 text-lg font-bold text-zinc-900 shadow"
              >
                {tile.text}
              </button>
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
              <button
                key={tile.wordIndex}
                type="button"
                onClick={() => placeTile(tile)}
                className="rounded-lg bg-white px-3 py-2 text-lg font-bold text-zinc-900 shadow hover:bg-zinc-100"
              >
                {tile.text}
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              disabled={assembled.length !== sentence.words.length}
              onClick={confirmSentence}
              className="rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              確認
            </button>
          </div>
        </>
      )}

      {stage === 'sentenceSuccess' && (
        <>
          <ScoreCelebration score={1} total={1} perfectMessage="Great Job!" />
          <p className="mt-4 text-center text-xl font-bold text-white">{sentence.en}</p>
          <p className="mt-1 text-center text-sm text-zinc-300">{sentence.zh}</p>
        </>
      )}

      {stage === 'finished' && (
        <>
          <ScoreCelebration score={TOTAL_SENTENCES} total={TOTAL_SENTENCES} perfectMessage="Great Job!" />
          <div className="mt-4 text-center text-lg font-bold text-[var(--hero-gold)]">
            完成了 {TOTAL_SENTENCES} 句話！
          </div>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={startNewGame}
              className="rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)]"
            >
              再玩一次
            </button>
          </div>
        </>
      )}
      </div>
    </main>
  );
}
