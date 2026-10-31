import type { ReviewEntry } from './review';
import type { ReviewAttempt } from './knowledge';
import { finalSessions } from './final-test';
export function learningStatistics(entries: ReviewEntry[], attempts: ReviewAttempt[]) {
  const ids = new Set(entries.map(e => e.knowledge.id));
  const existing = attempts.filter(a => ids.has(a.knowledge_id));
  const normal = existing.filter(a => !a.kind.startsWith('final_'));
  const finals = finalSessions(existing).filter(s => s.valid);
  const activity = new Map<string, { day: string; reviews: number; final_passed: number; final_failed: number }>();
  function add(time: string, passed?: boolean) {
    // UTC+9 is the fixed Asia/Tokyo display timezone.
    const day = new Date(Date.parse(time) + 9 * 3600000).toISOString().slice(0, 10);
    const row = activity.get(day) ?? { day, reviews: 0, final_passed: 0, final_failed: 0 };
    row.reviews++;
    if (passed === true) row.final_passed++;
    if (passed === false) row.final_failed++;
    activity.set(day, row);
  }
  normal.forEach(a => add(a.attempted_at)); finals.forEach(s => add(s.completed_at, s.passed));
  return { registered: entries.length, mastered: entries.filter(e => !e.knowledge.archived_at && e.progress.status === 'mastered').length,
    learning: entries.filter(e => !e.knowledge.archived_at && (e.progress.status === 'learning' || e.progress.status === 'final_due')).length,
    reviews: normal.length + finals.length, final_passed: finals.filter(s => s.passed).length, final_failed: finals.filter(s => !s.passed).length,
    days: [...activity.values()].sort((a, b) => b.day.localeCompare(a.day)),
  };
}
