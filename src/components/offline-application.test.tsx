import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OfflineApplication } from './offline-application';
vi.mock('./home-page', () => ({ default: () => <p>offline home</p> }));
vi.mock('./account-page', () => ({ default: () => <p>offline account</p> }));
vi.mock('./knowledge-new-page', () => ({ default: () => <p>offline new</p> }));
vi.mock('./review-screen', () => ({ ReviewScreen: () => <p>offline review</p> }));
vi.mock('./knowledge-pages', () => ({ KnowledgeList: () => <p>offline list</p>, KnowledgeDetail: ({ knowledgeId, edit }: { knowledgeId: string; edit?: boolean }) => <p>{edit ? 'edit' : 'detail'}:{knowledgeId}</p> }));
vi.mock('./final-test-screen', () => ({ FinalTestPage: ({ knowledgeId }: { knowledgeId: string }) => <p>final:{knowledgeId}</p> }));
afterEach(() => window.history.replaceState({}, '', '/'));
it.each([['/', 'offline home'], ['/account', 'offline account'], ['/knowledge/new', 'offline new'], ['/knowledge', 'offline list'], ['/review', 'offline review'], ['/knowledge/48dd520f-dff2-40c5-ab92-2b8b234aeecc', 'detail:48dd520f-dff2-40c5-ab92-2b8b234aeecc'], ['/knowledge/48dd520f-dff2-40c5-ab92-2b8b234aeecc/edit', 'edit:48dd520f-dff2-40c5-ab92-2b8b234aeecc'], ['/test/48dd520f-dff2-40c5-ab92-2b8b234aeecc', 'final:48dd520f-dff2-40c5-ab92-2b8b234aeecc']])('保存シェルから%sを既存画面へ渡す', (path, text) => {
  window.history.replaceState({}, '', '/offline?route=' + encodeURIComponent(path)); render(<OfflineApplication/>); expect(screen.getByText(text)).toBeInTheDocument();
});
