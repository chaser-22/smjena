import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function verifyPushScheduler(db, migration, transportMigration) {
  // PGlite has no cron/network workers. Stub only those extension boundaries;
  // authorization and scheduler SQL below execute unmodified.
  await db.exec(`create schema net; create schema cron;
    create table net.test_requests(id bigint generated always as identity, url text, headers jsonb);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$
      insert into net.test_requests(url,headers) values(url,headers) returning id; $$;
    create table cron.test_jobs(name text,schedule text,command text);
    create function cron.schedule(name text,schedule text,command text) returns bigint language sql as $$
      insert into cron.test_jobs values(name,schedule,command); select 1::bigint; $$;`);
  const sql = (await readFile(migration,'utf8')).replace('create extension if not exists pg_cron;','').replace('create extension if not exists pg_net;','');
  await db.exec(sql);
  await db.exec(await readFile(transportMigration,'utf8'));
  assert.equal((await db.query('select private.wake_application_push_worker() id')).rows[0].id,null,'No configured endpoint means no outbound request.');
  await db.exec("insert into private.application_push_scheduler(endpoint) values('https://test.example/api/internal/application-push')");
  const id=(await db.query('select private.wake_application_push_worker() id')).rows[0].id;
  assert.ok(id);
  assert.equal((await db.query('select private.wake_application_push_worker() id')).rows[0].id,null,'Repeated ticks are bounded.');
  const token=(await db.query('select headers from net.test_requests where id=$1',[id])).rows[0].headers['x-smjena-wakeup'];
  assert.match(token,/^[a-f0-9]{64}$/);
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(()=>db.query('select * from private.application_push_wakeups'),/permission denied/);
    await assert.rejects(()=>db.query('select * from net.test_requests'),/permission denied/);
    await assert.rejects(()=>db.query('select public.consume_application_push_wakeup($1)',[token]),/permission denied/);
    await assert.rejects(()=>db.query('select private.wake_application_push_worker()'),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const consume=async (value)=>(await db.query('select public.consume_application_push_wakeup($1) ok',[value])).rows[0].ok;
  assert.equal(await consume('b'.repeat(64)),false);
  assert.equal(await consume(token),true);
  assert.equal(await consume(token),false,'Tokens are one-use even after handler failure.');
  await db.exec('reset role');
  await db.exec("update private.application_push_wakeups set consumed_at=null,expires_at=now()-interval '1 minute'");
  await db.exec('set role service_role');
  assert.equal(await consume(token),false,'Expired tokens cannot wake the worker.');
  await db.exec('reset role');
  assert.equal((await db.query('select schedule from cron.test_jobs')).rows[0].schedule,'* * * * *');
  console.log('Push scheduler: private receipts, one-use/expiry/replay auth, bounded wake-ups and minute schedule verified (network/cron stubs).');
}
