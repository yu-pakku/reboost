'use client';
import Link from 'next/link';
import { useKnowledge } from '@/data/use-knowledge';
import { LoadingOrError } from './knowledge-pages';
export function KnowledgeSummary() {
  const { entries, error } = useKnowledge();
  return <section className="section-block" aria-labelledby="saved-title"><div className="section-heading"><h2 id="saved-title">保存した知識</h2><Link href="/knowledge" className="text-link">一覧を見る →</Link></div>{!entries ? <LoadingOrError error={error}/> : <><div className="summary-grid"><div className="summary-card"><span>登録件数</span><p>{entries.length}<small>件</small></p></div><div className="summary-card"><span>学習中</span><p>{entries.filter(e => e.progress.status === 'learning' || e.progress.status === 'final_due').length}<small>件</small></p></div></div><p className="muted small section-caption">{entries.length ? '知識はこのブラウザに保存されています。復習タブから学習できます。' : '最初の知識を追加してみましょう。'}</p></>}</section>;
}
export function MasteredCount() {
  const { entries, error } = useKnowledge();
  return <>{error ? <p className="field-error" role="alert">件数を読み込めませんでした。</p> : <p className="collection-count">{entries ? entries.filter(e => e.progress.status === 'mastered').length : '—'}<span>件</span></p>}</>;
}
