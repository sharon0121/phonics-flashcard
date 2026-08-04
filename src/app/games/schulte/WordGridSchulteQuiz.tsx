'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ZhuyinText from '@/components/ZhuyinText';
import type { Word } from '@/lib/types';
import { useWordGridPools, useWordGridSpeechRate, SPEECH_RATE_VALUES } from '@/lib/wordGridSettings';
import { useSchulteTimeLimit } from '@/lib/schulteSettings';
import {
  useSchulteLeaderboard,
  useLastSchultePlayerName,
  setLastSchultePlayerName,
  qualifiesForSchulteLeaderboard,
  addToSchulteLeaderboard,
} from '@/lib/schulteHistory';
import { playCollectSound, playErrorSound, playCelebrationChime } from '@/lib/sound';

const MAX_WRONG = 3;
const MAX_CHOICES = 9;
const CATEGORY_KEY = 'wordGrid';

type Stage = 'idle' | 'playing' | 'success' | 'failed';

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

interface Round {
  correct: Word;
  choices: Word[];
}

function makeRound(remaining: Word[], allWords: Word[]): Round | null {
  if (remaining.length === 0) return null;
  const correct = remaining[Math.floor(Math.random() * remaining.length)];
  const distractorSrc = allWords.filter((w) => w.id !== correct.id);
  const numChoices = Math.min(MAX_CHOICES, distractorSrc.length + 1);
  const distractors = shuffle(distractorSrc).slice(0, numChoices - 1);
  return { correct, choices: shuffle([correct, ...distractors]) };
}

function formatTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

interface Props {
  onBack: () => void;
}

export default function WordGridSchulteQuiz({ onBack }: Props) {
  const pools = useWordGridPools();
  const speechRate = useWordGridSpeechRate();
  const rate = SPEECH_RATE_VALUES[speechRate];
  const timeLimitSec = useSchulteTimeLimit();
  const leaderboard = useSchulteLeaderboard(CATEGORY_KEY, CATEGORY_KEY);
  const lastPlayerName = useLastSchultePlayerName();
  const allWords = pools.flat();

  const [stage, setStage] = useState<Stage>('idle');
  const [remaining, setRemaining] = useState<Word[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const [finalMs, setFinalMs] = useState(0);
  const [nameInput, setNameInput] = useState(lastPlayerName);
  const [saved, setSaved] = useState(false);

  const startTimeRef = useRef(0);
  const stageRef = useRef<Stage>('idle');
  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    if (stage !== 'playing') return;
    const id = setInterval(() => {
      const elapsed = performance.now() - startTimeRef.current;
      const remainingMs = timeLimitSec * 1000 - elapsed;
      setDisplayMs(Math.max(0, remainingMs));
      if (remainingMs <= 0) setStage('failed');
    }, 100);
    return () => clearInterval(id);
  }, [stage, timeLimitSec]);

  // Speak the target word whenever a fresh round is ready to answer.
  useEffect(() => {
    if (stage === 'playing' && round && !justSolved) {
      const t = setTimeout(() => speak(round.correct.word, rate), 200);
      return () => clearTimeout(t);
    }
  }, [stage, round, justSolved, rate]);

  function startGame() {
    const fresh = shuffle(allWords);
    setRemaining(fresh);
    setRound(makeRound(fresh, allWords));
    setWrongCount(0);
    setJustSolved(false);
    setSaved(false);
    startTimeRef.current = performance.now();
    setDisplayMs(timeLimitSec * 1000);
    setStage('playing');
  }

  function handleTap(choice: Word) {
    if (stageRef.current !== 'playing' || !round || justSolved) return;
    if (choice.id === round.correct.id) {
      playCollectSound();
      setJustSolved(true);
      const nextRemaining = remaining.filter((w) => w.id !== choice.id);
      setRemaining(nextRemaining);
      setTimeout(() => {
        if (nextRemaining.length === 0) {
          const elapsed = performance.now() - startTimeRef.current;
          setFinalMs(elapsed);
          playCelebrationChime();
          setStage('success');
        } else {
          setRound(makeRound(nextRemaining, allWords));
          setJustSolved(false);
        }
      }, 800);
    } else {
      playErrorSound();
      setWrongId(choice.id);
      setTimeout(() => setWrongId(null), 400);
      const nextWrong = wrongCount + 1;
      setWrongCount(nextWrong);
      if (nextWrong >= MAX_WRONG) setStage('failed');
    }
  }

  function handleSaveRecord() {
    setLastSchultePlayerName(nameInput);
    addToSchulteLeaderboard(nameInput, finalMs, CATEGORY_KEY, CATEGORY_KEY, Date.now());
    setSaved(true);
  }

  const qualifies = stage === 'success' && qualifiesForSchulteLeaderboard(finalMs, CATEGORY_KEY, CATEGORY_KEY);
  const tooFewWords = allWords.length < 2;

  return (
    <div className="relative flex-1 rounded-xl border-2 border-[var(--hero-gold)] bg-gradient-to-br from-[#0a0118] via-[#12042a] to-[#01030f] p-4">
      <div className="flex w-full items-center justify-between">
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
        <span className="text-sm font-bold text-[var(--hero-gold)]">🔤 單字複習</span>
        <Link
          href="/games/word-grid/settings"
          aria-label="題目來源設定"
          className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--hero-gold)] bg-white/10 text-lg hover:bg-white/20"
        >
          ⚙️
        </Link>
      </div>

      {tooFewWords ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-6 text-center">
          <span className="text-5xl">📚</span>
          <p className="text-zinc-900">目前選擇的題目來源單字太少，請到設定調整題目來源。</p>
          <Link
            href="/games/word-grid/settings"
            className="mt-2 rounded-lg bg-[var(--hero-red)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--hero-red-dark)]"
          >
            前往設定
          </Link>
        </div>
      ) : stage === 'idle' ? (
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-zinc-300">
            聽發音點出正確的單字，全部 {allWords.length} 個單字都答對才算過關；答錯 {MAX_WRONG} 次或時間到就算失敗，請在{' '}
            {timeLimitSec} 秒內完成！
          </p>
          <button
            type="button"
            onClick={startGame}
            className="rounded-xl bg-[var(--hero-red)] px-8 py-4 text-xl font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            開始挑戰
          </button>
          {leaderboard.length > 0 && (
            <div className="mt-2 w-full max-w-xs rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-3">
              <p className="text-center text-sm font-bold text-zinc-900">🏆 最佳紀錄</p>
              <div className="mt-1.5 flex flex-col gap-1">
                {leaderboard.slice(0, 5).map((r, i) => (
                  <div key={r.id} className="flex items-center justify-between text-xs text-zinc-700">
                    <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {r.name}</span>
                    <span className="font-bold tabular-nums">{formatTime(r.timeMs)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : stage === 'playing' && round ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="flex w-full max-w-md items-center justify-between text-sm font-bold text-white">
            <span>
              {'❤️'.repeat(Math.max(MAX_WRONG - wrongCount, 0))}
              {'🖤'.repeat(wrongCount)}
            </span>
            <span>剩 {remaining.length} 個</span>
            <span className={displayMs <= 10000 ? 'animate-pulse text-[var(--hero-red)]' : ''}>
              ⏱️ {formatTime(displayMs)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => speak(round.correct.word, rate)}
            className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
            aria-label="再聽一次"
          >
            🔊 再聽一次
          </button>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {round.choices.map((choice) => {
              const wrong = wrongId === choice.id;
              const solvedCorrect = justSolved && choice.id === round.correct.id;
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleTap(choice)}
                  disabled={justSolved}
                  className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-2 p-2 shadow transition-colors sm:p-3 ${
                    solvedCorrect
                      ? 'border-emerald-400 bg-emerald-100'
                      : wrong
                        ? 'animate-pulse border-red-400 bg-red-100'
                        : 'border-zinc-300 bg-white hover:bg-zinc-100'
                  }`}
                >
                  <span className="text-2xl sm:text-3xl">{choice.emoji}</span>
                  <span className="text-sm font-black tracking-wide text-zinc-900 uppercase sm:text-lg">
                    {choice.word}
                  </span>
                  <ZhuyinText zh={choice.zh} zhuyin={choice.zhuyin} className="text-[10px] font-bold text-zinc-600 sm:text-xs" />
                </button>
              );
            })}
          </div>
        </div>
      ) : stage === 'success' ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="animate-bounce text-6xl">🎉</div>
          <h2 className="text-2xl font-bold text-[var(--hero-gold)]">全部答對了！</h2>
          <p className="text-lg font-bold text-white">花費時間：{formatTime(finalMs)}</p>
          {qualifies && !saved && (
            <div className="mt-2 w-full max-w-xs rounded-xl border-2 border-[var(--hero-gold)] bg-white/95 p-4">
              <p className="text-center text-lg font-bold text-[var(--hero-red)]">🎉 進入最佳紀錄！</p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={10}
                placeholder="輸入名字上榜"
                className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              />
              <button
                type="button"
                onClick={handleSaveRecord}
                className="mt-2 w-full rounded-md bg-[var(--hero-gold)] px-3 py-2 text-sm font-bold text-zinc-900"
              >
                儲存紀錄
              </button>
            </div>
          )}
          {saved && <p className="text-sm font-bold text-emerald-400">✔️ 已上榜！</p>}
          <button
            type="button"
            onClick={startGame}
            className="mt-2 rounded-xl bg-[var(--hero-red)] px-6 py-3 text-base font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            再玩一次
          </button>
        </div>
      ) : stage === 'failed' ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="text-6xl">{wrongCount >= MAX_WRONG ? '💥' : '⏰'}</div>
          <h2 className="text-2xl font-bold text-[var(--hero-red)]">
            {wrongCount >= MAX_WRONG ? '答錯太多次了！' : '時間到！'}
          </h2>
          <p className="text-sm text-zinc-300">還差一點，再試一次看看！</p>
          <button
            type="button"
            onClick={startGame}
            className="mt-2 rounded-xl bg-[var(--hero-red)] px-6 py-3 text-base font-bold text-white shadow hover:bg-[var(--hero-red-dark)]"
          >
            再試一次
          </button>
        </div>
      ) : null}
    </div>
  );
}
