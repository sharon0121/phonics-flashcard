'use client';

import dynamic from 'next/dynamic';

const WordGridView = dynamic(() => import('./WordGridView'), { ssr: false });

export default function WordGridPage() {
  return <WordGridView />;
}
