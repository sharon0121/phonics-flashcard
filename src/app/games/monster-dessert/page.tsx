'use client';

import dynamic from 'next/dynamic';

const MonsterDessertView = dynamic(() => import('./MonsterDessertView'), { ssr: false });

export default function MonsterDessertPage() {
  return <MonsterDessertView />;
}
