import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedPushEndpoint } from './push-safety.ts';
test('push delivery rejects arbitrary and disguised network destinations', () => {
  for (const endpoint of ['http://fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://169.254.169.254/x',
    'https://fcm.googleapis.com.evil.test/x', 'https://fcm.googleapis.com@evil.test/x', 'https://evil.test@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x', 'https://evilpush.apple.com/x', 'https://fcm.googleapis.com/x#fragment']) {
    assert.equal(isTrustedPushEndpoint(endpoint), false, endpoint);
  }
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/token', 'https://updates.push.services.mozilla.com/wpush/token',
    'https://web.push.apple.com/token', 'https://wns.notify.windows.com/token']) assert.equal(isTrustedPushEndpoint(endpoint), true);
});
