import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, expect, it } from 'vitest';
import { BrainContainer } from './brain-container';
import { initialProgress, type Knowledge } from '@/domain/knowledge';
import type { ReviewEntry } from '@/domain/review';
const fixture = { entries: [] as ReviewEntry[] };
function mastered(id: string): ReviewEntry { const time = new Date().toISOString(); const knowledge: Knowledge = { id, term: 'HTTP', definition: 'Web通信で利用されるプロトコル', cloze_start: 11, cloze_end: 16, created_at: time, updated_at: time }; return { knowledge, progress: { ...initialProgress(id, time), status: 'mastered', level: undefined, next_due_at: undefined, mastered_at: time } }; }
beforeEach(() => { fixture.entries = []; sessionStorage.clear(); });
it('0件の脳型と空状態を表示する', () => { render(<BrainContainer entries={fixture.entries}/>); expect(screen.getByRole('img')).toHaveAccessibleName('脳型の知識容器'); expect(document.querySelectorAll('[data-particle-id]')).toHaveLength(0); expect(screen.getByText('件の知識が定着')).toHaveTextContent('0 件の知識が定着'); });
it('定着1件につき粒子1つで、順序変更・追加でも既存座標が変わらない', () => {
  fixture.entries = [mastered('a'), mastered('b')]; const { rerender } = render(<BrainContainer entries={fixture.entries}/>);
  const point = document.querySelector('[data-particle-id="a"]')!; const coordinates = point.getAttribute('data-crystal-position'); expect(document.querySelectorAll('[data-particle-id]')).toHaveLength(2);
  fixture.entries = [fixture.entries[1], mastered('c'), fixture.entries[0]]; rerender(<BrainContainer entries={fixture.entries}/>); const again = document.querySelector('[data-particle-id="a"]')!; expect(again.getAttribute('data-crystal-position')).toEqual(coordinates); expect(document.querySelectorAll('[data-particle-id]')).toHaveLength(3);
  fixture.entries[0].progress.status = 'archived'; fixture.entries[0].knowledge.archived_at = new Date().toISOString(); rerender(<BrainContainer entries={fixture.entries}/>); expect(document.querySelectorAll('[data-particle-id]')).toHaveLength(2);
});
it('新しい合格の粒子だけに追加アニメーションを付け、再マウント時は繰り返さない', async () => {
  fixture.entries = [mastered('new')]; const { unmount } = render(<StrictMode><BrainContainer entries={fixture.entries}/></StrictMode>); await waitFor(() => expect(document.querySelector('.particle-added')).not.toBeNull()); unmount();
  render(<BrainContainer entries={fixture.entries}/>); await waitFor(() => expect(sessionStorage.getItem('reboost-brain-seen')).toContain('new')); expect(document.querySelector('.particle-added')).toBeNull();
});
