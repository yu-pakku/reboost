'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { replaceAppRoute } from '@/pwa/navigation';
import { useRouter } from 'next/navigation';
import { clozePreview, comparableText, contentChanged, countCharacters, textBoundaries, validateKnowledge, type FieldErrors, type Knowledge, type KnowledgeDraft } from '@/domain/knowledge';
import { knowledgeRepository, storageError } from '@/data/knowledge-repository';
import { useKnowledge } from '@/data/use-knowledge';
import { ResetConfirmation } from './reset-confirmation';

export function KnowledgeForm({ existing: source }: { existing?: Knowledge }) {
  const [existing] = useState(source);
  const router = useRouter();
  const { entries } = useKnowledge();
  const [draft, setDraft] = useState<KnowledgeDraft>(existing ?? { term: '', definition: '', cloze_start: -1, cloze_end: -1 });
  const [query, setQuery] = useState(existing ? existing.definition.slice(existing.cloze_start, existing.cloze_end) : '');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const composing = useRef(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const validation = validateKnowledge(draft);
  const validCloze = !validation.cloze;
  const duplicate = entries?.some(({ knowledge }) => knowledge.id !== existing?.id && comparableText(knowledge.term) === comparableText(draft.term));
  const boundaries = new Set(textBoundaries(draft.definition));
  const matches: { start: number; end: number }[] = [];
  if (query.trim() && countCharacters(query) <= 100) {
    for (let start = draft.definition.indexOf(query); start !== -1; start = draft.definition.indexOf(query, start + 1)) {
      if (boundaries.has(start) && boundaries.has(start + query.length)) matches.push({ start, end: start + query.length });
    }
  }
  function choose(start: number, end: number) {
    const next = { ...draft, cloze_start: start, cloze_end: end };
    const error = validateKnowledge(next).cloze;
    if (error) { setErrors(current => ({ ...current, cloze: error })); return; }
    setDraft(next);
    setQuery(draft.definition.slice(start, end));
    setErrors(current => ({ ...current, cloze: undefined }));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || composing.current) return;
    setErrors(validation);
    setSaveError('');
    if (Object.keys(validation).length) { requestAnimationFrame(() => errorSummary.current?.focus()); return; }
    if (confirming) return;
    if (existing && contentChanged(existing, draft)) { setConfirming(true); return; }
    await save();
  }
  async function save() {
    if (inFlight.current) return;
    setConfirming(false);
    inFlight.current = true; setSaving(true);
    try {
      const id = await knowledgeRepository.save(draft, existing ? { id: existing.id, expected_updated_at: existing.updated_at, resetConfirmed: true } : undefined);
      replaceAppRoute(router, `/knowledge/${id}`);
    } catch (error) { setSaveError(storageError(error)); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} noValidate className="knowledge-form">
    {(Object.values(errors).some(Boolean) || saveError) && <div className="error-box" role="alert" tabIndex={-1} ref={errorSummary}><p>{saveError || '入力内容を確認してください。'}</p>{Object.entries(errors).filter(([, text]) => text).map(([key, text]) => <p key={key}>{text}</p>)}</div>}
    <fieldset disabled={saving} className="form-fields">
      <div className="field"><label htmlFor="term">用語 <span className="required">必須</span></label><input id="term" name="term" required autoComplete="off" value={draft.term} placeholder="例：HTTP" aria-invalid={!!errors.term} aria-describedby="term-note term-error" onChange={e => setDraft({ ...draft, term: e.target.value })}/><p className="field-note" id="term-note">1〜100文字（{countCharacters(draft.term.trim())}文字）</p>{errors.term && <p className="field-error" id="term-error">{errors.term}</p>}{duplicate && <p className="warning-box" role="status">同じ用語が登録されています。別の意味として追加する場合は、そのまま保存できます。</p>}</div>
      <div className="field"><label htmlFor="definition">意味・説明 <span className="required">必須</span></label><textarea id="definition" name="definition" required rows={6} value={draft.definition} placeholder="例：Web通信で利用されるプロトコル" aria-invalid={!!errors.definition} aria-describedby="definition-note definition-error" onSelect={e => { const el = e.currentTarget; setSelection({ start: el.selectionStart, end: el.selectionEnd }); }} onChange={e => { setDraft({ ...draft, definition: e.target.value, cloze_start: -1, cloze_end: -1 }); setQuery(''); setSelection({ start: 0, end: 0 }); }}/><p className="field-note" id="definition-note">1〜1000文字。用語そのものを含めずに説明してください。（{countCharacters(draft.definition)}文字）</p>{errors.definition && <p className="field-error" id="definition-error">{errors.definition}</p>}
      <button type="button" className="secondary-button selection-button" disabled={selection.start === selection.end} onClick={() => choose(selection.start, selection.end)}>説明文の選択範囲を穴埋めにする</button></div>
      <div className="field"><label htmlFor="cloze-query">穴埋めにする文字 <span className="required">必須</span></label><input id="cloze-query" autoComplete="off" value={query} placeholder="例：プロトコル" aria-describedby="cloze-note cloze-error" aria-invalid={!!errors.cloze || (!!query && !matches.length)} onChange={e => { setQuery(e.target.value); setDraft({ ...draft, cloze_start: -1, cloze_end: -1 }); }}/><p className="field-note" id="cloze-note">説明文の一部をそのまま入力し、下の候補を選択してください。上の説明文を範囲選択して指定することもできます。</p>
        {query && !matches.length && <p className="field-error" role="status">説明文中の連続した1〜100文字を入力してください。原文と完全に同じ文字列で指定します。</p>}
        {!!matches.length && <fieldset className="cloze-options"><legend>穴埋め箇所を選択（{matches.length}箇所）</legend>{matches.map((match, index) => <label className="cloze-option" key={match.start}><input type="radio" name="cloze" checked={draft.cloze_start === match.start && draft.cloze_end === match.end} onChange={() => choose(match.start, match.end)}/><span><strong>{index + 1}箇所目</strong><span className="option-context">{match.start > 12 ? '…' : ''}{draft.definition.slice(Math.max(0, match.start - 12), match.start)}<mark>{query}</mark>{draft.definition.slice(match.end, match.end + 12)}{match.end + 12 < draft.definition.length ? '…' : ''}</span></span></label>)}</fieldset>}
        {errors.cloze && <p className="field-error" id="cloze-error">{errors.cloze}</p>}
        {validCloze && <p className="selected-cloze" role="status">指定済み：{draft.definition.slice(draft.cloze_start, draft.cloze_end)}</p>}
      </div>
      <section className="preview-card" aria-labelledby="preview-title"><h2 id="preview-title">問題プレビュー</h2><h3>Level 2 · 用語を入力</h3><p className="user-text">{draft.definition || '意味・説明を入力すると表示されます。'}</p>{validation.definition && draft.definition.trim() && <p className="field-error">{validation.definition}</p>}<h3>Level 3 · 穴埋め</h3><p className="user-text" data-testid="cloze-preview">{validCloze ? clozePreview(draft) : '穴埋め箇所を指定すると表示されます。'}</p><p className="field-note">ここは登録内容の確認です。保存後、復習タブから学習できます。</p></section>
      <p className="field-note">保存先はこのブラウザの端末内です。説明文を変更すると穴埋め箇所の再指定が必要です。</p>
      <button type="submit" className="primary-button">{saving ? '保存中…' : existing ? '変更を保存' : '知識を保存'}</button>
    </fieldset>
    {confirming && <ResetConfirmation onConfirm={() => void save()} onCancel={() => setConfirming(false)}/>}
    <Link className="text-link cancel-link" href={existing ? `/knowledge/${existing.id}` : '/knowledge'}>キャンセル</Link>
  </form>;
}
