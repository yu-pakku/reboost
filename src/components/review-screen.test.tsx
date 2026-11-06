import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './home-page';
import { ReviewExercise, ReviewScreen } from './review-screen';
import { completeReview, type ReviewEntry, type ReviewResult } from '@/domain/review';
import { initialProgress, type Knowledge } from '@/domain/knowledge';
import { reviewRepository } from '@/data/review-repository';
const fixture = vi.hoisted(() => ({ entries: [] as ReviewEntry[], now: Date.parse('2026-10-30T01:00:00.000Z') }));
vi.mock('@/data/use-knowledge', () => ({ useKnowledge: () => ({ entries: fixture.entries }) }));
vi.mock('@/lib/use-review-clock', () => ({ useReviewClock: () => fixture.now }));
vi.mock('@/data/onboarding', () => ({ shouldShowOnboarding: async () => false }));
const now = new Date(fixture.now).toISOString();
const knowledge: Knowledge = { id: '48dd520f-dff2-40c5-ab92-2b8b234aeecc', term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: now, updated_at: now };
function entry(level: 1 | 2 | 3 = 1): ReviewEntry { return { knowledge, progress: { ...initialProgress(knowledge.id, now), level } }; }
beforeEach(() => { vi.restoreAllMocks(); fixture.entries = []; });
describe('復習UI', () => {
  it('空状態・3分類・最終待ちを表示し、閲覧では記録しない', () => {
    const save = vi.spyOn(reviewRepository, 'submit'); render(<ReviewScreen/>);
    expect(screen.getByRole('heading', { name: 'まだ知識がありません' })).toBeInTheDocument();
    for (const title of ['今すべき', '期限超過', '最終テスト待ち', '2026年 10月']) expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('問題を開いただけ・戻っただけでは進まず、L1確認でのみ保存する', async () => {
    fixture.entries = [entry()]; const result = completeReview(knowledge, entry().progress, undefined, now, crypto.randomUUID()); const submit = vi.spyOn(reviewRepository, 'submit').mockResolvedValue(result);
    render(<ReviewScreen/>); fireEvent.click(screen.getByRole('button', { name: 'HTTPを復習' })); expect(submit).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: '問題' })).toHaveTextContent('HTTP'); expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '回答せずに一覧へ戻る' })); expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'HTTPを復習' })); fireEvent.click(screen.getByRole('button', { name: '確認した' }));
    expect(await screen.findByRole('region', { name: '回答結果' })).toHaveTextContent('確認を記録'); expect(submit.mock.calls[0][0].response).toBeUndefined();
  });
  it('L2では用語・正答を回答前に表示せず、失敗後に正答を表示する', async () => {
    const value = entry(2); const submit = vi.spyOn(reviewRepository, 'submit').mockResolvedValue(completeReview(knowledge, value.progress, '誤答', now, crypto.randomUUID()));
    render(<ReviewExercise entry={value} attemptId={crypto.randomUUID()} remaining={1} onBack={vi.fn()}/>);
    expect(document.body).not.toHaveTextContent('HTTP'); expect(screen.getByLabelText('用語を入力')).toHaveAttribute('autocomplete', 'off');
    fireEvent.change(screen.getByLabelText('用語を入力'), { target: { value: '　\n' } }); expect(screen.getByRole('button', { name: '回答する' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('用語を入力'), { target: { value: '誤答' } }); fireEvent.click(screen.getByRole('button', { name: '回答する' }));
    expect(await screen.findByRole('region', { name: '回答結果' })).toHaveTextContent('HTTP'); expect(screen.getByRole('status')).toHaveTextContent('成功回数は増やさず'); expect(screen.getByText(/次の状態/)).toHaveTextContent('Level 2・成功0回'); expect(submit).toHaveBeenCalledTimes(1);
  });
  it('L3は指定範囲を伏せ、未設定なら編集へのリンクを出す', () => {
    const { rerender } = render(<ReviewExercise entry={entry(3)} attemptId={crypto.randomUUID()} remaining={1} onBack={vi.fn()}/>);
    expect(screen.getByRole('region', { name: '問題' })).toHaveTextContent('Web通信で利用される＿＿＿＿'); expect(document.body).not.toHaveTextContent('プロトコル');
    rerender(<ReviewExercise entry={{ ...entry(3), knowledge: { ...knowledge, cloze_start: -1 } }} attemptId={crypto.randomUUID()} remaining={1} onBack={vi.fn()}/>);
    expect(screen.getByRole('alert')).toHaveTextContent('穴埋め箇所'); expect(screen.getByRole('link', { name: '知識を編集して設定する' })).toHaveAttribute('href', `/knowledge/${knowledge.id}/edit`); expect(screen.queryByRole('button', { name: '回答する' })).not.toBeInTheDocument();
  });
  it('保存失敗時は回答・試行IDを保持し、再試行で結果を表示する', async () => {
    const value = entry(2); const attemptId = crypto.randomUUID(); const submit = vi.spyOn(reviewRepository, 'submit').mockRejectedValueOnce(new Error('容量不足')).mockResolvedValueOnce(completeReview(knowledge, value.progress, 'HTTP', now, attemptId));
    render(<ReviewExercise entry={value} attemptId={attemptId} remaining={1} onBack={vi.fn()}/>); fireEvent.change(screen.getByLabelText('用語を入力'), { target: { value: 'HTTP' } }); fireEvent.click(screen.getByRole('button', { name: '回答する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('再試行'); expect(screen.getByLabelText('用語を入力')).toHaveValue('HTTP');
    fireEvent.click(screen.getByRole('button', { name: '回答する' })); await screen.findByRole('region', { name: '回答結果' }); expect(submit.mock.calls.map(call => call[0].id)).toEqual([attemptId, attemptId]);
  });
  it('IME変換中と保存中の二重タップを防ぐ', async () => {
    let resolve!: (result: ReviewResult) => void; const value = entry(2); const attemptId = crypto.randomUUID(); const submit = vi.spyOn(reviewRepository, 'submit').mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<ReviewExercise entry={value} attemptId={attemptId} remaining={1} onBack={vi.fn()}/>); const input = screen.getByLabelText('用語を入力'); fireEvent.change(input, { target: { value: 'HTTP' } });
    const form = input.closest('form')!; fireEvent.compositionStart(input); fireEvent.submit(form); expect(submit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input); fireEvent.submit(form); fireEvent.submit(form); expect(submit).toHaveBeenCalledTimes(1); resolve(completeReview(knowledge, value.progress, 'HTTP', now, attemptId)); await screen.findByRole('region', { name: '回答結果' });
  });
  it('最終待ちでは受験導線を表示し、アーカイブ済みを除外する', () => {
    const base = entry(); fixture.entries = [{ ...base, progress: { ...base.progress, status: 'final_due', level: undefined } }, { knowledge: { ...knowledge, id: crypto.randomUUID(), term: '非表示の知識', archived_at: now }, progress: { ...base.progress, status: 'archived' } }]; render(<ReviewScreen/>);
    const section = screen.getByRole('region', { name: '最終テスト待ち' }); expect(within(section).getByRole('link', { name: '最終テストへ' })).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'HTTPを復習' })).not.toBeInTheDocument(); expect(document.body).not.toHaveTextContent('非表示の知識');
  });
  it('受験可能な最終テストを復習画面の件数とホームの復習タブに反映する', async () => {
    const base = entry(); fixture.entries = [{ ...base, progress: { ...base.progress, status: 'final_due', level: undefined } }];
    const { unmount } = render(<ReviewScreen/>); expect(screen.getByText('通常の復習は0件、受験可能な最終テストは1件です。')).toBeInTheDocument(); unmount();
    render(<Home/>); const tab = await screen.findByRole('link', { name: '復習' });
    expect(tab).toHaveAccessibleDescription('復習できる課題があります');
  });
  it('L3の2成功目の結果は最終待ちで止まり、次へで一覧へ戻る', async () => {
    const value = entry(3); value.progress.successes_in_level = 1;
    const next = vi.fn(); vi.spyOn(reviewRepository, 'submit').mockResolvedValue(completeReview(knowledge, value.progress, 'プロトコル', now, crypto.randomUUID()));
    render(<ReviewExercise entry={value} attemptId={crypto.randomUUID()} remaining={1} onBack={next}/>); fireEvent.change(screen.getByLabelText('穴埋めの答えを入力'), { target: { value: 'プロトコル' } }); fireEvent.click(screen.getByRole('button', { name: '回答する' }));
    expect(await screen.findByRole('region', { name: '回答結果' })).toHaveTextContent('まだ定着済みではありません'); fireEvent.click(screen.getByRole('button', { name: '次へ（復習一覧）' })); await waitFor(() => expect(next).toHaveBeenCalledOnce());
  });
});
