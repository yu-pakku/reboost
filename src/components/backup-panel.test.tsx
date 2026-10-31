import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupPanel } from './backup-panel';
import * as backups from '@/data/backup';
import { defaultSettings, initialProgress, type Knowledge } from '@/domain/knowledge';
const knowledge: Knowledge = { id: '48dd520f-dff2-40c5-ab92-2b8b234aeecc', term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: '2026-10-30T01:00:00.000Z', updated_at: '2026-10-30T01:00:00.000Z' };
const payload = { format: 'reboost', schema_version: 1, exported_at: knowledge.created_at, knowledge: [knowledge], progress: [initialProgress(knowledge.id, knowledge.created_at)], attempts: [], settings: defaultSettings };
beforeEach(() => vi.restoreAllMocks());
function choose(text: string, size = text.length) { fireEvent.change(screen.getByLabelText('バックアップから復元（10MB以下）'), { target: { files: [{ name: 'backup.json', size, text: async () => text }] } }); }
describe('バックアップの確認画面', () => {
  it('ファイル選択だけでは反映せず、確認後に復元する', async () => {
    const restore = vi.spyOn(backups, 'importBackup').mockResolvedValue({ added: 1, skipped: 0 }); render(<BackupPanel/>); choose(JSON.stringify(payload));
    expect(await screen.findByRole('heading', { name: '復元内容の確認' })).toBeInTheDocument(); expect(restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '確認した内容を追加して復元' })); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('追加1件')); expect(restore).toHaveBeenCalledTimes(1);
  });
  it('キャンセルしたら復元せず、確認画面を閉じる', async () => {
    const restore = vi.spyOn(backups, 'importBackup'); render(<BackupPanel/>); choose(JSON.stringify(payload)); await screen.findByRole('heading', { name: '復元内容の確認' });
    fireEvent.click(screen.getByRole('button', { name: '復元をキャンセル' })); expect(restore).not.toHaveBeenCalled(); expect(screen.queryByRole('heading', { name: '復元内容の確認' })).not.toBeInTheDocument();
  });
  it('不正JSON・サイズ超過を表示し、復元操作を出さない', async () => {
    const restore = vi.spyOn(backups, 'importBackup'); render(<BackupPanel/>); choose('{'); expect(await screen.findByRole('alert')).toHaveTextContent('形式');
    choose('{}', backups.MAX_BACKUP_BYTES + 1); expect(await screen.findByRole('alert')).toHaveTextContent('10MB'); expect(restore).not.toHaveBeenCalled(); expect(screen.queryByRole('heading', { name: '復元内容の確認' })).not.toBeInTheDocument();
  });
  it('保存エラーでも確認内容を保持して再試行できる', async () => {
    const restore = vi.spyOn(backups, 'importBackup').mockRejectedValueOnce(new Error('QuotaExceededError')).mockResolvedValueOnce({ added: 1, skipped: 0 });
    render(<BackupPanel/>); choose(JSON.stringify(payload)); await screen.findByRole('heading', { name: '復元内容の確認' }); fireEvent.click(screen.getByRole('button', { name: '確認した内容を追加して復元' })); expect(await screen.findByRole('alert')).toHaveTextContent('端末内データ');
    fireEvent.click(screen.getByRole('button', { name: '確認した内容を追加して復元' })); await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('追加1件')); expect(restore).toHaveBeenCalledTimes(2);
  });
});
