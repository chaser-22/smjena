import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ApplicationStatus } from '@/lib/applications';

export type ApplicationPost = {
  shift_id: string; employer_id: string; employer_name: string; role: string; city: string; location_area: string;
  starts_at: string; ends_at: string; pay_cents: number; workers_needed: number; requirements: string[]; status: 'open' | 'cancelled';
};
export type ShiftApplication = {
  id: string; shift_id: string; worker_id: string; worker_name: string; effective_status: ApplicationStatus;
  offer_expires_at: string | null; accepted_at: string | null;
};
export async function applicationSession(next: string) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { client, user: data.user, now: Date.now() };
}
export async function listApplications(client: Awaited<ReturnType<typeof createClient>>, filter: { shift?: string; worker?: string }) {
  let query = client.from('application_inbox').select('id,shift_id,worker_id,worker_name,effective_status,offer_expires_at,accepted_at').order('created_at', { ascending: false });
  if (filter.shift) query = query.eq('shift_id', filter.shift);
  if (filter.worker) query = query.eq('worker_id', filter.worker);
  const { data, error } = await query.limit(200);
  if (error) throw new Error('Application list unavailable');
  return data as ShiftApplication[];
}
export async function getApplicationContact(client: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await client.rpc('application_contact', { target_application: id });
  if (error) throw new Error('Contact unavailable');
  return (data as { phone: string; exact_address: string | null }[])[0] ?? null;
}
