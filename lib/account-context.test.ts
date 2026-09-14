import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDashboardContext, safeReturnPath, DashboardContextSchema } from './account-context.ts';
const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const access = { name: 'Test', city: 'Budva', worker: true, workspaces: [{ id: first, name: 'First', memberRole: 'owner' }, { id: second, name: 'Second', memberRole: 'manager' }] };

test('dual-capability accounts must choose context, never the first workspace', () => {
  assert.equal(resolveDashboardContext(access), null);
  assert.deepEqual(resolveDashboardContext(access, 'worker'), { role: 'worker' });
  assert.deepEqual(resolveDashboardContext(access, 'employer', second), { role: 'employer', employerId: second });
  assert.equal(resolveDashboardContext(access, 'employer', 'missing'), null);
  assert.equal(resolveDashboardContext(access, 'worker', second), null);
  assert.equal(resolveDashboardContext(access, 'invalid', second), null);
  assert.equal(resolveDashboardContext({ ...access, worker: false }, 'worker'), null);
  assert.equal(resolveDashboardContext({ ...access, workspaces: [] }, 'employer', first), null);
});

test('unambiguous legacy entry remains compatible', () => {
  assert.deepEqual(resolveDashboardContext({ ...access, workspaces: [] }), { role: 'worker' });
  assert.deepEqual(resolveDashboardContext({ ...access, worker: false, workspaces: access.workspaces.slice(0, 1) }), { role: 'employer', employerId: first });
});

test('contact and posting context needs an explicit valid workspace', () => {
  assert.equal(DashboardContextSchema.safeParse({ role: 'employer' }).success, false);
  assert.equal(DashboardContextSchema.safeParse({ role: 'employer', employerId: second }).success, true);
});

test('login returns only to known product destinations', () => {
  for (const bad of ['//evil.test', '/\\evil.test', '/%2f%2fevil.test', 'https://evil.test', '/auth/callback', '/login', '/shifts?email=private', '/dashboard?next=evil', '/settings\n']) {
    assert.equal(safeReturnPath(bad), '/dashboard', bad);
  }
  for (const good of ['/shifts', `/shifts/${first}`, '/settings', `/dashboard?mode=employer&workspace=${second}`]) assert.equal(safeReturnPath(good), good);
});
