import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { initialProgress, type ReviewAttempt } from '@/domain/knowledge';
import { learningStatistics } from '@/domain/statistics';
import type { ReviewEntry } from '@/domain/review';
import { calendarDays, calendarMonth, tokyoDateKey } from '@/lib/tokyo-calendar';
import { ReviewCalendar, calendarEvents } from './review-calendar';

const beforeMidnight = '2026-12-31T14:59:59.999Z';
const midnight = '2026-12-31T15:00:00.000Z';
const now = Date.parse(midnight);
function item(id: string, term: string, archived = false): ReviewEntry {
  return {
    knowledge: { id, term, definition: '定義のテスト', cloze_start: 0, cloze_end: 2, created_at: beforeMidnight, updated_at: beforeMidnight, ...(archived ? { archived_at: midnight } : {}) },
    progress: { ...initialProgress(id, beforeMidnight), status: archived ? 'archived' : 'learning' },
  };
}

it('JSTの深夜・年またぎ・閏日を端末のタイムゾーンと独立して扱う', () => {
  expect(tokyoDateKey(beforeMidnight)).toBe('2026-12-31');
  expect(tokyoDateKey(midnight)).toBe('2027-01-01');
  expect(calendarMonth('2027-01-01', -1)).toBe('2026-12-01');
  expect(calendarMonth('2026-12-31', 1)).toBe('2027-01-01');
  expect(calendarDays('2024-02-01').days.at(-1)).toBe('2024-02-29');
});

it('現在の予定と履歴を分け、完了した最終テストだけを各1受験として数える', () => {
  const entries = [item('learning', '学習中の項目'), item('archived', 'アーカイブ項目', true)];
  const attempts: ReviewAttempt[] = [
    { id: 'ordinary', knowledge_id: 'learning', kind: 'l1_confirm', is_correct: null, attempted_at: beforeMidnight },
    ...['pass', 'fail'].flatMap(session => (['final_reverse', 'final_cloze'] as const).map((kind, index) => ({
      id: session + index, knowledge_id: 'archived', kind, is_correct: session === 'pass' || index === 0,
      attempted_at: midnight, final_session_id: session,
    }))),
    { id: 'partial', knowledge_id: 'learning', kind: 'final_reverse', is_correct: true, attempted_at: midnight, final_session_id: 'incomplete' },
  ];
  const stats = learningStatistics(entries, attempts);
  expect(stats.days[0]).toMatchObject({ day: '2027-01-01', reviews: 2, final_passed: 1, final_failed: 1 });
  const days = calendarEvents(entries, stats.activity, now);
  expect(days.get('2026-12-31')).toMatchObject({ planned: [{ term: '学習中の項目' }], completed: [{ detail: 'Level 1・確認' }] });
  expect(days.get('2027-01-01')).toMatchObject({
    planned: [], completed: [{ term: 'アーカイブ項目', detail: '最終テスト・合格' }, { term: 'アーカイブ項目', detail: '最終テスト・不合格' }],
  });
  expect(days.size).toBe(2);
});

it('月送り・日付選択・日別リスト・今日への復帰で選択日の表示だけを変更する', () => {
  render(<ReviewCalendar entries={[item('ready', '昨日の予定')]} activity={[]} now={now}/>);
  expect(screen.getByRole('heading', { name: '2027年 1月' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '前月' }));
  fireEvent.click(screen.getByRole('button', { name: '2026年12月31日、実績0件、予定1件' }));
  const detail = screen.getByRole('region', { name: '選択した日の詳細' });
  expect(within(detail).getByText('昨日の予定')).toBeInTheDocument();
  expect(within(detail).queryByRole('button')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '日別リスト' }));
  expect(screen.getByRole('button', { name: '2026年12月31日、実績0件、予定1件' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '今日' }));
  expect(screen.getByRole('button', { name: '2027年1月1日、実績0件、予定0件' })).toHaveAttribute('aria-current', 'date');
  expect(within(detail).getByText('予定はありません。')).toBeInTheDocument();
});
