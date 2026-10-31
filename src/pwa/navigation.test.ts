import { describe, expect, it, vi } from 'vitest';
import { isAppRoute, offlineTarget, replaceAppRoute } from './navigation';
import manifest from '@/app/manifest';
describe('PWAのルートとメタデータ', () => {
  it('ReBoostのstandalone manifestと192/512アイコンを定義する', () => {
    const value = manifest(); expect(value).toMatchObject({ name: 'ReBoost', short_name: 'ReBoost', start_url: '/', scope: '/', display: 'standalone', theme_color: '#ffffff', background_color: '#ffffff' }); expect(value.icons?.map(icon => icon.sizes)).toContain('192x192'); expect(value.icons?.map(icon => icon.sizes)).toContain('512x512');
  });
  it('アプリのパスだけをオフライン画面として選択し、外部URLや未知のパスは採用しない', () => {
    const id = '48dd520f-dff2-40c5-ab92-2b8b234aeecc';
    expect(offlineTarget(`https://app.test/offline?route=${encodeURIComponent('/test/' + id)}`)).toBe('/test/' + id); expect(isAppRoute('/knowledge/' + id + '/edit')).toBe(true);
    expect(offlineTarget('https://app.test/offline?route=https://evil.test')).toBe('/'); expect(isAppRoute('/api/data')).toBe(false);
  });
  it('オンラインでの保存後遷移は既存Next.js routerを維持する', () => { const router = { replace: vi.fn() }; replaceAppRoute(router, '/knowledge'); expect(router.replace).toHaveBeenCalledWith('/knowledge'); });
});
