import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PwaProvider, PwaStatus } from './pwa-provider';
let online: boolean;
let worker: EventTarget & { postMessage: ReturnType<typeof vi.fn> };
let registration: EventTarget & { waiting?: typeof worker; installing?: typeof worker; update: ReturnType<typeof vi.fn> };
let serviceWorker: EventTarget & { controller: typeof worker; ready: Promise<typeof registration>; register: ReturnType<typeof vi.fn> };
class Channel {
  port1 = { onmessage: undefined as ((event: { data: { ready: boolean } }) => void) | undefined, close: () => {} };
  port2 = { send: () => this.port1.onmessage?.({ data: { ready: true } }) };
}
beforeEach(() => {
  online = true;
  worker = Object.assign(new EventTarget(), { postMessage: vi.fn((_message, ports?: { send: () => void }[]) => ports?.[0].send()) });
  registration = Object.assign(new EventTarget(), { waiting: worker, update: vi.fn(async () => {}) });
  serviceWorker = Object.assign(new EventTarget(), { controller: worker, ready: Promise.resolve(registration), register: vi.fn(async () => registration) });
  vi.stubEnv('NODE_ENV', 'production'); vi.stubGlobal('isSecureContext', true); vi.stubGlobal('MessageChannel', Channel);
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online }); Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: serviceWorker });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); document.querySelector('meta[name="reboost-offline-shell"]')?.remove(); Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true }); Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined }); });
it('登録を静かに行い、更新は入力を保持して利用者操作まで待つ', async () => {
  render(<PwaProvider><PwaStatus/><input aria-label="入力中" defaultValue="残す回答"/></PwaProvider>);
  await screen.findByRole('button', { name: '保存後に更新する' });
  expect(screen.queryByText('オフライン利用の準備ができています。')).not.toBeInTheDocument(); expect(serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  expect(worker.postMessage.mock.calls.some(call => call[0].type === 'APPLY_UPDATE')).toBe(false); expect(screen.getByLabelText('入力中')).toHaveValue('残す回答'); fireEvent.click(screen.getByRole('button', { name: '保存後に更新する' })); expect(worker.postMessage).toHaveBeenCalledWith({ type: 'APPLY_UPDATE' });
});
it('ネットワーク切断・復帰とサーバー到達不能の保存画面を案内する', async () => {
  registration.waiting = undefined;
  const meta = document.createElement('meta'); meta.name = 'reboost-offline-shell'; document.head.append(meta);
  render(<PwaProvider><PwaStatus/></PwaProvider>); expect(await screen.findByText('接続できないため、保存済みの画面を使っています。')).toBeInTheDocument();
  online = false; fireEvent(window, new Event('offline')); expect(screen.getByText('オフライン：この端末に保存した知識を利用できます。')).toBeInTheDocument();
  meta.remove(); online = true; fireEvent(window, new Event('online')); await waitFor(() => expect(screen.queryByLabelText('接続とアプリの状態')).not.toBeInTheDocument());
});
