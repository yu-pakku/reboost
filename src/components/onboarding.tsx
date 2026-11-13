'use client';
import { useEffect, useRef, useState } from 'react';
import { completeOnboarding } from '@/data/onboarding';
import { AppShell } from './app-shell';
import { GravityVessel, type VesselIntroHandle } from './gravity-vessel';

// Illustration only: never counted as saved knowledge or written to IndexedDB.
const sampleMemories = Array.from({ length: 6 }, (_, index) => ({ id: `intro-${index}`, entering: true }));

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const inFlight = useRef(false);
  const vessel = useRef<VesselIntroHandle>(null);
  const section = useRef<HTMLElement>(null);
  const mounted = useRef(true);
  const exitAnimation = useRef<Animation | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; exitAnimation.current?.cancel(); }; }, []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await completeOnboarding();
      await vessel.current?.drop();
      if (!mounted.current) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (!reduce?.matches && section.current?.animate) {
        const animation = section.current.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 300, easing: 'ease-in', fill: 'both' });
        exitAnimation.current = animation;
        const finish = () => { if (reduce?.matches) animation.finish(); };
        reduce?.addEventListener('change', finish);
        try { await animation.finished; } catch { /* Leaving the page cancels its decoration. */ }
        finally { reduce?.removeEventListener('change', finish); }
      }
      if (mounted.current) onComplete();
    } catch {
      setError(true);
      setSaving(false);
      inFlight.current = false;
    }
  }

  return <AppShell active="/" hideNav>
    <section ref={section} className="onboarding" aria-busy={saving} aria-labelledby="onboarding-title">
      <div className="onboarding-content">
        <div className="brain-stage">
          <GravityVessel introRef={vessel} decorative description="脳型の容器に、種入りの玉がたまるイメージ。玉は説明用のサンプルです。" items={sampleMemories}/>
        </div>
        <h1 id="onboarding-title">思い出すたび、<br/>記憶になる。</h1>
        <p>復習と最終テストを重ねて、<br/>定着した知識が、種入りの玉に。</p>
      </div>
      <div className="onboarding-actions">
        {error && <p className="field-error" role="alert">開始状態を保存できませんでした。もう一度お試しください。</p>}
        <button className="primary-button home-primary onboarding-start" type="button" onClick={start} disabled={saving}>
          <span>{saving ? 'はじめの一歩…' : 'さあ、始めよう'}</span><span className="onboarding-start-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  </AppShell>;
}
