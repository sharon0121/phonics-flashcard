'use client';

import dynamic from 'next/dynamic';

const KlotskiView = dynamic(() => import('./KlotskiView'), { ssr: false });

export default function KlotskiPage() {
  return <KlotskiView />;
}
