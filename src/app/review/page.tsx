import type { Metadata } from 'next';
import { ReviewScreen } from '@/components/review-screen';
export const metadata: Metadata = { title: '復習' };
export default function Review() { return <ReviewScreen/>; }
