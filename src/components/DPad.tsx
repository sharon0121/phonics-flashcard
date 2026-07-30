'use client';

interface DPadProps {
  disabled?: boolean;
  onUp: () => void;
  onDown: () => void;
  onLeft: () => void;
  onRight: () => void;
}

const btnClass =
  'flex flex-col items-center justify-center rounded-xl bg-white font-bold text-zinc-900 shadow transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50';

export default function DPad({ disabled, onUp, onDown, onLeft, onRight }: DPadProps) {
  return (
    <div className="grid w-40 grid-cols-3 grid-rows-3 gap-2">
      <div />
      <button type="button" disabled={disabled} onClick={onUp} className={`${btnClass} h-12`}>
        <span className="text-lg">⬆️</span>
        <span className="text-[10px]">Up</span>
      </button>
      <div />
      <button type="button" disabled={disabled} onClick={onLeft} className={`${btnClass} h-12`}>
        <span className="text-lg">⬅️</span>
        <span className="text-[10px]">Left</span>
      </button>
      <div />
      <button type="button" disabled={disabled} onClick={onRight} className={`${btnClass} h-12`}>
        <span className="text-lg">➡️</span>
        <span className="text-[10px]">Right</span>
      </button>
      <div />
      <button type="button" disabled={disabled} onClick={onDown} className={`${btnClass} h-12`}>
        <span className="text-lg">⬇️</span>
        <span className="text-[10px]">Down</span>
      </button>
      <div />
    </div>
  );
}
