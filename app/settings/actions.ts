'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { montenegroCities } from '@/lib/montenegro';

export type SettingsResult = { success?: boolean; error?: string; workspaceId?: string };

export async function enableWorkerAction(): Promise<SettingsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: 'Prijava je istekla. Prijavi se ponovo.' };
  const result = await supabase.rpc('enable_worker_profile');
  if (result.error) return { error: 'Profil nije dodat. Pokušaj ponovo kasnije.' };
  revalidatePath('/settings');
  return { success: true };
}

export async function createWorkspaceAction(_state: SettingsResult, form: FormData): Promise<SettingsResult> {
  const parsed = z.object({ requestId: z.uuid(), name: z.string().trim().min(2).max(120), city: z.enum(montenegroCities) })
    .safeParse({ requestId: form.get('requestId'), name: form.get('name'), city: form.get('city') });
  if (!parsed.success) return { error: 'Unesi naziv firme (2–120 znakova) i izaberi grad.' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: 'Prijava je istekla. Prijavi se ponovo.' };
  const result = await supabase.rpc('create_employer_workspace', {
    request_id: parsed.data.requestId, workspace_name: parsed.data.name, workspace_city: parsed.data.city,
  });
  if (result.error || !result.data) return { error: result.error?.message.includes('rate limit')
    ? 'Dostignut je dnevni limit novih firmi. Pokušaj sjutra.' : 'Firma nije dodata. Provjeri vezu i pokušaj ponovo.' };
  revalidatePath('/settings');
  return { success: true, workspaceId: String(result.data) };
}
