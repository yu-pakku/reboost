import { db, type ReboostDatabase } from './database';
import { contentChanged, initialProgress, knowledgeSchema, type KnowledgeDraft, type Knowledge } from '@/domain/knowledge';
export class DataError extends Error {}
const nextTime = (old?: string) => new Date(Math.max(Date.now(), old ? Date.parse(old) + 1 : 0)).toISOString();
export class KnowledgeRepository {
  constructor(private readonly database: ReboostDatabase = db) {}
  async save(draft: KnowledgeDraft, options?: { id: string; expected_updated_at: string; resetConfirmed: boolean }): Promise<string> {
    const id = options?.id ?? crypto.randomUUID();
    return this.database.transaction('rw', this.database.knowledge, this.database.progress, async () => {
      const old = options ? await this.database.knowledge.get(id) : undefined;
      if (options && (!old || old.updated_at !== options.expected_updated_at)) throw new DataError('別の画面で変更または削除されています。一覧に戻って開き直してください。');
      if (old && !contentChanged(old, draft)) return id;
      if (old && !options?.resetConfirmed) throw new DataError('内容の変更には進捗リセットの確認が必要です。');
      const now = nextTime(old?.updated_at);
      const knowledge: Knowledge = knowledgeSchema.parse({ ...draft, term: draft.term.trim(), id, created_at: old?.created_at ?? now, updated_at: now, ...(old?.archived_at ? { archived_at: old.archived_at } : {}) });
      await this.database.knowledge.put(knowledge);
      const progress = initialProgress(id, now);
      await this.database.progress.put(old?.archived_at ? { ...progress, status: 'archived', next_due_at: undefined } : progress);
      return id;
    });
  }
  async archive(id: string, expected: string, archived: boolean) {
    await this.database.transaction('rw', this.database.knowledge, this.database.progress, async () => {
      const knowledge = await this.database.knowledge.get(id);
      const progress = await this.database.progress.get(id);
      if (!knowledge || !progress || knowledge.updated_at !== expected) throw new DataError('データが変更されています。一覧に戻って開き直してください。');
      const now = nextTime(knowledge.updated_at);
      await this.database.knowledge.put({ ...knowledge, archived_at: archived ? now : undefined, updated_at: now });
      await this.database.progress.put(archived ? { ...progress, status: 'archived', next_due_at: undefined, updated_at: now } : initialProgress(id, now));
    });
  }
  async remove(id: string, expected: string) {
    await this.database.transaction('rw', this.database.knowledge, this.database.progress, this.database.attempts, async () => {
      const old = await this.database.knowledge.get(id);
      if (!old || old.updated_at !== expected) throw new DataError('データが変更されています。一覧に戻って開き直してください。');
      await this.database.attempts.where('knowledge_id').equals(id).delete();
      await this.database.progress.delete(id);
      await this.database.knowledge.delete(id);
    });
  }
}
export const knowledgeRepository = new KnowledgeRepository();
export function storageError(error: unknown) {
  if (error instanceof DataError) return error.message;
  return '端末内データを読み書きできませんでした。空き容量やブラウザの保存設定を確認し、もう一度お試しください。入力内容はこの画面に残っています。';
}
