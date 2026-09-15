'use server';

import { z } from 'zod';
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applicationError, type MarketplaceResult } from '@/lib/applications';
import { deliverApplicationNotifications } from '@/lib/application-notifications';

export async function preferredAction(_previous: MarketplaceResult, form: FormData): Promise<MarketplaceResult> {
  const parsed = z.object({ action: z.enum(['invite', 'dismiss', 'save', 'remove', 'allow', 'mute']), id: z.uuid(), worker: z.uuid().optional() })
    .safeParse({ action: form.get('action'), id: form.get('id'), worker: form.get('worker') ?? undefined });
  if (!parsed.success) return { error: 'Izbor nije ispravan. Osvježi stranicu.' };
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { error: 'Prijavi se ponovo.' };
  const { action, id, worker } = parsed.data;
  if (['invite', 'save', 'remove'].includes(action) && !worker) return { error: 'Izaberi radnika.' };
  if (action === 'allow' || action === 'mute') {
    if (id !== data.user.id) return { error: 'Nemaš pristup ovom podešavanju.' };
    const enabled = action === 'allow';
    const inserted = await client.from('invitation_preferences').upsert({ user_id: data.user.id, allow_invitations: enabled }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (inserted.error) return { error: 'Podešavanje nije sačuvano. Pokušaj ponovo.' };
    const updated = await client.from('invitation_preferences').update({ allow_invitations: enabled }).eq('user_id', data.user.id);
    if (updated.error) return { error: 'Podešavanje nije sačuvano. Pokušaj ponovo.' };
    revalidatePath('/applications');
    return { message: enabled ? 'Pozivi firmi su uključeni.' : 'Novi pozivi firmi su isključeni. Postojeće prijave i ponude ostaju nepromijenjene.' };
  }
  const result = action === 'invite'
    ? await client.rpc('invite_preferred_worker', { target_shift: id, target_worker: worker })
    : action === 'dismiss'
      ? await client.rpc('dismiss_application_invitation', { target_invitation: id })
      : await client.rpc('set_preferred_worker', { target_employer: id, target_worker: worker, preferred: action === 'save' });
  if (result.error) return { error: applicationError(result.error.message) };
  if (action === 'invite') after(deliverApplicationNotifications);
  revalidatePath('/applications');
  revalidatePath('/employer/shifts', 'layout');
  revalidatePath('/notifications');
  return { message: action === 'invite' ? 'Poziv je sačuvan u radnikovom nalogu. To nije prijava ni rezervacija mjesta; push dostava nije garantovana.'
    : action === 'dismiss' ? 'Poziv je sklonjen. Nijedna prijava nije povučena.'
      : action === 'save' ? 'Radnik je dodat među omiljene za ovu firmu. To nije ocjena ni potvrda obavljenog rada.' : 'Radnik je uklonjen iz omiljenih ove firme.' };
}
