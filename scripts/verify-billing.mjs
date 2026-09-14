import assert from 'node:assert/strict';

export async function verifyBilling(db, { employerId, employerUserId, workerOneId, workerTwoId }) {
  const actor = async (id) => db.exec(`select set_config('request.jwt.claim.sub','${id}',false); set role authenticated;`);
  const reset = () => db.exec('reset role;');
  const post = (await db.query(`select shift_id from public.application_posts where employer_id='${employerId}' limit 1`)).rows[0].shift_id;
  const other = (await db.query(`select id from public.employers where id<>'${employerId}' limit 1`)).rows[0].id;
  assert.equal((await db.query('select count(*)::int n from public.employer_posting_grants')).rows[0].n, 0, 'Migration must not invent credits.');
  assert.equal((await db.query('select count(*)::int n from private.posting_plans')).rows[0].n, 0, 'Migration must not invent commercial plans.');
  const grant = (await db.query(`insert into public.employer_posting_grants(employer_id,kind,source,reference_key,units,expires_at)
    values('${employerId}','standard_post','manual',gen_random_uuid(),1,now()+interval '1 day') returning id`)).rows[0].id;
  const sos = (await db.query(`insert into public.employer_posting_grants(employer_id,kind,source,reference_key,units,expires_at)
    values('${employerId}','sos_promotion','manual',gen_random_uuid(),2,now()+interval '1 day') returning id`)).rows[0].id;
  await assert.rejects(() => db.exec(`insert into public.employer_posting_grants(employer_id,kind,source,reference_key,units,expires_at)
    values('${employerId}','standard_post','plan',gen_random_uuid(),1,now()+interval '1 day')`), /check constraint/);
  await actor(employerUserId);
  assert.equal((await db.query('select * from public.employer_credit_balances')).rows.length, 2);
  assert.equal((await db.query('select * from public.employer_credit_totals')).rows.length, 2);
  await assert.rejects(() => db.query('select reference_key from public.employer_posting_grants'), /permission denied/);
  await assert.rejects(() => db.exec(`update public.employer_posting_grants set units=999 where id='${grant}'`), /permission denied/);
  await assert.rejects(() => db.exec(`insert into public.employer_posting_usage(grant_id,employer_id,kind,shift_id,request_id)
    values('${grant}','${employerId}','standard_post','${post}',gen_random_uuid())`), /permission denied/);
  await reset();
  await actor(workerOneId);
  assert.equal((await db.query('select * from public.employer_credit_balances')).rows.length, 0, 'Workers cannot read billing.');
  assert.equal((await db.query('select * from public.employer_credit_totals')).rows.length, 0, 'Aggregate view must preserve RLS.');
  await reset();
  await db.exec(`insert into public.employer_members(employer_id,user_id,member_role) values('${employerId}','${workerTwoId}','manager') on conflict do nothing;`);
  await actor(workerTwoId);
  assert.equal((await db.query('select * from public.employer_credit_balances')).rows.length, 0, 'Managers cannot read owner billing.');
  await reset();
  await db.exec('set role anon;');
  await assert.rejects(() => db.query('select * from public.employer_credit_balances'), /permission denied/);
  await reset();
  const consume = (id, firm=employerId, kind='standard_post', request='gen_random_uuid()') => db.query(`insert into public.employer_posting_usage(grant_id,employer_id,kind,shift_id,request_id)
    values('${id}','${firm}','${kind}','${post}',${request}) returning id`);
  await assert.rejects(() => consume(grant, other), /credit unavailable/i);
  await assert.rejects(() => consume(grant, employerId, 'sos_promotion'), /credit unavailable/i);
  await db.exec(`update public.employer_posting_grants set revoked_at=now() where id='${grant}'`);
  assert.equal((await db.query("select * from public.employer_credit_totals where kind='standard_post'")).rows.length, 0);
  await assert.rejects(() => consume(grant), /credit unavailable/i);
  await db.exec(`update public.employer_posting_grants set revoked_at=null,starts_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id='${grant}'`);
  assert.equal((await db.query("select * from public.employer_credit_totals where kind='standard_post'")).rows.length, 0);
  await assert.rejects(() => consume(grant), /credit unavailable/i);
  await db.exec(`update public.employer_posting_grants set starts_at=now()+interval '1 hour',expires_at=now()+interval '1 day' where id='${grant}'`);
  await assert.rejects(() => consume(grant), /credit unavailable/i);
  await db.exec(`update public.employer_posting_grants set starts_at=now()-interval '1 hour' where id='${grant}'`);
  await consume(grant);
  await assert.rejects(() => consume(grant), /exhausted/i);
  assert.equal((await db.query(`select remaining_units from public.employer_credit_balances where id='${grant}'`)).rows[0].remaining_units, 0);
  assert.equal((await db.query(`select remaining_units from public.employer_credit_balances where id='${sos}'`)).rows[0].remaining_units, 2, 'A standard post must never consume SOS credits.');
  const usage = (await consume(sos, employerId, 'sos_promotion', "'70000000-0000-4000-8000-000000000001'")).rows[0].id;
  await assert.rejects(() => consume(sos, employerId, 'sos_promotion', "'70000000-0000-4000-8000-000000000001'"), /duplicate key/i);
  await assert.rejects(() => db.exec(`update public.employer_posting_usage set kind='standard_post' where id='${usage}'`), /immutable/);
  await assert.rejects(() => db.exec(`delete from public.employer_posting_usage where id='${usage}'`), /immutable/);
  await db.exec(`delete from public.employer_members where employer_id='${employerId}' and user_id='${workerTwoId}' and member_role='manager';`);
  console.log('Phase 4A: empty migration, owner-only billing, no client writes, separate credits, expiry, capacity and immutable usage verified');
}
