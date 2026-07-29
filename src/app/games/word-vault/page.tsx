'use client';

import dynamic from 'next/dynamic';

const WordVaultView = dynamic(() => import('./WordVaultView'), { ssr: false });

export default function WordVaultPage() {
  return <WordVaultView />;
}
