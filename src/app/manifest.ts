import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { id: '/', name: 'ReBoost', short_name: 'ReBoost', description: '思い出すを、日常に。端末内に知識を保存する学習アプリ。', lang: 'ja', start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#ffffff', icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ] };
}
