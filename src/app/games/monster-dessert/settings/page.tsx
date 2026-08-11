'use client';

import dynamic from 'next/dynamic';

const MonsterDessertSettingsView = dynamic(() => import('./MonsterDessertSettingsView'), { ssr: false });

export default function MonsterDessertSettingsPage() {
  return <MonsterDessertSettingsView />;
}
