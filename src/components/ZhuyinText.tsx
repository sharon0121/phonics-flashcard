interface ZhuyinTextProps {
  zh: string;
  zhuyin: string;
  className?: string;
  vertical?: boolean;
}

const TONE_MARKS = ['ˊ', 'ˇ', 'ˋ', '˙'];

function splitReading(reading: string): { base: string; tone: string } {
  const lastChar = reading.slice(-1);
  if (TONE_MARKS.includes(lastChar)) {
    return { base: reading.slice(0, -1), tone: lastChar };
  }
  return { base: reading, tone: '' };
}

// Renders each Chinese character with its zhuyin reading stacked vertically
// to its right (bopomofo symbols in one column, the tone mark beside them
// to the right rather than stacked underneath), matching how it's printed
// in Taiwan textbooks.
export default function ZhuyinText({ zh, zhuyin, className = '', vertical = false }: ZhuyinTextProps) {
  const chars = Array.from(zh);
  const readings = zhuyin.split(' ');

  return (
    <span className={`zhuyin-word ${className}`} style={vertical ? { flexDirection: 'column' } : undefined}>
      {chars.map((char, i) => {
        const { base, tone } = splitReading(readings[i] ?? '');
        return (
          <span key={i} className="zhuyin-char">
            <span>{char}</span>
            <span className="zhuyin-mark-wrap">
              <span className="zhuyin-base">{base}</span>
              {tone && <span className="zhuyin-tone">{tone}</span>}
            </span>
          </span>
        );
      })}
    </span>
  );
}
