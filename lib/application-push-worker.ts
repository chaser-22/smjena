import { applicationNotificationText, isTrustedPushEndpoint } from './push-safety.ts';

export type PushJob = { job_id: string; token: string; notification_id: string; kind: string; destination: string;
  endpoint: string; p256dh: string; auth_secret: string; expires_at: string };
export type PushOutcome = 'skipped' | 'accepted_by_service' | 'failed' | 'retry';
export type PushBatchResult = { leased: number; accepted_by_service: number; skipped: number; failed: number; retry: number; acknowledgement_errors: number };
export type PushTransport = (job: PushJob, payload: string, ttl: number) => Promise<unknown>;

// The database owns leasing, eligibility and retry deadlines. Transport success
// means the push service accepted the request, never that a person saw it.
export async function processPushBatch(jobs: PushJob[], send: PushTransport,
  finish: (job: PushJob, outcome: PushOutcome) => Promise<void>, now = Date.now): Promise<PushBatchResult> {
  const result: PushBatchResult = { leased: jobs.length, accepted_by_service: 0, skipped: 0, failed: 0, retry: 0, acknowledgement_errors: 0 };
  await Promise.all(jobs.map(async (job) => {
    let outcome: PushOutcome = 'skipped';
    const ttl = Math.min(900, Math.floor((Date.parse(job.expires_at) - now()) / 1000));
    if (ttl > 0 && isTrustedPushEndpoint(job.endpoint)) {
      try {
        await send(job, JSON.stringify({ title: 'SMJENA · Novi status', body: applicationNotificationText[job.kind] ?? 'Otvori SMJENU za detalje.',
          url: job.destination, tag: job.notification_id }), ttl);
        outcome = 'accepted_by_service';
      } catch (error) {
        const code = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 0;
        outcome = code === 404 || code === 410 ? 'skipped' : code >= 400 && code < 500 && code !== 429 ? 'failed' : 'retry';
      }
    }
    result[outcome]++;
    try { await finish(job, outcome); } catch { result.acknowledgement_errors++; }
  }));
  return result;
}

export async function handlePushWakeup(request: Request, consume: (token: string) => Promise<boolean>,
  deliver: () => Promise<PushBatchResult>): Promise<Response> {
  const headers = { 'Cache-Control': 'no-store' };
  const token = request.headers.get('x-smjena-wakeup') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
  try {
    if (!await consume(token)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers });
    const result = await deliver();
    return Response.json(result, { status: result.acknowledgement_errors ? 503 : 200, headers });
  } catch {
    // Never return tokens, subscription endpoints, payloads or database errors.
    return Response.json({ error: 'Notification worker unavailable' }, { status: 503, headers });
  }
}
