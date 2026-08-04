'use client';

import { useEffect, useRef, useState } from 'react';
import { playErrorSound } from '@/lib/sound';
import ZhuyinText from '@/components/ZhuyinText';

interface Tile {
  id: number;
  letter: string;
}

interface HeroClimbSpellPhaseProps {
  word: string; // already uppercase
  zh: string;
  zhuyin: string;
  emoji: string;
  speechRate: number;
  onSolved: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function speak(text: string, rate: number) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

// Shown once all of a word's letters are collected on the ladder — the
// fall itself already revealed which letter goes where, so this is where
// the actual "can you spell it" challenge lives: letters are reshuffled
// and the child has to place them from memory/by ear, same interaction as
// the word-vault maze game's spelling step.
export default function HeroClimbSpellPhase({ word, zh, zhuyin, emoji, speechRate, onSolved }: HeroClimbSpellPhaseProps) {
  const [pool, setPool] = useState<Tile[]>(() =>
    shuffle(word.split('').map((letter, id) => ({ id, letter }))),
  );
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [feedback, setFeedback] = useState<'idle' | 'wrong'>('idle');
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => speak(word, speechRate), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeTile(tile: Tile) {
    if (solved || placed.length >= word.length) return;
    setPool((p) => p.filter((t) => t.id !== tile.id));
    setPlaced((p) => [...p, tile]);
  }

  function removeTile(index: number) {
    if (solved) return;
    const tile = placed[index];
    setPlaced((p) => p.filter((_, i) => i !== index));
    setPool((p) => [...p, tile]);
  }

  function confirm() {
    if (placed.length !== word.length) return;
    const attempt = placed.map((t) => t.letter).join('');
    if (attempt === word) {
      setSolved(true);
      if (!solvedRef.current) {
        solvedRef.current = true;
        setTimeout(onSolved, 900);
      }
      return;
    }
    playErrorSound();
    setFeedback('wrong');
    setTimeout(() => {
      setFeedback('idle');
      setPool((p) => shuffle([...p, ...placed]));
      setPlaced([]);
    }, 700);
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 p-4 text-center">
      <p className="text-base font-bold text-[var(--hero-gold)]">🔤 聽發音，拼出單字！</p>

      <div className="flex items-center gap-2">
        <span className="text-4xl">{emoji}</span>
        <ZhuyinText zh={zh} zhuyin={zhuyin} className="text-lg font-bold text-white" />
      </div>

      <div
        className={`flex gap-1.5 rounded-xl border-2 border-dashed p-2 transition-colors ${
          feedback === 'wrong' ? 'border-red-400 bg-red-50' : 'border-zinc-300 bg-white/10'
        }`}
      >
        {Array.from({ length: word.length }, (_, i) => {
          const tile = placed[i];
          return (
            <button
              key={i}
              type="button"
              disabled={!tile}
              onClick={() => removeTile(i)}
              className={`flex h-11 w-11 items-center justify-center rounded-lg text-xl font-extrabold shadow ${
                tile ? 'bg-[var(--hero-gold)] text-zinc-900' : 'bg-white/20 text-transparent'
              }`}
            >
              {tile ? tile.letter : '_'}
            </button>
          );
        })}
      </div>

      {feedback === 'wrong' && <div className="text-xl font-bold text-[var(--hero-red)]">再試一次！</div>}
      {solved && <div className="text-xl font-bold text-emerald-400">✔️ 拼對了！</div>}

      <div className="flex flex-wrap justify-center gap-1.5">
        {pool.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => placeTile(tile)}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-xl font-extrabold text-zinc-900 shadow hover:bg-zinc-100"
          >
            {tile.letter}
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => speak(word, speechRate)}
          className="rounded-full bg-white/10 p-2.5 text-xl hover:bg-white/20"
          aria-label="再聽一次發音"
        >
          🔊
        </button>
        <button
          type="button"
          disabled={placed.length !== word.length || solved}
          onClick={confirm}
          className="rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          確認
        </button>
      </div>
    </div>
  );
}
