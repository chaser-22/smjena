import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { requireStagingTestConfig } from './staging-safety.ts';

const variableNames = [
  'E2E_ALLOW_STAGING_MUTATIONS',
  'E2E_BASE_URL',
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_PUBLISHABLE_KEY',
  'E2E_SUPABASE_SERVICE_ROLE_KEY',
] as const;

const originalEnvironment = Object.fromEntries(
  variableNames.map((name) => [name, process.env[name]]),
);

afterEach(() => {
  for (const name of variableNames) {
    const value = originalEnvironment[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('staging mutation guard', () => {
  it('requires a deliberate mutation opt-in', () => {
    setValidStagingEnvironment();
    process.env.E2E_ALLOW_STAGING_MUTATIONS = 'false';

    assert.throws(requireStagingTestConfig, /mutation tests are disabled/i);
  });

  it('refuses the production application host', () => {
    setValidStagingEnvironment();
    process.env.E2E_BASE_URL = 'https://smjena.vercel.app';

    assert.throws(
      requireStagingTestConfig,
      /refusing to mutate production application/i,
    );
  });

  it('refuses the production Supabase project', () => {
    setValidStagingEnvironment();
    process.env.E2E_SUPABASE_URL = 'https://deshfuafmxzdfvpobyyp.supabase.co';

    assert.throws(
      requireStagingTestConfig,
      /refusing to mutate production Supabase/i,
    );
  });

  it('accepts a separate staging app and Supabase project', () => {
    setValidStagingEnvironment();

    assert.deepEqual(requireStagingTestConfig(), {
      baseURL: 'https://smjena-staging.example.test',
      supabaseURL: 'https://stagingprojectref.supabase.co',
      publishableKey: 'sb_publishable_staging',
      serviceRoleKey: 'sb_secret_staging',
    });
  });
});

function setValidStagingEnvironment() {
  process.env.E2E_ALLOW_STAGING_MUTATIONS = 'true';
  process.env.E2E_BASE_URL = 'https://smjena-staging.example.test';
  process.env.E2E_SUPABASE_URL = 'https://stagingprojectref.supabase.co';
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_staging';
  process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_staging';
}
