'use client';

import dynamic from 'next/dynamic';

const HanziView = dynamic(() => import('./HanziView'), { ssr: false });

export default function HanziPage() {
  return <HanziView />;
}
