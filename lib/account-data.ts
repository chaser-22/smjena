import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { AccountAccess } from '@/lib/account-context';

export async function getAccountAccess(userId: string): Promise<AccountAccess> {
  const supabase = await createClient();
  const [profile, worker, memberships] = await Promise.all([
    supabase.from('profiles').select('full_name, city').eq('id', userId).single(),
    supabase.from('worker_profiles').select('user_id').eq('user_id', userId).maybeSingle(),
    supabase.from('employer_members').select('employer_id, member_role, employers!inner(id, name)').eq('user_id', userId).order('created_at'),
  ]);
  if (profile.error || worker.error || memberships.error || !profile.data) throw new Error('Nalog trenutno nije dostupan. Pokušaj ponovo.');
  return {
    name: profile.data.full_name,
    city: profile.data.city,
    worker: Boolean(worker.data),
    workspaces: (memberships.data ?? []).map((membership) => {
      const employer = membership.employers as unknown as { id: string; name: string };
      return { id: employer.id, name: employer.name, memberRole: membership.member_role };
    }),
  };
}
