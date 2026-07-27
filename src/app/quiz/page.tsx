'use client';

import dynamic from 'next/dynamic';

const QuizView = dynamic(() => import('./QuizView'), { ssr: false });

export default function QuizPage() {
  return <QuizView />;
}
