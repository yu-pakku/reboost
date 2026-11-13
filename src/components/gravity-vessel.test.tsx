import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GravityVessel } from './gravity-vessel';
afterEach(() => vi.unstubAllGlobals());
it('動き軽減時には揺らす・端末連動・装飾アニメーションを停止する', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<GravityVessel items={[{ id: 'memory' }]} description="1件"/>);
  expect(screen.getByRole('button', { name: '記憶の容器を揺らす' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '端末と連動' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '動きを軽減中' })).toBeDisabled();
});
it('手動停止と再開ができ、端末センサー非対応では代替操作を案内する', () => {
  render(<GravityVessel items={[]} description="0件"/>);
  fireEvent.click(screen.getByRole('button', { name: '動きを止める' }));
  expect(screen.getByRole('button', { name: '記憶の容器を揺らす' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '動きを再開' }));
  expect(screen.getByRole('button', { name: '記憶の容器を揺らす' })).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '端末と連動' }));
  expect(screen.getByRole('status')).toHaveTextContent('容器をタップして揺らせます');
});
