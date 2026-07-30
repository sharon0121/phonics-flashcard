'use client';

import dynamic from 'next/dynamic';

const HeroClimbView = dynamic(() => import('./HeroClimbView'), { ssr: false });

export default function HeroClimbPage() {
  return <HeroClimbView />;
}
