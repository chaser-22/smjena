import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type PublicShift = {
  shift_id: string; role: string; employer_name: string; city: string;
  location_area: string; starts_at: string; ends_at: string;
  pay_cents: number; workers_needed: number; requirements: string[];
};

export async function getPublicShifts(city?: string, id?: string): Promise<{ shifts: PublicShift[]; unavailable: boolean }> {
  if (!isSupabaseConfigured()) return { shifts: [], unavailable: true };
  // Always anonymous, including for signed-in visitors. No cookies, service key,
  // base-table joins, private enrichment or shared-cache authenticated payload.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  let query = supabase.from('public_shift_listings')
    .select('shift_id, role, employer_name, city, location_area, starts_at, ends_at, pay_cents, workers_needed, requirements')
    .gt('starts_at', new Date().toISOString()).order('starts_at').order('shift_id').limit(50);
  if (city) query = query.eq('city', city);
  if (id) query = query.eq('shift_id', id);
  const { data, error } = await query;
  return error ? { shifts: [], unavailable: true } : { shifts: data as PublicShift[], unavailable: false };
}

export function publicShiftTime(value: string) {
  return new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'Europe/Podgorica', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
