'use client';

import dynamic from 'next/dynamic';

const WordGridSettingsView = dynamic(() => import('./WordGridSettingsView'), { ssr: false });

export default function WordGridSettingsPage() {
  return <WordGridSettingsView />;
}
