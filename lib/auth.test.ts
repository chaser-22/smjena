import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuthSubmission } from './auth.ts';

test('returning-user login requires only an email and cannot select a role', () => {
  const parsed = parseAuthSubmission({
    intent: 'login',
    email: 'radnik@example.com',
    role: 'employer',
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(parsed.data, { intent: 'login', email: 'radnik@example.com' });
});

test('new employer registration requires a business name', () => {
  const parsed = parseAuthSubmission({
    intent: 'register',
    email: 'firma@example.com',
    fullName: 'Ana Anić',
    role: 'employer',
    city: 'Kotor',
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.issues.find((issue) => issue.path[0] === 'companyName')?.message, 'Unesi naziv firme ili lokala.');
  }
});

test('registration accepts municipalities outside the original tourist-city subset', () => {
  const parsed = parseAuthSubmission({
    intent: 'register',
    email: 'radnik@example.com',
    fullName: 'Iva Ivić',
    role: 'worker',
    city: 'Žabljak',
  });
  assert.equal(parsed.success, true);
});
