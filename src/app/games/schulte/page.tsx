'use client';

import dynamic from 'next/dynamic';

const SchulteView = dynamic(() => import('./SchulteView'), { ssr: false });

export default function SchultePage() {
  return <SchulteView />;
}
