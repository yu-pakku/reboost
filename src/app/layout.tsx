import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaProvider } from '@/components/pwa-provider';
export const metadata: Metadata = { title: { default: 'ReBoost | 思い出すを、日常に。', template: '%s | ReBoost' }, description: '学んだ知識に、もう一度出会う。自分のペースで思い出す習慣を。', applicationName: 'ReBoost', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'ReBoost', statusBarStyle: 'default' }, icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }], apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }] } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#ffffff' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body><PwaProvider>{children}</PwaProvider></body></html>;
}
