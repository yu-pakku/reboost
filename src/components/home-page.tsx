import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { KnowledgeSummary } from '@/components/knowledge-summary';
import { BrainContainer } from '@/components/brain-container';
import { ReviewSummary } from '@/components/review-summary';
import { Icon } from '@/components/icon';
export default function Home() {
  return <AppShell active="/">
    <div className="page-intro"><p className="eyebrow">あなたの知識に、もう一度。</p><h1>思い出すたび、<br/>自分のものに。</h1><p className="intro-copy">学んだことを、少しずつ。<br/>未来の自分に残す習慣をはじめよう。</p></div>
    <section className="hero-card" aria-labelledby="collection-title">
      <BrainContainer/>
      <Link className="primary-button" href="/knowledge/new"><Icon name="plus" size={20}/>知識を追加</Link><p className="feature-note">保存した知識はいつでも編集できます</p>
    </section>
    <ReviewSummary/>
    <KnowledgeSummary/>
    <aside className="tip-card"><span className="tip-icon"><Icon name="book"/></span><div><h2>小さな一歩を、積み重ねよう。</h2><p>まずはひとつ。気になった言葉からで大丈夫。</p></div></aside>
  </AppShell>;
}
