import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ReboostDatabase } from './database';
import { completeOnboarding, shouldShowOnboarding } from './onboarding';
import { exportBackup, importBackup, parseBackup } from './backup';
import { KnowledgeRepository } from './knowledge-repository';
import { defaultSettings } from '@/domain/knowledge';

let database: ReboostDatabase;
beforeEach(() => { database = new ReboostDatabase(crypto.randomUUID()); });
afterEach(async () => { await database.delete(); });

it('新しい端末だけで開始を待ち、完了後は再オープンしても表示しない', async () => {
  expect(await shouldShowOnboarding(database)).toBe(true);
  expect(await shouldShowOnboarding(database)).toBe(true);
  await completeOnboarding(database);
  database.close();
  await database.open();
  expect(await shouldShowOnboarding(database)).toBe(false);
  expect(await database.knowledge.count()).toBe(0);
  expect(await database.progress.count()).toBe(0);
  expect(await database.attempts.count()).toBe(0);
});

it('導入設定のない既存の空DBはそのままホームを開く', async () => {
  await database.settings.delete('onboarding');
  expect(await shouldShowOnboarding(database)).toBe(false);
  expect(await database.settings.get('app')).toEqual(defaultSettings);
});

it('導入前に知識がある場合もスキップし、JSONに端末の既読設定を含めない', async () => {
  await new KnowledgeRepository(database).save({
    term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16,
  });
  expect(await shouldShowOnboarding(database)).toBe(false);
  expect(await database.settings.get('onboarding')).toEqual({ id: 'onboarding', state: 'complete' });
  const backup = parseBackup(await exportBackup(database));
  expect(backup.settings).toEqual(defaultSettings);
  expect(await importBackup(backup, database)).toEqual({ added: 0, skipped: 1 });
  expect(await shouldShowOnboarding(database)).toBe(false);
  expect(await database.knowledge.count()).toBe(1);
});
