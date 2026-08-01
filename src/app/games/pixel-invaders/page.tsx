'use client';

import dynamic from 'next/dynamic';

const PixelInvadersView = dynamic(() => import('./PixelInvadersView'), { ssr: false });

export default function Page() {
  return <PixelInvadersView />;
}
