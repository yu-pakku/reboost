import { AppShell } from '@/components/app-shell';
import { InstallHelp } from './pwa-provider';
import { BackupPanel } from '@/components/backup-panel';
import { LearningStatistics } from '@/components/learning-statistics';
import { Icon } from '@/components/icon';
export default function Account() {
  return <AppShell active="/account"><div className="page-intro"><p className="eyebrow">あなたのペースで。</p><h1>アカウント</h1><p className="intro-copy">日々の積み重ねを、ここに。</p></div>
    <section className="profile-card"><span className="avatar"><Icon name="account" size={28}/></span><div><h2>あなたの学習ノート</h2><p>この端末から、はじめよう。</p></div><span className="tag">端末内</span></section>
    <LearningStatistics/>
    <section className="section-block"><h2 className="section-title">通知</h2><p className="field-note">通知機能は未提供です。</p></section>
    <BackupPanel/>
    <InstallHelp/>
    <aside className="tip-card storage-note"><span className="tip-icon"><Icon name="shield"/></span><div><h2>データについて</h2><p>知識と学習状態は、この端末のIndexedDBに保存されます。ほかの端末や起動先には自動同期されません。ブラウザのデータ消去などで失われる場合があるため、バックアップの利用をおすすめします。</p></div></aside>
  </AppShell>;
}
