import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { LearningStatistics } from './learning-statistics';
vi.mock('@/data/use-statistics', () => ({ useStatistics: () => ({ statistics: { registered: 3, mastered: 1, learning: 2, reviews: 8, final_passed: 1, final_failed: 1, days: [{ day: '2026-10-31', reviews: 8, final_passed: 1, final_failed: 1 }] } }) }));
it('要求された6統計と日別履歴を表示する', () => {
  render(<LearningStatistics/>);
  for (const [name, value] of [['登録知識数', '3件'], ['定着済み（アプリ判定）', '1件'], ['学習中', '2件'], ['復習実施回数', '8回'], ['最終テスト合格', '1回'], ['最終テスト不合格', '1回']]) {
    expect(screen.getByText(name).parentElement).toHaveTextContent(value);
  }
  const table = screen.getByRole('table'); expect(within(table).getByRole('rowheader', { name: '2026-10-31' })).toBeInTheDocument(); expect(document.body).toHaveTextContent('永久記憶の保証ではありません');
});
