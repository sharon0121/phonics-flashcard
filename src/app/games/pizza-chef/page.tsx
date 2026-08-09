'use client';
import dynamic from 'next/dynamic';

const PizzaChefView = dynamic(() => import('./PizzaChefView'), { ssr: false });

export default function PizzaChefPage() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <PizzaChefView />
    </div>
  );
}
