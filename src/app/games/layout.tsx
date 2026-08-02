import type { ReactNode } from 'react';

export default function GamesLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="select-none"
      style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
