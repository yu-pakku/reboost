import Link from 'next/link';
import { AppShell } from './app-shell';
import { InstallHelp } from './pwa-provider';
import { BackupPanel } from './backup-panel';
import { LearningStatistics } from './learning-statistics';
import { Icon } from './icon';

export default function Settings() {
  return <AppShell active="/knowledge">
    <Link className="text-link" href="/knowledge">← 知識に戻る</Link>
    <div className="page-intro compact-intro"><h1>設定</h1></div>
    <BackupPanel/>
    <aside className="tip-card storage-note"><span className="tip-icon"><Icon name="shield"/></span><div><h2>端末内の保存</h2><p>知識と学習状態は、この端末のIndexedDBに保存されます。ほかの端末や起動先には自動同期されません。ブラウザのデータ消去などで失われる場合があるため、バックアップの利用をおすすめします。</p></div></aside>
    <InstallHelp/>
    <section className="section-block"><h2 className="section-title">通知</h2><p className="field-note">通知機能は未提供です。</p></section>
    <LearningStatistics/>
  </AppShell>;
}
