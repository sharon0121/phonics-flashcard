'use client';

import dynamic from 'next/dynamic';

const AngryCowView = dynamic(() => import('./AngryCowView'), { ssr: false });

export default function AngryCowPage() {
  return <AngryCowView />;
}
