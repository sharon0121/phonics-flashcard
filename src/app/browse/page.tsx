import { Suspense } from 'react';
import BrowseView from './BrowseView';

export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseView />
    </Suspense>
  );
}
