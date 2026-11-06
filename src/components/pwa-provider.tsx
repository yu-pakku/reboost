'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { isAppRoute, usesOfflineShell } from '@/pwa/navigation';
type PwaState = { online: boolean; fallback: boolean; ready: boolean; error: boolean; waiting?: ServiceWorker; updating: boolean; applyUpdate: () => void };
const PwaContext = createContext<PwaState | undefined>(undefined);
export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker>();
  const [updating, setUpdating] = useState(false);
  const requestedUpdate = useRef(false);
  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined;
    let stopped = false;
    const cleanups: (() => void)[] = [];
    const connection = () => { setOnline(navigator.onLine); setFallback(usesOfflineShell()); if (navigator.onLine) void registration?.update().catch(() => {}); };
    const frame = requestAnimationFrame(connection);
    window.addEventListener('online', connection); window.addEventListener('offline', connection); window.addEventListener('focus', connection);
    const navigateOffline = (event: MouseEvent) => {
      if (navigator.onLine && !usesOfflineShell() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.download || anchor.target && anchor.target !== '_self') return;
      const url = new URL(anchor.href);
      if (url.origin !== location.origin || !isAppRoute(url.pathname) || url.hash && url.pathname === location.pathname) return;
      event.preventDefault(); window.location.assign(url.href);
    };
    document.addEventListener('click', navigateOffline, true);
    let focusTimer: number | undefined;
    const keepInputVisible = () => {
      const element = document.activeElement;
      clearTimeout(focusTimer);
      if (!window.visualViewport || window.visualViewport.height >= innerHeight * .85) return;
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element instanceof HTMLInputElement && !['radio', 'checkbox', 'file'].includes(element.type)) focusTimer = window.setTimeout(() => element.scrollIntoView({ block: 'center', behavior: 'auto' }), 100);
    };
    window.visualViewport?.addEventListener('resize', keepInputVisible);
    cleanups.push(() => { clearTimeout(focusTimer); window.visualViewport?.removeEventListener('resize', keepInputVisible); });
    document.addEventListener('focusin', keepInputVisible);
    async function checkCache() {
      const worker = navigator.serviceWorker.controller;
      if (!worker || stopped) return;
      const channel = new MessageChannel();
      const timer = setTimeout(() => channel.port1.close(), 5000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); if (!stopped) setReady(event.data?.ready === true); };
      cleanups.push(() => { clearTimeout(timer); channel.port1.close(); });
      worker.postMessage({ type: 'PWA_STATUS' }, [channel.port2]);
    }
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && window.isSecureContext) {
      const controlled = () => { if (requestedUpdate.current) location.reload(); else void checkCache(); };
      navigator.serviceWorker.addEventListener('controllerchange', controlled);
      cleanups.push(() => navigator.serviceWorker.removeEventListener('controllerchange', controlled));
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(reg => {
        if (stopped) return;
        registration = reg;
        if (reg.waiting) setWaiting(reg.waiting);
        const watch = () => {
          const worker = reg.installing;
          if (!worker) return;
          const changed = () => {
            if (stopped) return;
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
            if (worker.state === 'redundant') setError(true);
          };
          worker.addEventListener('statechange', changed); cleanups.push(() => worker.removeEventListener('statechange', changed));
        };
        reg.addEventListener('updatefound', watch); cleanups.push(() => reg.removeEventListener('updatefound', watch)); watch();
        void navigator.serviceWorker.ready.then(() => checkCache());
      }).catch(() => { if (!stopped) setError(true); });
    }
    return () => { stopped = true; cancelAnimationFrame(frame); window.removeEventListener('online', connection); window.removeEventListener('offline', connection); window.removeEventListener('focus', connection); document.removeEventListener('click', navigateOffline, true); document.removeEventListener('focusin', keepInputVisible); cleanups.forEach(fn => fn()); };
  }, []);
  function applyUpdate() { if (!waiting) return; requestedUpdate.current = true; setUpdating(true); waiting.postMessage({ type: 'APPLY_UPDATE' }); }
  return <PwaContext.Provider value={{ online, fallback, ready, error, waiting, updating, applyUpdate }}>{children}</PwaContext.Provider>;
}
export function PwaStatus() {
  const pwa = useContext(PwaContext);
  if (!pwa) return null;
  const message = pwa.fallback && pwa.online
    ? '接続できないため、保存済みの画面を使っています。'
    : !pwa.online
      ? 'オフライン：この端末に保存した知識を利用できます。'
      : pwa.error && !pwa.ready
        ? 'オフライン画面を準備できませんでした。オンラインで再読み込みしてください。'
        : undefined;
  if (!message && !pwa.waiting) return null;
  return <aside className="pwa-status" aria-label="接続とアプリの状態">
    {message && <p role="status">{message}</p>}
    {pwa.waiting && <div className="update-notice"><p role="status">新しい版があります。入力や回答を保存してから更新してください。</p><button disabled={pwa.updating} onClick={pwa.applyUpdate}>{pwa.updating ? '更新中…' : '保存後に更新する'}</button></div>}
  </aside>;
}
export function InstallHelp() {
  return <section className="section-block install-help" aria-labelledby="install-title"><h2 id="install-title" className="section-title">ホーム画面で使う</h2><p>iPhoneではSafariの共有メニューから「ホーム画面に追加」を選ぶと、アプリとして開けます。</p><p>知識はこの端末・このアプリの保存領域に保存され、自動同期されません。追加前・URL変更前にJSONを出力し、新しい起動先で知識を確認してください。表示されない場合はJSONから復元できます。</p><p>現在のアイコンは既存の星形ロゴを使った暫定アイコンです。インストールしてもプッシュ通知は配信されません。</p></section>;
}
