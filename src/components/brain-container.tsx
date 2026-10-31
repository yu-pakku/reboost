'use client';
import { useEffect, useId, useState } from 'react';
import { useKnowledge } from '@/data/use-knowledge';
import { particlePosition } from '@/domain/brain';
const HALF_BRAIN = 'M158 47 C148 22 114 20 99 39 C76 31 51 46 50 70 C26 79 22 109 36 127 C20 150 33 181 56 188 C60 213 86 228 109 216 C126 234 151 224 158 208 Z';
const FOLDS = 'M99 39 C91 53 99 70 115 73 M50 70 C68 64 80 79 77 95 C90 92 102 101 102 115 M36 127 C49 112 66 117 71 130 C74 145 61 155 49 154 M56 188 C64 170 87 172 96 185 C103 202 94 213 109 216 M121 102 C145 105 146 127 131 139 C112 146 112 161 129 172 M105 148 C91 146 84 153 84 164';
export function BrainContainer() {
  const { entries, error } = useKnowledge();
  const uid = useId().replace(/:/g, '');
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
      setAnimated(fresh);
      try { sessionStorage.setItem('reboost-brain-seen', JSON.stringify([...seen])); } catch { /* no learning data is stored here */ }
    });
    return () => cancelAnimationFrame(frame);
  }, [entries]);
  const animatedIds = new Set(animated);
  const mastered = entries?.filter(e => !e.knowledge.archived_at && e.progress.status === 'mastered').sort((a, b) => a.knowledge.id.localeCompare(b.knowledge.id));
  return <div className="brain-collection"><svg className="brain-svg" viewBox="0 0 320 260" role="img" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-desc`}><title id={`${uid}-title`}>脳型の知識容器</title><desc id={`${uid}-desc`}>{mastered ? `定着済みの知識${mastered.length}件を${mastered.length}個の粒子で表示しています。` : '保存した定着状態を読み込んでいます。'}</desc>
    <defs><linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#eefbff" stopOpacity=".85"/><stop offset=".5" stopColor="#c7effa" stopOpacity=".24"/><stop offset="1" stopColor="#e8faff" stopOpacity=".75"/></linearGradient><clipPath id={`${uid}-clip`}><path d={HALF_BRAIN}/><path d={HALF_BRAIN} transform="translate(320 0) scale(-1 1)"/></clipPath></defs>
    <ellipse cx="160" cy="241" rx="97" ry="6" fill="#d6eef5" opacity=".35"/>
    <g fill={`url(#${uid}-glass)`} stroke="#7fc5db" strokeWidth="1.8"><path d={HALF_BRAIN}/><path d={HALF_BRAIN} transform="translate(320 0) scale(-1 1)"/></g>
    <g clipPath={`url(#${uid}-clip)`}>{mastered?.map(e => { const point = particlePosition(e.knowledge.id); return <circle key={`${e.knowledge.id}:${e.progress.mastered_at}`} data-particle-id={e.knowledge.id} cx={point.x.toFixed(3)} cy={point.y.toFixed(3)} r="3.5" fill="#29a9d0" opacity=".82" className={animatedIds.has(e.knowledge.id) ? 'knowledge-particle particle-added' : 'knowledge-particle'}/>; })}</g>
    <g fill="none" stroke="#8dcbdf" strokeWidth="1.3" opacity=".65" strokeLinecap="round"><path d={FOLDS}/><path d={FOLDS} transform="translate(320 0) scale(-1 1)"/><path d="M160 50 V207" strokeDasharray="3 6"/></g>
  </svg>
    {error ? <p className="field-error" role="alert">定着状態を読み込めませんでした。</p> : <><p className="eyebrow" id="collection-title">思い出せる知識が、ここに。</p><p className="collection-count">{mastered ? mastered.length : '—'}<span>件</span></p><p className="muted">定着済み（アプリ判定）</p><p className="brain-empty">{mastered?.length === 0 ? '最終テストに合格すると、最初の粒が加わります。' : mastered ? 'ひと粒ずつ、学びを積み重ねよう。' : '定着状態を読み込み中…'}</p></>}
    <p className="field-note">学習達成の記録であり、永久記憶の保証ではありません。</p>
  </div>;
}
