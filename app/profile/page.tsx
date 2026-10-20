import type { Metadata } from 'next';
import { ProfilePage } from '@/components/ProfilePage';

export const metadata: Metadata = {
  title: 'Profile — WELP UP',
  description: 'View the wallet connected to WELP UP and its public balance summary.',
};

export default function ProfileRoute() {
  return <ProfilePage />;
}
