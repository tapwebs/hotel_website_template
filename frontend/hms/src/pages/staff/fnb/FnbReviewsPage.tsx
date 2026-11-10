import React, { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Gift, Phone, Star } from 'lucide-react';
import { fnbService } from '../../../services/fnbService';
import type { FnbReview } from '../../../types/fnb';
import { LoadingState } from '../../../components/common/LoadingState';
import { Button } from '../../../components/ui/Button';
import { ErrorNote, Segmented, rupees, titleCase } from './fnbUi';

const PAGE = 50;

const Stars: React.FC<{ value: number; className?: string }> = ({ value, className = 'h-4 w-4' }) => (
  <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`${className} ${n <= value ? 'fill-amber-400 text-amber-400' : 'text-border'}`} />
    ))}
  </span>
);

/** The guest app saves quick tags as "Tags: A, B | free text". Split them back apart. */
function parseComment(raw: string | null): { tags: string[]; text: string } {
  if (!raw) return { tags: [], text: '' };
  let tags: string[] = [];
  const text: string[] = [];
  for (const part of raw.split(' | ')) {
    if (part.startsWith('Tags: ')) tags = part.slice(6).split(', ').filter(Boolean);
    else text.push(part);
  }
  return { tags, text: text.join(' | ') };
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const ReviewCard: React.FC<{ r: FnbReview }> = ({ r }) => {
  const { tags, text } = parseComment(r.comment);
  return (
    <li className="grid gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars value={r.rating} />
        <span className="text-xs text-walnut">{when(r.reviewedAt)}</span>
      </div>
      {text && <p className="text-sm text-ink break-words">{text}</p>}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-gold-soft/20 px-2 py-0.5 text-xs text-walnut">{t}</span>
          ))}
        </div>
      )}
      {!text && tags.length === 0 && <p className="text-sm italic text-walnut">No comment, rating only.</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-walnut">
        <span className="font-semibold text-ink">{r.guestName || 'Guest'}</span>
        {r.location && <span>{r.location}</span>}
        <span className="font-mono">#{r.orderNumber}</span>
        <span>{rupees(r.totalMinor)}</span>
        <span className={r.status === 'DELIVERED' || r.status === 'BILLED' ? '' : 'font-semibold text-amber-800'}>
          Order {titleCase(r.status)}
        </span>
        {r.phone && (
          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-mono text-burgundy hover:underline">
            <Phone className="h-3 w-3" />{r.phone}
          </a>
        )}
        {r.spinPrize && <span className="inline-flex items-center gap-1"><Gift className="h-3 w-3" />{r.spinPrize}</span>}
      </div>
    </li>
  );
};

/** Every review guests left on their orders, with a rating summary and a star filter. */
export const FnbReviewsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const q = useInfiniteQuery({
    queryKey: ['fnb', 'reviews', filter],
    queryFn: ({ pageParam }) => fnbService.reviews(filter === 'all' ? undefined : Number(filter), pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.items.length < PAGE ? undefined : all.length * PAGE),
    refetchInterval: () => (document.hidden ? false : 60_000),
  });

  const summary = q.data?.pages[0]?.summary;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="text-center sm:px-4">
          <p className="font-display text-4xl font-semibold text-ink">{summary?.count ? summary.average.toFixed(1) : '–'}</p>
          <Stars value={Math.round(summary?.average ?? 0)} />
          <p className="mt-1 text-xs text-walnut">{summary?.count ?? 0} {summary?.count === 1 ? 'review' : 'reviews'}</p>
        </div>
        <div className="grid gap-1.5">
          {(['5', '4', '3', '2', '1'] as const).map((n) => {
            const c = summary?.distribution[n] ?? 0;
            const pct = summary?.count ? (c / summary.count) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2 text-xs text-walnut">
                <span className="w-3 font-mono">{n}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gold-soft/30">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right font-mono">{c}</span>
              </div>
            );
          })}
        </div>
      </section>

      <Segmented label="Filter by rating" value={filter} onChange={setFilter} className="justify-self-start"
        options={[{ id: 'all', label: 'All' }, ...(['5', '4', '3', '2', '1'] as const).map((n) => ({ id: n, label: `${n}★` }))]} />

      <ErrorNote error={q.error} />
      {q.isLoading ? (
        <LoadingState message="Loading reviews…" subtext="" />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-walnut">
          {filter === 'all' ? 'No reviews yet. They appear here as guests rate their orders.' : 'No reviews with this rating.'}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((r) => <ReviewCard key={r.orderId} r={r} />)}
        </ul>
      )}
      {q.hasNextPage && (
        <Button variant="secondary" className="justify-self-center" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  );
};
