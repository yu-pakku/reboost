'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { AppShell } from './app-shell';
import { EmptyState } from './empty-state';
import { LoadingOrError } from './knowledge-pages';
import { ReviewCalendar } from './review-calendar';
import { useStatistics } from '@/data/use-statistics';
import { useKnowledge } from '@/data/use-knowledge';
import { buildQuestion, reviewQueue, ReviewError, type ReviewEntry, type ReviewQuestion, type ReviewResult, type QueueGroup } from '@/domain/review';
import { reviewRepository, reviewError } from '@/data/review-repository';
import { comparableText } from '@/domain/knowledge';
import { formatDate, progressLabel } from '@/lib/knowledge-display';
import { useReviewClock } from '@/lib/use-review-clock';

export function ReviewScreen() {
  const { entries, error } = useKnowledge();
  const { statistics, error: activityError } = useStatistics();
  const now = useReviewClock();
  const [active, setActive] = useState<{ entry: ReviewEntry; id: string }>();
  const queue = reviewQueue(entries ?? [], now);
  const ready = queue.overdue.length + queue.due.length;
  const available = { ...queue, final: queue.final.filter(e => Date.parse(e.progress.next_due_at!) <= now) };
  const finalReady = available.final.length;
  return <AppShell active="/review" hideNav={!!active}>
    {active ? <ReviewExercise key={active.id} entry={active.entry} attemptId={active.id} remaining={ready} onBack={() => setActive(undefined)}/> : <>
      <div className="page-intro"><h1>復習</h1><p className="intro-copy">通常の復習は{ready}件、受験可能な最終テストは{finalReady}件です。</p></div>
      {!entries ? <LoadingOrError error={error}/> : <>
        {!entries.length && <EmptyState title="まだ知識がありません">ホームから最初の知識を登録しましょう。<Link className="text-link" href="/knowledge/new">知識を追加 →</Link></EmptyState>}
        <section className="calendar-ready" aria-label="今できる学習">
        {([{ group: 'overdue', title: '期限超過', empty: '前日以前の未完了の復習はありません。' }, { group: 'due', title: '今すべき', empty: '今日、予定時刻を迎えた復習はありません。' }, { group: 'final', title: '最終テスト待ち', empty: '受験可能な最終テストはありません。' }] satisfies { group: QueueGroup; title: string; empty: string }[]).map(section => <section className="section-block review-queue" key={section.group} aria-labelledby={`queue-${section.group}`}><div className="section-heading"><h2 id={`queue-${section.group}`}>{section.title}</h2><span className="count-badge">{available[section.group].length}件</span></div>
          {available[section.group].length ? <ul>{available[section.group].map(entry => <li key={entry.knowledge.id}><div><h3 className="user-text">{entry.knowledge.term}</h3><p>{progressLabel(entry.progress)}</p><time dateTime={entry.progress.next_due_at}>{formatDate(entry.progress.next_due_at!)}</time></div>
            {section.group === 'due' || section.group === 'overdue' ? <button className="secondary-button" onClick={() => setActive({ entry, id: crypto.randomUUID() })} aria-label={`${entry.knowledge.term}を復習`}>復習する</button> : section.group === 'final' ? <Link className="secondary-button" href={`/test/${entry.knowledge.id}`}>最終テストへ</Link> : <span className="status-label">予定時刻まで待機</span>}
          </li>)}</ul> : <p className="field-note">{section.empty}</p>}
        </section>)}
        </section>
        <ReviewCalendar entries={entries} activity={statistics?.activity} error={activityError} now={now}/>
      </>}
    </>}
  </AppShell>;
}
export function ReviewExercise({ entry, attemptId, remaining, onBack }: { entry: ReviewEntry; attemptId: string; remaining: number; onBack: () => void }) {
  const [response, setResponse] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ReviewResult>();
  const lock = useRef(false);
  const composing = useRef(false);
  let question: ReviewQuestion | undefined;
  let issue: string | undefined;
  try { question = buildQuestion(entry.knowledge, entry.progress); }
  catch (error) { issue = error instanceof ReviewError ? error.message : '問題を表示できませんでした。登録内容を確認してください。'; }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || result || composing.current || !question) return;
    if (question.level !== 1 && !comparableText(response)) { setError('回答を入力してください（空白のみは送信できません）。'); return; }
    lock.current = true; setBusy(true); setError('');
    try { setResult(await reviewRepository.submit({ id: attemptId, knowledge: entry.knowledge, progress: entry.progress, ...(question.level !== 1 ? { response } : {}) })); }
    catch (error) { setError(reviewError(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!question) return <><div className="page-intro"><h1>登録内容を確認してください</h1></div><p className="error-box" role="alert">{issue}</p><Link href={`/knowledge/${entry.knowledge.id}/edit`} className="primary-button">知識を編集して設定する</Link><button onClick={onBack} className="text-button">復習一覧へ戻る</button></>;
  return <>
    <div className="page-intro"><p className="eyebrow">Level {question.level} · {question.level === 1 ? '確認' : question.level === 2 ? '用語を入力' : '穴埋め'}</p><h1>{question.level === 1 ? '知識を確認しよう' : '思い出してみよう'}</h1><p className="intro-copy">{result ? '回答前の成功' : 'このレベルの成功'} {question.successes} / 2回 · 復習対象は残り{Math.max(0, remaining)}件</p></div>
    {!result ? <form className="review-form" onSubmit={submit} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
      <section className="question-card" aria-label="問題">{question.term && <h2 className="user-text">{question.term}</h2>}<p className="user-text">{question.prompt}</p></section>
      {question.level === 1 ? <p className="field-note">用語と意味を読み、「確認した」を押すと1回完了します。客観的な記憶評価ではありません。</p> : <div className="field"><label htmlFor="review-answer">{question.level === 2 ? '用語を入力' : '穴埋めの答えを入力'}</label><input id="review-answer" name="review-answer" type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={response} maxLength={4000} disabled={busy} onChange={event => setResponse(event.target.value)} aria-invalid={!!error} aria-describedby="grading-note"/><p id="grading-note" className="field-note">全角・半角、英字の大小、前後・連続空白を整理して完全一致で採点します。別の表現や意味の類似性は判定しません。</p></div>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <button type="submit" disabled={busy || question.level !== 1 && !comparableText(response)} className="primary-button">{busy ? '保存中…' : question.level === 1 ? '確認した' : '回答する'}</button>
      <button type="button" disabled={busy} className="text-button" onClick={onBack}>回答せずに一覧へ戻る</button>
    </form> : <section className="review-feedback" aria-label="回答結果">
      <div className={result.correct === false ? 'warning-box' : 'success-box'} role="status"><h2>{result.correct === null ? '確認を記録しました' : result.correct ? '正解です' : '今回は不正解です'}</h2><p>{result.correct === false ? '成功回数は増やさず、同じレベルを後日復習します。' : '今回の学習を保存しました。'}</p></div>
      {result.answer && <div className="detail-card"><h2>正答</h2><p className="user-text">{result.answer}</p><h2>あなたの回答</h2><p className="user-text">{response}</p></div>}
      <p className="result-progress">次の状態：{progressLabel(result.progress)}</p><p>次回：<time dateTime={result.progress.next_due_at}>{formatDate(result.progress.next_due_at!)}</time></p>
      {result.progress.status === 'final_due' && <p className="field-note">3段階の学習が完了しました。まだ定着済みではありません。予定時刻を迎えたら、復習一覧から最終テストを受験できます。</p>}
      <button className="primary-button" onClick={onBack}>次へ（復習一覧）</button>
    </section>}
  </>;
}
