import type { ReviewEntry } from './review';
import type { ReviewAttempt } from './knowledge';
import { finalSessions } from './final-test';
import { tokyoDateKey } from '@/lib/tokyo-calendar';

export type LearningActivity = {
  id: string;
  knowledgeId: string;
  time: string;
  kind: Exclude<ReviewAttempt['kind'], 'final_reverse' | 'final_cloze'> | 'final';
  correct: boolean | null;
};

export function learningActivity(entries: ReviewEntry[], attempts: ReviewAttempt[]): LearningActivity[] {
  const ids = new Set(entries.map(entry => entry.knowledge.id));
  const existing = attempts.filter(attempt => ids.has(attempt.knowledge_id));
  const normal = existing.flatMap((attempt): LearningActivity[] => {
    if (attempt.kind === 'final_reverse' || attempt.kind === 'final_cloze') return [];
    return [{ id: attempt.id, knowledgeId: attempt.knowledge_id, time: attempt.attempted_at, kind: attempt.kind, correct: attempt.is_correct }];
  });
  const finals = finalSessions(existing).filter(session => session.valid).map((session): LearningActivity => ({
    id: session.id, knowledgeId: session.records[0].knowledge_id, time: session.completed_at, kind: 'final', correct: session.passed,
  }));
  return [...normal, ...finals].sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
}

export function learningStatistics(entries: ReviewEntry[], attempts: ReviewAttempt[]) {
  const activity = learningActivity(entries, attempts);
  const days = new Map<string, { day: string; reviews: number; final_passed: number; final_failed: number }>();
  let passed = 0, failed = 0;
  for (const event of activity) {
    const day = tokyoDateKey(event.time);
    const row = days.get(day) ?? { day, reviews: 0, final_passed: 0, final_failed: 0 };
    row.reviews++;
    if (event.kind === 'final') {
      if (event.correct) { row.final_passed++; passed++; }
      else { row.final_failed++; failed++; }
    }
    days.set(day, row);
  }
  return {
    registered: entries.length,
    mastered: entries.filter(e => !e.knowledge.archived_at && e.progress.status === 'mastered').length,
    learning: entries.filter(e => !e.knowledge.archived_at && (e.progress.status === 'learning' || e.progress.status === 'final_due')).length,
    reviews: activity.length, final_passed: passed, final_failed: failed,
    days: [...days.values()],
    activity,
  };
}
