'use client';

import dynamic from 'next/dynamic';

const DetectiveVennView = dynamic(() => import('./DetectiveVennView'), { ssr: false });

export default function DetectiveVennPage() {
  return <DetectiveVennView />;
}
