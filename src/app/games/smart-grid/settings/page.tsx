'use client';

import dynamic from 'next/dynamic';

const SmartGridSettingsView = dynamic(() => import('./SmartGridSettingsView'), { ssr: false });

export default function SmartGridSettingsPage() {
  return <SmartGridSettingsView />;
}
