import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { snapshotMarketplace, verifyModelBoundary } from './verify-model-boundary.mjs';
import { verifyCapabilitiesAndProjection } from './verify-capabilities.mjs';
import { verifyApplications } from './verify-applications.mjs';
import { verifyBilling } from './verify-billing.mjs';
import { verifyNotifications } from './verify-notifications.mjs';
import { verifyInvitations } from './verify-invitations.mjs';
import { verifySos } from './verify-sos.mjs';

const root = new URL('../', import.meta.url);
const modelMigrationFile = 'supabase/migrations/20260914171829_isolate_marketplace_models.sql';
const capabilitiesMigrationFile = 'supabase/migrations/20260914171835_account_capabilities_and_public_listings.sql';
const populatedUpgrade = process.argv.includes('--populated-upgrade');
const preflightSql = await readFile(new URL('../supabase/checks/marketplace-model-preflight.sql', import.meta.url), 'utf8');
const migrationFiles = [
  'supabase/migrations/202609030001_initial_marketplace.sql',
  'supabase/migrations/202609050001_product_events.sql',
  'supabase/migrations/202609050002_shift_requirements.sql',
  'supabase/migrations/20260905174804_harden_marketplace_states.sql',
  'supabase/migrations/20260905182551_fix_no_show_terminal_state.sql',
  'supabase/migrations/20260906170318_add_foreign_key_indexes.sql',
  'supabase/migrations/20260906170718_block_expired_assignment_cancellation.sql',
  'supabase/migrations/20260907171142_add_assignment_contacts.sql',
  ...(!populatedUpgrade ? [modelMigrationFile, capabilitiesMigrationFile] : []),
];

const database = new PGlite();
await database.exec(`
  create schema auth;
  create role anon;
  create role authenticated;
  create role service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`);

for (const file of migrationFiles) {
  let sql = await readFile(new URL(file, root), 'utf8');
  sql = sql.replace('create extension if not exists pgcrypto;', '');
  const publicationBlock = sql.indexOf("do $$\nbegin\n  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'");
  if (publicationBlock >= 0) sql = sql.slice(0, publicationBlock);
  await database.exec(sql);
  console.log(`validated ${file}`);
}

const result = await database.query(`
  select column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'shifts'
    and column_name in ('request_id', 'replacement_requested_at')
  order by column_name
`);

assert.equal(result.rows.length, 2, 'Hardened shift columns were not created.');

const employerUserId = '10000000-0000-4000-8000-000000000001';
const workerOneId = '20000000-0000-4000-8000-000000000001';
const workerTwoId = '20000000-0000-4000-8000-000000000002';
const workerThreeId = '20000000-0000-4000-8000-000000000003';

await database.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${employerUserId}', 'operator@example.test', '{"role":"employer","full_name":"Test Operator","company_name":"Test Hotel","city":"Budva"}'),
    ('${workerOneId}', 'worker1@example.test', '{"role":"worker","full_name":"Test Worker One","city":"Budva"}'),
    ('${workerTwoId}', 'worker2@example.test', '{"role":"worker","full_name":"Test Worker Two","city":"Budva"}'),
    ('${workerThreeId}', 'worker3@example.test', '{"role":"worker","full_name":"Test Worker Three","city":"Budva"}');
`);

const actor = async (userId) => {
  await database.exec(`select set_config('request.jwt.claim.sub', '${userId}', false);`);
};
const firstValue = (queryResult, key) => queryResult.rows[0][key];
const publishShift = async ({ requestId, starts = 'now() + interval \'2 hours\'', ends = 'now() + interval \'8 hours\'', workers = 1 }) => {
  const result = await database.query(`
    select public.publish_shift(
      '${employerId}'::uuid,
      '${requestId}'::uuid,
      'Konobar',
      'Centar, Budva',
      ${starts},
      ${ends},
      8000,
      1000,
      ${workers}::smallint,
      array['Bijela košulja']::text[],
      false,
      'public'::public.shift_audience
    ) as id
  `);
  return firstValue(result, 'id');
};
const claimShift = async (workerId, shiftId) => {
  await actor(workerId);
  const result = await database.query(`select public.claim_shift('${shiftId}'::uuid) as id`);
  return firstValue(result, 'id');
};

const employerResult = await database.query(`select id from public.employers where owner_id = '${employerUserId}'`);
const employerId = firstValue(employerResult, 'id');
const defaultAvailability = await database.query(`select available from public.worker_profiles where user_id = '${workerOneId}'`);
assert.equal(firstValue(defaultAvailability, 'available'), false, 'New workers must explicitly enable availability.');
await database.exec(`update public.worker_profiles set available = true;`);

// A reachable contact is required before either side can make a commitment.
await actor(employerUserId);
await assert.rejects(
  () => publishShift({ requestId: '30000000-0000-4000-8000-000000000099' }),
  /contact phone/i,
);
await assert.rejects(
  () => database.exec(`insert into public.worker_contacts (user_id, phone) values ('${workerOneId}', '+382123')`),
  /check constraint/i,
);
// Exercise the same authenticated column privileges as the real Data API.
// Merge-upserts try to update immutable ownership keys, even on first insert.
for (const [table, key, owner, user] of [
  ['worker_contacts', 'user_id', workerOneId, workerOneId],
  ['employer_contacts', 'employer_id', employerId, employerUserId],
]) {
  await actor(user);
  await database.exec('set role authenticated;');
  await assert.rejects(() => database.query(`
    insert into public.${table} (${key}, phone, updated_at)
    values ('${owner}', '+38267123456', now())
    on conflict (${key}) do update set ${key} = excluded.${key}, phone = excluded.phone, updated_at = excluded.updated_at
  `), /permission denied/i);
  await database.query(`insert into public.${table} (${key}, phone, updated_at) values ('${owner}', '+38267123456', now())`);
  await assert.rejects(() => database.query(`insert into public.${table} (${key}, phone) values ('${owner}', '+38267654321')`), /duplicate key/i);
  const saved = await database.query(`update public.${table} set phone = '+38267654321', updated_at = now() where ${key} = '${owner}' returning phone`);
  assert.equal(saved.rows[0].phone, '+38267654321', 'Existing contacts must update without changing ownership.');
  await database.exec('reset role;');
  await actor(workerThreeId);
  await database.exec('set role authenticated;');
  const forbidden = await database.query(`update public.${table} set phone = '+38267000000' where ${key} = '${owner}' returning phone`);
  assert.equal(forbidden.rows.length, 0, 'An unrelated account cannot change a contact.');
  await database.exec('reset role;');
  await database.query(`delete from public.${table} where ${key} = '${owner}'`);
}

await database.exec(`
  insert into public.employer_contacts (employer_id, phone) values
    ('${employerId}', '+38267111111');
  insert into public.worker_contacts (user_id, phone) values
    ('${workerOneId}', '+38267222222'),
    ('${workerTwoId}', '+38267333333'),
    ('${workerThreeId}', '+38267444444');
`);

// Publishing is retry-safe: the same request ID returns one shift.
await actor(employerUserId);
const noShowRequestId = '30000000-0000-4000-8000-000000000001';
const noShowShiftId = await publishShift({ requestId: noShowRequestId, workers: 2 });
const retriedShiftId = await publishShift({ requestId: noShowRequestId, workers: 2 });
assert.equal(retriedShiftId, noShowShiftId, 'A retried publish must return the original shift.');
const requestCount = await database.query(`select count(*)::integer as count from public.shifts where request_id = '${noShowRequestId}'`);
assert.equal(firstValue(requestCount, 'count'), 1, 'A retried publish must not duplicate a shift.');

await database.exec(`delete from public.employer_contacts where employer_id = '${employerId}'`);
await assert.rejects(() => claimShift(workerOneId, noShowShiftId), /employer contact phone/i);
await database.exec(`insert into public.employer_contacts (employer_id, phone) values ('${employerId}', '+38267111111')`);
await database.exec(`delete from public.worker_contacts where user_id = '${workerOneId}'`);
await assert.rejects(() => claimShift(workerOneId, noShowShiftId), /contact phone/i);
await database.exec(`insert into public.worker_contacts (user_id, phone) values ('${workerOneId}', '+38267222222')`);
const noShowAssignmentOne = await claimShift(workerOneId, noShowShiftId);
const noShowAssignmentTwo = await claimShift(workerTwoId, noShowShiftId);
await assert.rejects(() => claimShift(workerThreeId, noShowShiftId), /not available|already full/i);

await actor(workerOneId);
await database.exec('set role authenticated;');
let visibleContacts = await database.query(`select phone from public.employer_contacts where employer_id = '${employerId}'`);
assert.equal(visibleContacts.rows.length, 1, 'The assigned worker must see the business contact.');
await database.exec('reset role;');

await actor(employerUserId);
await database.exec('set role authenticated;');
visibleContacts = await database.query(`select phone from public.worker_contacts where user_id in ('${workerOneId}', '${workerTwoId}')`);
assert.equal(visibleContacts.rows.length, 2, 'The employer must see active assigned worker contacts.');
await database.exec('reset role;');

// The browser-facing Data API exposes neither side's phone to an unrelated
// authenticated account.
await actor(workerThreeId);
await database.exec('set role authenticated;');
const unrelatedWorkerContacts = await database.query(`select phone from public.worker_contacts where user_id in ('${workerOneId}', '${workerTwoId}')`);
const unrelatedEmployerContacts = await database.query(`select phone from public.employer_contacts where employer_id = '${employerId}'`);
assert.equal(unrelatedWorkerContacts.rows.length, 0, 'An unrelated worker must not read worker contacts.');
assert.equal(unrelatedEmployerContacts.rows.length, 0, 'An unrelated worker must not read business contacts.');
await database.exec('reset role;');

// If one worker is still unresolved after the scheduled end, the shift stays
// operational. It completes exactly once after the final assignment is resolved.
await database.exec(`
  update public.shifts
  set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour', status = 'in_progress'
  where id = '${noShowShiftId}';
`);
await actor(employerUserId);
await database.query(`select public.mark_assignment_no_show('${noShowAssignmentOne}'::uuid)`);
let shiftState = await database.query(`select status from public.shifts where id = '${noShowShiftId}'`);
assert.equal(firstValue(shiftState, 'status'), 'in_progress');
await actor(workerOneId);
await database.exec('set role authenticated;');
visibleContacts = await database.query(`select phone from public.employer_contacts where employer_id = '${employerId}'`);
assert.equal(visibleContacts.rows.length, 0, 'Contact access must expire when the assignment is no longer active.');
await database.exec('reset role;');
await actor(employerUserId);
await database.query(`select public.mark_assignment_no_show('${noShowAssignmentTwo}'::uuid)`);
shiftState = await database.query(`select status from public.shifts where id = '${noShowShiftId}'`);
assert.equal(firstValue(shiftState, 'status'), 'completed');
const employerCompleted = await database.query(`select completed_shifts from public.employers where id = '${employerId}'`);
assert.equal(firstValue(employerCompleted, 'completed_shifts'), 1, 'A shift must be counted as completed once.');

// Checkout creates an obligation only; employer authorization changes it to
// authorized and never to paid.
await actor(employerUserId);
const paymentShiftId = await publishShift({ requestId: '30000000-0000-4000-8000-000000000002' });
const paymentAssignmentId = await claimShift(workerOneId, paymentShiftId);
await database.exec(`
  update public.shifts
  set starts_at = now() - interval '1 hour', ends_at = now() + interval '20 minutes', status = 'in_progress'
  where id = '${paymentShiftId}';
`);
await actor(workerOneId);
await database.query(`select public.check_in_assignment('${paymentAssignmentId}'::uuid)`);
await database.query(`select public.check_out_assignment('${paymentAssignmentId}'::uuid)`);
let ledger = await database.query(`select status from public.payment_ledger where assignment_id = '${paymentAssignmentId}'`);
assert.equal(firstValue(ledger, 'status'), 'pending');
await actor(employerUserId);
await database.query(`select public.authorize_assignment_payment('${paymentAssignmentId}'::uuid)`);
ledger = await database.query(`select status from public.payment_ledger where assignment_id = '${paymentAssignmentId}'`);
assert.equal(firstValue(ledger, 'status'), 'authorized');

// Employer cancellation preserves worker reliability and records an honest reason.
await actor(employerUserId);
const cancelledShiftId = await publishShift({ requestId: '30000000-0000-4000-8000-000000000003' });
const cancelledAssignmentId = await claimShift(workerTwoId, cancelledShiftId);
const scoreBeforeCancellation = await database.query(`select reliability_score from public.worker_profiles where user_id = '${workerTwoId}'`);
await actor(employerUserId);
await database.query(`select public.cancel_shift('${cancelledShiftId}'::uuid)`);
const cancelledAssignment = await database.query(`select status, cancellation_reason from public.shift_assignments where id = '${cancelledAssignmentId}'`);
const scoreAfterCancellation = await database.query(`select reliability_score from public.worker_profiles where user_id = '${workerTwoId}'`);
assert.equal(firstValue(cancelledAssignment, 'status'), 'cancelled');
assert.equal(firstValue(cancelledAssignment, 'cancellation_reason'), 'Poslodavac je otkazao smjenu');
assert.equal(firstValue(scoreAfterCancellation, 'reliability_score'), firstValue(scoreBeforeCancellation, 'reliability_score'));

// Worker cancellation reopens the exact shift and records a replacement request.
await actor(employerUserId);
const replacementShiftId = await publishShift({
  requestId: '30000000-0000-4000-8000-000000000004',
  starts: "now() + interval '30 hours'",
  ends: "now() + interval '36 hours'",
});
const replacementAssignmentId = await claimShift(workerThreeId, replacementShiftId);
await actor(workerThreeId);
await database.query(`select public.cancel_assignment('${replacementAssignmentId}'::uuid, 'Test cancellation')`);
const replacementState = await database.query(`select status, urgent, audience, replacement_requested_at from public.shifts where id = '${replacementShiftId}'`);
assert.equal(firstValue(replacementState, 'status'), 'published');
assert.equal(firstValue(replacementState, 'urgent'), true);
assert.equal(firstValue(replacementState, 'audience'), 'public');
assert.ok(firstValue(replacementState, 'replacement_requested_at'));

// Overlapping commitments are rejected, while a cancelled commitment no longer blocks work.
await actor(employerUserId);
const overlapOneId = await publishShift({
  requestId: '30000000-0000-4000-8000-000000000005',
  starts: "now() + interval '12 hours'",
  ends: "now() + interval '18 hours'",
});
const overlapTwoId = await publishShift({
  requestId: '30000000-0000-4000-8000-000000000006',
  starts: "now() + interval '17 hours'",
  ends: "now() + interval '23 hours'",
});
await claimShift(workerThreeId, overlapOneId);
await assert.rejects(() => claimShift(workerThreeId, overlapTwoId), /overlapping shift/i);

// An ended shift cannot be reopened by a late worker cancellation; attendance
// must instead be resolved through check-out or the employer no-show flow.
await actor(employerUserId);
const expiredShiftId = await publishShift({ requestId: '30000000-0000-4000-8000-000000000007' });
const expiredAssignmentId = await claimShift(workerTwoId, expiredShiftId);
await database.exec(`
  update public.shifts
  set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour', status = 'in_progress'
  where id = '${expiredShiftId}';
`);
await actor(workerTwoId);
await assert.rejects(
  () => database.query(`select public.cancel_assignment('${expiredAssignmentId}'::uuid, 'Late test cancellation')`),
  /cannot be cancelled/i,
);

// Validate the exposed mutation surface and the replacement for the former
// security-definer view.
const grants = await database.query(`
  select
    has_function_privilege('authenticated', 'public.publish_shift(uuid,uuid,text,text,timestamptz,timestamptz,integer,integer,smallint,text[],boolean,public.shift_audience)', 'execute') as can_publish,
    has_function_privilege('authenticated', 'public.create_shift(uuid,text,text,timestamptz,timestamptz,integer,integer,smallint,boolean,public.shift_audience)', 'execute') as can_use_legacy_create,
    has_function_privilege('authenticated', 'public.request_shift_replacement(uuid)', 'execute') as can_request_manual_replacement
`);
assert.equal(firstValue(grants, 'can_publish'), true);
assert.equal(firstValue(grants, 'can_use_legacy_create'), false);
assert.equal(firstValue(grants, 'can_request_manual_replacement'), false);
const marketplaceProfileRelation = await database.query(`
  select c.relkind, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'employer_marketplace_profiles'
`);
assert.equal(firstValue(marketplaceProfileRelation, 'relkind'), 'r');
assert.equal(firstValue(marketplaceProfileRelation, 'relrowsecurity'), true);
const contactSecurity = await database.query(`
  select
    has_column_privilege('authenticated', 'public.profiles', 'phone', 'select') as can_select_legacy_phone,
    has_column_privilege('authenticated', 'public.profiles', 'phone', 'update') as can_update_legacy_phone,
    (select relrowsecurity from pg_class where oid = 'public.worker_contacts'::regclass) as worker_contacts_rls,
    (select relrowsecurity from pg_class where oid = 'public.employer_contacts'::regclass) as employer_contacts_rls
`);
assert.equal(firstValue(contactSecurity, 'can_select_legacy_phone'), false);
assert.equal(firstValue(contactSecurity, 'can_update_legacy_phone'), false);
assert.equal(firstValue(contactSecurity, 'worker_contacts_rls'), true);
assert.equal(firstValue(contactSecurity, 'employer_contacts_rls'), true);

if (populatedUpgrade) {
  await database.exec(preflightSql);
  const before = await snapshotMarketplace(database);
  await database.exec(await readFile(new URL(modelMigrationFile, root), 'utf8'));
  await database.exec(await readFile(new URL(capabilitiesMigrationFile, root), 'utf8'));
  assert.deepEqual(await snapshotMarketplace(database), before, 'Upgrade changed historical marketplace records.');
  console.log('populated upgrade preserved all historical marketplace records');
}

await database.exec(preflightSql);
await verifyModelBoundary(database, { employerId, employerUserId, workerOneId, workerTwoId, workerThreeId });
await verifyCapabilitiesAndProjection(database, { employerId, employerUserId, workerOneId, workerTwoId });
const beforeApplications = await snapshotMarketplace(database);
await database.exec(await readFile(new URL('supabase/migrations/20260914171841_application_offer_acceptance.sql', root), 'utf8'));
assert.deepEqual(await snapshotMarketplace(database), beforeApplications, 'Phase 3 changed historical records.');
await verifyApplications(database, { employerId, employerUserId, workerOneId, workerTwoId, workerThreeId });
const beforeBilling = await snapshotMarketplace(database);
await database.exec(await readFile(new URL('supabase/migrations/20260914173021_employer_billing_foundation.sql', root), 'utf8'));
assert.deepEqual(await snapshotMarketplace(database), beforeBilling, 'Phase 4A changed historical records.');
await verifyBilling(database, { employerId, employerUserId, workerOneId, workerTwoId });
await database.exec(await readFile(new URL('supabase/migrations/20260914223024_application_notifications.sql', root), 'utf8'));
await verifyNotifications(database, { employerId, employerUserId, workerOneId, workerTwoId });
await database.exec(await readFile(new URL('supabase/migrations/20260915081036_preferred_worker_invitations.sql', root), 'utf8'));
await verifyInvitations(database, { employerId, employerUserId, workerOneId, workerTwoId });
await database.exec(await readFile(new URL('supabase/migrations/20260915175154_posting_credit_redemption_and_sos.sql', root), 'utf8'));
await verifySos(database, { employerId, employerUserId, workerOneId, workerTwoId });
console.log('all migrations, legacy transitions and model boundaries validated');
await database.close();
