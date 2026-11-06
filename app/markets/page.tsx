import type { Metadata } from 'next';
import { MarketBoard } from '@/components/MarketBoard';
export const metadata: Metadata = { title: 'Markets', description: 'Live Solana market board with liquidity, volume, organic activity and transparent rule scores.' };
export default function MarketsPage() { return <MarketBoard />; }
