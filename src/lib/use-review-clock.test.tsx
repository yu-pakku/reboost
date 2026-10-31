import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useReviewClock } from './use-review-clock';
afterEach(() => vi.useRealTimers());
it('時間経過・アプリ復帰時にキューの時計を更新し、終了時に購読を解除する', () => {
  vi.useFakeTimers(); vi.setSystemTime('2026-10-30T01:00:00.000Z');
  const { result, unmount } = renderHook(useReviewClock);
  const initial = result.current;
  act(() => vi.advanceTimersByTime(30000)); expect(result.current).toBe(initial + 30000);
  vi.setSystemTime('2026-11-01T01:00:00.000Z'); act(() => window.dispatchEvent(new Event('focus'))); expect(result.current).toBe(Date.parse('2026-11-01T01:00:00.000Z'));
  vi.setSystemTime('2026-11-02T01:00:00.000Z'); act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(result.current).toBe(Date.parse('2026-11-02T01:00:00.000Z'));
  unmount(); expect(vi.getTimerCount()).toBe(0);
});
