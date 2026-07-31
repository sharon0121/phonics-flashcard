'use client';

import dynamic from 'next/dynamic';

const AngryCowSettingsView = dynamic(() => import('./AngryCowSettingsView'), { ssr: false });

export default function AngryCowSettingsPage() {
  return <AngryCowSettingsView />;
}
