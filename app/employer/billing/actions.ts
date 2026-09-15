'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applicationError, type MarketplaceResult } from '@/lib/applications';

export async function activateSosAction(_previous: MarketplaceResult, form: FormData): Promise<MarketplaceResult> {
  const input = z.object({ shift: z.uuid(), grant: z.uuid(), request: z.uuid(), minutes: z.coerce.number().int().min(1).max(10080), confirmed: z.literal(true) })
    .safeParse({ shift: form.get('shift'), grant: form.get('grant'), request: form.get('request'), minutes: form.get('minutes'), confirmed: form.get('confirmed') === 'on' });
  if (!input.success) return { error: 'Izaberi SOS kredit i potvrdi trajanje promocije.' };
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { error: 'Prijavi se ponovo.' };
  const result = await client.rpc('activate_shift_sos', { target_shift: input.data.shift, target_grant: input.data.grant,
    request_key: input.data.request, expected_minutes: input.data.minutes, confirmed: true });
  if (result.error) return { error: applicationError(result.error.message) };
  revalidatePath('/employer/billing');
  revalidatePath('/shifts', 'layout');
  revalidatePath('/employer/shifts', 'layout');
  return { message: 'SOS promocija je evidentirana. Provjeri njen trenutni status ispod. Naknada radniku nije promijenjena.' };
}
