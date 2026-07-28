'use client';

interface NumberKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function NumberKeypad({ onDigit, onBackspace, onClear, disabled = false }: NumberKeypadProps) {
  const keyClass =
    'flex h-10 w-10 items-center justify-center rounded-lg bg-white text-base font-bold text-zinc-900 shadow transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50';
  const actionKeyClass =
    'flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-200 text-[10px] font-bold text-zinc-700 shadow transition-colors hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50';

  function digitKey(d: string) {
    return (
      <button key={d} type="button" disabled={disabled} onClick={() => onDigit(d)} className={keyClass}>
        {d}
      </button>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {digitKey('7')}
      {digitKey('8')}
      {digitKey('9')}
      <button type="button" disabled={disabled} onClick={onClear} className={actionKeyClass}>
        清除
      </button>

      {digitKey('4')}
      {digitKey('5')}
      {digitKey('6')}
      {digitKey('0')}

      {digitKey('1')}
      {digitKey('2')}
      {digitKey('3')}
      <button type="button" disabled={disabled} onClick={onBackspace} className={`${actionKeyClass} text-sm`}>
        ⌫
      </button>
    </div>
  );
}
