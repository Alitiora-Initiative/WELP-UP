import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';
import { WalletConnectionControl } from '@/components/WalletConnectionControl';

type Block =
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

function parseTerms(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: 'list', items: list });
    list = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', text: heading[2], level: heading[1].length });
    } else if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      list.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (!line.trim() || /^---+$/.test(line.trim())) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      if (href.startsWith('http') || href.startsWith('mailto:')) {
        return (
          <a key={index} href={href} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      }
      const path =
        href === 'PRIVACY.md' || href.toLowerCase() === 'privacy.md'
          ? '/privacy'
          : href === 'LIMITS.md'
            ? '/safety'
            : href === 'ROADMAP.md'
              ? '/safety'
              : href === 'README.md'
                ? '/'
                : href.startsWith('/')
                  ? href
                  : `/${href}`;
      return (
        <Link key={index} href={path}>
          {label}
        </Link>
      );
    }
    return part;
  });
}

const terms = readFileSync(join(process.cwd(), 'TERMS.md'), 'utf8');
const blocks = parseTerms(terms);

export default function TermsPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="terms" status="Terms v1.0 · effective 21 Oct 2026" />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WELP UP</span>
            <span className="crumb-slash">/</span>
            <strong>Terms &amp; Conditions</strong>
          </div>
          <div className="topbar-right"><WalletConnectionControl /></div>
        </header>
        <div className="page-content terms-page">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">SERVICE TERMS · VERSION 1.0</p>
              <h1>
                Terms &amp; <em>Conditions.</em>
              </h1>
              <p className="welcome-copy">
                Official terms for the non-custodial WELP UP! Solana interface operated by Joseph Mushelle Nyingeh under Alitiora Initiative.
              </p>
            </div>
            <div className="date-pill">
              <span className="date-dot" /> EFFECTIVE 21 OCT 2026
            </div>
          </section>
          <div className="terms-draft-banner">
            <strong>Version 1.0 — published terms.</strong>
            <span>
              Operator: Joseph Mushelle Nyingeh (Alitiora Initiative), Kenya. Non-custodial wallet interface only. Autonomous vault is not enabled. Independent Kenyan legal advice remains recommended for formal reliance.
            </span>
          </div>
          <article className="panel terms-document">
            {blocks.map((block, index) => {
              if (block.kind === 'heading') {
                const Heading = block.level === 1 || block.level === 2 ? 'h2' : 'h3';
                return (
                  <Heading className={block.level === 1 ? 'terms-title' : 'terms-heading'} key={`${block.text}-${index}`}>
                    {block.text}
                  </Heading>
                );
              }
              if (block.kind === 'list') {
                return (
                  <ul key={`list-${index}`}>
                    {block.items.map((item) => (
                      <li key={item}>{inline(item)}</li>
                    ))}
                  </ul>
                );
              }
              return <p key={`paragraph-${index}`}>{inline(block.text)}</p>;
            })}
          </article>
          <footer className="footer">
            <span>WELP UP · Terms v1.0 · effective 21 October 2026</span>
            <span>Contact: jaymnyon@gmail.com · jaymn2006@gmail.com</span>
            <Link href="/">Back to home</Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
