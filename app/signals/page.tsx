import type { Metadata } from 'next';
import { SignalsBoard } from '@/components/SignalsBoard';
export const metadata: Metadata = { title: 'Signals', description: 'Scored Solana market candidates with the reason behind every warning and block.' };
export default function SignalsPage() { return <SignalsBoard />; }
