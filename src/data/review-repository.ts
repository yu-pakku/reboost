import { db, type ReboostDatabase } from './database';
import { DataError } from './knowledge-repository';
import { attemptSchema, type Knowledge, type LearningProgress } from '@/domain/knowledge';
import { completeReview, ReviewError, type ReviewResult } from '@/domain/review';
export interface ReviewSubmission {
  id: string;
  knowledge: Knowledge;
  progress: LearningProgress;
  response?: string;
}
export const sameProgress = (a: LearningProgress, b: LearningProgress) =>
  a.knowledge_id === b.knowledge_id && a.updated_at === b.updated_at && a.status === b.status && a.level === b.level && a.successes_in_level === b.successes_in_level && a.next_due_at === b.next_due_at && a.last_review_at === b.last_review_at && a.final_attempt_count === b.final_attempt_count && a.mastered_at === b.mastered_at && JSON.stringify(a.relearning_levels) === JSON.stringify(b.relearning_levels);
export class ReviewRepository {
  constructor(private readonly database: ReboostDatabase = db, private readonly clock: () => string = () => new Date().toISOString()) {}
  async submit(input: ReviewSubmission): Promise<ReviewResult> {
    return this.database.transaction('rw', this.database.knowledge, this.database.progress, this.database.attempts, async () => {
      // Retries with the same id never write another record, including after a reload.
      if (await this.database.attempts.get(input.id)) throw new DataError('この回答はすでに保存されています。復習一覧に戻って進捗を確認してください。');
      const knowledge = await this.database.knowledge.get(input.knowledge.id);
      const progress = await this.database.progress.get(input.knowledge.id);
      if (!knowledge || !progress || knowledge.updated_at !== input.knowledge.updated_at || !sameProgress(progress, input.progress)) throw new ReviewError('stale', '別の画面で知識または進捗が変わりました。復習一覧に戻って開き直してください。');
      const result = completeReview(knowledge, progress, input.response, this.clock(), input.id);
      attemptSchema.parse(result.attempt);
      await this.database.attempts.add(result.attempt);
      await this.database.progress.put(result.progress);
      return result;
    });
  }
}
export const reviewRepository = new ReviewRepository();
export function reviewError(error: unknown): string {
  return error instanceof ReviewError || error instanceof DataError ? error.message : '回答を保存できませんでした。入力を残したまま再試行できます。空き容量やブラウザの保存設定を確認してください。';
}
