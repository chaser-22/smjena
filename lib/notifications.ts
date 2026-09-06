import 'server-only';

import webPush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

type ShiftNotification = {
  id: string;
  employerId: string;
  role: string;
  area: string;
  city: string;
  payCents: number;
  startsAt: string;
  audience: 'crew' | 'public';
};

export async function notifyAvailableWorkers(shift: ShiftNotification) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  let workerIds: string[] = [];

  if (shift.audience === 'crew') {
    const { data } = await admin.from('trusted_workers').select('worker_id').eq('employer_id', shift.employerId);
    workerIds = (data ?? []).map((row) => row.worker_id);
    if (workerIds.length) {
      const { data: available } = await admin
        .from('worker_profiles')
        .select('user_id')
        .in('user_id', workerIds)
        .eq('available', true)
        .eq('notifications_enabled', true);
      workerIds = (available ?? []).map((row) => row.user_id);
    }
  } else {
    const { data: profiles } = await admin.from('profiles').select('id').eq('role', 'worker').eq('city', shift.city);
    const cityWorkerIds = (profiles ?? []).map((row) => row.id);
    if (cityWorkerIds.length) {
      const { data: available } = await admin.from('worker_profiles').select('user_id').in('user_id', cityWorkerIds).eq('available', true).eq('notifications_enabled', true);
      workerIds = (available ?? []).map((row) => row.user_id);
    }
  }

  if (!workerIds.length) return 0;
  const { data: previousAssignments } = await admin
    .from('shift_assignments')
    .select('worker_id')
    .eq('shift_id', shift.id)
    .in('worker_id', workerIds);
  const previousWorkerIds = new Set((previousAssignments ?? []).map((row) => row.worker_id));
  workerIds = workerIds.filter((workerId) => !previousWorkerIds.has(workerId));
  if (!workerIds.length) return 0;
  const { data: subscriptions } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth_secret').in('user_id', workerIds);
  if (!subscriptions?.length) return 0;

  const start = new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'Europe/Podgorica', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(shift.startsAt));
  const payload = JSON.stringify({
    title: shift.audience === 'crew' ? 'Nova smjena za tvoju ekipu' : 'Nova SMJENA blizu tebe',
    body: `${shift.role} · ${shift.area} · €${shift.payCents / 100} · ${start}`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    url: `/dashboard?shift=${shift.id}&source=push`,
  });

  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      }, payload, { TTL: 900, urgency: shift.audience === 'crew' ? 'normal' : 'high' });
      return true;
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      }
      return false;
    }
  }));
  const delivered = results.filter(Boolean).length;
  if (delivered > 0) await admin.from('shifts').update({ notified_count: delivered }).eq('id', shift.id);
  return delivered;
}

export async function notifyShiftCancellation(input: {
  shiftId: string;
  role: string;
  startsAt: string;
  workerIds: string[];
}) {
  const workerIds = [...new Set(input.workerIds)];
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!workerIds.length || !publicKey || !privateKey || !subject || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;

  webPush.setVapidDetails(subject, publicKey, privateKey);
  const admin = createAdminClient();
  const { data: enabledWorkers } = await admin
    .from('worker_profiles')
    .select('user_id')
    .in('user_id', workerIds)
    .eq('notifications_enabled', true);
  const enabledIds = (enabledWorkers ?? []).map((row) => row.user_id);
  if (!enabledIds.length) return 0;

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_secret')
    .in('user_id', enabledIds);
  if (!subscriptions?.length) return 0;

  const start = new Intl.DateTimeFormat('sr-Latn-ME', {
    timeZone: 'Europe/Podgorica',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(input.startsAt));
  const payload = JSON.stringify({
    title: 'Poslodavac je otkazao smjenu',
    body: `${input.role} · ${start}. Otvori SMJENU za detalje.`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    url: `/dashboard?shift=${input.shiftId}&source=push`,
  });

  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      }, payload, { TTL: 24 * 60 * 60, urgency: 'high' });
      return true;
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      }
      return false;
    }
  }));

  return results.filter(Boolean).length;
}
