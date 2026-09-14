import assert from 'node:assert/strict';

// Runs exclusively inside the migration runner's disposable in-memory database.
export async function verifyCapabilitiesAndProjection(database, { employerUserId, workerOneId, workerTwoId }) {
  const actor = async (id, role = 'authenticated') => {
    await database.exec('reset role');
    await database.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? '']);
    if (role === 'authenticated' || role === 'anon') await database.exec(`set role ${role}`);
  };
  await actor(employerUserId);
  await database.query('select public.enable_worker_profile()');
  await database.query('select public.enable_worker_profile()');
  const worker = await database.query('select user_id, available from public.worker_profiles where user_id = $1', [employerUserId]);
  assert.deepEqual(worker.rows, [{ user_id: employerUserId, available: false }]);
  await database.query(`insert into public.worker_contacts(user_id, phone) values ($1, '+38267555555')`, [employerUserId]);
  await assert.rejects(() => database.query(`update public.profiles set role = 'admin' where id = $1`, [employerUserId]), /permission denied/);
  await actor(null, 'anon');
  await assert.rejects(() => database.query('select public.enable_worker_profile()'), /permission denied/);
  await actor(null);
  await assert.rejects(() => database.query('select public.enable_worker_profile()'), /Not authorized/);

  await actor(workerOneId);
  const create = async (requestId, name) => (await database.query(
    `select public.create_employer_workspace($1, $2, 'Budva') as id`, [requestId, name],
  )).rows[0].id;
  const first = await create('70000000-0000-4000-8000-000000000001', 'First workspace');
  const again = await create('70000000-0000-4000-8000-000000000001', 'First workspace');
  const second = await create('70000000-0000-4000-8000-000000000002', 'Second workspace');
  assert.equal(again, first);
  assert.notEqual(first, second);
  await assert.rejects(() => create('70000000-0000-4000-8000-000000000099', ' '), /Invalid workspace details/);
  const memberships = await database.query('select employer_id from public.employer_members where user_id = $1', [workerOneId]);
  assert.equal(memberships.rows.length, 2);
  const identity = await database.query('select role from public.profiles where id = $1', [workerOneId]);
  assert.equal(identity.rows[0].role, 'worker', 'Onboarding must not overwrite historical role or admin privileges.');

  // Each business has its own phone. A worker-capable owner can maintain both.
  await database.query(`insert into public.employer_contacts(employer_id, phone) values ($1, '+38267666666'), ($2, '+38267777777')`, [first, second]);
  await database.query(`update public.employer_contacts set phone = '+38267888888' where employer_id = $1`, [second]);
  const firstPhone = await database.query('select phone from public.employer_contacts where employer_id = $1', [first]);
  assert.equal(firstPhone.rows[0].phone, '+38267666666');
  await actor(workerTwoId);
  assert.equal((await database.query('select id from public.employers where id = $1', [second])).rows.length, 0);
  assert.equal((await database.query('select phone from public.employer_contacts where employer_id = $1', [second])).rows.length, 0);
  await assert.rejects(() => database.query(`insert into public.employer_members(employer_id,user_id) values ($1,$2)`, [second, workerTwoId]), /permission denied/);

  await actor(workerOneId);
  const publish = async (workspace, requestId = '80000000-0000-4000-8000-000000000001') => (await database.query(`select public.publish_shift(
    $1, $2, 'Konobar', 'Private exact address 42',
    now() + interval '120 hours', now() + interval '126 hours', 8000, 0, 1::smallint,
    '{}'::text[], false, 'public'::public.shift_audience) as id`, [workspace, requestId])).rows[0].id;
  const legacyShift = await publish(second);
  const unrelatedShift = await publish(second, '80000000-0000-4000-8000-000000000002');
  assert.equal((await database.query('select employer_id from public.shifts where id = $1', [legacyShift])).rows[0].employer_id, second);
  await actor(employerUserId);
  await database.query('update public.worker_profiles set available = true where user_id = $1', [employerUserId]);
  const legacyAssignment = (await database.query('select public.claim_shift($1) as id', [legacyShift])).rows[0].id;
  assert.equal((await database.query('select exact_address from public.shift_locations where shift_id = $1', [legacyShift])).rows[0].exact_address, 'Private exact address 42');
  assert.equal((await database.query('select exact_address from public.shift_locations where shift_id = $1', [unrelatedShift])).rows.length, 0, 'An active assignment must not unlock another shift location at the same employer.');
  await database.query('select public.cancel_assignment($1)', [legacyAssignment]);
  assert.equal((await database.query('select exact_address from public.shift_locations where shift_id = $1', [legacyShift])).rows.length, 0);

  await actor(workerOneId, 'owner');
  const backfill = await database.query(`select count(*)::int as missing from public.shifts s
    left join public.shift_locations l on l.shift_id=s.id
    where s.marketplace_model='legacy_claim' and (l.shift_id is null or l.exact_address <> s.area)`);
  assert.equal(backfill.rows[0].missing, 0);
  await database.query('delete from public.employer_members where employer_id=$1 and user_id=$2', [second, workerOneId]);
  await actor(workerOneId);
  assert.equal((await database.query('select id from public.employers where id=$1', [second])).rows.length, 0);
  await assert.rejects(() => publish(second), /Not authorized/);
  await assert.rejects(() => create('70000000-0000-4000-8000-000000000002', 'Second workspace'), /Not authorized/);
  for (const digit of ['3', '4', '5']) {
    await create(`70000000-0000-4000-8000-00000000000${digit}`, `Additional workspace ${digit}`);
  }
  await assert.rejects(() => create('70000000-0000-4000-8000-000000000006', 'Above limit'), /rate limit/);
  assert.equal(await create('70000000-0000-4000-8000-000000000001', 'First workspace'), first, 'An idempotent retry still succeeds at the abuse ceiling.');
  await actor(null, 'anon');
  await assert.rejects(() => create('70000000-0000-4000-8000-000000000007', 'Anonymous workspace'), /permission denied/);

  await actor(employerUserId, 'owner');
  assert.equal((await database.query('select count(*)::int as count from public.public_shift_listings')).rows[0].count, 0, 'No legacy free text may be copied into public listings.');
  const columns = (await database.query(`select column_name from information_schema.columns where table_schema='public' and table_name='public_shift_listings' order by column_name`)).rows.map((r) => r.column_name);
  assert.deepEqual(columns, ['approved_at', 'city', 'employer_name', 'ends_at', 'location_area', 'pay_cents', 'requirements', 'role', 'shift_id', 'source_updated_at', 'starts_at', 'workers_needed']);

  // Reuse Phase 1's fault-injected future-model fixture. A curated projection
  // contains no copied street address and cannot unlock raw shifts or contacts.
  const applicationShift = '40000000-0000-4000-8000-000000000001';
  await database.query(`insert into public.shift_locations(shift_id, exact_address) values ($1, 'Never public address 99')`, [applicationShift]);
  await database.query(`insert into public.public_shift_listings(shift_id,role,employer_name,city,location_area,
    starts_at,ends_at,pay_cents,workers_needed,requirements,source_updated_at,approved_at)
    select id,'Konobar','Approved business display','Budva','Centar',starts_at,ends_at,pay_cents,workers_needed,
      array['Iskustvo u ugostiteljstvu'],updated_at,now() from public.shifts where id=$1`, [applicationShift]);
  for (const [user, role] of [[null, 'anon'], [workerTwoId, 'authenticated']]) {
    await actor(user, role);
    const publicRows = await database.query('select * from public.public_shift_listings');
    assert.equal(publicRows.rows.length, 1);
    assert.equal(JSON.stringify(publicRows.rows).includes('Never public'), false);
    await assert.rejects(() => database.query(`update public.public_shift_listings set pay_cents=1`), /permission denied/);
    await assert.rejects(() => database.query('insert into public.public_shift_listings(shift_id) values ($1)', [legacyShift]), /permission denied/);
    if (role === 'anon') {
      for (const table of ['shifts', 'shift_locations', 'worker_contacts', 'employer_contacts', 'shift_assignments']) {
        await assert.rejects(() => database.query(`select * from public.${table}`), /permission denied/);
      }
    } else {
      // Even a deliberately inconsistent claimed row in the Phase 1 fixture
      // must not reveal a new-model shift's address through old read policies.
      assert.equal((await database.query('select * from public.shifts where id=$1', [applicationShift])).rows.length, 0);
      assert.equal((await database.query('select * from public.shift_locations where shift_id=$1', [applicationShift])).rows.length, 0);
    }
  }

  // Source changes invalidate publication immediately, with no cron dependency.
  for (const change of ["updated_at=updated_at + interval '1 second'", "audience='crew'", "status='cancelled'", "starts_at=now() - interval '1 minute'"]) {
    await actor(employerUserId, 'owner');
    await database.exec('begin; alter table public.shifts disable trigger shifts_guard_marketplace_model;');
    await database.query(`update public.shifts set ${change} where id=$1`, [applicationShift]);
    await actor(null, 'anon');
    assert.equal((await database.query('select * from public.public_shift_listings')).rows.length, 0);
    await database.exec('reset role; rollback;');
  }
  await actor(employerUserId, 'owner');
  console.log('Phase 2: dual capabilities, workspace isolation, idempotency, location backfill and public/private RLS verified');
}
