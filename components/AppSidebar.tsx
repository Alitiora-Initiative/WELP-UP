import Link from 'next/link';
import { Activity, ArrowDownUp, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

type AppSidebarProps = {
  active: 'dashboard' | 'profile';
  signalCount?: number | string;
  status?: string;
};

export function AppSidebar({ active, signalCount = '—', status = 'Ready when wallet connects' }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/#top" aria-label="WELP UP home">
        <span className="brand-mark">W</span>
        <span><strong>WELP UP</strong><small>AGENT CONSOLE</small></span>
      </Link>
      <div className="network-chip"><span className="network-pip" /> SOLANA MAINNET</div>
      <nav className="side-nav" aria-label="Main navigation">
        <Link className={`nav-item${active === 'dashboard' ? ' active' : ''}`} href="/#signals" aria-current={active === 'dashboard' ? 'page' : undefined}>
          <Activity size={17} /> Live signals <span className="nav-count">{signalCount || '—'}</span>
        </Link>
        <Link className="nav-item" href="/#swap"><ArrowDownUp size={17} /> Swap</Link>
        <Link className="nav-item" href="/#safety"><ShieldCheck size={17} /> Safety rules</Link>
        <Link className={`nav-item${active === 'profile' ? ' active' : ''}`} href="/profile" aria-current={active === 'profile' ? 'page' : undefined}>
          <UserRound size={17} /> Profile
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="agent-status"><span className="status-pip" /><div><strong>Signal engine</strong><small>{status}</small></div></div>
        <div className="sidebar-note"><LockKeyhole size={15} /><span>Keys stay inside your wallet. WELP never asks for a seed phrase.</span></div>
        <div className="build-label">WELP UP <span>v1.0</span></div>
      </div>
    </aside>
  );
}
