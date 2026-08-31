'use client';

import { useEffect } from 'react';

// Renders nothing — just registers the offline-cache service worker once
// when the app first loads, which is what makes the site installable
// ("Add to Home Screen" becomes a real app icon + splash + standalone
// window instead of a plain browser bookmark).
export default function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
