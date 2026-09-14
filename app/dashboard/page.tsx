import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SmjenaApp } from '@/components/smjena/smjena-app';
import { getDashboardData } from '@/lib/smjena-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getAccountAccess } from '@/lib/account-data';
import { marketplaceHome, resolveDashboardContext } from '@/lib/account-context';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Moja SMJENA' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ mode?: string; workspace?: string }> }) {
  if (!isSupabaseConfigured()) redirect('/login');
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/login');
  const params = await searchParams;
  const access = await getAccountAccess(data.user.id);
  if (!params.mode && !params.workspace) redirect(marketplaceHome(access));
  const context = resolveDashboardContext(access, params.mode, params.workspace);
  if (!context) redirect('/settings');
  const dashboard = await getDashboardData(data.user, context);
  return <SmjenaApp key={`${context.role}-${dashboard.employerId ?? data.user.id}`} data={dashboard} />;
}
