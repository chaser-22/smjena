import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PRODUCTION_APP_HOSTS = new Set([
  'smjena.vercel.app',
  'smjena.me',
  'www.smjena.me',
]);
const PRODUCTION_SUPABASE_REF = 'deshfuafmxzdfvpobyyp';

export type StagingTestConfig = {
  baseURL: string;
  supabaseURL: string;
  publishableKey: string;
  serviceRoleKey: string;
};

export function requireStagingTestConfig(): StagingTestConfig {
  if (process.env.E2E_ALLOW_STAGING_MUTATIONS !== 'true') {
    throw new Error(
      'Staging mutation tests are disabled. Set E2E_ALLOW_STAGING_MUTATIONS=true only for an isolated staging environment.',
    );
  }

  const config = {
    baseURL: required('E2E_BASE_URL'),
    supabaseURL: required('E2E_SUPABASE_URL'),
    publishableKey: required('E2E_SUPABASE_PUBLISHABLE_KEY'),
    serviceRoleKey: required('E2E_SUPABASE_SERVICE_ROLE_KEY'),
  };

  const appURL = parseURL(config.baseURL, 'E2E_BASE_URL');
  const supabaseURL = parseURL(config.supabaseURL, 'E2E_SUPABASE_URL');

  if (PRODUCTION_APP_HOSTS.has(appURL.hostname.toLowerCase())) {
    throw new Error(
      `Refusing to mutate production application host ${appURL.hostname}.`,
    );
  }

  if (
    supabaseURL.hostname.toLowerCase().startsWith(`${PRODUCTION_SUPABASE_REF}.`)
  ) {
    throw new Error(
      `Refusing to mutate production Supabase project ${PRODUCTION_SUPABASE_REF}.`,
    );
  }

  if (!supabaseURL.hostname.endsWith('.supabase.co')) {
    throw new Error(
      'E2E_SUPABASE_URL must be a dedicated Supabase project URL.',
    );
  }

  return config;
}

export function createStagingAdmin(config: StagingTestConfig): SupabaseClient {
  return createClient(config.supabaseURL, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`Missing required staging test variable ${name}.`);
  return value;
}

function parseURL(value: string, name: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL.`);
  }
}
