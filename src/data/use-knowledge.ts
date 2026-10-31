'use client';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './database';
import { storageError } from './knowledge-repository';
import type { Knowledge, LearningProgress } from '@/domain/knowledge';
export type KnowledgeEntry = { knowledge: Knowledge; progress: LearningProgress };
export function useKnowledge() {
  const [state, setState] = useState<{ entries?: KnowledgeEntry[]; error?: string }>({});
  useEffect(() => {
    const subscription = liveQuery(() => db.transaction('r', db.knowledge, db.progress, async () => {
      const knowledge = await db.knowledge.orderBy('updated_at').reverse().toArray();
      const progress = new Map((await db.progress.toArray()).map(p => [p.knowledge_id, p]));
      return knowledge.map(k => {
        const p = progress.get(k.id);
        if (!p) throw new Error('進捗が見つかりません');
        return { knowledge: k, progress: p };
      });
    })).subscribe({ next: entries => setState({ entries }), error: error => setState({ error: storageError(error) }) });
    return () => subscription.unsubscribe();
  }, []);
  return state;
}
