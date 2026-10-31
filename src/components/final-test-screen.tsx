'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { AppShell } from './app-shell';
import { LoadingOrError } from './knowledge-pages';
import { useKnowledge } from '@/data/use-knowledge';
import { prepareFinalTest, type FinalIds, type FinalResult } from '@/domain/final-test';
import { comparableText } from '@/domain/knowledge';
import { ReviewError, type ReviewEntry } from '@/domain/review';
import { finalTestRepository } from '@/data/final-test-repository';
import { reviewError } from '@/data/review-repository';
import { useReviewClock } from '@/lib/use-review-clock';
import { formatDate, progressLabel } from '@/lib/knowledge-display';
export function FinalTestPage({ knowledgeId }: { knowledgeId?: string } = {}) {
  const params = useParams<{ id: string }>();
  const id = knowledgeId ?? params.id;
  const { entries, error } = useKnowledge();
  const now = useReviewClock();
  const [active, setActive] = useState<{ entry: ReviewEntry; ids: FinalIds }>();
  const entry = entries?.find(e => e.knowledge.id === id);
  let issue: string | undefined;
  let editable = false;
  if (entry) try { prepareFinalTest(entry.knowledge, entry.progress, now); }
  catch (e) { issue = e instanceof Error ? e.message : 'テストを開始できません。'; editable = e instanceof ReviewError && (e.code === 'cloze' || e.code === 'leak'); }
  return <AppShell active="/review" hideNav>{active ? <FinalTestExercise entry={active.entry} ids={active.ids}/> : !entries ? <LoadingOrError error={error}/> : <>
    <Link href="/review" className="text-link">← 復習一覧</Link><div className="page-intro"><p className="eyebrow">思い出せるか、確かめよう。</p><h1>最終テスト</h1></div>
    {!entry ? <p className="error-box" role="alert">この知識が見つかりません。</p> : <><p>用語入力と穴埋めの2問です。全問解答後に結果を表示します。</p>{entry.progress.next_due_at && <p className="field-note">受験予定：{formatDate(entry.progress.next_due_at)}</p>}
    {issue ? <><p className="error-box" role="alert">{issue}</p>{editable && <Link className="primary-button" href={`/knowledge/${id}/edit`}>知識を編集して設定する</Link>}</> : <button className="primary-button" onClick={() => setActive({ entry: structuredClone(entry), ids: { session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() } })}>2問のテストを開始</button>}
    <p className="field-note">途中で中断・再読み込みすると未完了の回答は破棄され、進捗は変わりません。合格はアプリ独自の学習達成状態であり、永久記憶を保証しません。</p></>}
  </>}</AppShell>;
}
export function FinalTestExercise({ entry, ids }: { entry: ReviewEntry; ids: FinalIds }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [responses, setResponses] = useState<[string, string]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<FinalResult>();
  const lock = useRef(false);
  const composing = useRef(false);
  // Validate with the supplied due time here; availability is rechecked with the real clock at commit.
  let questions: ReturnType<typeof prepareFinalTest> | undefined;
  try { questions = prepareFinalTest(entry.knowledge, entry.progress, Date.parse(entry.progress.next_due_at!)); } catch { /* parent shows the precise setup issue before starting */ }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || composing.current || result || !questions) return;
    if (!comparableText(responses[step])) { setError('空白のみを除く回答を入力してください。'); return; }
    if (step === 0) { setStep(1); setError(''); return; }
    lock.current = true; setBusy(true); setError('');
    try { setResult(await finalTestRepository.submit({ ids, knowledge: entry.knowledge, progress: entry.progress, responses })); }
    catch (e) { setError(reviewError(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  if (result) return <section className="final-result" aria-label="最終テストの結果"><div className="page-intro"><p className="eyebrow">2問の回答を保存しました。</p><h1>{result.passed ? '定着達成！' : 'もう一度、育てよう。'}</h1></div><div role="status" className={result.passed ? 'success-box' : 'warning-box'}>{result.passed ? '2問とも正解。定着済み（アプリ判定）として保存しました。' : '不正解だった形式を、時間を空けて2回ずつ再学習します。'}</div>
    {result.answers.map((answer, i) => <div className="detail-card" key={i}><h2>{i + 1}問目 · {i === 0 ? '用語入力' : '穴埋め'} · {result.correct[i] ? '正解' : '不正解'}</h2><p className="user-text">あなたの回答：{responses[i]}</p><p className="user-text">正答：{answer}</p></div>)}
    <p className="result-progress">{progressLabel(result.progress)}</p>{result.progress.next_due_at && <p className="field-note">再学習予定：{formatDate(result.progress.next_due_at)}</p>}<p className="field-note">定着済みはこのアプリの学習達成状態です。永久に忘れないことを保証するものではありません。</p><Link href="/" className="primary-button">ホームへ</Link><Link href="/review" className="text-link">復習一覧へ</Link>
  </section>;
  if (!questions) return <p className="error-box" role="alert">登録内容を確認し、一覧からテストを開き直してください。</p>;
  return <><div className="page-intro"><p className="eyebrow">最終テスト · {step + 1} / 2問</p><h1>{step === 0 ? '用語を思い出そう' : '空欄を埋めよう'}</h1><p className="intro-copy">正答と結果は2問の回答後に表示します。</p></div><form className="review-form" onSubmit={submit} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}>
    <div className="question-card" aria-label="問題"><p className="user-text">{step === 0 ? questions.reverse : questions.cloze}</p></div><div className="field"><label htmlFor="final-answer">{step === 0 ? '用語を入力' : '穴埋めの答えを入力'}</label><input key={step} id="final-answer" value={responses[step]} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={4000} disabled={busy} onChange={e => { const next: [string, string] = [...responses]; next[step] = e.target.value; setResponses(next); }}/></div><p className="field-note">全角・半角、大小、前後・連続空白を整理して完全一致で採点します。</p>
    {error && <p className="error-box" role="alert">{error}</p>}<button className="primary-button" disabled={busy || !comparableText(responses[step])}>{busy ? '採点結果を保存中…' : step === 0 ? '回答を確定して次へ' : '全問の回答を送信'}</button>{!busy && <Link className="text-link cancel-link" href="/review">中断して復習一覧へ戻る</Link>}
  </form></>;
}
