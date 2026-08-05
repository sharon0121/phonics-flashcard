'use client';

import dynamic from 'next/dynamic';

const KlotskiSettingsView = dynamic(() => import('./KlotskiSettingsView'), { ssr: false });

export default function KlotskiSettingsPage() {
  return <KlotskiSettingsView />;
}
