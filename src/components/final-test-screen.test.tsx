import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinalTestExercise, FinalTestPage } from './final-test-screen';
import { completeFinalTest, type FinalResult } from '@/domain/final-test';
import { initialProgress, type Knowledge } from '@/domain/knowledge';
import type { ReviewEntry } from '@/domain/review';
import { finalTestRepository } from '@/data/final-test-repository';
const fixture = vi.hoisted(() => ({ entries: [] as ReviewEntry[], now: Date.parse('2026-10-30T01:00:00.000Z'), id: '48dd520f-dff2-40c5-ab92-2b8b234aeecc' }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: fixture.id }) }));
vi.mock('@/data/use-knowledge', () => ({ useKnowledge: () => ({ entries: fixture.entries }) }));
vi.mock('@/lib/use-review-clock', () => ({ useReviewClock: () => fixture.now }));
const time = new Date(fixture.now).toISOString();
const knowledge: Knowledge = { id: fixture.id, term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: time, updated_at: time };
const entry = (): ReviewEntry => ({ knowledge, progress: { ...initialProgress(knowledge.id, time), status: 'final_due', level: undefined } });
const ids = () => ({ session: crypto.randomUUID(), reverse: crypto.randomUUID(), cloze: crypto.randomUUID() });
beforeEach(() => { vi.restoreAllMocks(); fixture.entries = [entry()]; });
function firstAnswer() { fireEvent.change(screen.getByLabelText('用語を入力'), { target: { value: 'HTTP' } }); fireEvent.click(screen.getByRole('button', { name: '回答を確定して次へ' })); }
describe('最終テストの集中画面', () => {
  it('予定前は開始不可で、穴埋め未設定は編集へ誘導する', () => {
    fixture.entries[0].progress.next_due_at = '2026-10-31T01:00:00.000Z'; const { rerender } = render(<FinalTestPage/>);
    expect(screen.getByRole('alert')).toHaveTextContent('予定時刻'); expect(screen.queryByRole('button', { name: '2問のテストを開始' })).not.toBeInTheDocument();
    fixture.entries = [{ ...entry(), knowledge: { ...knowledge, cloze_start: -1 } }]; rerender(<FinalTestPage/>); expect(screen.getByRole('alert')).toHaveTextContent('穴埋め'); expect(screen.getByRole('link', { name: '知識を編集して設定する' })).toHaveAttribute('href', `/knowledge/${knowledge.id}/edit`);
  });
  it('1問目の確定では保存も採点表示もせず、2問終了後にだけ合格を表示する', async () => {
    const keys = ids(); const submit = vi.spyOn(finalTestRepository, 'submit').mockResolvedValue(completeFinalTest(knowledge, entry().progress, ['HTTP', 'プロトコル'], time, keys));
    render(<FinalTestExercise entry={entry()} ids={keys}/>); expect(document.body).not.toHaveTextContent('HTTP'); firstAnswer();
    expect(submit).not.toHaveBeenCalled(); expect(screen.queryByText(/正答：/)).not.toBeInTheDocument(); expect(screen.queryByRole('status')).not.toBeInTheDocument(); expect(document.body).not.toHaveTextContent('HTTP');
    expect(screen.getByRole('button', { name: '全問の回答を送信' })).toBeDisabled(); fireEvent.change(screen.getByLabelText('穴埋めの答えを入力'), { target: { value: 'プロトコル' } }); fireEvent.click(screen.getByRole('button', { name: '全問の回答を送信' }));
    expect(await screen.findByRole('region', { name: '最終テストの結果' })).toHaveTextContent('定着達成'); expect(screen.getByText('正答：HTTP')).toBeInTheDocument(); expect(submit).toHaveBeenCalledTimes(1);
  });
  it('保存中の二重送信とIME変換中の確定を防ぐ', async () => {
    let resolve!: (result: FinalResult) => void; const keys = ids(); const submit = vi.spyOn(finalTestRepository, 'submit').mockImplementation(() => new Promise(r => { resolve = r; }));
    render(<FinalTestExercise entry={entry()} ids={keys}/>); firstAnswer(); const input = screen.getByLabelText('穴埋めの答えを入力'); fireEvent.change(input, { target: { value: 'プロトコル' } }); const form = input.closest('form')!;
    fireEvent.compositionStart(input); fireEvent.submit(form); expect(submit).not.toHaveBeenCalled(); fireEvent.compositionEnd(input); fireEvent.submit(form); fireEvent.submit(form); expect(submit).toHaveBeenCalledTimes(1);
    resolve(completeFinalTest(knowledge, entry().progress, ['HTTP', 'プロトコル'], time, keys)); await screen.findByRole('region', { name: '最終テストの結果' });
  });
  it('失敗後も回答とセッションIDを保持し、再試行時まで正答を開示しない', async () => {
    const keys = ids(); const submit = vi.spyOn(finalTestRepository, 'submit').mockRejectedValueOnce(new Error('容量不足')).mockResolvedValueOnce(completeFinalTest(knowledge, entry().progress, ['HTTP', '誤答'], time, keys));
    render(<FinalTestExercise entry={entry()} ids={keys}/>); firstAnswer(); fireEvent.change(screen.getByLabelText('穴埋めの答えを入力'), { target: { value: '誤答' } }); fireEvent.click(screen.getByRole('button', { name: '全問の回答を送信' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('再試行'); expect(screen.queryByText(/正答：/)).not.toBeInTheDocument(); expect(screen.getByLabelText('穴埋めの答えを入力')).toHaveValue('誤答');
    fireEvent.click(screen.getByRole('button', { name: '全問の回答を送信' })); expect(await screen.findByRole('region', { name: '最終テストの結果' })).toHaveTextContent('Level 3'); expect(submit.mock.calls.map(call => call[0].ids)).toEqual([keys, keys]);
  });
  it('保存後にliveQueryで定着へ更新されても結果画面を保持する', async () => {
    const submit = vi.spyOn(finalTestRepository, 'submit').mockImplementation(async input => completeFinalTest(input.knowledge, input.progress, input.responses, time, input.ids));
    const { rerender } = render(<FinalTestPage/>); fireEvent.click(screen.getByRole('button', { name: '2問のテストを開始' })); firstAnswer(); fireEvent.change(screen.getByLabelText('穴埋めの答えを入力'), { target: { value: 'プロトコル' } }); fireEvent.click(screen.getByRole('button', { name: '全問の回答を送信' })); await screen.findByRole('region', { name: '最終テストの結果' });
    fixture.entries[0].progress = (await submit.mock.results[0].value).progress; rerender(<FinalTestPage/>); expect(screen.getByRole('heading', { name: '定着達成！' })).toBeInTheDocument();
  });
});
