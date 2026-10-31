import { db, type ReboostDatabase } from './database';
import { DataError } from './knowledge-repository';
import { sameProgress } from './review-repository';
import { attemptSchema, uuid, type Knowledge, type LearningProgress } from '@/domain/knowledge';
import { completeFinalTest, type FinalIds } from '@/domain/final-test';
import { ReviewError } from '@/domain/review';
export interface FinalSubmission { ids: FinalIds; knowledge: Knowledge; progress: LearningProgress; responses: [string, string] }
export class FinalTestRepository {
  constructor(private readonly database: ReboostDatabase = db, private readonly clock: () => string = () => new Date().toISOString()) {}
  async submit(input: FinalSubmission) {
    for (const id of Object.values(input.ids)) uuid.parse(id);
    if (new Set(Object.values(input.ids)).size !== 3) throw new DataError('テストの識別子が重複しています。一覧から開き直してください。');
    return this.database.transaction('rw', this.database.knowledge, this.database.progress, this.database.attempts, async () => {
      if (await this.database.attempts.where('final_session_id').equals(input.ids.session).count() || (await this.database.attempts.bulkGet([input.ids.reverse, input.ids.cloze])).some(Boolean)) throw new DataError('このテストはすでに採点・保存されています。復習一覧で結果を確認してください。');
      const knowledge = await this.database.knowledge.get(input.knowledge.id);
      const progress = await this.database.progress.get(input.knowledge.id);
      if (!knowledge || !progress || knowledge.updated_at !== input.knowledge.updated_at || !sameProgress(progress, input.progress)) throw new ReviewError('stale', '知識または進捗が変更されています。復習一覧から開き直してください。');
      const result = completeFinalTest(knowledge, progress, input.responses, this.clock(), input.ids);
      result.attempts.forEach(a => attemptSchema.parse(a));
      await this.database.attempts.bulkAdd(result.attempts);
      await this.database.progress.put(result.progress);
      return result;
    });
  }
}
export const finalTestRepository = new FinalTestRepository();
