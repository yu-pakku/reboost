import { describe, expect, it } from 'vitest';
import { completeFinalTest, finalSessions, prepareFinalTest } from './final-test';
import { initialProgress, progressSchema, type Knowledge, type LearningProgress } from './knowledge';
import { completeReview, DAY_MS, reviewQueue } from './review';
const now = '2026-10-30T01:00:00.000Z';
const knowledge: Knowledge = { id: crypto.randomUUID(), term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: now, updated_at: now };
const pending = (): LearningProgress => ({ ...initialProgress(knowledge.id, now), status: 'final_due', level: undefined });
const ids = () => ({ session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() });
describe('最終テストと再学習', () => {
  it('M3の予定に達するまでは受験不可、到来後に2問を作成する', () => {
    expect(() => prepareFinalTest(knowledge, pending(), Date.parse(now) - 1)).toThrow('予定時刻');
    const question = prepareFinalTest(knowledge, pending(), Date.parse(now)); expect(question.reverse).toBe(knowledge.definition); expect(question.cloze).toBe('Web通信で利用される＿＿＿＿'); expect(question).not.toHaveProperty('answer');
  });
  it('正規化して全問正解なら定着状態を作り、キューから除外する', () => {
    const before = pending(); const result = completeFinalTest(knowledge, before, [' ＨＴＴＰ ', 'ﾌﾟﾛﾄｺﾙ'], now, ids());
    expect(before.status).toBe('final_due'); expect(result.passed).toBe(true); expect(result.correct).toEqual([true, true]);
    expect(result.progress).toMatchObject({ status: 'mastered', mastered_at: now, final_attempt_count: 1, last_review_at: now }); expect(result.progress.next_due_at).toBeUndefined(); expect(result.progress.level).toBeUndefined();
    expect(reviewQueue([{ knowledge, progress: result.progress }], Date.parse(now))).toEqual({ due: [], overdue: [], upcoming: [], final: [] });
    expect(finalSessions(result.attempts)).toMatchObject([{ valid: true, passed: true }]);
  });
  it.each([{ responses: ['誤答', 'プロトコル'], levels: [2] }, { responses: ['HTTP', '誤答'], levels: [3] }, { responses: ['誤答', '誤答'], levels: [2, 3] }])('$responses の失敗形式だけを再学習する', ({ responses, levels }) => {
    const result = completeFinalTest(knowledge, pending(), responses as [string, string], now, ids());
    expect(result.passed).toBe(false); expect(result.progress).toMatchObject({ status: 'learning', level: levels[0], successes_in_level: 0, relearning_levels: levels, next_due_at: '2026-10-31T01:00:00.000Z' });
    let progress = result.progress;
    let successCount = 0;
    while (progress.status === 'learning') {
      const time = progress.next_due_at!;
      const response = progress.level === 2 ? 'HTTP' : 'プロトコル';
      const next = completeReview(knowledge, progress, response, time, crypto.randomUUID()); successCount++;
      progress = next.progress;
      if (progress.status === 'final_due') expect(Date.parse(progress.next_due_at!) - Date.parse(time)).toBe(3 * DAY_MS);
    }
    expect(successCount).toBe(levels.length * 2); expect(progress.relearning_levels).toBeUndefined(); expect(progress.mastered_at).toBeUndefined(); expect(progress.final_attempt_count).toBe(1);
    const pass = completeFinalTest(knowledge, progress, ['HTTP', 'プロトコル'], progress.next_due_at!, ids()); expect(pass.progress.final_attempt_count).toBe(2);
  });
  it('再学習の失敗で対象形式と成功回数を保持する', () => {
    const retry = completeFinalTest(knowledge, pending(), ['誤答', 'プロトコル'], now, ids()).progress;
    const first = completeReview(knowledge, retry, 'HTTP', retry.next_due_at!, crypto.randomUUID()).progress;
    const failed = completeReview(knowledge, first, '誤答', first.next_due_at!, crypto.randomUUID()).progress;
    expect(failed).toMatchObject({ level: 2, successes_in_level: 1, relearning_levels: [2] });
  });
  it('穴埋め未設定・答え漏洩・空回答・アーカイブは採点しない', () => {
    expect(() => prepareFinalTest({ ...knowledge, cloze_start: -1 }, pending(), Date.parse(now))).toThrow('穴埋め');
    expect(() => prepareFinalTest({ ...knowledge, definition: 'HTTP用の説明', cloze_start: 4, cloze_end: 5 }, pending(), Date.parse(now))).toThrow('編集');
    expect(() => completeFinalTest(knowledge, pending(), ['HTTP', '　'], now, ids())).toThrow('2問とも');
    expect(() => completeFinalTest({ ...knowledge, archived_at: now }, pending(), ['HTTP', 'プロトコル'], now, ids())).toThrow('待ちでは');
  });
  it('再学習状態の不正な組み合わせはスキーマで拒否する', () => {
    for (const levels of [[3, 2], [2, 2], [], [1], [2, 3, 3]]) expect(progressSchema.safeParse({ ...initialProgress(knowledge.id, now), level: 2, relearning_levels: levels }).success).toBe(false);
    expect(progressSchema.safeParse({ ...pending(), relearning_levels: [2] }).success).toBe(false);
  });
});
