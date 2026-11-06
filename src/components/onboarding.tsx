'use client';
import { useRef, useState } from 'react';
import { completeOnboarding } from '@/data/onboarding';
import { AppShell } from './app-shell';
import { BrainArt } from './brain-art';
import { crystalPlacement } from '@/domain/brain';

// Decorative crystals are independent of saved knowledge and progress.
const crystals = Array.from({ length: 6 }, (_, slot) => ({
  ...crystalPlacement(slot, 6), id: `intro-${slot}`, entering: true, decorative: true,
}));

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(false);
    try {
      await completeOnboarding();
      onComplete();
    } catch {
      setError(true);
      setSaving(false);
      inFlight.current = false;
    }
  }

  return <AppShell active="/" hideNav>
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding-content">
        <div className="brain-stage">
          <BrainArt description="透明な曲面に結晶が集まるイメージ" crystals={crystals}/>
        </div>
        <h1 id="onboarding-title">思い出すたび、<br/>記憶になる。</h1>
        <p>小さな学びを、ひと粒ずつ。</p>
      </div>
      <div className="onboarding-actions">
        {error && <p className="field-error" role="alert">開始状態を保存できませんでした。もう一度お試しください。</p>}
        <button className="primary-button home-primary" type="button" onClick={start} disabled={saving}>
          {saving ? '保存中…' : 'さあ、始めよう'}
        </button>
      </div>
    </section>
  </AppShell>;
}
