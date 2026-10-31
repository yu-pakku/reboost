'use client';
import Link from 'next/link';
import { useKnowledge } from '@/data/use-knowledge';
import { reviewQueue } from '@/domain/review';
import { useReviewClock } from '@/lib/use-review-clock';
import { LoadingOrError } from './knowledge-pages';
export function ReviewSummary() {
  const { entries, error } = useKnowledge();
  const now = useReviewClock();
  const queue = reviewQueue(entries ?? [], now);
  const finalReady = queue.final.filter(e => Date.parse(e.progress.next_due_at!) <= now).length;
  return <section className="section-block" aria-labelledby="review-summary-title"><div className="section-heading"><h2 id="review-summary-title">今日の復習</h2><Link href="/review" className="text-link">復習へ →</Link></div>{!entries ? <LoadingOrError error={error}/> : <div className="summary-grid"><div className="summary-card"><span>今すべき</span><p>{queue.due.length}<small>件</small></p></div><div className="summary-card"><span>期限超過</span><p>{queue.overdue.length}<small>件</small></p></div></div>}{finalReady > 0 && <Link className="text-link" href="/review">最終テスト {finalReady}件が受験可能 →</Link>}<p className="field-note">未完了の課題は、予定を過ぎても復習できます。</p></section>;
}
