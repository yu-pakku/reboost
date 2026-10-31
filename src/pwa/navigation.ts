import config from './config.json';
export function isAppRoute(path: string) { return config.staticPages.includes(path) || new RegExp(config.dynamicPattern, 'i').test(path); }
export function offlineTarget(href: string): string {
  const url = new URL(href);
  const route = url.pathname === '/offline' ? url.searchParams.get('route') ?? '/' : url.pathname;
  return isAppRoute(route) && route !== '/offline' ? route : '/';
}
export function usesOfflineShell() { return typeof document !== 'undefined' && !!document.querySelector('meta[name="reboost-offline-shell"]') || typeof location !== 'undefined' && location.pathname === '/offline'; }
export function replaceAppRoute(router: { replace: (path: string) => void }, path: string) {
  if (typeof navigator !== 'undefined' && (!navigator.onLine || usesOfflineShell())) window.location.replace(path);
  else router.replace(path);
}
