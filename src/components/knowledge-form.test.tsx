import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeForm } from './knowledge-form';
import { KnowledgeDetail, KnowledgeList } from './knowledge-pages';
import { knowledgeRepository } from '@/data/knowledge-repository';
import { initialProgress, type Knowledge } from '@/domain/knowledge';
const fixture = vi.hoisted(() => ({ id: '48dd520f-dff2-40c5-ab92-2b8b234aeecc', entries: [] as { knowledge: Knowledge; progress: ReturnType<typeof initialProgress> }[], replace: vi.fn() }));
vi.mock('@/components/review-history', () => ({ ReviewHistory: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: fixture.replace }), useParams: () => ({ id: fixture.id }) }));
vi.mock('@/data/use-knowledge', () => ({ useKnowledge: () => ({ entries: fixture.entries }) }));
const knowledge: Knowledge = { id: fixture.id, term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: '2026-10-30T01:00:00.000Z', updated_at: '2026-10-30T01:00:00.000Z' };
beforeEach(() => { vi.restoreAllMocks(); fixture.replace.mockClear(); fixture.entries = []; });
function fill() {
  fireEvent.change(screen.getByLabelText(/^用語/), { target: { value: 'HTTP' } });
  fireEvent.change(screen.getByLabelText(/^意味・説明/), { target: { value: knowledge.definition } });
  fireEvent.change(screen.getByLabelText(/^穴埋めにする文字/), { target: { value: 'プロトコル' } });
  fireEvent.click(screen.getByRole('radio'));
}
describe('知識登録フォーム', () => {
  it('必須入力と説明に存在しない穴埋めを拒否する', async () => {
    const save = vi.spyOn(knowledgeRepository, 'save'); render(<KnowledgeForm/>);
    fireEvent.click(screen.getByRole('button', { name: '知識を保存' })); expect(await screen.findByRole('alert')).toHaveTextContent('入力内容を確認'); expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^穴埋めにする文字/), { target: { value: '原文にない語' } }); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
  it('原文の2箇所目を選択でき、説明の変更で選択を解除する', () => {
    render(<KnowledgeForm/>); fireEvent.change(screen.getByLabelText(/^意味・説明/), { target: { value: '猫と猫' } }); fireEvent.change(screen.getByLabelText(/^穴埋めにする文字/), { target: { value: '猫' } });
    fireEvent.click(screen.getAllByRole('radio')[1]); expect(screen.getByTestId('cloze-preview')).toHaveTextContent('猫と＿＿＿＿');
    fireEvent.change(screen.getByLabelText(/^意味・説明/), { target: { value: '猫と犬' } }); expect(screen.queryByText('指定済み：猫')).not.toBeInTheDocument(); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
  it('選択範囲から設定し、正しいUTF-16オフセットで保存する', async () => {
    const save = vi.spyOn(knowledgeRepository, 'save').mockResolvedValue(fixture.id); render(<KnowledgeForm/>);
    fireEvent.change(screen.getByLabelText(/^用語/), { target: { value: 'HTTP' } }); const input = screen.getByLabelText(/^意味・説明/) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: knowledge.definition } }); input.setSelectionRange(11, 16); fireEvent.select(input);
    fireEvent.click(screen.getByRole('button', { name: '説明文の選択範囲を穴埋めにする' })); expect(screen.getByTestId('cloze-preview')).toHaveTextContent('Web通信で利用される＿＿＿＿');
    fireEvent.click(screen.getByRole('button', { name: '知識を保存' })); await waitFor(() => expect(fixture.replace).toHaveBeenCalledWith(`/knowledge/${fixture.id}`)); expect(save).toHaveBeenCalledWith({ term: 'HTTP', definition: knowledge.definition, cloze_start: 11, cloze_end: 16 }, undefined);
  });
  it('保存失敗でも入力を保持し、再試行できる', async () => {
    const save = vi.spyOn(knowledgeRepository, 'save').mockRejectedValueOnce(new Error('QuotaExceededError')).mockResolvedValueOnce(fixture.id); render(<KnowledgeForm/>); fill();
    fireEvent.click(screen.getByRole('button', { name: '知識を保存' })); expect(await screen.findByRole('alert')).toHaveTextContent('端末内データ'); expect(screen.getByLabelText(/^用語/)).toHaveValue('HTTP'); expect(screen.getByRole('radio')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: '知識を保存' })); await waitFor(() => expect(fixture.replace).toHaveBeenCalled()); expect(save).toHaveBeenCalledTimes(2);
  });
  it('日本語IMEの変換中は保存しない', async () => {
    const save = vi.spyOn(knowledgeRepository, 'save').mockResolvedValue(fixture.id); render(<KnowledgeForm/>); fill();
    const input = screen.getByLabelText(/^用語/); const form = input.closest('form')!;
    fireEvent.compositionStart(input); fireEvent.submit(form); expect(save).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input); fireEvent.submit(form); await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  });
  it('保存中の二重送信を防ぐ', async () => {
    let resolve!: (id: string) => void; const save = vi.spyOn(knowledgeRepository, 'save').mockImplementation(() => new Promise<string>(r => { resolve = r; }));
    render(<KnowledgeForm/>); fill(); const form = screen.getByRole('button', { name: '知識を保存' }).closest('form')!; fireEvent.submit(form); fireEvent.submit(form); expect(save).toHaveBeenCalledTimes(1); resolve(fixture.id); await waitFor(() => expect(fixture.replace).toHaveBeenCalled());
  });
  it('変更確認をキャンセルしたら保存せず、初期版の更新日時で競合を検出する', async () => {
    const save = vi.spyOn(knowledgeRepository, 'save').mockResolvedValue(fixture.id);
    const { rerender } = render(<KnowledgeForm existing={knowledge}/>); fireEvent.change(screen.getByLabelText(/^用語/), { target: { value: 'TCP' } });
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' })); expect(screen.getByRole('alertdialog')).toHaveTextContent('過去の解答履歴は残ります'); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '編集に戻る' })); expect(save).not.toHaveBeenCalled(); expect(screen.getByLabelText(/^用語/)).toHaveValue('TCP');
    rerender(<KnowledgeForm existing={{ ...knowledge, updated_at: '2026-10-30T03:00:00.000Z' }}/>);
    fireEvent.click(screen.getByRole('button', { name: '変更を保存' })); fireEvent.click(screen.getByRole('button', { name: '進捗リセットを確認して保存' })); await waitFor(() => expect(save).toHaveBeenCalled()); expect(save.mock.calls[0][1]?.expected_updated_at).toBe(knowledge.updated_at);
  });

});
describe('一覧・詳細', () => {
  it('空状態から追加でき、用語・意味検索とアーカイブ絞り込みが動く', () => {
    const { rerender } = render(<KnowledgeList/>); expect(screen.getByRole('heading', { name: 'まだ知識がありません' })).toBeInTheDocument();
    fixture.entries = [{ knowledge, progress: initialProgress(knowledge.id, knowledge.updated_at) }]; rerender(<KnowledgeList/>);
    expect(screen.getByRole('heading', { name: 'HTTP' })).toBeInTheDocument(); fireEvent.change(screen.getByLabelText('用語・意味を検索'), { target: { value: 'プロトコル' } }); expect(screen.getByRole('heading', { name: 'HTTP' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'アーカイブ済み' })); expect(screen.getByRole('heading', { name: '条件に合う知識がありません' })).toBeInTheDocument();
  });
  it('学習中に最終待ちを含め、定着済み・アーカイブと分ける', () => {
    const states = ['learning', 'final_due', 'mastered', 'archived'] as const;
    fixture.entries = states.map((status, index) => {
      const id = crypto.randomUUID();
      return {
        knowledge: { ...knowledge, id, term: ['練習', '最終待ち', '定着', '保管済み'][index] },
        progress: { ...initialProgress(id, knowledge.updated_at), status },
      };
    });
    render(<KnowledgeList/>);
    expect(screen.getByRole('link', { name: '設定' })).toHaveAttribute('href', '/settings');
    fireEvent.click(screen.getByRole('button', { name: '学習中' }));
    expect(screen.getByRole('heading', { name: '最終待ち' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '練習' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '定着' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '定着済み' }));
    expect(screen.getByRole('heading', { name: '定着' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '保管済み' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'アーカイブ済み' }));
    expect(screen.getByRole('heading', { name: '保管済み' })).toBeInTheDocument();
  });
  it('削除確認のキャンセルでは削除せず、承諾時だけ保存層を呼ぶ', async () => {
    fixture.entries = [{ knowledge, progress: initialProgress(knowledge.id, knowledge.updated_at) }]; const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false); const remove = vi.spyOn(knowledgeRepository, 'remove').mockResolvedValue(); render(<KnowledgeDetail/>);
    fireEvent.click(screen.getByRole('button', { name: 'この知識を削除' })); expect(remove).not.toHaveBeenCalled(); confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'この知識を削除' })); await waitFor(() => expect(fixture.replace).toHaveBeenCalledWith('/knowledge')); expect(remove).toHaveBeenCalledWith(knowledge.id, knowledge.updated_at);
  });
  it('登録文字列をHTMLとして解釈しない', () => {
    fixture.entries = [{ knowledge: { ...knowledge, term: '<img src=x onerror=alert(1)>' }, progress: initialProgress(knowledge.id, knowledge.updated_at) }]; render(<KnowledgeDetail/>); expect(screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' })).toBeInTheDocument(); expect(document.querySelector('img')).toBeNull();
  });
});
