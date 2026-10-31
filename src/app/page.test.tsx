import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Home from './page';
import Review from './review/page';
import Account from './account/page';
vi.mock('@/data/use-knowledge', () => ({ useKnowledge: () => ({ entries: [] }) }));
describe('3タブとM2の導線', () => {
  it.each([{ Page: Home, path: '/', label: 'ホーム' }, { Page: Review, path: '/review', label: '復習' }, { Page: Account, path: '/account', label: 'アカウント' }])('$labelを現在地として3タブを表示する', ({ Page, path, label }) => {
    render(<Page />);
    const nav = within(screen.getByRole('navigation', { name: 'メインナビゲーション' }));
    expect(nav.getAllByRole('link').map(link => link.textContent)).toEqual(['復習', 'ホーム', 'アカウント']);
    const current = nav.getByRole('link', { name: label });
    expect(current).toHaveAttribute('href', path); expect(current).toHaveAttribute('aria-current', 'page');
    expect(nav.getAllByRole('link').filter(link => link.hasAttribute('aria-current'))).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '本文へ移動' })).toHaveAttribute('href', '#main');
  });
  it('ホームから登録・一覧を開ける', () => {
    render(<Home/>);
    expect(screen.getByRole('link', { name: '知識を追加' })).toHaveAttribute('href', '/knowledge/new');
    expect(screen.getByRole('link', { name: '一覧を見る →' })).toHaveAttribute('href', '/knowledge');
  });
  it('空の復習キューを表示する', () => {
    render(<Review/>); expect(screen.getByRole('heading', { name: 'まだ知識がありません' })).toBeInTheDocument(); expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('通知は未提供で、バックアップ操作を利用できる', () => {
    render(<Account/>); expect(screen.getByText('通知機能は未提供です。')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'JSONをエクスポート' })).toBeEnabled(); expect(screen.getByLabelText('バックアップから復元（10MB以下）')).toHaveAttribute('type', 'file');
  });
});
