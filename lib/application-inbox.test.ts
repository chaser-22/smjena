import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { inboxHref, loadWorkerInbox, parseInboxQuery } from './application-inbox.ts';

test('inbox filters and pages accept only bounded, single values', () => {
  assert.deepEqual(parseInboxQuery({ filter: 'offered', page: '9' }), { filter: 'offered', page: 9 });
  for (const page of ['0', '-1', '1.5', '1e3', '9999999', '01', ['2'], undefined]) {
    assert.equal(parseInboxQuery({ page }).page, 1);
  }
  for (const filter of ['__proto__', 'constructor', 'paid', ['offered'], undefined]) {
    assert.equal(parseInboxQuery({ filter }).filter, 'all');
  }
  assert.equal(inboxHref('all'), '/applications');
  assert.equal(inboxHref('offered', 9), '/applications?filter=offered&page=9');
});

function fixture(options: { fail?: 'page' | 'count'; rows?: number } = {}) {
  const requests: { url: URL; method: string }[] = [];
  const client = createClient('https://inbox-test.invalid', 'test-publishable-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      requests.push({ url, method });
      const isCount = method === 'HEAD';
      if (options.fail === (isCount ? 'count' : 'page')) return new Response(isCount ? null : JSON.stringify({ message: 'Unavailable' }), { status: 503 });
      return new Response(isCount ? null : JSON.stringify(Array.from({ length: options.rows ?? 26 }, (_, index) => ({ id: String(index) }))), {
        headers: { 'content-type': 'application/json', 'content-range': isCount ? '*/3' : '0-25/*' },
      });
    } },
  });
  return { client, requests };
}

test('offers are filtered before paging, ordered by deadline, and counted beyond the page', async () => {
  const { client, requests } = fixture();
  const result = await loadWorkerInbox(client, 'worker-test', { filter: 'offered', page: 9 });
  assert.equal(result.applications.length, 25);
  assert.equal(result.applications.at(-1)?.id, '24');
  assert.equal(result.hasNext, true);
  assert.equal(result.offerCount, 3);
  const page = requests.find((request) => request.method === 'GET')!.url;
  assert.equal(page.searchParams.get('effective_status'), 'eq.offered');
  assert.equal(page.searchParams.get('offset'), '200');
  assert.equal(page.searchParams.get('limit'), '26');
  assert.equal(page.searchParams.get('order'), 'offer_expires_at.asc,created_at.desc,id.desc');
  const count = requests.find((request) => request.method === 'HEAD')!.url;
  assert.equal(count.searchParams.has('offset'), false);
  for (const { url } of requests) {
    assert.equal(url.pathname, '/rest/v1/application_inbox');
    assert.equal(url.searchParams.get('worker_id'), 'eq.worker-test');
    assert.equal(url.searchParams.get('effective_status'), 'eq.offered');
    assert.doesNotMatch(url.search, /phone|address/);
  }
});

test('closed means terminal applications, never accepted, attended or paid', async () => {
  const { client, requests } = fixture({ rows: 25 });
  const result = await loadWorkerInbox(client, 'worker-test', { filter: 'closed', page: 1 });
  assert.equal(result.hasNext, false);
  assert.equal(requests[0].url.searchParams.get('effective_status'), 'in.(declined,withdrawn,expired,rejected,cancelled)');
});

test('all applications remain accessible and failed reads never look empty', async () => {
  const { client, requests } = fixture({ rows: 0 });
  const result = await loadWorkerInbox(client, 'worker-test', { filter: 'all', page: 1 });
  assert.equal(result.hasNext, false);
  assert.equal(requests[0].url.searchParams.has('effective_status'), false);
  for (const fail of ['page', 'count'] as const) {
    await assert.rejects(loadWorkerInbox(fixture({ fail }).client, 'worker-test', { filter: 'all', page: 1 }), /inbox unavailable/);
  }
});
