'use client';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './database';
import { learningStatistics } from '@/domain/statistics';
export function useStatistics() {
  const [state, setState] = useState<{ statistics?: ReturnType<typeof learningStatistics>; error?: string }>({});
  useEffect(() => {
    const sub = liveQuery(() => db.transaction('r', db.knowledge, db.progress, db.attempts, async () => {
      const knowledge = await db.knowledge.toArray(); const progress = new Map((await db.progress.toArray()).map(p => [p.knowledge_id, p]));
      const entries = knowledge.map(k => { const p = progress.get(k.id); if (!p) throw new Error('進捗がありません'); return { knowledge: k, progress: p }; });
      return learningStatistics(entries, await db.attempts.toArray());
    })).subscribe({ next: statistics => setState({ statistics }), error: () => setState({ error: '統計を読み込めませんでした。再読み込みをお試しください。' }) });
    return () => sub.unsubscribe();
  }, []);
  return state;
}
