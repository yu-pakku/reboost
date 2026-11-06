import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from './page';
import Review from './review/page';
import Account from './account/page';
import Knowledge from './knowledge/page';
import Settings from './settings/page';
vi.mock('@/data/use-knowledge', () => ({ useKnowledge: () => ({ entries: [] }) }));
const onboarding = vi.hoisted(() => ({
  shouldShowOnboarding: vi.fn(async () => false),
  completeOnboarding: vi.fn(async () => {}),
}));
vi.mock('@/data/onboarding', () => onboarding);
describe('3タブとM2の導線', () => {
  it.each([{ Page: Home, path: '/', label: 'ホーム' }, { Page: Review, path: '/review', label: '復習' }, { Page: Knowledge, path: '/knowledge', label: '知識' }])('$labelを現在地として3タブを表示する', async ({ Page, path, label }) => {
    render(<Page />);
    const nav = within(await screen.findByRole('navigation', { name: 'メインナビゲーション' }));
    expect(nav.getAllByRole('link').map(link => link.textContent)).toEqual(['復習', 'ホーム', '知識']);
    const current = nav.getByRole('link', { name: label });
    expect(current).toHaveAttribute('href', path); expect(current).toHaveAttribute('aria-current', 'page');
    expect(nav.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveAttribute('href', '#main');
  });
  it('ホームから登録・一覧を開ける', async () => {
    render(<Home/>);
    expect(await screen.findByRole('link', { name: '知識を追加' })).toHaveAttribute('href', '/knowledge/new');
    expect(screen.getByRole('link', { name: '知識一覧' })).toHaveAttribute('href', '/knowledge');
  });
  it('空の復習キューを表示する', () => {
    render(<Review/>); expect(screen.getByRole('heading', { name: 'まだ知識がありません' })).toBeInTheDocument(); expect(screen.getByRole('button', { name: '今日' })).toBeInTheDocument();
  });
  it.each([Settings, Account])('設定と旧URLでバックアップ操作を利用できる', Page => {
    render(<Page/>); expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument(); expect(screen.getByText('通知機能は未提供です。')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'JSONをエクスポート' })).toBeEnabled(); expect(screen.getByLabelText('バックアップから復元（10MB以下）')).toHaveAttribute('type', 'file');
  });
});

it('初回だけ導入を表示し、サンプル粒子を定着粒子から分け、開始後はホームに移る', async () => {
  onboarding.shouldShowOnboarding.mockResolvedValueOnce(true);
  const { unmount } = render(<Home/>);
  const start = await screen.findByRole('button', { name: 'さあ、始めよう' });
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  expect(document.querySelectorAll('.sample-particle')).toHaveLength(6);
  expect(document.querySelectorAll('[data-particle-id]')).toHaveLength(0);
  fireEvent.click(start);
  expect(await screen.findByRole('link', { name: '知識を追加' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '記憶のコレクション' })).toHaveFocus();
  expect(screen.getByText('件の知識が定着')).toHaveTextContent('0 件の知識が定着');
  expect(screen.getByRole('link', { name: '復習' })).not.toHaveAttribute('aria-describedby');
  expect(onboarding.completeOnboarding).toHaveBeenCalledOnce();
  unmount();
  render(<Home/>);
  expect(await screen.findByRole('link', { name: '知識を追加' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'さあ、始めよう' })).not.toBeInTheDocument();
});
