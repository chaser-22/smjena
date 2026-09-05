import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SmjenaApp } from '@/components/smjena/smjena-app';
import { getDashboardData } from '@/lib/smjena-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moja SMJENA' };

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect('/login');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  const dashboard = await getDashboardData(data.user);
  return <SmjenaApp data={dashboard} />;
}
