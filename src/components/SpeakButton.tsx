'use client';

interface SpeakButtonProps {
  text: string;
  className?: string;
}

export default function SpeakButton({ text, className = '' }: SpeakButtonProps) {
  function handleSpeak(e: React.MouseEvent) {
    e.stopPropagation();
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={handleSpeak}
      aria-label={`朗讀 ${text}`}
      className={`inline-flex items-center justify-center rounded-full bg-zinc-100 p-2 text-xl transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 ${className}`}
    >
      🔊
    </button>
  );
}
