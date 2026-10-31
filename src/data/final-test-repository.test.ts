import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReboostDatabase } from './database';
import { KnowledgeRepository } from './knowledge-repository';
import { FinalTestRepository, type FinalSubmission } from './final-test-repository';
import { exportBackup, importBackup, parseBackup } from './backup';
import { learningStatistics } from '@/domain/statistics';
let database: ReboostDatabase; let repo: KnowledgeRepository; let final: FinalTestRepository; let clock: string;
const databases: ReboostDatabase[] = [];
function makeDB() { const d = new ReboostDatabase(`final-${crypto.randomUUID()}`); databases.push(d); return d; }
beforeEach(() => { database = makeDB(); repo = new KnowledgeRepository(database); final = new FinalTestRepository(database, () => clock); });
afterEach(async () => { vi.restoreAllMocks(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function input(responses: [string, string] = ['HTTP', 'プロトコル']): Promise<FinalSubmission> {
  const id = await repo.save({ term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16 });
  const p = (await database.progress.get(id))!; clock = p.next_due_at!;
  await database.progress.put({ ...p, status: 'final_due', level: undefined });
  return { ids: { session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() }, knowledge: (await database.knowledge.get(id))!, progress: (await database.progress.get(id))!, responses };
}
describe('最終テストの原子的な保存', () => {
  it('合格と2回答を保存し、再オープン後も定着済みを保持する', async () => {
    const request = await input(); const result = await final.submit(request); database.close(); await database.open();
    expect(await database.progress.get(request.knowledge.id)).toEqual(result.progress); expect(await database.attempts.count()).toBe(2); expect((await database.attempts.toArray()).every(a => a.final_session_id === request.ids.session)).toBe(true);
  });
  it.each([['誤答', 'プロトコル'], ['HTTP', '誤答'], ['誤答', '誤答']] as [string, string][])('不合格%s/%sを保存し、JSON復元後も再学習対象を保持する', async (a, b) => {
    const request = await input([a, b]); const result = await final.submit(request); expect(result.passed).toBe(false);
    const backup = parseBackup(await exportBackup(database)); expect(backup.schema_version).toBe(2);
    const target = makeDB(); await importBackup(backup, target); expect(await target.progress.get(request.knowledge.id)).toEqual(result.progress); expect(await target.attempts.toArray()).toEqual(await database.attempts.toArray());
    expect(await importBackup(backup, target)).toEqual({ added: 0, skipped: 1 });
  });
  it('連打と別タブの同じ進捗への回答を1受験だけ記録する', async () => {
    const request = await input(); const other = { ...request, ids: { session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() } };
    const results = await Promise.allSettled([final.submit(request), final.submit(request), final.submit(other)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1); expect(await database.attempts.count()).toBe(2); expect((await database.progress.get(request.knowledge.id))?.final_attempt_count).toBe(1);
    database.close(); await database.open(); await expect(final.submit(request)).rejects.toThrow('すでに');
  });
  it('保存失敗で2回答と進捗をすべて戻し、同じIDで再試行できる', async () => {
    const request = await input(); vi.spyOn(database.progress, 'put').mockRejectedValueOnce(new Error('容量不足'));
    await expect(final.submit(request)).rejects.toThrow('容量不足'); expect(await database.attempts.count()).toBe(0); expect(await database.progress.get(request.knowledge.id)).toEqual(request.progress);
    await final.submit(request); expect(await database.attempts.count()).toBe(2);
  });
  it('履歴側の保存失敗でも進捗を変更しない', async () => {
    const request = await input(); vi.spyOn(database.attempts, 'bulkAdd').mockRejectedValueOnce(new Error('失敗'));
    await expect(final.submit(request)).rejects.toThrow(); expect(await database.progress.get(request.knowledge.id)).toEqual(request.progress); expect(await database.attempts.count()).toBe(0);
  });
  it('期限前・空回答・穴埋め未設定を保存しない', async () => {
    const request = await input(); clock = new Date(Date.parse(clock) - 1).toISOString(); await expect(final.submit(request)).rejects.toThrow('予定時刻');
    clock = request.progress.next_due_at!; await expect(final.submit({ ...request, responses: ['HTTP', ' '] })).rejects.toThrow('2問とも');
    await database.knowledge.update(request.knowledge.id, { cloze_start: -1 }); await expect(final.submit(request)).rejects.toThrow('穴埋め'); expect(await database.attempts.count()).toBe(0);
  });
  it('編集・削除・アーカイブ済みの古いテストは記録しない', async () => {
    for (const action of ['edit', 'delete', 'archive']) {
      const request = await input(); const k = request.knowledge;
      if (action === 'edit') await repo.save({ ...k, term: 'TCP' }, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true });
      if (action === 'delete') await repo.remove(k.id, k.updated_at);
      if (action === 'archive') await repo.archive(k.id, k.updated_at, true);
      await expect(final.submit(request)).rejects.toThrow('変更');
    }
    expect(await database.attempts.count()).toBe(0);
  });
  it('定着後の編集で粒子対象を減らし、合格履歴は保持、削除で履歴も消える', async () => {
    const request = await input(); await final.submit(request); const k = request.knowledge;
    const entries = async () => [{ knowledge: (await database.knowledge.get(k.id))!, progress: (await database.progress.get(k.id))! }];
    expect(learningStatistics(await entries(), await database.attempts.toArray()).mastered).toBe(1);
    await repo.save({ ...k, term: 'TCP' }, { id: k.id, expected_updated_at: k.updated_at, resetConfirmed: true });
    expect(learningStatistics(await entries(), await database.attempts.toArray())).toMatchObject({ mastered: 0, final_passed: 1 });
    const updated = (await database.knowledge.get(k.id))!; await repo.remove(k.id, updated.updated_at); expect(await database.attempts.count()).toBe(0);
  });
  it('合格後のアーカイブは定着表示から除外し、解除は既存通り学習をリセットする', async () => {
    const request = await input(); await final.submit(request); const k = request.knowledge; await repo.archive(k.id, k.updated_at, true);
    const archived = (await database.knowledge.get(k.id))!; expect((await database.progress.get(k.id))?.status).toBe('archived');
    await repo.archive(k.id, archived.updated_at, false); expect(await database.progress.get(k.id)).toMatchObject({ status: 'learning', level: 1, successes_in_level: 0 }); expect(await database.attempts.count()).toBe(2);
  });
  it('旧v1バックアップを読み込み、新しい形式へ変換できる', async () => {
    await input(); const backup = parseBackup(await exportBackup(database));
    const old = { ...backup, schema_version: 1 }; expect(parseBackup(JSON.stringify(old)).schema_version).toBe(2);
    const target = makeDB(); await importBackup(parseBackup(JSON.stringify(old)), target); expect(await target.knowledge.count()).toBe(1); expect(target.verno).toBe(1);
  });
  it('最終テストの片方欠落・異なる知識や時刻の組を復元しない', async () => {
    const request = await input(); await final.submit(request); const backup = parseBackup(await exportBackup(database));
    expect(() => parseBackup(JSON.stringify({ ...backup, attempts: backup.attempts.slice(0, 1) }))).toThrow();
    const mixed = structuredClone(backup); mixed.attempts[0].attempted_at = '2026-01-01T00:00:00.000Z'; expect(() => parseBackup(JSON.stringify(mixed))).toThrow();
    const other = structuredClone(backup); other.attempts[0].knowledge_id = crypto.randomUUID(); expect(() => parseBackup(JSON.stringify(other))).toThrow();
  });
});
