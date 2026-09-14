import 'server-only';
import webPush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import { applicationNotificationText, isTrustedPushEndpoint } from '@/lib/push-safety';

type Job = { job_id: string; token: string; notification_id: string; kind: string; destination: string;
  endpoint: string; p256dh: string; auth_secret: string; expires_at: string };

export async function deliverApplicationNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const admin = createAdminClient();
  webPush.setVapidDetails(subject, publicKey, privateKey);
  const { data, error } = await admin.rpc('lease_application_push');
  if (error) { console.error('Application push lease failed', error.code); return; }
  // Twenty bounded requests, with short timeouts; leases recover after crashes.
  await Promise.all((data as Job[]).map(async (job) => {
    let outcome = 'skipped';
    const ttl = Math.min(900, Math.floor((Date.parse(job.expires_at) - Date.now()) / 1000));
    if (ttl > 0 && isTrustedPushEndpoint(job.endpoint)) {
      try {
        await webPush.sendNotification({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth_secret } },
          JSON.stringify({ title: 'SMJENA · Novi status', body: applicationNotificationText[job.kind] ?? 'Otvori SMJENU za detalje.',
            url: job.destination, tag: job.notification_id }), { TTL: ttl, urgency: 'high', timeout: 8000 });
        outcome = 'accepted_by_service'; // Not evidence of display, reading or attendance.
      } catch (error) {
        const code = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
        outcome = code === 404 || code === 410 ? 'skipped' : code >= 400 && code < 500 && code !== 429 ? 'failed' : 'retry';
      }
    }
    const result = await admin.rpc('finish_application_push', { target_job: job.job_id, token: job.token, outcome });
    if (result.error) console.error('Application push acknowledgement failed', result.error.code);
  }));
}
