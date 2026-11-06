import Link from 'next/link';
import { PwaStatus } from './pwa-provider';
import { Icon, type IconName } from './icon';

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: '/review', label: '復習', icon: 'review' },
  { href: '/', label: 'ホーム', icon: 'home' },
  { href: '/knowledge', label: '知識', icon: 'book' },
];

export function AppShell({ active, children, hideNav = false, reviewDue = false }: {
  active: string;
  children: React.ReactNode;
  hideNav?: boolean;
  reviewDue?: boolean;
}) {
  return <div className={active === '/' ? 'app-shell home-shell' : 'app-shell'}>
    <a className="skip-link" href="#main">本文へ移動</a>
    {(active !== '/' || !hideNav) && <header className="app-header">
      <Link href="/" className="brand" aria-label="ReBoost ホーム">ReBoost</Link>
    </header>}
    <PwaStatus/>
    <main id="main" className="main-content" tabIndex={-1}>{children}</main>
    {!hideNav && <nav className="bottom-nav" aria-label="メインナビゲーション">
      {tabs.map(tab => {
        const due = tab.href === '/review' && reviewDue;
        return <Link key={tab.href} href={tab.href} aria-current={active === tab.href ? 'page' : undefined}
          aria-describedby={due ? 'review-due-note' : undefined} className="nav-item">
          <span className="nav-icon">
            <Icon name={tab.icon}/>
            {due && <span className="review-dot" aria-hidden="true"/>}
          </span>
          <span>{tab.label}</span>
        </Link>;
      })}
      {reviewDue && <span id="review-due-note" className="sr-only">復習できる課題があります</span>}
    </nav>}
  </div>;
}
