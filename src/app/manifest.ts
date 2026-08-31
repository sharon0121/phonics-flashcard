import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '英雄學習平台',
    short_name: '英雄平台',
    description: '小朋友的英語自然發音字卡、數學與小遊戲學習平台',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1130',
    theme_color: '#0b1130',
    lang: 'zh-Hant',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
