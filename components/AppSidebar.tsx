import Link from 'next/link';
import { Activity, ArrowDownUp, Bot, BookOpen, FileText, Home, LayoutDashboard, LineChart, LockKeyhole, Settings, Shield, ShieldCheck, Trophy, UserRound, Vault } from 'lucide-react';

type AppSidebarProps = {
  active: 'home' | 'console' | 'signals' | 'autonomous' | 'swap' | 'vault' | 'safety' | 'profile' | 'activity' | 'terms' | 'privacy' | 'settings' | 'leaderboard';
  signalCount?: number | string;
  status?: string;
  network?: 'mainnet';
};

export function AppSidebar({ active, signalCount = '—', status = 'Ready when wallet connects', network = 'mainnet' }: AppSidebarProps) {
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="WELP UP home">
        <span className="brand-mark">W</span>
        <span><strong>WELP UP</strong><small>AGENT CONSOLE</small></span>
      </Link>
      <div className="network-chip"><span className="network-pip" /> SOLANA {network.toUpperCase()}</div>
      <nav className="side-nav" aria-label="Main navigation">
        <Link className={`nav-item${active === 'home' ? ' active' : ''}`} href="/" aria-current={active === 'home' ? 'page' : undefined}><Home size={17} /> Home</Link>
        <Link className={`nav-item${active === 'console' ? ' active' : ''}`} href="/dashboard" aria-current={active === 'console' ? 'page' : undefined}><LayoutDashboard size={17} /> Overview</Link>
        <Link className={`nav-item${active === 'signals' ? ' active' : ''}`} href="/signals" aria-current={active === 'signals' ? 'page' : undefined}><Activity size={17} /> Live signals <span className="nav-count">{signalCount || '—'}</span></Link>
        <Link className={`nav-item${active === 'autonomous' ? ' active' : ''}`} href="/autonomous" aria-current={active === 'autonomous' ? 'page' : undefined}><Bot size={17} /> Agent status</Link>
        <Link className={`nav-item${active === 'leaderboard' ? ' active' : ''}`} href="/leaderboard" aria-current={active === 'leaderboard' ? 'page' : undefined}><Trophy size={17} /> Leaderboard</Link>
        <Link className={`nav-item${active === 'vault' ? ' active' : ''}`} href="/vault" aria-current={active === 'vault' ? 'page' : undefined}><Vault size={17} /> Vault status</Link>
        <Link className={`nav-item${active === 'swap' ? ' active' : ''}`} href="/swap" aria-current={active === 'swap' ? 'page' : undefined}><ArrowDownUp size={17} /> Swap</Link>
        <Link className={`nav-item${active === 'safety' ? ' active' : ''}`} href="/safety" aria-current={active === 'safety' ? 'page' : undefined}><ShieldCheck size={17} /> Safety rules</Link>
        <Link className={`nav-item${active === 'activity' ? ' active' : ''}`} href="/activity" aria-current={active === 'activity' ? 'page' : undefined}><LineChart size={17} /> Portfolio activity</Link>
        <Link className={`nav-item${active === 'profile' ? ' active' : ''}`} href="/profile" aria-current={active === 'profile' ? 'page' : undefined}><UserRound size={17} /> Profile</Link>
        <Link className={`nav-item${active === 'settings' ? ' active' : ''}`} href="/settings" aria-current={active === 'settings' ? 'page' : undefined}><Settings size={17} /> Settings</Link>
        <Link className="nav-item" href="/docs"><BookOpen size={17} /> Documentation</Link>
        <Link className="nav-item" href="/whitepaper"><FileText size={17} /> Whitepaper</Link>
        <Link className={`nav-item${active === 'terms' ? ' active' : ''}`} href="/terms" aria-current={active === 'terms' ? 'page' : undefined}><FileText size={17} /> Terms &amp; Conditions</Link>
        <Link className={`nav-item${active === 'privacy' ? ' active' : ''}`} href="/privacy" aria-current={active === 'privacy' ? 'page' : undefined}><Shield size={17} /> Privacy Policy</Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="agent-status"><span className="status-pip" /><div><strong>Signal engine</strong><small>{status}</small></div></div>
        <div className="sidebar-note"><LockKeyhole size={15} /><span>Every available swap requires an explicit wallet signature.</span></div>
        <div className="build-label">WELP UP <span>v1.0</span></div>
      </div>
    </aside>
  );
}
