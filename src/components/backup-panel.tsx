'use client';
import { useRef, useState, type ChangeEvent } from 'react';
import { exportBackup, importBackup, MAX_BACKUP_BYTES, parseBackup, type Backup } from '@/data/backup';
import { DataError, storageError } from '@/data/knowledge-repository';
export function BackupPanel() {
  const [backup, setBackup] = useState<Backup>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    if (lock.current) return;
    const file = event.target.files?.[0];
    setBackup(undefined); setMessage(''); setError('');
    if (!file) return;
    lock.current = true; setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new DataError('10MB以下のJSONファイルを選んでください。');
      setBackup(parseBackup(await file.text()));
    } catch (error) { setError(error instanceof DataError ? error.message : 'ファイルを読み込めませんでした。もう一度選んでください。'); }
    finally { lock.current = false; setBusy(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function run(kind: 'export' | 'import') {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (kind === 'export') {
        const text = await exportBackup();
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url; link.download = `reboost-${new Date().toISOString().slice(0, 10)}.json`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('JSONを出力しました。ダウンロード先にファイルが保存されたことを確認してください。');
      } else if (backup) {
        const result = await importBackup(backup);
        setMessage(`復元しました：追加${result.added}件、同一内容のスキップ${result.skipped}件。`);
        setBackup(undefined);
      }
    } catch (error) { setError(storageError(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="section-block" aria-labelledby="backup-title"><h2 id="backup-title" className="section-title">バックアップ・復元</h2><div className="settings-card backup-panel"><p>JSONファイルを端末に保存して、大切な知識をバックアップできます。内容は外部へ送信されません。</p><button disabled={busy} className="secondary-button" onClick={() => run('export')}>JSONをエクスポート</button><label htmlFor="backup-file">バックアップから復元（10MB以下）</label><input id="backup-file" ref={fileInput} type="file" accept=".json,application/json" disabled={busy} onChange={chooseFile}/><p>復元は追加方式です。同じID・同じ内容はスキップし、同じIDで内容・進捗・履歴が異なる場合や設定が競合する場合は全体を中止します。既存データを上書きしません。</p>
    {backup && <div className="import-preview"><h3>復元内容の確認</h3><p>知識{backup.knowledge.length}件・学習状態{backup.progress.length}件・解答履歴{backup.attempts.length}件</p><button className="primary-button" disabled={busy} onClick={() => run('import')}>確認した内容を追加して復元</button><button className="text-button" disabled={busy} onClick={() => setBackup(undefined)}>復元をキャンセル</button></div>}
    {busy && <p role="status">処理中…</p>}{message && <p role="status" className="success-box">{message}</p>}{error && <p role="alert" className="error-box">{error}</p>}
    </div></section>;
}
