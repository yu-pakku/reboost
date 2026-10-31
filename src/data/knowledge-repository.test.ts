import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReboostDatabase } from './database';
import { KnowledgeRepository } from './knowledge-repository';
import { exportBackup, importBackup, parseBackup, MAX_BACKUP_BYTES } from './backup';
import type { KnowledgeDraft, ReviewAttempt } from '@/domain/knowledge';
let database: ReboostDatabase;
let repository: KnowledgeRepository;
const draft: KnowledgeDraft = { term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16 };
const second = { ...draft, term: 'TCP' };
const created: ReboostDatabase[] = [];
function makeDatabase() { const d = new ReboostDatabase(`test-${crypto.randomUUID()}`); created.push(d); return d; }
beforeEach(() => { database = makeDatabase(); repository = new KnowledgeRepository(database); });
afterEach(async () => { vi.restoreAllMocks(); for (const d of created.splice(0)) { d.close(); await d.delete(); } });
async function saved() { const id = await repository.save(draft); return (await database.knowledge.get(id))!; }
async function history(id: string) { const attempt: ReviewAttempt = { id: crypto.randomUUID(), knowledge_id: id, kind: 'l1_confirm', is_correct: null, attempted_at: new Date().toISOString() }; await database.attempts.add(attempt); return attempt; }
describe('Dexieによる知識管理', () => {
  it('知識1件とLevel 1・成功0・未定着を原子的に保存し、再オープン後も残る', async () => {
    const k = await saved();
    expect(k.id).toMatch(/^[\da-f-]{36}$/);
    const progress = (await database.progress.get(k.id))!;
    expect(progress).toMatchObject({ status: 'learning', level: 1, successes_in_level: 0, final_attempt_count: 0, next_due_at: k.created_at });
    expect(progress.mastered_at).toBeUndefined(); expect(k.created_at.endsWith('Z')).toBe(true);
    database.close(); await database.open(); expect(await database.knowledge.get(k.id)).toEqual(k);
    expect(await database.progress.get(k.id)).toEqual(progress);
  });
  it('進捗保存に失敗したら知識もロールバックする', async () => {
    vi.spyOn(database.progress, 'put').mockRejectedValueOnce(new Error('容量不足'));
    await expect(repository.save(draft)).rejects.toThrow('容量不足');
    expect(await database.knowledge.count()).toBe(0); expect(await database.progress.count()).toBe(0);
  });
  it('不正内容は永続化せず、用語の重複は許可する', async () => {
    await expect(repository.save({ ...draft, cloze_start: -1 })).rejects.toThrow();
    expect(await database.knowledge.count()).toBe(0);
    await saved(); await saved(); expect(await database.knowledge.count()).toBe(2);
  });
  it('内容変更は確認が必要で、進捗だけリセットして履歴を残す', async () => {
    const k = await saved(); const a = await history(k.id);
    await database.progress.update(k.id, { level: 3, successes_in_level: 1 });
    await expect(repository.save(second, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: false })).rejects.toThrow('確認');
    expect((await database.knowledge.get(k.id))?.term).toBe('HTTP');
    await repository.save(second, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true });
    expect(await database.progress.get(k.id)).toMatchObject({ status: 'learning', level: 1, successes_in_level: 0 });
    expect(await database.attempts.get(a.id)).toEqual(a);
  });
  it('編集途中の進捗保存失敗なら知識・進捗を元に戻す', async () => {
    const k = await saved(); const before = await database.progress.get(k.id);
    vi.spyOn(database.progress, 'put').mockRejectedValueOnce(new Error('容量不足'));
    await expect(repository.save(second, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true })).rejects.toThrow('容量不足');
    expect(await database.knowledge.get(k.id)).toEqual(k); expect(await database.progress.get(k.id)).toEqual(before);
  });
  it('無変更の保存・閲覧は進捗と更新日時を変えない', async () => {
    const k = await saved(); await database.progress.update(k.id, { level: 2, successes_in_level: 1 });
    const p = await database.progress.get(k.id);
    await repository.save(k, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: false });
    expect(await database.knowledge.get(k.id)).toEqual(k); expect(await database.progress.get(k.id)).toEqual(p);
  });
  it('古い編集画面による上書き・削除を拒否する', async () => {
    const k = await saved();
    await repository.save(second, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true });
    await expect(repository.save(draft, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true })).rejects.toThrow('別の画面');
    await expect(repository.remove(k.id, k.updated_at)).rejects.toThrow('変更');
    expect((await database.knowledge.get(k.id))?.term).toBe('TCP');
  });
  it('アーカイブで予定を除外し、解除で初期状態に戻す', async () => {
    const k = await saved(); await repository.archive(k.id, k.updated_at, true);
    const archived = (await database.knowledge.get(k.id))!;
    expect(archived.archived_at).toBeDefined(); expect(await database.progress.get(k.id)).toMatchObject({ status: 'archived', next_due_at: undefined });
    await repository.save(second, { id: k.id, expected_updated_at: archived.updated_at, resetConfirmed: true });
    expect((await database.progress.get(k.id))?.status).toBe('archived');
    const updated = (await database.knowledge.get(k.id))!;
    await repository.archive(k.id, updated.updated_at, false);
    expect(await database.progress.get(k.id)).toMatchObject({ status: 'learning', level: 1, successes_in_level: 0 });
  });
  it('削除失敗で知識・進捗・履歴をすべてロールバックする', async () => {
    const k = await saved(); const a = await history(k.id);
    vi.spyOn(database.knowledge, 'delete').mockRejectedValueOnce(new Error('削除失敗'));
    await expect(repository.remove(k.id, k.updated_at)).rejects.toThrow('削除失敗');
    expect(await database.attempts.get(a.id)).toEqual(a); expect(await database.progress.get(k.id)).toBeDefined(); expect(await database.knowledge.get(k.id)).toEqual(k);
  });
  it('知識・進捗・履歴をまとめて削除し、他の知識を残す', async () => {
    const k = await saved(); const other = await saved(); await history(k.id); await history(other.id);
    await repository.remove(k.id, k.updated_at);
    expect(await database.knowledge.get(k.id)).toBeUndefined(); expect(await database.progress.get(k.id)).toBeUndefined(); expect(await database.attempts.where('knowledge_id').equals(k.id).count()).toBe(0);
    expect(await database.knowledge.get(other.id)).toEqual(other); expect(await database.attempts.count()).toBe(1);
  });
});
describe('JSONバックアップ', () => {
  it('出力→別DBへ復元して知識・進捗・履歴・設定が一致し、再取込はスキップする', async () => {
    const k = await saved(); await history(k.id);
    const backup = parseBackup(await exportBackup(database)); const target = makeDatabase();
    expect(await importBackup(backup, target)).toEqual({ added: 1, skipped: 0 });
    expect(await target.knowledge.toArray()).toEqual(backup.knowledge); expect(await target.progress.toArray()).toEqual(backup.progress); expect(await target.attempts.toArray()).toEqual(backup.attempts); expect(await target.settings.get('app')).toEqual(backup.settings);
    expect(await importBackup(backup, target)).toEqual({ added: 0, skipped: 1 });
  });
  it('空のバックアップも復元できる', async () => {
    const backup = parseBackup(await exportBackup(database)); expect(await importBackup(backup, database)).toEqual({ added: 0, skipped: 0 });
  });
  it('壊れたJSON・未知バージョン・重複ID・参照不整合・不正オフセット・学習状態を拒否', async () => {
    const k = await saved(); const payload = parseBackup(await exportBackup(database));
    const invalid = ['{', JSON.stringify({ ...payload, schema_version: 99 }), JSON.stringify({ ...payload, knowledge: [k, k] }), JSON.stringify({ ...payload, progress: [] }), JSON.stringify({ ...payload, knowledge: [{ ...k, cloze_end: 999 }] }), JSON.stringify({ ...payload, progress: [{ ...payload.progress[0], level: undefined }] }), JSON.stringify({ ...payload, progress: [{ ...payload.progress[0], knowledge_id: crypto.randomUUID() }] }), JSON.stringify({ ...payload, knowledge: [{ ...k, archived_at: k.updated_at }] })];
    for (const text of invalid) expect(() => parseBackup(text)).toThrow();
    expect(await database.knowledge.count()).toBe(1);
  });
  it('10MB超のファイルを拒否する', () => { expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('10MB'); });
  it('衝突があれば新規データを含めて全体を反映しない', async () => {
    await saved(); const backup = parseBackup(await exportBackup(database));
    const target = makeDatabase(); await importBackup(backup, target);
    const fresh = await repository.save(second); const mixed = parseBackup(await exportBackup(database));
    mixed.knowledge.find(k => k.id === backup.knowledge[0].id)!.term = '変更された用語';
    await expect(importBackup(mixed, target)).rejects.toThrow('同じID');
    expect(await target.knowledge.count()).toBe(1); expect(await target.knowledge.get(fresh)).toBeUndefined(); expect((await target.knowledge.get(backup.knowledge[0].id))?.term).toBe('HTTP');
  });
  it('進捗・履歴・設定の衝突も全体を拒否する', async () => {
    const k = await saved(); await history(k.id); const backup = parseBackup(await exportBackup(database)); const target = makeDatabase();
    await importBackup(backup, target);
    const changedProgress = structuredClone(backup); changedProgress.progress[0].successes_in_level = 1;
    await expect(importBackup(changedProgress, target)).rejects.toThrow('学習状態');
    const changedAttempt = structuredClone(backup); changedAttempt.attempts[0].attempted_at = '2026-10-30T00:00:00.000Z';
    await expect(importBackup(changedAttempt, target)).rejects.toThrow('履歴');
    const changedSettings = structuredClone(backup); changedSettings.settings.preferred_daily_reminder_hour = 10;
    await expect(importBackup(changedSettings, target)).rejects.toThrow('設定');
    expect(await target.progress.toArray()).toEqual(backup.progress); expect(await target.attempts.toArray()).toEqual(backup.attempts);
  });
  it('復元途中の書き込み失敗を全体ロールバックする', async () => {
    await saved(); const backup = parseBackup(await exportBackup(database)); const target = makeDatabase();
    vi.spyOn(target.progress, 'bulkPut').mockRejectedValueOnce(new Error('容量不足'));
    await expect(importBackup(backup, target)).rejects.toThrow('容量不足');
    expect(await target.knowledge.count()).toBe(0); expect(await target.progress.count()).toBe(0);
  });
});
