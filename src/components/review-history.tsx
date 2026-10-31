'use client';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '@/data/database';
import type { ReviewAttempt } from '@/domain/knowledge';
import { formatDate } from '@/lib/knowledge-display';
export function ReviewHistory({ knowledgeId }: { knowledgeId: string }) {
  const [history, setHistory] = useState<ReviewAttempt[]>();
  const [error, setError] = useState(false);
  useEffect(() => {
    const sub = liveQuery(() => db.attempts.where('knowledge_id').equals(knowledgeId).toArray()).subscribe({ next: attempts => setHistory(attempts.sort((a, b) => Date.parse(b.attempted_at) - Date.parse(a.attempted_at))), error: () => setError(true) });
    return () => sub.unsubscribe();
  }, [knowledgeId]);
  const labels = { l1_confirm: 'Level 1 確認', l2_reverse: 'Level 2 用語入力', l3_cloze: 'Level 3 穴埋め', final_reverse: '最終 用語入力', final_cloze: '最終 穴埋め' };
  return <section className="section-block" aria-labelledby="history-title"><h2 id="history-title">回答履歴</h2>{error ? <p role="alert">回答履歴を読み込めませんでした。</p> : !history ? <p className="field-note">読み込み中…</p> : history.length === 0 ? <p className="field-note">まだ回答履歴はありません。</p> : <><p className="field-note">全{history.length}件・直近20件を表示。内容変更前の履歴も含みます。</p><ol className="review-history">{history.slice(0, 20).map(attempt => <li key={attempt.id}><strong>{labels[attempt.kind]} · {attempt.is_correct === null ? '確認済み' : attempt.is_correct ? '正解' : '不正解'}</strong><time dateTime={attempt.attempted_at}>{formatDate(attempt.attempted_at)}</time>{attempt.response !== undefined && <p className="user-text">回答：{attempt.response}</p>}</li>)}</ol></>}</section>;
}
