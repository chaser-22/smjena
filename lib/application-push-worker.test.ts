import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePushWakeup, processPushBatch, type PushJob, type PushOutcome } from './application-push-worker.ts';

const job: PushJob = { job_id: 'job', token: 'lease', notification_id: 'notice', kind: 'offered', destination: '/applications',
  endpoint: 'https://fcm.googleapis.com/send/test', p256dh: 'key', auth_secret: 'secret', expires_at: new Date(100000).toISOString() };
test('expired and unsafe push jobs never reach the network', async () => {
  let sent = 0;
  const result = await processPushBatch([{ ...job, expires_at: new Date(0).toISOString() }, { ...job, endpoint: 'https://127.0.0.1/' }],
    async () => { sent++; }, async () => {}, () => 1000);
  assert.equal(sent, 0); assert.equal(result.skipped, 2);
});
test('push service acceptance is distinct from delivery and retains a stable notification tag', async () => {
  const result = await processPushBatch([job], async (_job, payload, ttl) => {
    assert.equal(JSON.parse(payload).tag, 'notice'); assert.equal(ttl, 99);
  }, async (_job, outcome) => assert.equal(outcome, 'accepted_by_service'), () => 1000);
  assert.equal(result.accepted_by_service, 1);
});
test('transport failures distinguish retryable, expired subscriptions and permanent errors', async () => {
  for (const [code, expected] of [[429, 'retry'], [500, 'retry'], [0, 'retry'], [410, 'skipped'], [404, 'skipped'], [403, 'failed']] as const) {
    let actual: PushOutcome | undefined;
    await processPushBatch([job], async () => { throw { statusCode: code }; }, async (_job, outcome) => { actual = outcome; }, () => 1000);
    assert.equal(actual, expected);
  }
});
test('acknowledgement failures are surfaced without aborting unrelated jobs', async () => {
  const result = await processPushBatch([job, job], async () => {}, async () => { throw new Error('database'); }, () => 1000);
  assert.equal(result.accepted_by_service, 2); assert.equal(result.acknowledgement_errors, 2);
});
test('missing, invalid and replayed wake-up tokens cannot run the worker', async () => {
  let runs = 0;
  for (const token of ['', 'undefined', 'x'.repeat(64), 'a'.repeat(64)]) {
    const response = await handlePushWakeup(new Request('https://example.test', { headers: { 'x-smjena-wakeup': token } }),
      async () => false, async () => { runs++; throw new Error(); });
    assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(runs, 0);
});
test('authorized wake-ups return counts; failures never expose secrets or fake success', async () => {
  const request = new Request('https://example.test', { headers: { 'x-smjena-wakeup': 'a'.repeat(64) } });
  const empty = await processPushBatch([], async () => {}, async () => {});
  assert.equal((await handlePushWakeup(request, async () => true, async () => empty)).status, 200);
  assert.equal((await handlePushWakeup(request, async () => true, async () => ({ ...empty, acknowledgement_errors: 1 }))).status, 503);
  const failure = await handlePushWakeup(request, async () => { throw new Error('secret'); }, async () => empty);
  assert.equal(failure.status, 503); assert.equal((await failure.text()).includes('secret'), false);
});
