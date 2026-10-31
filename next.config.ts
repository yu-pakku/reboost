import type { NextConfig } from 'next';
const config: NextConfig = {
  reactStrictMode: true, poweredByHeader: false,
  async headers() { return [
    { source: '/sw.js', headers: [{ key: 'Content-Type', value: 'application/javascript; charset=utf-8' }, { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }, { key: 'X-Content-Type-Options', value: 'nosniff' }] },
    { source: '/pwa-assets.json', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    { source: '/manifest.webmanifest', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
  ]; },
};
export default config;
