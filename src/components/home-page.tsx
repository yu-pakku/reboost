'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from './app-shell';
import { BrainContainer } from './brain-container';
import { Icon } from './icon';
import { Onboarding } from './onboarding';
import { useKnowledge } from '@/data/use-knowledge';
import { shouldShowOnboarding } from '@/data/onboarding';
import { reviewQueue } from '@/domain/review';
import { useReviewClock } from '@/lib/use-review-clock';
import { formatDate } from '@/lib/knowledge-display';

export default function Home() {
  const [view, setView] = useState<'loading' | 'intro' | 'home'>('loading');
  const focusHome = useRef(false);
  const [arriving, setArriving] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true;
    void shouldShowOnboarding().then(
      show => { if (active) setView(show ? 'intro' : 'home'); },
      () => { if (active) setView('home'); },
    );
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (view === 'home' && focusHome.current) heading.current?.focus();
  }, [view]);

  if (view === 'loading') return <AppShell active="/" hideNav>
    <p className="loading-message" role="status">端末内のデータを確認しています…</p>
  </AppShell>;
  if (view === 'intro') return <Onboarding onComplete={() => {
    focusHome.current = true;
    setArriving(true);
    setView('home');
  }}/>;
  return <div className={arriving ? 'onboarding-home-enter' : undefined}><HomeCollection heading={heading}/></div>;
}

function HomeCollection({ heading }: { heading: React.RefObject<HTMLHeadingElement | null> }) {
  const { entries, error } = useKnowledge();
  const now = useReviewClock();
  const queue = reviewQueue(entries ?? [], now);
  const ready = queue.due.length + queue.overdue.length;
  const finalReady = queue.final.filter(entry => Date.parse(entry.progress.next_due_at!) <= now).length;
  const next = [queue.upcoming[0], queue.final.find(entry => Date.parse(entry.progress.next_due_at!) > now)]
    .filter(entry => entry !== undefined).sort((a, b) => Date.parse(a.progress.next_due_at!) - Date.parse(b.progress.next_due_at!))[0];

  return <AppShell active="/" reviewDue={ready > 0 || finalReady > 0}>
    <section className="home-collection" aria-labelledby="home-title">
      <h1 id="home-title" ref={heading} tabIndex={-1}>記憶のコレクション</h1>
      <div className="brain-stage">
        <BrainContainer entries={entries} error={error}/>
      </div>
      {entries && <section className="home-review-status" aria-label="今日の学習">
        <div>
          <p className="eyebrow">今日の学習</p>
          <h2>{entries.length ? `復習${ready}件・最終テスト${finalReady}件` : 'まずは知識を1件追加'}</h2>
          {next && <p className="field-note">次回 <time dateTime={next.progress.next_due_at}>{formatDate(next.progress.next_due_at!)}</time> · {next.knowledge.term}</p>}
        </div>
        {entries.length > 0 && <Link className="text-link" href="/review">復習を開く →</Link>}
      </section>}
      <div className="home-actions">
        <Link className="primary-button home-primary" href="/knowledge/new">
          <Icon name="plus" size={21}/>知識を追加
        </Link>
        <Link className="text-link collection-link" href="/knowledge">知識一覧</Link>
      </div>
    </section>
  </AppShell>;
}
