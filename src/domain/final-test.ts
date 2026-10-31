import { comparableText, progressSchema, validateKnowledge, clozePreview, type Knowledge, type LearningProgress, type ReviewAttempt } from './knowledge';
import { gradeAnswer, DAY_MS, REVIEW_INTERVALS, ReviewError } from './review';
export function prepareFinalTest(knowledge: Knowledge, progress: LearningProgress, now: number) {
  if (!Number.isFinite(now)) throw new ReviewError('state', '受験日時が不正です。');
  if (!progressSchema.safeParse(progress).success || progress.status !== 'final_due' || knowledge.archived_at || progress.knowledge_id !== knowledge.id) throw new ReviewError('state', 'この知識は最終テスト待ちではありません。');
  const errors = validateKnowledge(knowledge);
  if (errors.cloze) throw new ReviewError('cloze', '穴埋め箇所が未設定または無効です。知識を編集して指定すると受験できます。');
  if (errors.term || errors.definition) throw new ReviewError('leak', '用語または説明文に問題があります。答えが見えない説明へ編集してください。');
  if (now < Date.parse(progress.next_due_at!)) throw new ReviewError('early', '最終テストの予定時刻までお待ちください。');
  return { reverse: knowledge.definition, cloze: clozePreview(knowledge) };
}
export interface FinalIds { session: string; reverse: string; cloze: string }
export interface FinalResult { progress: LearningProgress; attempts: [ReviewAttempt, ReviewAttempt]; passed: boolean; correct: [boolean, boolean]; answers: [string, string] }
export function completeFinalTest(knowledge: Knowledge, progress: LearningProgress, responses: [string, string], completedAt: string, ids: FinalIds): FinalResult {
  const now = Date.parse(completedAt);
  if (!Number.isFinite(now)) throw new ReviewError('state', '受験日時が不正です。');
  prepareFinalTest(knowledge, progress, now);
  if (responses.some(response => !comparableText(response) || response.length > 4000)) throw new ReviewError('empty', '2問とも空白のみを除く4000文字以内で回答してください。');
  const answers: [string, string] = [knowledge.term, knowledge.definition.slice(knowledge.cloze_start, knowledge.cloze_end)];
  const correct: [boolean, boolean] = [gradeAnswer(responses[0], answers[0]), gradeAnswer(responses[1], answers[1])];
  const passed = correct.every(Boolean);
  const next: LearningProgress = { ...progress, successes_in_level: 0, final_attempt_count: progress.final_attempt_count + 1, last_review_at: completedAt, updated_at: completedAt };
  if (passed) { next.status = 'mastered'; next.mastered_at = completedAt; delete next.level; delete next.next_due_at; delete next.relearning_levels; }
  else {
    const levels: (2 | 3)[] = [];
    if (!correct[0]) levels.push(2);
    if (!correct[1]) levels.push(3);
    next.status = 'learning'; next.level = levels[0]; next.relearning_levels = levels;
    delete next.mastered_at;
    next.next_due_at = new Date(now + REVIEW_INTERVALS.finalFailureDays * DAY_MS).toISOString();
  }
  const attempts: [ReviewAttempt, ReviewAttempt] = [
    { id: ids.reverse, knowledge_id: knowledge.id, kind: 'final_reverse', response: responses[0], is_correct: correct[0], attempted_at: completedAt, final_session_id: ids.session },
    { id: ids.cloze, knowledge_id: knowledge.id, kind: 'final_cloze', response: responses[1], is_correct: correct[1], attempted_at: completedAt, final_session_id: ids.session },
  ];
  return { progress: progressSchema.parse(next), attempts, passed, correct, answers };
}
/** A completed final session is represented by exactly one reverse + one cloze answer. */
export function finalSessions(attempts: ReviewAttempt[]) {
  const groups = new Map<string, ReviewAttempt[]>();
  for (const a of attempts) if (a.kind === 'final_reverse' || a.kind === 'final_cloze') {
    const key = a.final_session_id ?? '';
    const group = groups.get(key) ?? []; group.push(a); groups.set(key, group);
  }
  return [...groups.entries()].map(([id, records]) => {
    const valid = !!id && records.length === 2 && records[0].knowledge_id === records[1].knowledge_id && records[0].attempted_at === records[1].attempted_at && records[0].kind !== records[1].kind && records.every(a => typeof a.is_correct === 'boolean');
    return { id, records, valid, passed: valid && records.every(a => a.is_correct), completed_at: records[0].attempted_at };
  });
}
