'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { recordProductEvent } from '@/lib/product-events';
import { normalizeMontenegroPhone, type NewShiftInput } from '@/lib/smjena';
import { notifyAvailableWorkers, notifyShiftCancellation } from '@/lib/notifications';

export type ActionResult = { ok: true; amount?: number; count?: number } | { ok: false; error: string };

const ShiftSchema = z.object({
  requestId: z.uuid(),
  role: z.string().trim().min(2).max(80),
  workersNeeded: z.number().int().min(1).max(50),
  date: z.iso.date(),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  pay: z.number().min(20).max(5000),
  area: z.string().trim().min(2).max(200),
  requirements: z.array(z.string().trim().min(2).max(80)).max(8),
  urgent: z.boolean(),
  crewFirst: z.boolean(),
});

export async function updateContactAction(phone: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(6).max(40).safeParse(phone);
  const normalized = parsed.success ? normalizeMontenegroPhone(parsed.data) : null;
  if (!normalized) return failure('Unesi važeći broj iz Crne Gore, na primjer 067 123 456.');

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError || !data.user) return failure('Prijava je istekla. Prijavi se ponovo.');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile) return failure('Profil nije pronađen.');

  if (profile.role === 'worker') {
    const { error } = await saveContact(supabase, 'worker_contacts', 'user_id', data.user.id, normalized);
    if (error) return databaseFailure(error.message);
  } else if (profile.role === 'employer') {
    const { data: membership, error: membershipError } = await supabase
      .from('employer_members')
      .select('employer_id')
      .eq('user_id', data.user.id)
      .limit(1)
      .single();
    if (membershipError || !membership) return failure('Nalog nije povezan sa poslodavcem.');
    const { error } = await saveContact(supabase, 'employer_contacts', 'employer_id', membership.employer_id, normalized);
    if (error) return databaseFailure(error.message);
  } else {
    return failure('Nemaš dozvolu za ovu akciju.');
  }
  revalidatePath('/dashboard');
  return { ok: true };
}

async function saveContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: 'worker_contacts' | 'employer_contacts',
  key: 'user_id' | 'employer_id',
  ownerId: string,
  phone: string,
) {
  const values = { phone, updated_at: new Date().toISOString() };
  // A merge-upsert also UPDATEs its primary key, which is deliberately not
  // writable. Insert first, then update only mutable columns on a conflict.
  const inserted = await supabase.from(table).insert({ [key]: ownerId, ...values });
  if (inserted.error?.code !== '23505') return inserted;
  return supabase.from(table).update(values).eq(key, ownerId).select('phone').single();
}

export async function claimShiftAction(shiftId: string, source: 'dashboard' | 'push' = 'dashboard'): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc('claim_shift', { target_shift_id: shiftId });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'shift_claimed', subjectId: shiftId, source });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function checkInAction(shiftId: string): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  const assignment = await findActiveAssignment(context.supabase, context.userId, shiftId);
  if (!assignment) return failure('Aktivna smjena nije pronađena.');
  const { error } = await context.supabase.rpc('check_in_assignment', { target_assignment_id: assignment.id });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'shift_checked_in', subjectId: shiftId });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function checkOutAction(shiftId: string): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  const assignment = await findActiveAssignment(context.supabase, context.userId, shiftId);
  if (!assignment) return failure('Aktivna smjena nije pronađena.');
  const { data, error } = await context.supabase.rpc('check_out_assignment', { target_assignment_id: assignment.id });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'shift_checked_out', subjectId: shiftId });
  revalidatePath('/dashboard');
  return { ok: true, amount: Number(data) / 100 };
}

export async function cancelAssignmentAction(shiftId: string): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  const assignment = await findActiveAssignment(context.supabase, context.userId, shiftId);
  if (!assignment) return failure('Aktivna smjena nije pronađena.');
  const { error } = await context.supabase.rpc('cancel_assignment', {
    target_assignment_id: assignment.id,
    reason: 'Radnik je otkazao u aplikaciji',
  });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'shift_cancelled', subjectId: shiftId });
  await notifyShift(context.supabase, shiftId);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function setAvailabilityAction(available: boolean): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  const { error } = await context.supabase.from('worker_profiles').update({ available, updated_at: new Date().toISOString() }).eq('user_id', context.userId);
  if (error) return databaseFailure(error.message);
  if (available) await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'availability_enabled' });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function setNotificationsAction(enabled: boolean, subscription?: PushSubscriptionJSON): Promise<ActionResult> {
  const context = await requireRole('worker');
  if (!context.ok) return context;
  if (enabled) {
    const parsed = z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) }).safeParse(subscription);
    if (!parsed.success) return failure('Pretplata za obavijesti nije ispravna.');
    const { error: subscriptionError } = await context.supabase.from('push_subscriptions').upsert({
      user_id: context.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth_secret: parsed.data.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,endpoint' });
    if (subscriptionError) return databaseFailure(subscriptionError.message);
  } else {
    const { error: deleteError } = await context.supabase.from('push_subscriptions').delete().eq('user_id', context.userId);
    if (deleteError) return databaseFailure(deleteError.message);
  }
  const { error } = await context.supabase.from('worker_profiles').update({ notifications_enabled: enabled, updated_at: new Date().toISOString() }).eq('user_id', context.userId);
  if (error) return databaseFailure(error.message);
  if (enabled) await recordProductEvent({ userId: context.userId, actorRole: 'worker', eventName: 'notifications_enabled' });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function postShiftAction(input: NewShiftInput): Promise<ActionResult> {
  const parsed = ShiftSchema.safeParse(input);
  if (!parsed.success) return failure('Podaci smjene nijesu ispravni.');
  const context = await requireRole('employer');
  if (!context.ok) return context;

  const { data: membership, error: membershipError } = await context.supabase
    .from('employer_members')
    .select('employer_id')
    .eq('user_id', context.userId)
    .limit(1)
    .single();
  if (membershipError || !membership) return failure('Nalog nije povezan sa poslodavcem.');

  const { data: existingShift } = await context.supabase
    .from('shifts')
    .select('id')
    .eq('employer_id', membership.employer_id)
    .eq('request_id', parsed.data.requestId)
    .maybeSingle();
  if (existingShift) return { ok: true };

  const startsAt = montenegroDate(parsed.data.date, parsed.data.start);
  let endsAt = montenegroDate(parsed.data.date, parsed.data.end);
  if (endsAt <= startsAt) {
    const nextDate = new Date(`${parsed.data.date}T12:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    endsAt = montenegroDate(nextDate.toISOString().slice(0, 10), parsed.data.end);
  }

  if (startsAt <= new Date()) return failure('Početak smjene mora biti u budućnosti.');

  const payCents = Math.round(parsed.data.pay * 100);
  const bonusCents = parsed.data.urgent ? Math.min(1500, payCents - 2000) : 0;
  const { data: createdShiftId, error } = await context.supabase.rpc('publish_shift', {
    target_employer_id: membership.employer_id,
    publish_request_id: parsed.data.requestId,
    shift_role: parsed.data.role,
    shift_area: parsed.data.area,
    shift_starts_at: startsAt.toISOString(),
    shift_ends_at: endsAt.toISOString(),
    shift_pay_cents: payCents,
    shift_bonus_cents: bonusCents,
    shift_workers_needed: parsed.data.workersNeeded,
    shift_requirements: parsed.data.requirements,
    shift_urgent: parsed.data.urgent,
    shift_audience: parsed.data.crewFirst ? 'crew' : 'public',
  });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'employer', employerId: String(membership.employer_id), eventName: 'shift_published', subjectId: String(createdShiftId) });
  const { data: createdShift } = await context.supabase
    .from('shifts')
    .select('id, employer_id, role, area, city, pay_cents, starts_at, audience')
    .eq('id', createdShiftId)
    .single();
  if (createdShift) {
    await notifyAvailableWorkers({
      id: createdShift.id,
      employerId: createdShift.employer_id,
      role: createdShift.role,
      area: createdShift.area,
      city: createdShift.city,
      payCents: createdShift.pay_cents,
      startsAt: createdShift.starts_at,
      audience: createdShift.audience,
    });
  }
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function cancelShiftAction(shiftId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(shiftId);
  if (!parsed.success) return failure('Smjena nije ispravna.');
  const context = await requireRole('employer');
  if (!context.ok) return context;

  const { data: shift } = await context.supabase
    .from('shifts')
    .select('id, role, starts_at')
    .eq('id', parsed.data)
    .single();
  if (!shift) return failure('Smjena nije pronađena.');

  const { data: affectedWorkers, error } = await context.supabase.rpc('cancel_shift', { target_shift_id: parsed.data });
  if (error) return databaseFailure(error.message);
  const { data: assignments } = await context.supabase
    .from('shift_assignments')
    .select('worker_id')
    .eq('shift_id', parsed.data)
    .eq('status', 'cancelled')
    .eq('cancellation_reason', 'Poslodavac je otkazao smjenu');

  await recordProductEvent({
    userId: context.userId,
    actorRole: 'employer',
    eventName: 'shift_cancelled_by_employer',
    subjectId: parsed.data,
  });
  await notifyShiftCancellation({
    shiftId: parsed.data,
    role: shift.role,
    startsAt: shift.starts_at,
    workerIds: (assignments ?? []).map((assignment) => assignment.worker_id),
  });
  revalidatePath('/dashboard');
  return { ok: true, count: Number(affectedWorkers ?? 0) };
}

export async function markNoShowAction(assignmentId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(assignmentId);
  if (!parsed.success) return failure('Angažman nije ispravan.');
  const context = await requireRole('employer');
  if (!context.ok) return context;
  const { data: shiftId, error } = await context.supabase.rpc('mark_assignment_no_show', {
    target_assignment_id: parsed.data,
  });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({
    userId: context.userId,
    actorRole: 'employer',
    eventName: 'worker_marked_no_show',
    subjectId: parsed.data,
  });
  if (shiftId) await notifyShift(context.supabase, String(shiftId));
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function authorizePaymentAction(assignmentId: string): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(assignmentId);
  if (!parsed.success) return failure('Angažman nije ispravan.');
  const context = await requireRole('employer');
  if (!context.ok) return context;
  const { data: existingLedger } = await context.supabase
    .from('payment_ledger')
    .select('status')
    .eq('assignment_id', parsed.data)
    .maybeSingle();
  const { data, error } = await context.supabase.rpc('authorize_assignment_payment', {
    target_assignment_id: parsed.data,
  });
  if (error) return databaseFailure(error.message);
  if (existingLedger?.status === 'pending') {
    await recordProductEvent({
      userId: context.userId,
      actorRole: 'employer',
      eventName: 'payment_authorized',
      subjectId: parsed.data,
    });
  }
  revalidatePath('/dashboard');
  return { ok: true, amount: Number(data) / 100 };
}

export async function raiseShiftPayAction(shiftId: string): Promise<ActionResult> {
  const context = await requireRole('employer');
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc('raise_shift_pay', { target_shift_id: shiftId, increment_cents: 1000 });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'employer', eventName: 'shift_pay_raised', subjectId: shiftId });
  await notifyShift(context.supabase, shiftId);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function broadcastShiftAction(shiftId: string): Promise<ActionResult> {
  const context = await requireRole('employer');
  if (!context.ok) return context;
  const { error } = await context.supabase.rpc('broadcast_shift', { target_shift_id: shiftId });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'employer', eventName: 'shift_broadcast', subjectId: shiftId });
  await notifyShift(context.supabase, shiftId);
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function rateAssignmentAction(assignmentId: string, score: number, wantAgain: boolean): Promise<ActionResult> {
  const parsed = z.object({ assignmentId: z.uuid(), score: z.number().int().min(1).max(5), wantAgain: z.boolean() }).safeParse({ assignmentId, score, wantAgain });
  if (!parsed.success) return failure('Ocjena nije ispravna.');
  const context = await requireRole('employer');
  if (!context.ok) return context;
  const { data: assignment, error: assignmentError } = await context.supabase.from('shift_assignments').select('id, worker_id, shift_id, shifts!inner(employer_id)').eq('id', assignmentId).single();
  if (assignmentError || !assignment) return failure('Angažman nije pronađen.');
  const employerId = String((assignment.shifts as unknown as { employer_id: string }).employer_id);
  const { error } = await context.supabase.from('ratings').upsert({
    assignment_id: assignment.id,
    employer_id: employerId,
    worker_id: assignment.worker_id,
    created_by: context.userId,
    score: parsed.data.score,
    want_again: parsed.data.wantAgain,
  }, { onConflict: 'assignment_id' });
  if (error) return databaseFailure(error.message);
  await recordProductEvent({ userId: context.userId, actorRole: 'employer', employerId, eventName: 'worker_rated', subjectId: assignment.id });
  revalidatePath('/dashboard');
  return { ok: true };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

async function requireRole(expectedRole: 'worker' | 'employer') {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return failure('Prijava je istekla. Prijavi se ponovo.');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
  if (!profile || profile.role !== expectedRole) return failure('Nemaš dozvolu za ovu akciju.');
  return { ok: true as const, supabase, userId: data.user.id };
}

async function findActiveAssignment(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, shiftId: string) {
  const { data } = await supabase.from('shift_assignments').select('id').eq('worker_id', userId).eq('shift_id', shiftId).in('status', ['claimed', 'checked_in']).limit(1).maybeSingle();
  return data;
}

async function notifyShift(supabase: Awaited<ReturnType<typeof createClient>>, shiftId: string) {
  const { data: shift } = await supabase.from('shifts').select('id, employer_id, role, area, city, pay_cents, starts_at, audience, status').eq('id', shiftId).single();
  if (!shift || shift.status !== 'published') return;
  await notifyAvailableWorkers({ id: shift.id, employerId: shift.employer_id, role: shift.role, area: shift.area, city: shift.city, payCents: shift.pay_cents, startsAt: shift.starts_at, audience: shift.audience });
}

function failure(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

function databaseFailure(message: string): { ok: false; error: string } {
  const friendly: Record<string, string> = {
    'Shift is already full': 'Neko je upravo uzeo posljednje mjesto.',
    'Worker has an overlapping shift': 'Već imaš prihvaćenu smjenu u tom terminu.',
    'Worker is not available': 'Prvo uključi dostupnost na vrhu ekrana.',
    'Check-in is outside the allowed time window': 'Dolazak možeš potvrditi najranije 60 minuta prije početka smjene.',
    'Check-out is not available yet': 'Završetak možeš evidentirati najranije 30 minuta prije planiranog kraja.',
    'Shift is not available': 'Ova smjena više nije dostupna.',
    'No open replacement position': 'Sva mjesta su trenutno pokrivena.',
    'Shift cannot be cancelled': 'Smjenu možeš otkazati samo prije početka.',
    'Shift publishing rate limit reached': 'Objavljeno je previše smjena u kratkom periodu. Sačekaj prije nove objave.',
    'Payment cannot be authorized': 'Ovu obavezu nije moguće potvrditi u trenutnom statusu.',
    'Assignment cannot be marked no show': 'Nedolazak nije moguće evidentirati za ovaj angažman.',
    'No show is not available yet': 'Nedolazak možeš evidentirati tek kada smjena počne.',
    'Worker already responded to shift': 'Već si odgovorio na ovu smjenu.',
    'No cancelled assignment': 'Zamjena je dostupna tek kada se prethodno mjesto oslobodi.',
    'Assignment cannot be cancelled': 'Ovaj angažman više nije moguće otkazati. Ako ne možeš doći, odmah kontaktiraj poslodavca.',
    'Contact phone is required': 'Dodaj kontakt telefon prije ove akcije.',
    'Employer contact phone is required': 'Poslodavac nije dodao kontakt. Ovu smjenu trenutno nije moguće potvrditi.',
  };
  return { ok: false, error: friendly[message] ?? 'Nijesmo mogli potvrditi akciju. Pokušaj ponovo; ako se problem ponavlja, javi podršci.' };
}

function montenegroDate(date: string, time: string) {
  const provisional = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Podgorica', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(provisional);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return new Date(provisional.getTime() - (representedAsUtc - provisional.getTime()));
}
