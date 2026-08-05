'use client';

import { useEffect, useRef, useState } from 'react';
import type { MazeWord } from '@/data/wordMazeWords';
import { shuffle } from '@/lib/wordMaze';
import { playErrorSound } from '@/lib/sound';
import { recordWordCompletion } from '@/lib/wordVaultHistory';
import ScoreCelebration from '@/components/ScoreCelebration';

interface Tile {
  id: number;
  letter: string;
}

interface PuzzlePhaseProps {
  word: MazeWord;
  collectedLetters: string[];
  onReplaySame: () => void;
  onNext: () => void;
}

const HINT_IDLE_MS = 12000;

function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

function speakZh(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

export default function PuzzlePhase({ word, collectedLetters, onReplaySame, onNext }: PuzzlePhaseProps) {
  const [pool, setPool] = useState<Tile[]>(() =>
    shuffle(collectedLetters.map((letter, id) => ({ id, letter }))),
  );
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [hintStage, setHintStage] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'wrong'>('idle');
  const [solved, setSolved] = useState(false);
  const [pulseHint, setPulseHint] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function resetIdleTimer() {
    setPulseHint(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setPulseHint(true), HINT_IDLE_MS);
  }

  useEffect(() => {
    const startTimer = setTimeout(resetIdleTimer, 0);
    return () => {
      clearTimeout(startTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  function placeTile(tile: Tile) {
    if (solved || placed.length >= word.word.length) return;
    resetIdleTimer();
    setPool((p) => p.filter((t) => t.id !== tile.id));
    setPlaced((p) => [...p, tile]);
  }

  function removeTile(index: number) {
    if (solved) return;
    if (hintStage >= 3 && index === 0) return;
    resetIdleTimer();
    const tile = placed[index];
    setPlaced((p) => p.filter((_, i) => i !== index));
    setPool((p) => [...p, tile]);
  }

  function useHint() {
    if (hintStage >= 3) return;
    const next = hintStage + 1;
    setHintStage(next);
    resetIdleTimer();
    if (next === 2) speak(word.word);
    if (next === 3) {
      const firstLetter = word.word[0];
      const combined = [...pool, ...placed];
      const idx = combined.findIndex((t) => t.letter === firstLetter);
      if (idx >= 0) {
        const tile = combined[idx];
        setPool(combined.filter((_, i) => i !== idx));
        setPlaced([tile]);
      }
    }
  }

  function confirm() {
    if (placed.length !== word.word.length) return;
    const attempt = placed.map((t) => t.letter).join('');
    if (attempt === word.word) {
      setSolved(true);
      speak(word.word);
      setTimeout(() => speakZh(word.zh), 700);
      const finalStars = hintStage === 0 ? 3 : hintStage <= 2 ? 2 : 1;
      recordWordCompletion(word.word, word.zh, word.emoji, finalStars, Date.now());
      return;
    }
    playErrorSound();
    setFeedback('wrong');
    const lockedTile = hintStage >= 3 ? placed[0] : null;
    const toReturn = hintStage >= 3 ? placed.slice(1) : placed;
    setTimeout(() => {
      setFeedback('idle');
      setPool((p) => shuffle([...p, ...toReturn]));
      setPlaced(lockedTile ? [lockedTile] : []);
    }, 700);
  }

  const stars = hintStage === 0 ? 3 : hintStage <= 2 ? 2 : 1;

  if (solved) {
    return (
      <div className="flex flex-col items-center">
        <ScoreCelebration score={1} total={1} perfectMessage={hintStage === 0 ? 'Brain Master!' : 'Great Job!'} />
        <div className="mt-3 text-3xl">
          {'⭐'.repeat(stars)}
          {'☆'.repeat(3 - stars)}
        </div>
        <p className="mt-2 text-xl font-bold text-white">{word.word}</p>
        <p className="text-sm text-zinc-300">
          {word.zh} {word.emoji}
        </p>
        {hintStage === 0 && (
          <p className="mt-2 text-sm font-bold text-[var(--hero-gold)]">
            🎉 沒看提示就答對！獲得額外水晶！💎💎💎
          </p>
        )}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onReplaySame}
            className="rounded-lg bg-zinc-100 px-5 py-3 text-base font-bold text-zinc-900 hover:bg-zinc-200"
          >
            再玩一次 Try again
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg bg-[var(--hero-red)] px-5 py-3 text-base font-bold text-white hover:bg-[var(--hero-red-dark)]"
          >
            繼續下一關 Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-zinc-300">把字母拼成正確的單字！</p>

      <div
        className={`mt-4 flex gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
          feedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/50'
        }`}
      >
        {Array.from({ length: word.word.length }, (_, i) => {
          const tile = placed[i];
          const locked = hintStage >= 3 && i === 0;
          return (
            <button
              key={i}
              type="button"
              disabled={!tile || locked}
              onClick={() => removeTile(i)}
              className={`flex h-14 w-14 items-center justify-center rounded-lg text-2xl font-extrabold shadow ${
                tile ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-white/20 text-transparent'
              }`}
            >
              {tile ? tile.letter : '_'}
            </button>
          );
        })}
      </div>

      {feedback === 'wrong' && (
        <div className="mt-2 flex flex-col items-center gap-2">
          <div className="animate-bounce text-5xl">💪</div>
          <div className="text-2xl font-bold text-[var(--hero-red)]">Try again!</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => placeTile(tile)}
            className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-2xl font-extrabold text-zinc-900 shadow hover:bg-zinc-100"
          >
            {tile.letter}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={useHint}
          disabled={hintStage >= 3}
          aria-label="求助提示"
          className={`rounded-full p-3 text-2xl shadow disabled:cursor-not-allowed disabled:opacity-50 ${
            pulseHint ? 'animate-pulse bg-yellow-300' : 'bg-white'
          }`}
        >
          💡
        </button>
        <button
          type="button"
          disabled={placed.length !== word.word.length}
          onClick={confirm}
          className="rounded-lg bg-[var(--hero-red)] px-6 py-3 text-lg font-bold text-white hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          確認
        </button>
      </div>

      {hintStage >= 1 && <div className="mt-4 text-6xl">{word.emoji}</div>}
      {hintStage >= 2 && (
        <button
          type="button"
          onClick={() => speak(word.word)}
          className="mt-2 text-sm font-medium text-zinc-300 hover:underline"
        >
          🔊 再聽一次發音
        </button>
      )}
    </div>
  );
}
