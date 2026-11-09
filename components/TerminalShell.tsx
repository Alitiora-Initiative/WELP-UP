'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

type Ticker = { mint: string; symbol: string; priceUsd: number; priceChange24h: number };
type Feed = { assets?: Ticker[] };
type NavItem = { label: string; href: string; description: string };
type NavGroup = { label: string; items: NavItem[] };
const navGroups: NavGroup[] = [
 {label:'Markets',items:[['Market overview','/markets','Live Solana assets, liquidity and turnover'],['Token explorer','/token-explorer','Search tokens and inspect on-chain details'],['Signal engine','/signals','Transparent scoring and eligibility rules'],['Risk dashboard','/risk-dashboard','Review exposure and published risk checks'],['Leaderboard','/leaderboard','Compare tracked market activity']]},
 {label:'Trade',items:[['Launch Studio','/launch-studio','Review verified token launches and the on-chain launch studio'],['Swap desk','/swap','Review a Jupiter route and approve in your wallet'],['Safety limits','/safety','Execution checks, limits and wallet handoff'],['Transaction history','/history','Inspect public wallet transactions']]},
 {label:'Automate',items:[['Signal policies','/automation','Save watch rules and browser alerts'],['AI analyst','/agent','Market commentary and analysis boundaries'],['Agent monitor','/autonomous','Runtime status; no unattended execution'],['Strategy marketplace','/strategy-marketplace','Explore strategy listings and their status']]},
 {label:'Vault',items:[['Vault console','/vault','Authority model, gates and launch readiness'],['Vault cap chart','/dashboard','Review vault dashboard and cap snapshots'],['Architecture','/whitepaper','PDA design, threat model and authority flow']]},
 {label:'Console',items:[['Profile','/profile','Wallet overview and local preferences'],['Appearance','/settings','Dark, light and system display preferences'],['Portfolio','/portfolio','Public balances and wallet snapshots'],['Activity logs','/activity-logs','Browser-local policy and activity trail'],['System status','/system-status','Live Solana, Jupiter and service checks'],['Support centre','/support','FAQs and troubleshooting'],['Referral programme','/referral','Referral programme status and information']]},
 {label:'Docs',items:[['Documentation','/docs','Architecture, limits, roadmap and runbook'],['Whitepaper','/whitepaper','The WELP UP design and technical record'],['Terms','/terms','Published service terms'],['Privacy','/privacy','How data is handled'],['API keys','/api-keys','API access status and guidance']]}
].map(group=>({...group,items:group.items.map(([label,href,description])=>({label,href,description}))}));
const tickerSymbols = ['SOL', 'USDC', 'PUMP', 'USDT', 'WBTC', 'TTWO', 'HYPE', 'JUP', 'BONK', 'cbBTC'];
function price(value: number) {
  if (value >= 1000) return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return '$' + value.toFixed(2);
  if (value >= 0.01) return '$' + value.toFixed(4);
  return '$' + value.toPrecision(4);
}
function TickerStrip() {
  const [assets, setAssets] = useState<Ticker[]>([]);
  const [status, setStatus] = useState('connecting');
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/markets', { cache: 'no-store' });
        const data = await response.json() as Feed;
        if (!response.ok) throw new Error('feed unavailable');
        const rows = Array.isArray(data.assets) ? data.assets : [];
        const selected = tickerSymbols.map((symbol) => rows.find((row) => row.symbol.toUpperCase() === symbol.toUpperCase())).filter((row): row is Ticker => Boolean(row));
        if (active) { setAssets(selected); setStatus('live'); }
      } catch { if (active) setStatus('offline'); }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return <div className="ticker-strip"><div className="ticker-track">
    {[0, 1].map((copy) => <div className="ticker-group" key={copy} aria-hidden={copy === 1}>
      {assets.map((asset) => <span className="ticker-item" key={copy + asset.mint}><strong>{asset.symbol}</strong><span>{price(asset.priceUsd)}</span><em className={asset.priceChange24h >= 0 ? 'positive' : 'negative'}>{asset.priceChange24h >= 0 ? '+' : ''}{asset.priceChange24h.toFixed(2)}%</em></span>)}
    </div>)}
    {!assets.length ? <span className="ticker-status">{status === 'offline' ? 'Market feed unavailable' : 'Loading live market feed…'}</span> : null}
  </div><span className={'ticker-live ' + (status === 'live' ? 'is-live' : '')}><i />{status === 'live' ? 'LIVE FEED' : status === 'offline' ? 'FEED ISSUE' : 'CONNECTING'}</span></div>;
}

export function TerminalShell({ children }: { children: ReactNode }) {
 const pathname=usePathname();
 const [open,setOpen]=useState(false);
 const [activeMenu,setActiveMenu]=useState<string|null>(null);
 useEffect(()=>{let disposed=false;let stopReferralCapture:(()=>void)|undefined;void import('@/lib/referral-attribution').then((module)=>{if(!disposed)stopReferralCapture=module.installReferralCapture();}).catch(()=>{});const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);setActiveMenu(null);}};window.addEventListener('keydown',onKeyDown);return()=>{disposed=true;stopReferralCapture?.();window.removeEventListener('keydown',onKeyDown);};},[]);
 const isActive=(items:NavItem[])=>items.some(item=>pathname===item.href||(item.href!=='/'&&pathname.startsWith(item.href+'/')));
 const activeGroup=navGroups.find(group=>group.label===activeMenu);
 return <div className="terminal-site">
  <header className="site-header" onPointerLeave={(event)=>{if(event.pointerType==='mouse')setActiveMenu(null);}}>
   <Link href="/" className="site-brand" onClick={()=>{setOpen(false);setActiveMenu(null);}}><Image className="site-brand-mark" src="/welp-up-logo.svg" alt="WELP UP" width={40} height={40} priority /><strong>WELP UP!</strong><span className="network-badge"><i/> MAINNET</span></Link>
   <nav id="welp-primary-navigation" className={'site-nav'+(open?' is-open':'')} aria-label="Main navigation">
    {navGroups.map(group=><button key={group.label} type="button" className={'site-nav-trigger'+(isActive(group.items)?' is-active':'')+(activeMenu===group.label?' is-expanded':'')} aria-expanded={activeMenu===group.label} aria-controls="welp-mega-menu" onPointerEnter={(event)=>{if(event.pointerType==='mouse')setActiveMenu(group.label);}} onFocus={()=>setActiveMenu(group.label)} onClick={()=>setActiveMenu(current=>current===group.label?null:group.label)}>{group.label}<ChevronDown size={12}/></button>)}
   </nav>
   <div className="site-header-actions"><Link className="desk-link" href="/launch-studio">Launch Studio <ArrowUpRight size={14}/></Link><Link className="desk-link" href="/swap">Open trade desk <ArrowUpRight size={14}/></Link><WalletConnectionControl/><button className="mobile-nav-toggle" onClick={()=>{setOpen(value=>!value);setActiveMenu(null);}} aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="welp-primary-navigation">{open?<X size={18}/>:<Menu size={18}/>}</button></div>
   {activeGroup?<div id="welp-mega-menu" className="mega-menu" role="region" aria-label={activeGroup.label+' menu'} onPointerEnter={(event)=>{if(event.pointerType==='mouse')setActiveMenu(activeGroup.label);}}><div className="mega-menu-inner"><div className="mega-menu-heading"><span className="mega-menu-kicker">WELP UP! / {activeGroup.label.toUpperCase()}</span><h2>{activeGroup.label}</h2><p>Explore the tools and information available in this workspace.</p></div><div className="mega-menu-links">{activeGroup.items.map(item=><Link key={item.href} href={item.href} className="mega-menu-link" onClick={()=>{setActiveMenu(null);setOpen(false);}}><span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowUpRight size={15}/></Link>)}</div><div className="mega-menu-aside"><span className="mega-menu-kicker">MARKET ACCESS</span><strong>One desk. Clear controls.</strong><p>Live market data, transparent rules and wallet-approved transactions. No custody or unattended trading.</p><Link href="/safety" onClick={()=>setActiveMenu(null)}>Review safety model <ArrowUpRight size={13}/></Link></div></div></div>:null}
  </header>
  <TickerStrip/>
  <div className="site-main">{children}</div>
    <footer className="site-footer">
      <div className="footer-brand"><Image className="footer-brand-mark" src="/welp-up-logo.svg" alt="" width={42} height={42} /><div><strong>WELP UP!</strong><p>A Solana market console. Live pools, published rules, wallet-approved execution. WELP never holds keys and never trades on your behalf.</p></div></div>
      <div className="footer-column"><strong>PRODUCT</strong><Link href="/markets">Market board</Link><Link href="/signals">Signal engine</Link><Link href="/swap">Swap desk</Link><Link href="/portfolio">Portfolio</Link><Link href="/token-explorer">Token explorer</Link><Link href="/launch-studio">Launch Studio</Link></div>
      <div className="footer-column"><strong>AUTOMATION</strong><Link href="/automation">Signal policies</Link><Link href="/agent">Market agent</Link><Link href="/vault">Vault console</Link><Link href="/strategy-marketplace">Strategy marketplace</Link></div>
      <div className="footer-column"><strong>CONSOLE</strong><Link href="/profile">Profile</Link><Link href="/history">Transaction history</Link><Link href="/activity-logs">Activity logs</Link><Link href="/support">Support centre</Link><Link href="/system-status">System status</Link></div>
      <div className="footer-column"><strong>RECORD</strong><Link href="/docs">Documentation</Link><Link href="/whitepaper">Whitepaper</Link><Link href="/safety">Safety limits</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
      <div className="footer-column"><strong>MORE TOOLS</strong><Link href="/settings">Account settings</Link><Link href="/autonomous">Agent monitor</Link><Link href="/governance">Governance</Link><Link href="/risk-dashboard">Risk dashboard</Link><Link href="/api-keys">API keys</Link><Link href="/referral">Referral programme</Link></div>
      <div className="footer-bottom"><span>© 2026 WELP UP! · MIT licensed interface source.</span><span>Not investment advice. Digital assets can lose all value.</span><span>Solana mainnet · non-custodial</span></div>
    </footer>
  </div>;
}
