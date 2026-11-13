'use client';
import { useEffect, useState } from 'react';
import type { KnowledgeEntry } from '@/data/use-knowledge';
import { GravityVessel } from './gravity-vessel';

export function BrainContainer({ entries, error }: { entries?: KnowledgeEntry[]; error?: string }) {
  const [animated, setAnimated] = useState<string[]>([]);
  useEffect(() => {
    if (!entries) return;
    let seen = new Set<string>();
    try { seen = new Set(JSON.parse(sessionStorage.getItem('reboost-brain-seen') ?? '[]')); } catch { /* visualization remains available without storage */ }
    const fresh: string[] = [];
    for (const entry of entries) if (!entry.knowledge.archived_at && entry.progress.status === 'mastered' && entry.progress.mastered_at) {
      const key = `${entry.knowledge.id}:${entry.progress.mastered_at}`;
      const age = Date.now() - Date.parse(entry.progress.mastered_at);
      if (!seen.has(key) && age >= 0 && age < 5 * 60000) fresh.push(entry.knowledge.id);
      seen.add(key);
    }
    const frame = requestAnimationFrame(() => {
      if (fresh.length) setAnimated(previous => [...previous, ...fresh]);
      try { sessionStorage.setItem('reboost-brain-seen', JSON.stringify([...seen])); } catch { /* no learning data is stored here */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [entries]);
  const animatedIds = new Set(animated);
  const mastered = entries?.filter(e => !e.knowledge.archived_at && e.progress.status === 'mastered')
    .sort((a, b) => (a.progress.mastered_at ?? '').localeCompare(b.progress.mastered_at ?? '') || a.knowledge.id.localeCompare(b.knowledge.id));
  const items = mastered?.map(({ knowledge }) => ({ id: knowledge.id, entering: animatedIds.has(knowledge.id) })) ?? [];
  return <div className="brain-collection">
    <GravityVessel description={mastered ? `定着済みの知識${mastered.length}件を${mastered.length}個の種入りの玉で表示しています。` : '保存した定着状態を読み込んでいます。'} items={items}/>
    {error ? <p className="field-error" role="alert">定着状態を読み込めませんでした。</p>
      : mastered && <p className="collection-label"><strong>{mastered.length}</strong> 件の知識が定着</p>}
  </div>;
}
