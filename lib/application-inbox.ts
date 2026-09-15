import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApplicationStatus } from './applications.ts';

export const inboxFilters = {
  all: 'Sve prijave',
  offered: 'Ponude',
  applied: 'Poslate',
  accepted: 'Prihvaćene',
  closed: 'Zatvorene',
} as const;
export type InboxFilter = keyof typeof inboxFilters;
export const inboxPageSize = 25;
const closedStatuses: ApplicationStatus[] = ['declined', 'withdrawn', 'expired', 'rejected', 'cancelled'];

export function parseInboxQuery(query: { filter?: unknown; page?: unknown }) {
  const filter: InboxFilter = typeof query.filter === 'string' && Object.hasOwn(inboxFilters, query.filter)
    ? query.filter as InboxFilter : 'all';
  const page = typeof query.page === 'string' && /^[1-9]\d{0,5}$/.test(query.page) ? Number(query.page) : 1;
  return { filter, page };
}

export function inboxHref(filter: InboxFilter, page = 1) {
  const query = new URLSearchParams();
  if (filter !== 'all') query.set('filter', filter);
  if (page > 1) query.set('page', String(page));
  return `/applications${query.size ? `?${query}` : ''}`;
}

export type InboxApplication = {
  id: string; shift_id: string; worker_id: string; worker_name: string; effective_status: ApplicationStatus;
  offer_expires_at: string | null; accepted_at: string | null;
};

// Keep filtering in PostgREST, before pagination. The security-invoker view
// computes expiry and applies RLS; this explicit worker scope narrows it further.
export async function loadWorkerInbox(client: SupabaseClient, workerId: string, options: { filter: InboxFilter; page: number }) {
  let query = client.from('application_inbox')
    .select('id,shift_id,worker_id,worker_name,effective_status,offer_expires_at,accepted_at')
    .eq('worker_id', workerId);
  if (options.filter === 'closed') query = query.in('effective_status', closedStatuses);
  else if (options.filter !== 'all') query = query.eq('effective_status', options.filter);
  if (options.filter === 'offered') query = query.order('offer_expires_at', { ascending: true });
  query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
  const offset = (options.page - 1) * inboxPageSize;
  const [result, offers] = await Promise.all([
    query.range(offset, offset + inboxPageSize), // one extra row detects a next page
    client.from('application_inbox').select('id', { count: 'exact', head: true })
      .eq('worker_id', workerId).eq('effective_status', 'offered'),
  ]);
  if (result.error || offers.error || offers.count === null) throw new Error('Application inbox unavailable');
  const rows = result.data as InboxApplication[];
  return { applications: rows.slice(0, inboxPageSize), hasNext: rows.length > inboxPageSize, offerCount: offers.count };
}
