import { finalSessions } from '@/domain/final-test';
import { z } from 'zod';
import { attemptSchema, knowledgeSchema, progressSchema, settingsSchema, utcDate } from '@/domain/knowledge';
import { db, type ReboostDatabase } from './database';
import { DataError } from './knowledge-repository';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const backupSchema = z.strictObject({
  format: z.literal('reboost'), schema_version: z.union([z.literal(1), z.literal(2)]), exported_at: utcDate,
  knowledge: z.array(knowledgeSchema).max(10000), progress: z.array(progressSchema).max(10000),
  attempts: z.array(attemptSchema).max(100000), settings: settingsSchema,
}).superRefine((data, ctx) => {
  if (finalSessions(data.attempts).some(session => !session.valid)) ctx.addIssue({ code: 'custom', message: '最終テストの2回答が揃っていません。' });
  const ids = new Set(data.knowledge.map(k => k.id));
  const progressIds = new Set(data.progress.map(p => p.knowledge_id));
  const attemptIds = new Set(data.attempts.map(a => a.id));
  if (ids.size !== data.knowledge.length || progressIds.size !== data.progress.length || attemptIds.size !== data.attempts.length) ctx.addIssue({ code: 'custom', message: 'IDが重複しています。' });
  if (data.progress.length !== data.knowledge.length || data.progress.some(p => !ids.has(p.knowledge_id)) || data.attempts.some(a => !ids.has(a.knowledge_id))) ctx.addIssue({ code: 'custom', message: '知識と進捗・履歴の参照関係が不正です。' });
  const progress = new Map(data.progress.map(p => [p.knowledge_id, p]));
  for (const k of data.knowledge) if (!!k.archived_at !== (progress.get(k.id)?.status === 'archived')) ctx.addIssue({ code: 'custom', message: 'アーカイブの状態が一致しません。' });
}).transform(data => ({ ...data, schema_version: 2 as const }));
export type Backup = z.infer<typeof backupSchema>;
export function parseBackup(text: string): Backup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DataError('バックアップは10MB以下のJSONを選んでください。');
  try { return backupSchema.parse(JSON.parse(text)); }
  catch { throw new DataError('バックアップの形式・バージョン・入力内容・参照関係に問題があります。データは変更していません。'); }
}
export async function exportBackup(database: ReboostDatabase = db): Promise<string> {
  return database.transaction('r', database.tables, async () => {
    const payload = backupSchema.parse({ format: 'reboost', schema_version: 2, exported_at: new Date().toISOString(), knowledge: await database.knowledge.toArray(), progress: await database.progress.toArray(), attempts: await database.attempts.toArray(), settings: await database.settings.get('app') });
    const text = JSON.stringify(payload, null, 2);
    if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) throw new DataError('出力サイズが10MBを超えています。この版では扱える容量を超えています。');
    return text;
  });
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export async function importBackup(input: Backup, database: ReboostDatabase = db) {
  // Validate again at the persistence boundary; callers cannot bypass the checks.
  const data = backupSchema.parse(input);
  return database.transaction('rw', database.tables, async () => {
    for (const k of data.knowledge) {
      const old = await database.knowledge.get(k.id);
      if (old && !equal(knowledgeSchema.parse(old), k)) throw new DataError('同じIDの知識に異なる内容があります。既存データを保護するため復元を中止しました。');
    }
    for (const p of data.progress) {
      const old = await database.progress.get(p.knowledge_id);
      if (old && !equal(progressSchema.parse(old), p)) throw new DataError('同じIDの学習状態が競合しています。復元を中止しました。');
    }
    for (const a of data.attempts) {
      const old = await database.attempts.get(a.id);
      if (old && !equal(attemptSchema.parse(old), a)) throw new DataError('同じIDの履歴が競合しています。復元を中止しました。');
    }
    const settings = await database.settings.get('app');
    if (settings && !equal(settingsSchema.parse(settings), data.settings)) throw new DataError('端末の設定とバックアップの設定が異なります。復元を中止しました。');
    const existing = await database.knowledge.bulkGet(data.knowledge.map(k => k.id));
    await database.knowledge.bulkPut(data.knowledge);
    await database.progress.bulkPut(data.progress);
    await database.attempts.bulkPut(data.attempts);
    await database.settings.put(data.settings);
    return { added: existing.filter(k => !k).length, skipped: existing.filter(Boolean).length };
  });
}
