'use client';

import dynamic from 'next/dynamic';

const SchulteSettingsView = dynamic(() => import('./SchulteSettingsView'), { ssr: false });

export default function SchulteSettingsPage() {
  return <SchulteSettingsView />;
}
