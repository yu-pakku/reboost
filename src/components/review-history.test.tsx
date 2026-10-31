import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { db } from '@/data/database';
import { ReviewHistory } from './review-history';
beforeEach(async () => { await db.open(); });
afterEach(async () => { cleanup(); db.close(); await db.delete(); });
it('保存済み履歴の回答・正否・日本時間を表示し、別の知識は混ぜない', async () => {
  const knowledgeId = crypto.randomUUID();
  await db.attempts.bulkAdd([
    { id: crypto.randomUUID(), knowledge_id: knowledgeId, kind: 'l2_reverse', response: '誤答', is_correct: false, attempted_at: '2026-10-30T01:00:00.000Z' },
    { id: crypto.randomUUID(), knowledge_id: crypto.randomUUID(), kind: 'l2_reverse', response: '別の知識の回答', is_correct: true, attempted_at: '2026-10-30T02:00:00.000Z' },
  ]);
  render(<ReviewHistory knowledgeId={knowledgeId}/>);
  expect(await screen.findByText('Level 2 用語入力 · 不正解')).toBeInTheDocument(); expect(screen.getByText('回答：誤答')).toBeInTheDocument(); expect(screen.getByText('2026年10月30日 10:00')).toBeInTheDocument(); expect(screen.queryByText(/別の知識の回答/)).not.toBeInTheDocument();
});
it('履歴がないときの空状態を表示する', async () => {
  render(<ReviewHistory knowledgeId={crypto.randomUUID()}/>); expect(await screen.findByText('まだ回答履歴はありません。')).toBeInTheDocument();
});
