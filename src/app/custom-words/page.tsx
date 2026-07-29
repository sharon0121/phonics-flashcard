import { Suspense } from 'react';
import CustomWordsView from './CustomWordsView';

export default function CustomWordsPage() {
  return (
    <Suspense>
      <CustomWordsView />
    </Suspense>
  );
}
