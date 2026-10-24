import type { Metadata } from 'next';
import { LeaderboardPage } from '@/components/LeaderboardPage';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top performing WELP UP bots ranked by verified on-chain results.',
};

export default function Page() {
  return <LeaderboardPage />;
}
