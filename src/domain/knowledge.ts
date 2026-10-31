import { z } from 'zod';

export const uuid = z.uuid();
export const utcDate = z.iso.datetime();
export const countCharacters = (value: string) => Array.from(value).length;
export const comparableText = (value: string) => value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
export interface KnowledgeDraft { term: string; definition: string; cloze_start: number; cloze_end: number }
export type FieldErrors = Partial<Record<'term' | 'definition' | 'cloze', string>>;

/** DOM selection offsets are UTF-16; disallow splitting graphemes (emoji, combining marks). */
export function textBoundaries(text: string): number[] {
  return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(text)].map(part => part.index).concat(text.length);
}
export function validateKnowledge(draft: KnowledgeDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!draft.term.trim() || countCharacters(draft.term.trim()) > 100) errors.term = '用語は1〜100文字で入力してください。';
  if (!draft.definition.trim() || countCharacters(draft.definition) > 1000) errors.definition = '意味・説明は1〜1000文字で入力してください。';
  const term = comparableText(draft.term);
  if (term && comparableText(draft.definition).includes(term)) errors.definition = '意味に用語が含まれています。逆向き問題で答えが見えるため、説明を書き直してください。';
  const { definition, cloze_start: start, cloze_end: end } = draft;
  const boundaries = new Set(textBoundaries(definition));
  const answer = definition.slice(start, end);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > definition.length || !boundaries.has(start) || !boundaries.has(end) || !answer.trim() || countCharacters(answer) > 100) {
    errors.cloze = '説明文から連続した1〜100文字を穴埋め箇所に指定してください（空白のみは不可）。';
  }
  return errors;
}
export function clozePreview(draft: KnowledgeDraft): string {
  return draft.definition.slice(0, draft.cloze_start) + '＿＿＿＿' + draft.definition.slice(draft.cloze_end);
}
const boundedText = (max: number) => z.string().refine(value => !!value.trim() && countCharacters(value) <= max);
export const knowledgeSchema = z.strictObject({
  id: uuid, term: boundedText(100), definition: boundedText(1000),
  cloze_start: z.number().int().min(0), cloze_end: z.number().int().min(1),
  created_at: utcDate, updated_at: utcDate, archived_at: utcDate.optional(),
}).superRefine((value, ctx) => {
  for (const [field, message] of Object.entries(validateKnowledge(value))) ctx.addIssue({ code: 'custom', path: [field], message });
  if (value.term !== value.term.trim()) ctx.addIssue({ code: 'custom', message: '用語の前後空白は保存できません。' });
  if (Date.parse(value.updated_at) < Date.parse(value.created_at)) ctx.addIssue({ code: 'custom', message: '更新日時が不正です。' });
});
export type Knowledge = z.infer<typeof knowledgeSchema>;
export const progressSchema = z.strictObject({
  knowledge_id: uuid, status: z.enum(['learning', 'final_due', 'mastered', 'archived']),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), successes_in_level: z.union([z.literal(0), z.literal(1)]),
  next_due_at: utcDate.optional(), last_review_at: utcDate.optional(), mastered_at: utcDate.optional(),
  relearning_levels: z.array(z.union([z.literal(2), z.literal(3)])).min(1).max(2).optional(),
  final_attempt_count: z.number().int().nonnegative(), updated_at: utcDate,
}).superRefine((p, ctx) => {
  const valid = p.status === 'learning' ? p.level !== undefined && !!p.next_due_at && !p.mastered_at
    : p.status === 'final_due' ? !p.level && !!p.next_due_at && !p.mastered_at && p.successes_in_level === 0
    : p.status === 'mastered' ? !!p.mastered_at && !p.next_due_at && !p.level && p.successes_in_level === 0
    : !p.next_due_at;
  if (p.relearning_levels && (!(p.status === 'learning' || p.status === 'archived') || p.level !== p.relearning_levels[0] || p.relearning_levels.some((level, i, levels) => i > 0 && level <= levels[i - 1]))) ctx.addIssue({ code: 'custom', message: '再学習の形式が不正です。' });
  if (!valid) ctx.addIssue({ code: 'custom', message: '学習状態の組み合わせが不正です。' });
});
export type LearningProgress = z.infer<typeof progressSchema>;
export const attemptSchema = z.strictObject({
  id: uuid, knowledge_id: uuid,
  kind: z.enum(['l1_confirm', 'l2_reverse', 'l3_cloze', 'final_reverse', 'final_cloze']),
  response: z.string().max(4000).optional(), is_correct: z.boolean().nullable(), attempted_at: utcDate, final_session_id: uuid.optional(),
}).superRefine((a, ctx) => {
  if ((a.kind === 'l1_confirm' ? a.is_correct !== null : typeof a.is_correct !== 'boolean') || (a.kind.startsWith('final_') && !a.final_session_id)) ctx.addIssue({ code: 'custom', message: '解答履歴が不正です。' });
});
export type ReviewAttempt = z.infer<typeof attemptSchema>;
export const settingsSchema = z.strictObject({
  id: z.literal('app'), locale: z.literal('ja-JP'), timezone: z.literal('Asia/Tokyo'),
  notification_preference: z.enum(['disabled', 'enabled']), preferred_daily_reminder_hour: z.number().int().min(0).max(23), data_schema_version: z.literal(1),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = { id: 'app', locale: 'ja-JP', timezone: 'Asia/Tokyo', notification_preference: 'disabled', preferred_daily_reminder_hour: 9, data_schema_version: 1 };
export function initialProgress(id: string, now: string): LearningProgress {
  return { knowledge_id: id, status: 'learning', level: 1, successes_in_level: 0, next_due_at: now, final_attempt_count: 0, updated_at: now };
}
export function contentChanged(a: KnowledgeDraft, b: KnowledgeDraft) {
  return a.term !== b.term.trim() || a.definition !== b.definition || a.cloze_start !== b.cloze_start || a.cloze_end !== b.cloze_end;
}
