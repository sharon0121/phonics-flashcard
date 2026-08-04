'use client';

import { useEffect } from 'react';
import { startSync } from '@/lib/sync';

// Renders nothing — just kicks off cross-device progress sync once when
// the app first loads.
export default function SyncBoot() {
  useEffect(() => {
    startSync();
  }, []);
  return null;
}
