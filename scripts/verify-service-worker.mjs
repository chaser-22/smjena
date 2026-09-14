import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const listeners = new Map();
const cached = [], deleted = [];
runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
  self: { addEventListener: (type, handler) => listeners.set(type, handler), skipWaiting() {}, clients: { claim() {} }, location: { origin: 'https://smjena.invalid' } },
  caches: {
    open: async () => ({ addAll: async (paths) => cached.push(...paths) }),
    keys: async () => ['smjena-shell-v1', 'smjena-shell-v2'],
    delete: async (key) => deleted.push(key),
  },
});
let pending;
listeners.get('install')({ waitUntil: (work) => { pending = work; } });
await pending;
assert.deepEqual(cached, ['/offline', '/favicon.svg']);
listeners.get('activate')({ waitUntil: (work) => { pending = work; } });
await pending;
assert.deepEqual(deleted, ['smjena-shell-v1']);
console.log('PWA precaches only public offline assets and invalidates the old home-response cache');
