import { describe, expect, it } from 'vitest';
import { buildQuestion, completeReview, DAY_MS, gradeAnswer, REVIEW_INTERVALS, reviewGroup, reviewQueue } from './review';
import { initialProgress, type Knowledge, type LearningProgress } from './knowledge';
const start = '2026-10-30T01:00:00.000Z';
const knowledge: Knowledge = { id: '48dd520f-dff2-40c5-ab92-2b8b234aeecc', term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: start, updated_at: start };
const initial = () => initialProgress(knowledge.id, start);
const id = () => crypto.randomUUID();
describe('明示的な文字列比較', () => {
  it.each([[' ＨＴＴＰ　', 'http', true], ['e\u0301', 'é', true], [' A\n\t B ', 'a b', true], ['ﾌﾟﾛﾄｺﾙ', 'プロトコル', true], ['🧠', '🧠', true], ['通信規約', 'プロトコル', false], ['a b', 'ab', false], ['HTTP!', 'HTTP', false], ['\u200bHTTP', 'HTTP', false], ['　\n', ' ', false]])('%j と %j → %s', (response, expected, correct) => {
    expect(gradeAnswer(response, expected)).toBe(correct);
  });
});
describe('3段階学習の純粋な状態遷移', () => {
  it('1件だけで6成功後にfinal_dueへ進み、定着済みにしない', () => {
    let progress = initial();
    const states = [[1, 1], [2, 0], [2, 1], [3, 0], [3, 1], [undefined, 0]];
    const delays = [1, 1, 1, 2, 2, 3];
    const attempts = [];
    for (let i = 0; i < 6; i++) {
      const completed = progress.next_due_at!;
      const response = progress.level === 2 ? ' ＨＴＴＰ ' : progress.level === 3 ? 'プロトコル' : undefined;
      const previous = structuredClone(progress);
      const result = completeReview(knowledge, progress, response, completed, id());
      expect(progress).toEqual(previous); // no mutation of the supplied state
      expect(result.progress.level).toBe(states[i][0]); expect(result.progress.successes_in_level).toBe(states[i][1]);
      expect(Date.parse(result.progress.next_due_at!) - Date.parse(completed)).toBe(delays[i] * DAY_MS);
      expect(result.progress.last_review_at).toBe(completed); expect(result.progress.updated_at).toBe(completed);
      attempts.push(result.attempt); progress = result.progress;
    }
    expect(progress.status).toBe('final_due'); expect(progress.mastered_at).toBeUndefined(); expect(progress.final_attempt_count).toBe(0);
    expect(attempts.map(a => a.kind)).toEqual(['l1_confirm', 'l1_confirm', 'l2_reverse', 'l2_reverse', 'l3_cloze', 'l3_cloze']);
    expect(attempts[0].is_correct).toBeNull(); expect(attempts[0].response).toBeUndefined();
    expect(REVIEW_INTERVALS.failureDays).toBe(1);
  });
  it.each([2, 3] as const)('L%s不正解でレベルと成功回数を保持して1日後へ', level => {
    for (const successes of [0, 1] as const) {
      const progress: LearningProgress = { ...initial(), level, successes_in_level: successes };
      const result = completeReview(knowledge, progress, '誤答', start, id());
      expect(result.correct).toBe(false); expect(result.progress.level).toBe(level); expect(result.progress.successes_in_level).toBe(successes);
      expect(result.answer).toBe(level === 2 ? 'HTTP' : 'プロトコル'); expect(result.attempt.response).toBe('誤答');
      expect(Date.parse(result.progress.next_due_at!) - Date.parse(start)).toBe(DAY_MS);
      expect(() => completeReview(knowledge, result.progress, result.answer, start, id())).toThrow('予定時刻');
    }
  });
  it('期限を過ぎても自動消化せず、遅れた完了時刻から計算する', () => {
    const progress = initial(); const late = '2027-03-01T12:34:56.000Z';
    expect(reviewGroup({ knowledge, progress }, Date.parse(late))).toBe('overdue'); expect(progress).toEqual(initial());
    const result = completeReview(knowledge, progress, undefined, late, id());
    expect(result.progress.level).toBe(1); expect(result.progress.successes_in_level).toBe(1); expect(result.progress.next_due_at).toBe('2027-03-02T12:34:56.000Z');
  });
  it('空回答、未到来、学習対象外の状態を拒否する', () => {
    expect(() => completeReview(knowledge, { ...initial(), level: 2 }, '　\n', start, id())).toThrow('回答');
    expect(() => completeReview(knowledge, initial(), undefined, '2026-10-30T00:59:59.999Z', id())).toThrow('予定時刻');
    expect(() => completeReview(knowledge, { ...initial(), status: 'archived', next_due_at: undefined }, undefined, start, id())).toThrow('対象');
    expect(() => completeReview(knowledge, { ...initial(), status: 'final_due', level: undefined }, undefined, start, id())).toThrow('対象');
    expect(() => completeReview(knowledge, { ...initial(), level: 2 }, 'a'.repeat(4001), start, id())).toThrow('4000');
  });
  it('問題データはL2で用語を、L3で指定の正答を含めない', () => {
    const reverse = buildQuestion(knowledge, { ...initial(), level: 2 });
    expect(reverse).not.toHaveProperty('term'); expect(JSON.stringify(reverse)).not.toContain('HTTP');
    const cloze = buildQuestion(knowledge, { ...initial(), level: 3 });
    expect(cloze.prompt).toBe('Web通信で利用される＿＿＿＿'); expect(JSON.stringify(cloze)).not.toContain('プロトコル');
    const repeated = { ...knowledge, definition: '猫と猫', cloze_start: 2, cloze_end: 3 };
    expect(buildQuestion(repeated, { ...initial(), level: 3 }).prompt).toBe('猫と＿＿＿＿');
  });
  it('L2の答え漏洩とL3の未設定・不正オフセットを出題しない', () => {
    expect(() => buildQuestion({ ...knowledge, definition: 'ｈｔｔｐの通信' }, { ...initial(), level: 2 })).toThrow('編集');
    expect(() => buildQuestion({ ...knowledge, cloze_start: -1 }, { ...initial(), level: 3 })).toThrow('穴埋め');
    expect(() => buildQuestion({ ...knowledge, cloze_end: undefined } as unknown as Knowledge, { ...initial(), level: 3 })).toThrow('穴埋め');
    expect(() => buildQuestion({ ...knowledge, definition: '🧠の例', cloze_start: 0, cloze_end: 1 }, { ...initial(), level: 3 })).toThrow('穴埋め');
  });
});
describe('日本時間での予定分類', () => {
  const entry = (next_due_at: string, key = knowledge.id) => ({ knowledge: { ...knowledge, id: key }, progress: { ...initial(), knowledge_id: key, next_due_at } });
  it('期限境界・日本時間の日付境界で分類し、予定が早い順に並べる', () => {
    const now = Date.parse('2026-10-30T15:00:00.000Z'); // JST 10/31 00:00
    const earlier = entry('2026-10-30T01:00:00.000Z', 'a');
    const yesterday = entry('2026-10-30T14:59:59.999Z', 'b');
    const due = entry('2026-10-30T15:00:00.000Z', 'c'); const upcoming = entry('2026-10-30T15:00:00.001Z', 'd');
    const queue = reviewQueue([upcoming, yesterday, earlier, due], now);
    expect(queue.overdue.map(e => e.knowledge.id)).toEqual(['a', 'b']); expect(queue.due).toEqual([due]); expect(queue.upcoming).toEqual([upcoming]);
  });
  it('アーカイブ・定着済みを除外し、最終待ちは学習キューに入れない', () => {
    const base = entry(start);
    expect(reviewGroup({ ...base, knowledge: { ...base.knowledge, archived_at: start } }, Date.parse(start))).toBeUndefined();
    expect(reviewGroup({ ...base, progress: { ...base.progress, status: 'archived' } }, Date.parse(start))).toBeUndefined();
    expect(reviewGroup({ ...base, progress: { ...base.progress, status: 'mastered' } }, Date.parse(start))).toBeUndefined();
    expect(reviewGroup({ ...base, progress: { ...base.progress, status: 'final_due', level: undefined } }, Date.parse(start))).toBe('final');
  });
});
