import type { Word } from '@/lib/types';
import WordHighlight from './WordHighlight';
import ZhuyinText from './ZhuyinText';

interface PrintCardProps {
  word: Word;
  side: 'front' | 'back' | 'study';
  perPage: number;
  heightMm: number;
}

export default function PrintCard({ word, side, perPage, heightMm }: PrintCardProps) {
  const compact = perPage >= 8;
  const wordSize = compact ? 'text-xl' : perPage >= 6 ? 'text-2xl' : 'text-3xl';
  const kkSize = compact ? 'text-xs' : 'text-base';
  const enSize = compact ? 'text-[10px]' : 'text-sm';
  const sentenceSize = compact ? 'text-[9px]' : 'text-xs';
  const emojiSize = compact ? 'text-4xl' : perPage >= 6 ? 'text-5xl' : 'text-6xl';
  const zhSize = compact ? 'text-xl' : 'text-3xl';
  const studyEmojiSize = compact ? 'text-3xl' : perPage >= 6 ? 'text-4xl' : 'text-5xl';
  const studyZhSize = compact ? 'text-lg' : perPage >= 6 ? 'text-xl' : 'text-2xl';
  const style = { height: `${heightMm}mm` };

  if (side === 'front') {
    return (
      <div className={`print-card ${compact ? 'print-card-compact' : ''}`} style={style}>
        <div className={`${wordSize} font-bold`}>
          <WordHighlight word={word.word} highlight={word.highlight} />
        </div>
        <div className={`mt-1 ${kkSize} text-zinc-600`}>{word.kk}</div>
        <div className={`mt-1 px-3 text-center ${enSize} text-zinc-500`}>{word.en}</div>
        <div className={`mt-1 px-3 text-center ${sentenceSize} italic text-zinc-400`}>
          {word.sentence}
        </div>
      </div>
    );
  }

  if (side === 'back') {
    return (
      <div className={`print-card ${compact ? 'print-card-compact' : ''}`} style={style}>
        <div className={emojiSize}>{word.emoji}</div>
        <div className={`mt-1 ${zhSize} font-bold`}>
          <ZhuyinText zh={word.zh} zhuyin={word.zhuyin} />
        </div>
      </div>
    );
  }

  // study: emoji + English word + phonetics + Chinese — everything on one face
  return (
    <div className={`print-card ${compact ? 'print-card-compact' : ''}`} style={style}>
      <div className={studyEmojiSize}>{word.emoji}</div>
      <div className={`mt-1 ${wordSize} font-bold`}>
        <WordHighlight word={word.word} highlight={word.highlight} />
      </div>
      <div className={`mt-0.5 ${kkSize} text-zinc-600`}>{word.kk}</div>
      <div className={`mt-1 ${studyZhSize} font-bold text-red-600`}>
        <ZhuyinText zh={word.zh} zhuyin={word.zhuyin} />
      </div>
    </div>
  );
}
