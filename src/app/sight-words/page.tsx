import { Suspense } from 'react';
import SightWordsView from './SightWordsView';

export default function SightWordsPage() {
  return (
    <Suspense fallback={null}>
      <SightWordsView />
    </Suspense>
  );
}
