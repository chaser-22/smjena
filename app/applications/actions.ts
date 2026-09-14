'use server';

import { z } from 'zod';
import { after } from 'next/server';
import { deliverApplicationNotifications } from '@/lib/application-notifications';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applicationError, decisions, montenegroInstant, PublishApplicationSchema, statusLabels, type ApplicationStatus, type MarketplaceResult } from '@/lib/applications';

export async function applicationAction(_previous: MarketplaceResult, form: FormData): Promise<MarketplaceResult> {
  const input = z.object({ id: z.uuid(), decision: z.enum(['apply', 'cancel-post', ...decisions]), confirmed: z.boolean() })
    .safeParse({ id: form.get('id'), decision: form.get('decision'), confirmed: form.get('confirmed') === 'on' });
  if (!input.success) return { error: 'Podaci nijesu ispravni. Osvježi stranicu.' };
  const { id, decision, confirmed } = input.data;
  if (['accept', 'withdraw', 'revoke', 'cancel-post'].includes(decision) && !confirmed) return { error: 'Pročitaj uslove i potvrdi izbor.' };
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return { error: 'Prijava je istekla. Prijavi se ponovo.' };
  const result = decision === 'apply' ? await client.rpc('apply_to_shift', { target_shift: id })
    : decision === 'cancel-post' ? await client.rpc('cancel_application_post', { target_shift: id })
      : await client.rpc('transition_application', { target_application: id, decision });
  if (result.error) return { error: applicationError(result.error.message) };
  after(deliverApplicationNotifications);
  revalidatePath('/applications');
  revalidatePath('/employer/shifts', 'layout');
  revalidatePath('/shifts', 'layout');
  if (decision === 'apply') return { message: 'Prijava je evidentirana. Pogledaj njen trenutni status.', href: '/applications' };
  if (decision === 'cancel-post') return { message: 'Oglas je otkazan. Obavijesti osobe sa kojima si već dogovorio/la angažovanje.' };
  const state = result.data as ApplicationStatus;
  return { message: statusLabels[state] ?? 'Osvježi stranicu za trenutni status.' };
}

export async function publishApplicationAction(_previous: MarketplaceResult, form: FormData): Promise<MarketplaceResult> {
  const parsed = PublishApplicationSchema.safeParse({
    workspace: form.get('workspace'), requestId: form.get('requestId'), publicName: form.get('publicName'), role: form.get('role'),
    area: form.get('area'), address: form.get('address'), start: form.get('start'), end: form.get('end'),
    compensation: form.get('compensation'), places: form.get('places'), requirements: form.getAll('requirements'), confirmed: form.get('confirmed') === 'on',
  });
  if (!parsed.success) return { error: 'Popuni obavezna polja i potvrdi javne podatke i odgovornost firme.' };
  const input = parsed.data;
  const starts = montenegroInstant(input.start), ends = montenegroInstant(input.end);
  if (!starts || !ends || starts >= ends) return { error: 'Provjeri datum i vrijeme u Crnoj Gori. Vrijeme prelaska na ljetnje/zimsko računanje mora biti nedvosmisleno.' };
  const client = await createClient();
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) return { error: 'Prijava je istekla. Prijavi se ponovo.' };
  const result = await client.rpc('publish_application_shift', {
    target_employer: input.workspace, request_key: input.requestId, public_name: input.publicName,
    job_role: input.role, location_area: input.area, exact_address: input.address, starts_at: starts, ends_at: ends,
    pay_cents: Math.round(input.compensation * 100), places: input.places, requirements: input.requirements, public_copy_confirmed: input.confirmed,
  });
  if (result.error) return { error: applicationError(result.error.message) };
  revalidatePath('/shifts');
  revalidatePath('/employer/shifts');
  return { message: 'Oglas je sačuvan. Otvori prijave da vidiš trenutni status.', href: `/employer/shifts/${result.data}/applications` };
}
