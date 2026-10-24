import type { Metadata } from 'next';
import { SettingsPage } from '@/components/SettingsPage';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Adjust WELP UP display preferences: theme and text scale. Stored locally in your browser.',
};

export default function Page() {
  return <SettingsPage />;
}
