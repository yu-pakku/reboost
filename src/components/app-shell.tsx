import Link from 'next/link';
import { PwaStatus } from './pwa-provider';
import { Icon, type IconName } from './icon';
const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: '/review', label: '復習', icon: 'review' }, { href: '/', label: 'ホーム', icon: 'home' }, { href: '/account', label: 'アカウント', icon: 'account' },
];
export function AppShell({ active, children, hideNav = false }: { active: string; children: React.ReactNode; hideNav?: boolean }) {
  return <div className="app-shell">
    <a className="skip-link" href="#main">本文へ移動</a>
    <header className="app-header"><Link href="/" className="brand" aria-label="ReBoost ホーム"><span className="brand-mark"><Icon name="spark" size={20}/></span>ReBoost<span className="brand-dot">.</span></Link><span className="header-note">思い出すを、日常に。</span></header>
    <PwaStatus/>
    <main id="main" className="main-content" tabIndex={-1}>{children}</main>
    {!hideNav && <nav className="bottom-nav" aria-label="メインナビゲーション">{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={active === tab.href ? 'page' : undefined} className="nav-item"><span className="nav-icon"><Icon name={tab.icon}/></span><span>{tab.label}</span></Link>)}</nav>}
  </div>;
}
