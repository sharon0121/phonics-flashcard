'use client';

import dynamic from 'next/dynamic';

const HanziSettingsView = dynamic(() => import('../HanziSettingsView'), { ssr: false });

export default function HanziSettingsPage() {
  return <HanziSettingsView />;
}
