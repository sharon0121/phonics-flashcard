'use client';

import dynamic from 'next/dynamic';

const SmartGridView = dynamic(() => import('./SmartGridView'), { ssr: false });

export default function SmartGridPage() {
  return <SmartGridView />;
}
