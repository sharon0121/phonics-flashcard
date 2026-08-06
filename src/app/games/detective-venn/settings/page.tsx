'use client';

import dynamic from 'next/dynamic';

const DetectiveVennSettingsView = dynamic(() => import('./DetectiveVennSettingsView'), { ssr: false });

export default function DetectiveVennSettingsPage() {
  return <DetectiveVennSettingsView />;
}
