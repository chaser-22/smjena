import assert from 'node:assert/strict';

// Local, disposable PGlite only. No network client or production credentials.
export async function snapshotMarketplace(database) {
  const role = (await database.query('select current_role as name')).rows[0]
    .name;
  await database.exec('reset role');
  const snapshot = {};
  try {
    for (const table of [
      'profiles',
      'worker_profiles',
      'employers',
      'employer_members',
      'shifts',
      'shift_assignments',
      'ratings',
      'payment_ledger',
      'trusted_workers',
      'worker_contacts',
      'employer_contacts',
      'product_events',
      'push_subscriptions',
      'employer_marketplace_profiles',
    ]) {
      const result = await database.query(`
      select coalesce(jsonb_agg(record order by record::text), '[]'::jsonb) as records
      from (select to_jsonb(row) - 'marketplace_model' - 'onboarding_request_id' as record from public.${table} row) data
    `);
      snapshot[table] = result.rows[0].records;
    }
    return snapshot;
  } finally {
    if (role === 'authenticated' || role === 'anon')
      await database.exec(`set role ${role}`);
  }
}

export async function verifyModelBoundary(database, ids) {
  const {
    employerId,
    employerUserId,
    workerOneId,
    workerTwoId,
    workerThreeId,
  } = ids;
  const actor = async (id) =>
    database.query("select set_config('request.jwt.claim.sub', $1, false)", [
      id,
    ]);
  const reject = async (
    sql,
    pattern = /Application marketplace is not enabled|Legacy records require/,
  ) => {
    const before = await snapshotMarketplace(database);
    await assert.rejects(() => database.exec(sql), pattern);
    assert.deepEqual(
      await snapshotMarketplace(database),
      before,
      'Rejected operation left partial side effects.',
    );
  };
  const origin = await database.query(
    `select distinct marketplace_model from public.shifts`,
  );
  assert.deepEqual(origin.rows, [{ marketplace_model: 'legacy_claim' }]);
  await reject(
    `update public.shifts set marketplace_model = 'application_v1'`,
    /model is immutable/,
  );
  await reject(
    `update public.shifts set marketplace_model = null`,
    /model is immutable/,
  );

  const newShift = (id, model, status, starts, ends) => `
    insert into public.shifts (id, employer_id, created_by, role, city, area,
      starts_at, ends_at, pay_cents, base_pay_cents, workers_needed, status, marketplace_model)
    values ('${id}', '${employerId}', '${employerUserId}', 'Model boundary test',
      'Budva', 'Private fixture address', ${starts}, ${ends}, 8000, 8000, 4, '${status}', '${model}')
  `;
  const future = '40000000-0000-4000-8000-000000000001';
  const active = '40000000-0000-4000-8000-000000000002';
  const ended = '40000000-0000-4000-8000-000000000003';
  const complete = '40000000-0000-4000-8000-000000000004';
  const claimed = '50000000-0000-4000-8000-000000000001';
  const checkedIn = '50000000-0000-4000-8000-000000000002';
  const absent = '50000000-0000-4000-8000-000000000003';
  const completed = '50000000-0000-4000-8000-000000000004';

  await reject(
    newShift(
      future,
      'application_v1',
      'published',
      "now() + interval '2 hours'",
      "now() + interval '8 hours'",
    ),
  );

  // Deliberate fault injection in a disposable local DB: simulate future rows
  // and inconsistent legacy children to prove stale clients cannot mutate them.
  // This is not a rollout switch and must NEVER be executed against production.
  await database.exec(`
    begin;
    alter table public.shifts disable trigger shifts_guard_marketplace_model;
    alter table public.shift_assignments disable trigger assignments_guard_marketplace_model;
    alter table public.payment_ledger disable trigger ledger_guard_marketplace_model;
    ${newShift(future, 'application_v1', 'published', "now() + interval '2 hours'", "now() + interval '8 hours'")};
    ${newShift(active, 'application_v1', 'in_progress', "now() - interval '1 hour'", "now() + interval '20 minutes'")};
    ${newShift(ended, 'application_v1', 'in_progress', "now() - interval '2 hours'", "now() - interval '1 hour'")};
    ${newShift(complete, 'application_v1', 'completed', "now() - interval '4 hours'", "now() - interval '3 hours'")};
    insert into public.shift_assignments (id, shift_id, worker_id, status, pay_cents) values
      ('${claimed}', '${future}', '${workerTwoId}', 'claimed', 8000),
      ('${checkedIn}', '${active}', '${workerThreeId}', 'checked_in', 8000),
      ('${absent}', '${ended}', '${workerTwoId}', 'claimed', 8000),
      ('${completed}', '${complete}', '${workerOneId}', 'completed', 8000);
    insert into public.payment_ledger (assignment_id, employer_id, worker_id, amount_cents)
      values ('${completed}', '${employerId}', '${workerOneId}', 8000);
    alter table public.shifts enable trigger shifts_guard_marketplace_model;
    alter table public.shift_assignments enable trigger assignments_guard_marketplace_model;
    alter table public.payment_ledger enable trigger ledger_guard_marketplace_model;
    commit;
  `);

  await actor(workerOneId);
  await database.exec('set role authenticated');
  await reject(`select public.claim_shift('${future}')`);
  await database.exec('reset role');
  await actor(workerTwoId);
  await database.exec('set role authenticated');
  await reject(`select public.cancel_assignment('${claimed}', 'Test')`);
  await database.exec('reset role');
  await actor(workerThreeId);
  await database.exec('set role authenticated');
  await reject(`select public.check_out_assignment('${checkedIn}')`);
  await database.exec('reset role');

  // Check-in needs a claimed assignment within its existing arrival window.
  await database.exec(`
    alter table public.shift_assignments disable trigger assignments_guard_marketplace_model;
    update public.shift_assignments set status = 'claimed' where id = '${checkedIn}';
    alter table public.shift_assignments enable trigger assignments_guard_marketplace_model;
  `);
  await database.exec('set role authenticated');
  await reject(`select public.check_in_assignment('${checkedIn}')`);
  await database.exec('reset role');
  await actor(employerUserId);
  await database.exec('set role authenticated');
  for (const sql of [
    `select public.raise_shift_pay('${future}', 1000)`,
    `select public.broadcast_shift('${future}')`,
    `select public.cancel_shift('${future}')`,
    `select public.mark_assignment_no_show('${absent}')`,
    `select public.authorize_assignment_payment('${completed}')`,
    `insert into public.ratings (assignment_id, employer_id, worker_id, created_by, score, want_again)
      values ('${completed}', '${employerId}', '${workerOneId}', '${employerUserId}', 5, true)`,
  ])
    await reject(sql);
  await database.exec('reset role');

  // Direct privileged writes are fenced too; no reliance on hidden buttons/RLS.
  await reject(`delete from public.shifts where id = '${future}'`);
  await reject(`delete from public.shift_assignments where id = '${claimed}'`);
  await reject(
    `update public.payment_ledger set status = 'paid' where assignment_id = '${completed}'`,
  );
  const legacy = await database.query(
    `select id from public.shifts where marketplace_model = 'legacy_claim' limit 1`,
  );
  await reject(
    `update public.shift_assignments set shift_id = '${legacy.rows[0].id}' where id = '${claimed}'`,
  );

  const privileges = await database.query(`select
    has_function_privilege('anon', 'private.guard_shift_marketplace_model()', 'execute') as anon_execute,
    has_function_privilege('authenticated', 'private.guard_legacy_marketplace_record()', 'execute') as auth_execute,
    has_column_privilege('authenticated', 'public.shifts', 'marketplace_model', 'update') as model_update,
    has_table_privilege('anon', 'public.shifts', 'select') as public_shift_read
  `);
  assert.deepEqual(privileges.rows[0], {
    anon_execute: false,
    auth_execute: false,
    model_update: false,
    public_shift_read: false,
  });

  // Legacy employer feedback still works through the actual authenticated RLS
  // path, including its historical trusted-worker side effect.
  const legacyCompleted = await database.query(`
    select assignment.id, assignment.worker_id from public.shift_assignments assignment
    join public.shifts shift on shift.id = assignment.shift_id
    where shift.marketplace_model = 'legacy_claim' and assignment.status = 'completed' limit 1
  `);
  assert.equal(legacyCompleted.rows.length, 1);
  await actor(employerUserId);
  await database.exec('set role authenticated');
  await database.query(
    `insert into public.ratings (assignment_id, employer_id, worker_id, created_by, score, want_again)
    values ($1, $2, $3, $4, 4, true)`,
    [
      legacyCompleted.rows[0].id,
      employerId,
      legacyCompleted.rows[0].worker_id,
      employerUserId,
    ],
  );
  const editedRating = await database.query(
    `update public.ratings set score = 5 where assignment_id = $1 returning score`,
    [legacyCompleted.rows[0].id],
  );
  assert.equal(editedRating.rows[0].score, 5);
  await database.exec('reset role');

  // Default legacy publishing and claim/cancellation still work after upgrade.
  await actor(employerUserId);
  await database.exec('set role authenticated');
  const published = await database.query(`select public.publish_shift(
    '${employerId}', '60000000-0000-4000-8000-000000000001', 'Konobar', 'Private address',
    now() + interval '90 hours', now() + interval '96 hours', 8000, 0, 1::smallint,
    '{}'::text[], false, 'public'::public.shift_audience) as id`);
  await database.exec('reset role');
  const shiftId = published.rows[0].id;
  await actor(workerOneId);
  await database.exec('set role authenticated');
  const assignment = await database.query(
    `select public.claim_shift('${shiftId}') as id`,
  );
  await database.query(
    `select public.cancel_assignment('${assignment.rows[0].id}', 'Compatibility check')`,
  );
  await database.exec('reset role');
  await database.query(`delete from public.shifts where id = '${shiftId}'`);
  console.log(
    'model boundary: creation, immutability, legacy RPCs, rollback, grants and compatibility verified',
  );
}
