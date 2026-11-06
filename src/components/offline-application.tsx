'use client';
import { useSyncExternalStore } from 'react';
import Home from './home-page';
import Settings from './settings-page';
import KnowledgeNew from './knowledge-new-page';
import { KnowledgeDetail, KnowledgeList } from './knowledge-pages';
import { ReviewScreen } from './review-screen';
import { FinalTestPage } from './final-test-screen';
import { offlineTarget } from '@/pwa/navigation';
const subscribe = (callback: () => void) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); };
export function OfflineApplication() {
  const href = useSyncExternalStore(subscribe, () => window.location.href, () => '');
  if (!href) return <p className="loading-message" role="status">端末内の画面を準備中…</p>;
  const path = offlineTarget(href);
  if (path === '/') return <Home/>;
  if (path === '/account' || path === '/settings') return <Settings/>;
  if (path === '/review') return <ReviewScreen/>;
  if (path === '/knowledge/new') return <KnowledgeNew/>;
  if (path === '/knowledge') return <KnowledgeList/>;
  const parts = path.split('/');
  return path.startsWith('/test/') ? <FinalTestPage knowledgeId={parts[2]}/> : <KnowledgeDetail knowledgeId={parts[2]} edit={parts[3] === 'edit'}/>;
}
