'use client';

interface WordHighlightProps {
  word: string;
  highlight: string;
  className?: string;
}

// Renders a word with the phonics pattern highlighted in red + bold + underline.
// For Magic E patterns (a_e, i_e, o_e, u_e) both the vowel and final silent-e
// are highlighted; middle letters remain unstyled.
export default function WordHighlight({ word, highlight, className = '' }: WordHighlightProps) {
  const isMagicE = /^[aeiou]_e$/i.test(highlight);

  if (isMagicE) {
    const vowel = highlight[0].toLowerCase();
    const lower = word.toLowerCase();
    const vowelIdx = lower.indexOf(vowel);
    const eIdx = lower.lastIndexOf('e');

    if (vowelIdx === -1 || eIdx === -1 || vowelIdx === eIdx) {
      // Fallback: render plain
      return <span className={className}>{word}</span>;
    }

    const HL = 'text-red-500 font-bold underline';
    return (
      <span className={className}>
        {word.slice(0, vowelIdx)}
        <span className={HL}>{word[vowelIdx]}</span>
        {word.slice(vowelIdx + 1, eIdx)}
        <span className={HL}>{word[eIdx]}</span>
        {word.slice(eIdx + 1)}
      </span>
    );
  }

  // Regular highlight: find first occurrence (case-insensitive)
  const lower = word.toLowerCase();
  const pat = highlight.toLowerCase();
  const idx = lower.indexOf(pat);

  if (idx === -1) {
    return <span className={className}>{word}</span>;
  }

  const HL = 'text-red-500 font-bold underline';
  return (
    <span className={className}>
      {word.slice(0, idx)}
      <span className={HL}>{word.slice(idx, idx + pat.length)}</span>
      {word.slice(idx + pat.length)}
    </span>
  );
}
