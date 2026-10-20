'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, RotateCw } from 'lucide-react';

type WalletTransaction = {
  signature: string;
  slot: number;
  blockTime: number | null;
  failed: boolean;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null;
};

type HistoryResponse = { transactions: WalletTransaction[]; hasMore: boolean; nextBefore: string | null };
const PAGE_SIZES = [10, 25, 50, 100] as const;

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp * 1000);
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 10)}…${signature.slice(-8)}`;
}

export function TransactionHistory({ owner }: { owner: string }) {
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loadedFor, setLoadedFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const before = cursors[pageIndex];
        const params = new URLSearchParams({ owner, limit: String(pageSize) });
        if (before) params.set('before', before);
        const response = await fetch(`/api/history?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load transaction history.');
        if (!controller.signal.aborted) {
          setData(result as HistoryResponse);
          setLoadedFor(owner);
        }
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Could not load transaction history.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [owner, pageSize, pageIndex, cursors]);

  function changePageSize(value: number) {
    setPageSize(value);
    setPageIndex(0);
    setCursors([null]);
    setData(null);
  }

  function nextPage() {
    if (!data?.hasMore || !data.nextBefore) return;
    setCursors((current) => [...current.slice(0, pageIndex + 1), data.nextBefore]);
    setPageIndex((current) => current + 1);
    setData(null);
  }

  function previousPage() {
    if (pageIndex === 0) return;
    setPageIndex((current) => current - 1);
    setData(null);
  }

  const visibleData = loadedFor === owner ? data : null;

  return (
    <section className="panel wallet-history-panel" aria-label="On-chain transaction history">
      <div className="panel-heading wallet-history-heading">
        <div><p className="eyebrow">ON-CHAIN · THIS WALLET ADDRESS</p><h2>Transaction history</h2></div>
        <label className="history-page-size"><span>Rows</span><select value={pageSize} onChange={(event) => changePageSize(Number(event.target.value))} aria-label="Transactions per page">{PAGE_SIZES.map((size) => <option value={size} key={size}>{size} per page</option>)}</select></label>
      </div>
      <p className="wallet-history-caption">History is fetched from Solana for this public address. Select up to 100 transactions per page; use Explorer for token amounts and full instruction details.</p>
      {error ? <div className="inline-error history-error" role="alert">{error}<button className="text-button" onClick={() => { setData(null); setLoadedFor(''); setPageIndex(0); setCursors([null]); }}>Try again</button></div> : null}
      {loading ? <div className="history-loading"><LoaderCircle className="spin" size={18} /> Loading wallet transactions…</div> : null}
      {!loading && visibleData?.transactions.length === 0 ? <div className="history-empty">No transactions were returned for this wallet.</div> : null}
      {visibleData?.transactions.length ? (
        <>
          <div className="history-table-wrap">
            <table className="history-table">
              <thead><tr><th scope="col">Transaction</th><th scope="col">Time</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Details</span></th></tr></thead>
              <tbody>
                {visibleData.transactions.map((transaction, index) => (
                  <tr key={transaction.signature}>
                    <td><span className="history-index">{pageIndex * pageSize + index + 1}</span><code title={transaction.signature}>{shortSignature(transaction.signature)}</code></td>
                    <td>{formatTimestamp(transaction.blockTime)}</td>
                    <td><span className={`history-status${transaction.failed ? ' history-status-failed' : ''}`}>{transaction.failed ? 'Failed' : transaction.confirmationStatus ?? 'Unknown'}</span></td>
                    <td><a href={`https://explorer.solana.com/tx/${encodeURIComponent(transaction.signature)}`} target="_blank" rel="noreferrer" aria-label={`Open transaction ${shortSignature(transaction.signature)} in Solana Explorer`}><ExternalLink size={14} /></a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="history-pagination">
            <span>Page {pageIndex + 1} · {visibleData.transactions.length} transaction{visibleData.transactions.length === 1 ? '' : 's'}</span>
            <div><button onClick={previousPage} disabled={pageIndex === 0 || loading}>Previous</button><button onClick={nextPage} disabled={!visibleData.hasMore || loading}>Next</button></div>
          </div>
        </>
      ) : null}
      {!loading && !visibleData && !error ? <div className="history-loading"><RotateCw className="spin" size={17} /> Preparing history…</div> : null}
    </section>
  );
}
