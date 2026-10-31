'use client';
import Link from 'next/link';
import { replaceAppRoute } from '@/pwa/navigation';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AppShell } from './app-shell';
import { ReviewHistory } from './review-history';
import { EmptyState } from './empty-state';
import { KnowledgeForm } from './knowledge-form';
import { useKnowledge } from '@/data/use-knowledge';
import { knowledgeRepository, storageError } from '@/data/knowledge-repository';
import { clozePreview, comparableText } from '@/domain/knowledge';
import { formatDate, progressLabel } from '@/lib/knowledge-display';

export function LoadingOrError({ error }: { error?: string }) {
  return error ? <div className="error-box" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => window.location.reload()}>再読み込み</button></div> : <p className="loading-message" role="status">端末内データを読み込み中…</p>;
}
export function KnowledgeList() {
  const { entries, error } = useKnowledge();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('active');
  const query = comparableText(search);
  const visible = entries?.filter(({ knowledge: k, progress: p }) => (filter === 'all' || filter === 'active' && p.status !== 'archived' || filter === 'learning' && (p.status === 'learning' || p.status === 'final_due') || filter === p.status) && (!query || comparableText(k.term).includes(query) || comparableText(k.definition).includes(query)));
  return <AppShell active="/"><Link className="text-link" href="/">← ホーム</Link><div className="page-intro"><p className="eyebrow">覚えておきたいことを、ひとつずつ。</p><h1>知識一覧</h1></div><Link href="/knowledge/new" className="primary-button">＋ 知識を追加</Link>
    <div className="list-filters"><label htmlFor="search">用語・意味を検索</label><input id="search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="キーワードを入力"/><label htmlFor="status-filter">表示する状態</label><select id="status-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="active">アーカイブ以外</option><option value="all">すべて</option><option value="learning">学習中</option><option value="mastered">定着済み</option><option value="archived">アーカイブ</option></select></div>
    {!entries ? <LoadingOrError error={error}/> : <><p className="field-note" role="status">{visible?.length}件表示 / 全{entries.length}件</p>{visible?.length ? <ul className="knowledge-list">{visible.map(({ knowledge: k, progress: p }) => <li key={k.id}><Link href={`/knowledge/${k.id}`}><span className="status-label">{progressLabel(p)}</span><h2>{k.term}</h2><p className="definition-excerpt">{k.definition}</p><span className="field-note">更新：{formatDate(k.updated_at)}</span></Link></li>)}</ul> : <EmptyState title={entries.length ? '条件に合う知識がありません' : 'まだ知識がありません'}>{entries.length ? '検索語や状態の条件を変えてください。' : '覚えておきたい用語と意味を追加しましょう。'}</EmptyState>}</>}
  </AppShell>;
}
export function KnowledgeDetail({ edit = false, knowledgeId }: { edit?: boolean; knowledgeId?: string }) {
  const params = useParams<{ id: string }>();
  const id = knowledgeId ?? params.id;
  const { entries, error } = useKnowledge();
  const entry = entries?.find(entry => entry.knowledge.id === id);
  const router = useRouter();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function action(kind: 'delete' | 'archive') {
    if (!entry || lock.current) return;
    const archived = entry.progress.status === 'archived';
    const message = kind === 'delete' ? `「${entry.knowledge.term}」を完全に削除しますか？学習進捗・解答履歴も削除され、元に戻せません。` : archived ? 'アーカイブを解除し、Level 1・成功0回・未定着から再開しますか？過去の履歴は残ります。' : 'アーカイブして復習対象から外しますか？内容と履歴は端末内に残ります。';
    if (!window.confirm(message)) return;
    lock.current = true; setBusy(true); setActionError('');
    try {
      if (kind === 'delete') { await knowledgeRepository.remove(id, entry.knowledge.updated_at); replaceAppRoute(router, '/knowledge'); }
      else await knowledgeRepository.archive(id, entry.knowledge.updated_at, !archived);
    } catch (error) { setActionError(storageError(error)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <AppShell active="/" hideNav={edit}><Link className="text-link" href="/knowledge">← 知識一覧</Link>{!entries ? <LoadingOrError error={error}/> : !entry ? <EmptyState title="知識が見つかりません">削除されたか、この端末には保存されていません。</EmptyState> : edit ? <><div className="page-intro"><p className="eyebrow">内容を整える。</p><h1>知識を編集</h1></div><KnowledgeForm key={entry.knowledge.id} existing={entry.knowledge}/></> : <>
    <div className="page-intro"><p className="eyebrow">保存した知識</p><h1 className="user-text">{entry.knowledge.term}</h1><p className="status-label inline-status">{progressLabel(entry.progress)}</p></div>
    <section className="detail-card"><h2>意味・説明</h2><p className="user-text">{entry.knowledge.definition}</p><h2>穴埋めプレビュー</h2><p className="user-text">{clozePreview(entry.knowledge)}</p><p className="field-note">指定箇所：{entry.knowledge.definition.slice(entry.knowledge.cloze_start, entry.knowledge.cloze_end)}</p></section>
    <dl className="detail-meta"><dt>登録</dt><dd>{formatDate(entry.knowledge.created_at)}</dd><dt>更新</dt><dd>{formatDate(entry.knowledge.updated_at)}</dd><dt>次回予定</dt><dd>{entry.progress.next_due_at ? formatDate(entry.progress.next_due_at) : "予定なし"}</dd><dt>学習状態</dt><dd>{entry.progress.status === 'learning' ? '学習中・未定着' : progressLabel(entry.progress)}</dd></dl><p className="field-note">閲覧しても進捗は変わりません。予定時刻を迎えた知識は復習タブから学習できます。</p>
    <Link className="text-link" href="/review">復習一覧へ →</Link><ReviewHistory key={entry.knowledge.id} knowledgeId={entry.knowledge.id}/>
    {actionError && <p className="error-box" role="alert">{actionError}</p>}
    <div className="detail-actions"><Link href={`/knowledge/${id}/edit`} className="primary-button">内容を編集</Link><button disabled={busy} className="secondary-button" onClick={() => action('archive')}>{entry.progress.status === 'archived' ? 'アーカイブを解除' : 'アーカイブ'}</button><button disabled={busy} className="danger-button" onClick={() => action('delete')}>この知識を削除</button></div>
    </>}</AppShell>;
}
