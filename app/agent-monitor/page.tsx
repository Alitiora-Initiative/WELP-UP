import type { Metadata } from 'next';
import { TerminalFeaturePage } from '@/components/TerminalFeaturePages';

export const metadata: Metadata = {
  title: 'Agent Monitor',
  description: 'Live service and execution status for WELP UP agents. No production agent runtime is currently enabled.',
};

export default function AgentMonitorPage() {
  return <TerminalFeaturePage kind="autonomous" />;
}
