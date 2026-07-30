'use client';

import dynamic from 'next/dynamic';

const HeroClimbSettingsView = dynamic(() => import('./HeroClimbSettingsView'), { ssr: false });

export default function HeroClimbSettingsPage() {
  return <HeroClimbSettingsView />;
}
