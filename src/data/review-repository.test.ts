import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReboostDatabase } from './database';
import { KnowledgeRepository } from './knowledge-repository';
import { ReviewRepository, type ReviewSubmission } from './review-repository';
import { exportBackup, importBackup, parseBackup } from './backup';
import { DAY_MS } from '@/domain/review';
import type { LearningProgress } from '@/domain/knowledge';
let database: ReboostDatabase;
let knowledgeRepository: KnowledgeRepository;
let reviews: ReviewRepository;
let now: string;
const databases: ReboostDatabase[] = [];
function makeDB() { const db = new ReboostDatabase(`review-test-${crypto.randomUUID()}`); databases.push(db); return db; }
beforeEach(() => { database = makeDB(); knowledgeRepository = new KnowledgeRepository(database); now = new Date().toISOString(); reviews = new ReviewRepository(database, () => now); });
afterEach(async () => { vi.restoreAllMocks(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function create() { const id = await knowledgeRepository.save({ term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16 }); now = (await database.progress.get(id))!.next_due_at!; return id; }
async function submission(id: string, response?: string): Promise<ReviewSubmission> { return { id: crypto.randomUUID(), knowledge: (await database.knowledge.get(id))!, progress: (await database.progress.get(id))!, response }; }
describe('回答のトランザクションと互換性', () => {
  it('回答と進捗を保存し再オープン後も保持、別の知識は変化しない', async () => {
    const a = await create(); const b = await create(); const other = await database.progress.get(b);
    const result = await reviews.submit(await submission(a)); database.close(); await database.open();
    expect(await database.progress.get(a)).toEqual(result.progress); expect(await database.attempts.get(result.attempt.id)).toEqual(result.attempt); expect(await database.progress.get(b)).toEqual(other);
  });
  it('同じ試行IDの連打を1回だけ記録する', async () => {
    const id = await create(); const request = await submission(id);
    const results = await Promise.allSettled([reviews.submit(request), reviews.submit(request)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await database.attempts.count()).toBe(1); expect((await database.progress.get(id))?.successes_in_level).toBe(1);
    database.close(); await database.open(); await expect(reviews.submit(request)).rejects.toThrow('すでに保存'); expect(await database.attempts.count()).toBe(1);
  });
  it('異なる試行IDでも同じ進捗に対する別タブの回答を二重記録しない', async () => {
    const id = await create(); const a = await submission(id); const b = { ...a, id: crypto.randomUUID() };
    const results = await Promise.allSettled([reviews.submit(a), reviews.submit(b)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await database.attempts.count()).toBe(1);
  });
  it('別の知識の進捗スナップショットを取り違えた回答を拒否する', async () => {
    const id = await create(); const input = await submission(id);
    input.progress = { ...input.progress, knowledge_id: crypto.randomUUID() };
    await expect(reviews.submit(input)).rejects.toThrow('変わりました'); expect(await database.attempts.count()).toBe(0);
    expect((await database.progress.get(id))?.successes_in_level).toBe(0);
  });
  it('進捗保存に失敗すると履歴も戻し、同じ試行IDで再試行できる', async () => {
    const id = await create(); const input = await submission(id); const before = await database.progress.get(id);
    vi.spyOn(database.progress, 'put').mockRejectedValueOnce(new Error('容量不足'));
    await expect(reviews.submit(input)).rejects.toThrow('容量不足'); expect(await database.attempts.count()).toBe(0); expect(await database.progress.get(id)).toEqual(before);
    await reviews.submit(input); expect(await database.attempts.count()).toBe(1);
  });
  it('回答履歴保存に失敗したら進捗を変えない', async () => {
    const id = await create(); const input = await submission(id);
    vi.spyOn(database.attempts, 'add').mockRejectedValueOnce(new Error('保存失敗'));
    await expect(reviews.submit(input)).rejects.toThrow('保存失敗'); expect(await database.progress.get(id)).toEqual(input.progress); expect(await database.attempts.count()).toBe(0);
  });
  it('未到来・空回答・アーカイブ・編集済み・削除済みを記録しない', async () => {
    const id = await create(); const input = await submission(id);
    now = new Date(Date.parse(input.progress.next_due_at!) - 1).toISOString(); await expect(reviews.submit(input)).rejects.toThrow('予定時刻');
    now = input.progress.next_due_at!;
    await database.progress.update(id, { level: 2 }); await expect(reviews.submit(await submission(id, '　'))).rejects.toThrow('回答');
    const beforeArchive = await submission(id, 'HTTP'); await knowledgeRepository.archive(id, input.knowledge.updated_at, true); await expect(reviews.submit(beforeArchive)).rejects.toThrow('変わりました');
    const current = (await database.knowledge.get(id))!; await knowledgeRepository.archive(id, current.updated_at, false);
    const beforeEdit = await submission(id); await knowledgeRepository.save({ ...beforeEdit.knowledge, term: 'TCP' }, { id, expected_updated_at: beforeEdit.knowledge.updated_at, resetConfirmed: true }); await expect(reviews.submit(beforeEdit)).rejects.toThrow('変わりました');
    const beforeDelete = await submission(id); await knowledgeRepository.remove(id, beforeDelete.knowledge.updated_at); await expect(reviews.submit(beforeDelete)).rejects.toThrow('変わりました'); expect(await database.attempts.count()).toBe(0);
  });
  it('不正解と進捗保持・翌日予定を保存する', async () => {
    const id = await create(); await database.progress.update(id, { level: 3, successes_in_level: 1 });
    const result = await reviews.submit(await submission(id, '誤答'));
    expect(await database.progress.get(id)).toMatchObject({ level: 3, successes_in_level: 1, next_due_at: new Date(Date.parse(now) + DAY_MS).toISOString() }); expect((await database.attempts.get(result.attempt.id))?.is_correct).toBe(false);
  });
  it('実際の回答完了時刻を取得して、全6ステップ後もバックアップを復元できる', async () => {
    const id = await create();
    for (let i = 0; i < 6; i++) {
      const p = (await database.progress.get(id))!;
      now = new Date(Date.parse(p.next_due_at!) + (i === 2 ? 5 * DAY_MS : 0)).toISOString();
      const response = p.level === 2 ? ' ＨＴＴＰ ' : p.level === 3 ? 'プロトコル' : undefined;
      await reviews.submit(await submission(id, response));
    }
    const p = (await database.progress.get(id))!; expect(p.status).toBe('final_due'); expect(p.mastered_at).toBeUndefined();
    const backup = parseBackup(await exportBackup(database)); const target = makeDB(); await importBackup(backup, target);
    expect(await target.progress.get(id)).toEqual(p); expect(await target.attempts.toArray()).toEqual(await database.attempts.toArray()); expect(await target.attempts.count()).toBe(6);
    expect(await importBackup(backup, target)).toEqual({ added: 0, skipped: 1 });
  });
  it('学習後の編集は初期状態へ戻して履歴を保持、削除は履歴も除去する', async () => {
    const id = await create(); const input = await submission(id); await reviews.submit(input);
    await knowledgeRepository.save({ ...input.knowledge, term: 'TCP' }, { id, expected_updated_at: input.knowledge.updated_at, resetConfirmed: true });
    expect(await database.progress.get(id)).toMatchObject({ status: 'learning', level: 1, successes_in_level: 0 }); expect(await database.attempts.count()).toBe(1);
    const k = (await database.knowledge.get(id))!; await knowledgeRepository.remove(id, k.updated_at); expect(await database.attempts.count()).toBe(0);
  });
  it('M2形式のデータをそのまま復元して学習開始できる', async () => {
    const id = await create(); const backup = parseBackup(await exportBackup(database)); const target = makeDB(); await importBackup(backup, target);
    const restored = new ReviewRepository(target, () => now);
    await restored.submit({ id: crypto.randomUUID(), knowledge: (await target.knowledge.get(id))!, progress: (await target.progress.get(id))! as LearningProgress });
    expect((await target.progress.get(id))?.successes_in_level).toBe(1); expect(target.verno).toBe(1);
  });
});
