import { comparableText, clozePreview, progressSchema, validateKnowledge, type Knowledge, type LearningProgress, type ReviewAttempt } from './knowledge';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Provisional SPEC §6 defaults. Durations are elapsed 24h days, not calendar midnights. */
export const REVIEW_INTERVALS = {
  successDays: { 1: [1, 1], 2: [1, 2], 3: [2, 3] },
  failureDays: 1,
  finalFailureDays: 1,
} as const;
export type ReviewKind = 'l1_confirm' | 'l2_reverse' | 'l3_cloze';
export class ReviewError extends Error {
  constructor(public readonly code: 'state' | 'early' | 'empty' | 'cloze' | 'leak' | 'stale', message: string) { super(message); }
}
export type ReviewQuestion = { kind: ReviewKind; prompt: string; term?: string; level: 1 | 2 | 3; successes: 0 | 1 };
export type ReviewEntry = { knowledge: Knowledge; progress: LearningProgress };
export function buildQuestion(knowledge: Knowledge, progress: LearningProgress): ReviewQuestion {
  if (!progressSchema.safeParse(progress).success || progress.status !== 'learning' || knowledge.archived_at || progress.knowledge_id !== knowledge.id) throw new ReviewError('state', 'この知識は現在の学習対象ではありません。');
  const level = progress.level!;
  const errors = validateKnowledge(knowledge);
  if (level === 3 && errors.cloze) throw new ReviewError('cloze', '穴埋め箇所が未設定または無効です。知識の編集で指定してください。');
  if (level === 2 && errors.definition) throw new ReviewError('leak', '説明文に問題があります。答えが見えないよう、知識の編集で修正してください。');
  return { kind: level === 1 ? 'l1_confirm' : level === 2 ? 'l2_reverse' : 'l3_cloze', level, successes: progress.successes_in_level,
    prompt: level === 3 ? clozePreview(knowledge) : knowledge.definition,
    ...(level === 1 ? { term: knowledge.term } : {}),
  };
}
export function gradeAnswer(response: string, expected: string): boolean {
  return !!comparableText(response) && comparableText(response) === comparableText(expected);
}
export type ReviewResult = { progress: LearningProgress; attempt: ReviewAttempt; correct: boolean | null; answer?: string };
/** No clock, storage or UI: the caller supplies completion time and the unique attempt id. */
export function completeReview(knowledge: Knowledge, progress: LearningProgress, response: string | undefined, attemptedAt: string, attemptId: string): ReviewResult {
  const question = buildQuestion(knowledge, progress);
  const now = Date.parse(attemptedAt);
  if (!Number.isFinite(now)) throw new ReviewError('state', '回答日時が不正です。');
  if (now < Date.parse(progress.next_due_at!)) throw new ReviewError('early', 'まだ復習予定時刻になっていません。');
  if (question.level !== 1 && (!response || !comparableText(response) || response.length > 4000)) throw new ReviewError('empty', '回答は空白のみを除く4000文字以内で入力してください。');
  const answer = question.level === 2 ? knowledge.term : question.level === 3 ? knowledge.definition.slice(knowledge.cloze_start, knowledge.cloze_end) : undefined;
  const correct = question.level === 1 ? null : gradeAnswer(response!, answer!);
  const succeeded = question.level === 1 || correct === true;
  const finishesRelearning = succeeded && progress.successes_in_level === 1 && progress.relearning_levels?.length === 1;
  const days = finishesRelearning ? REVIEW_INTERVALS.successDays[3][1] : succeeded ? REVIEW_INTERVALS.successDays[question.level][progress.successes_in_level] : REVIEW_INTERVALS.failureDays;
  const next: LearningProgress = { ...progress, last_review_at: attemptedAt, updated_at: attemptedAt, next_due_at: new Date(now + days * DAY_MS).toISOString() };
  if (succeeded) {
    if (progress.successes_in_level === 0) next.successes_in_level = 1;
    else {
      next.successes_in_level = 0;
      if (question.level === 3 || finishesRelearning) { next.status = 'final_due'; delete next.level; delete next.relearning_levels; }
      else { next.level = question.level === 1 ? 2 : 3; if (next.relearning_levels) next.relearning_levels = next.relearning_levels.slice(1); }
    }
  }
  const attempt: ReviewAttempt = { id: attemptId, knowledge_id: knowledge.id, kind: question.kind, ...(question.level !== 1 ? { response } : {}), is_correct: correct, attempted_at: attemptedAt };
  return { progress: progressSchema.parse(next), attempt, correct, ...(answer ? { answer } : {}) };
}
export type QueueGroup = 'due' | 'overdue' | 'upcoming' | 'final';
const tokyoDay = (time: number) => Math.floor((time + 9 * 60 * 60 * 1000) / DAY_MS);
export function reviewGroup(entry: ReviewEntry, now: number): QueueGroup | undefined {
  const { knowledge: k, progress: p } = entry;
  if (k.archived_at || p.status === 'archived' || p.status === 'mastered' || !p.next_due_at || !Number.isFinite(Date.parse(p.next_due_at))) return;
  if (p.status === 'final_due') return 'final';
  const due = Date.parse(p.next_due_at);
  return due > now ? 'upcoming' : tokyoDay(due) < tokyoDay(now) ? 'overdue' : 'due';
}
export function reviewQueue(entries: ReviewEntry[], now: number): Record<QueueGroup, ReviewEntry[]> {
  const groups: Record<QueueGroup, ReviewEntry[]> = { due: [], overdue: [], upcoming: [], final: [] };
  for (const entry of entries) { const group = reviewGroup(entry, now); if (group) groups[group].push(entry); }
  for (const list of Object.values(groups)) list.sort((a, b) => Date.parse(a.progress.next_due_at!) - Date.parse(b.progress.next_due_at!) || a.knowledge.id.localeCompare(b.knowledge.id));
  return groups;
}
