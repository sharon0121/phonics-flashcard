'use client';

import dynamic from 'next/dynamic';

const SpaceRacerView = dynamic(() => import('./SpaceRacerView'), { ssr: false });

export default function SpaceRacerPage() {
  return <SpaceRacerView />;
}
