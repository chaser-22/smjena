import assert from 'node:assert/strict';
import test from 'node:test';
import { montenegroInstant, applicationError, statusLabels, applicationStatuses, PublishApplicationSchema } from './applications.ts';

test('Montenegro times are independent of the computer timezone and reject DST ambiguity', () => {
  assert.equal(montenegroInstant('2026-09-20T12:00'), '2026-09-20T10:00:00.000Z');
  assert.equal(montenegroInstant('2026-12-20T12:00'), '2026-12-20T11:00:00.000Z');
  assert.equal(montenegroInstant('2026-03-29T02:30'), null);
  assert.equal(montenegroInstant('2026-10-25T02:30'), null);
  assert.equal(montenegroInstant('2026-02-30T12:00'), null);
  assert.equal(montenegroInstant('invalid'), null);
});
test('every application state is labelled without implying attendance or payment', () => {
  for (const status of applicationStatuses) assert.ok(statusLabels[status]);
  assert.equal(statusLabels.accepted, 'Ponuda prihvaćena');
  assert.match(applicationError('No offer capacity'), /Sačekaj/);
  assert.match(applicationError('Overlapping commitment'), /terminu/);
  assert.equal(applicationError('postgres details secret'), 'Akcija nije potvrđena. Provjeri vezu i pokušaj ponovo.');
});
test('publication requires explicit disclosure confirmation and structured requirements', () => {
  const input = { workspace: '10000000-0000-4000-8000-000000000001', requestId: '10000000-0000-4000-8000-000000000002', publicName: 'Hotel', role: 'Konobar', area: 'Centar', address: 'Private 42', start: '2026-10-20T12:00', end: '2026-10-20T20:00', compensation: '80', places: '1', requirements: [], confirmed: true };
  assert.equal(PublishApplicationSchema.safeParse(input).success, true);
  assert.equal(PublishApplicationSchema.safeParse({ ...input, confirmed: false }).success, false);
  assert.equal(PublishApplicationSchema.safeParse({ ...input, requirements: ['Call +38267123456'] }).success, false);
  assert.equal(PublishApplicationSchema.safeParse({ ...input, places: '1.5' }).success, false);
});
