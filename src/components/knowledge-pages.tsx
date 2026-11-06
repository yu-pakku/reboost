'use client';
import Link from 'next/link';
import { replaceAppRoute } from '@/pwa/navigation';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AppShell } from './app-shell';
import { Icon } from './icon';
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
const filters = [
  ['all', 'すべて'], ['learning', '学習中'], ['mastered', '定着済み'], ['archived', 'アーカイブ済み'],
] as const;
type KnowledgeFilter = typeof filters[number][0];

export function KnowledgeList() {
  const { entries, error } = useKnowledge();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<KnowledgeFilter>('all');
  const query = comparableText(search);
  const visible = (entries ?? []).filter(({ knowledge, progress }) => {
    const status = knowledge.archived_at ? 'archived' : progress.status === 'final_due' ? 'learning' : progress.status;
    return (filter === 'all' || filter === status) &&
      (!query || comparableText(knowledge.term).includes(query) || comparableText(knowledge.definition).includes(query));
  });
  return <AppShell active="/knowledge">
    <div className="page-intro compact-intro library-heading"><h1>知識</h1>
      <Link className="secondary-button library-settings" href="/settings">設定</Link>
    </div>
    <div className="library-search"><label className="sr-only" htmlFor="search">用語・意味を検索</label>
      <input id="search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="用語・意味を検索" enterKeyHint="search"/>
    </div>
    <div className="segmented-control library-filters" role="group" aria-label="学習状態">
      {filters.map(([value, label]) => <button type="button" key={value} aria-pressed={value === filter} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {!entries ? <LoadingOrError error={error}/> : <>
      <p className="field-note library-count" role="status">{visible.length}件表示 / 全{entries.length}件</p>
      {visible.length ? <ul className="knowledge-list library-list">{visible.map(({ knowledge, progress }) => <li key={knowledge.id}>
        <Link href={`/knowledge/${knowledge.id}`}>
          <div><span className="status-label">{progressLabel(progress)}</span><h2>{knowledge.term}</h2>
            <p className="definition-excerpt">{knowledge.definition}</p></div>
          <Icon name="arrow" size={16}/>
        </Link>
      </li>)}</ul> : <EmptyState title={entries.length ? '条件に合う知識がありません' : 'まだ知識がありません'}>
        {entries.length ? <button type="button" className="text-button" onClick={() => { setFilter('all'); setSearch(''); }}>絞り込みを解除</button> :
          '覚えておきたい用語と意味を追加しましょう。'}
      </EmptyState>}
    </>}
    <Link href="/knowledge/new" className="text-link">＋ 知識を追加</Link>
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
  return <AppShell active="/knowledge" hideNav={edit}><Link className="text-link" href="/knowledge">← 知識一覧</Link>{!entries ? <LoadingOrError error={error}/> : !entry ? <EmptyState title="知識が見つかりません">削除されたか、この端末には保存されていません。</EmptyState> : edit ? <><div className="page-intro"><h1>知識を編集</h1></div><KnowledgeForm key={entry.knowledge.id} existing={entry.knowledge}/></> : <>
    <div className="page-intro"><p className="eyebrow">保存した知識</p><h1 className="user-text">{entry.knowledge.term}</h1><p className="status-label inline-status">{progressLabel(entry.progress)}</p></div>
    <section className="detail-card"><h2>意味・説明</h2><p className="user-text">{entry.knowledge.definition}</p><h2>穴埋めプレビュー</h2><p className="user-text">{clozePreview(entry.knowledge)}</p><p className="field-note">指定箇所：{entry.knowledge.definition.slice(entry.knowledge.cloze_start, entry.knowledge.cloze_end)}</p></section>
    <dl className="detail-meta"><dt>登録</dt><dd>{formatDate(entry.knowledge.created_at)}</dd><dt>更新</dt><dd>{formatDate(entry.knowledge.updated_at)}</dd><dt>次回予定</dt><dd>{entry.progress.next_due_at ? formatDate(entry.progress.next_due_at) : "予定なし"}</dd><dt>学習状態</dt><dd>{entry.progress.status === 'learning' ? '学習中・未定着' : progressLabel(entry.progress)}</dd></dl><p className="field-note">閲覧しても進捗は変わりません。予定時刻を迎えた知識は復習タブから学習できます。</p>
    <Link className="text-link" href="/review">復習一覧へ →</Link><ReviewHistory key={entry.knowledge.id} knowledgeId={entry.knowledge.id}/>
    {actionError && <p className="error-box" role="alert">{actionError}</p>}
    <div className="detail-actions"><Link href={`/knowledge/${id}/edit`} className="primary-button">内容を編集</Link><button disabled={busy} className="secondary-button" onClick={() => action('archive')}>{entry.progress.status === 'archived' ? 'アーカイブを解除' : 'アーカイブ'}</button><button disabled={busy} className="danger-button" onClick={() => action('delete')}>この知識を削除</button></div>
    </>}</AppShell>;
}
