import { expect, it } from 'vitest';
import { learningStatistics } from './statistics';
import { completeFinalTest } from './final-test';
import { particlePosition } from './brain';
import { initialProgress, type Knowledge, type LearningProgress } from './knowledge';
const time = '2026-10-30T15:00:00.000Z';
const knowledge: Knowledge = { id: crypto.randomUUID(), term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: time, updated_at: time };
const pending: LearningProgress = { ...initialProgress(knowledge.id, time), status: 'final_due', level: undefined };
const ids = () => ({ session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() });
it('通常復習1回と最終受験1回を区別し、JSTの日別に集計する', () => {
  const fail = completeFinalTest(knowledge, pending, ['誤答', 'プロトコル'], time, ids());
  const pass = completeFinalTest(knowledge, { ...pending, final_attempt_count: 1 }, ['HTTP', 'プロトコル'], time, ids());
  const attempts = [{ id: crypto.randomUUID(), knowledge_id: knowledge.id, kind: 'l1_confirm' as const, is_correct: null, attempted_at: '2026-10-30T14:59:59.999Z' }, ...fail.attempts, ...pass.attempts];
  const stats = learningStatistics([{ knowledge, progress: pass.progress }], attempts);
  expect(stats).toMatchObject({ registered: 1, mastered: 1, learning: 0, reviews: 3, final_passed: 1, final_failed: 1 });
  expect(stats.days).toEqual([{ day: '2026-10-31', reviews: 2, final_passed: 1, final_failed: 1 }, { day: '2026-10-30', reviews: 1, final_passed: 0, final_failed: 0 }]);
  expect(learningStatistics([], attempts)).toMatchObject({ registered: 0, mastered: 0, reviews: 0 });
});
it('アーカイブは登録総数に含むが定着・学習中には含めず、履歴は保持する', () => {
  const pass = completeFinalTest(knowledge, pending, ['HTTP', 'プロトコル'], time, ids());
  expect(learningStatistics([{ knowledge: { ...knowledge, archived_at: time }, progress: { ...pass.progress, status: 'archived' } }], pass.attempts)).toMatchObject({ registered: 1, mastered: 0, learning: 0, reviews: 1, final_passed: 1 });
});
it('空状態と未完了セッションを集計しない', () => {
  expect(learningStatistics([], []).days).toEqual([]);
  const pass = completeFinalTest(knowledge, pending, ['HTTP', 'プロトコル'], time, ids());
  expect(learningStatistics([{ knowledge, progress: pending }], [pass.attempts[0]])).toMatchObject({ registered: 1, learning: 1, reviews: 0, final_passed: 0 });
});
it('粒子座標はIDだけで決まり、再表示や追加によって動かず脳の内側にある', () => {
  const point = particlePosition(knowledge.id); expect(particlePosition(knowledge.id)).toEqual(point);
  for (let i = 0; i < 1000; i++) { const p = particlePosition(`knowledge-${i}`); expect(p.x).toBeGreaterThanOrEqual(52); expect(p.x).toBeLessThanOrEqual(268); expect(p.y).toBeGreaterThanOrEqual(58); expect(p.y).toBeLessThanOrEqual(198); }
});
