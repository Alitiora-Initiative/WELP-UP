import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Link from 'next/link';
import { AppSidebar } from '@/components/AppSidebar';

type Block =
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] };

function parseMarkdown(markdown: string): Block[] {
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
      return (
        <Link key={index} href={href}>
          {label}
        </Link>
      );
    }
    return part;
  });
}

const privacy = readFileSync(join(process.cwd(), 'PRIVACY.md'), 'utf8');
const blocks = parseMarkdown(privacy);

export default function PrivacyPage() {
  return (
    <main className="app-shell">
      <AppSidebar active="privacy" status="Privacy notice · see publication notes" />
      <section className="workspace" id="top">
        <header className="topbar">
          <div className="breadcrumb">
            <span>WELP UP</span>
            <span className="crumb-slash">/</span>
            <strong>Privacy Policy</strong>
          </div>
        </header>
        <div className="page-content terms-page">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">PRIVACY NOTICE</p>
              <h1>
                Privacy <em>Policy.</em>
              </h1>
              <p className="welcome-copy">
                How WELP UP! processes personal information when you use the Solana market-analysis and wallet trading interface.
              </p>
            </div>
            <div className="date-pill">
              <span className="date-dot" /> LAST UPDATED 20 OCT 2026
            </div>
          </section>
          <div className="terms-draft-banner">
            <strong>Privacy notice for the WELP UP! services.</strong>
            <span>
              Contact: jaymnyon@gmail.com · jaymn2006@gmail.com. Submit a data subject access request via the link in section 12 if you need to exercise privacy rights.
            </span>
          </div>
          <article className="panel terms-document">
            {blocks.map((block, index) => {
              if (block.kind === 'heading') {
                const Heading = block.level === 1 || block.level === 2 ? 'h2' : 'h3';
                return (
                  <Heading
                    className={block.level === 1 ? 'terms-title' : 'terms-heading'}
                    key={`${block.text}-${index}`}
                  >
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
            <span>WELP UP · Privacy notice dated 20 October 2026</span>
            <span>Contact: jaymnyon@gmail.com · jaymn2006@gmail.com</span>
            <Link href="/">Back to home</Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
