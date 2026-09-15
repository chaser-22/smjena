import 'server-only';
import webPush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPushBatch, type PushJob } from '@/lib/application-push-worker';

export async function deliverApplicationNotifications() {
  try {
    const result = await runApplicationNotificationBatch();
    if (result.acknowledgement_errors) console.error('Application push acknowledgement failed');
  }
  catch { console.error('Application push worker unavailable'); }
}

export async function runApplicationNotificationBatch() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Push configuration missing');
  const admin = createAdminClient();
  webPush.setVapidDetails(subject, publicKey, privateKey);
  const { data, error } = await admin.rpc('lease_application_push');
  if (error) throw new Error('Push lease failed');
  // Twenty bounded requests, with short timeouts; leases recover after crashes.
  return processPushBatch((data ?? []) as PushJob[], (job, payload, ttl) =>
    webPush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_secret } },
      payload, { TTL: ttl, urgency: 'high', timeout: 8000 }), async (job, outcome) => {
    const result = await admin.rpc('finish_application_push', { target_job: job.job_id, token: job.token, outcome });
    if (result.error) throw new Error('Push acknowledgement failed');
  });
}
