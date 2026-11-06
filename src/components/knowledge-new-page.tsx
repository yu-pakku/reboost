import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { KnowledgeForm } from '@/components/knowledge-form';
export default function Page() { return <AppShell active="/" hideNav><Link href="/" className="text-link">← ホーム</Link><div className="page-intro"><h1>知識を追加</h1><p className="intro-copy">用語と意味、思い出したい箇所を登録します。</p></div><KnowledgeForm/></AppShell>; }
