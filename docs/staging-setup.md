# SMJENA staging and acceptance testing

SMJENA staging must use a separate Supabase project and a Vercel preview deployment. The acceptance suite creates clearly labelled `@smjena.test` accounts, a real shift and a real assignment, then removes them. It must never run against production.

## Safety boundary

The mutation suite stops before creating data unless all of the following are true:

- `E2E_ALLOW_STAGING_MUTATIONS` is exactly `true`.
- `E2E_BASE_URL` is not `smjena.vercel.app`, `smjena.me` or `www.smjena.me`.
- `E2E_SUPABASE_URL` is not the production project `deshfuafmxzdfvpobyyp`.
- All staging Supabase credentials are present.

Do not weaken or bypass these checks. Public Playwright checks do not submit forms or create data.

## 1. Create the isolated Supabase project

Create `smjena-staging` in `eu-west-1`, then apply every migration in `supabase/migrations` in filename order. Keep Data API enabled, automatic exposure of new tables disabled, and automatic RLS enabled.

Use only the staging project values for the staging environments:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_STAGING_VALUE
SUPABASE_SERVICE_ROLE_KEY=sb_secret_STAGING_VALUE
```

The secret key is server-only. Never put it in a `NEXT_PUBLIC_` variable, a committed file, a test report or a message.

In Supabase Authentication URL Configuration, set the preview URL as the Site URL and allow its exact callback:

```text
https://YOUR-STAGING-VERCEL-URL/auth/callback
```

## 2. Create a Vercel staging deployment

Create a `staging` Git branch only after Vercel Preview environment variables point to the staging Supabase project. A preview deployment that still points to production can contaminate production even when its URL says “preview.”

Set these values for Preview only:

```ini
NEXT_PUBLIC_SITE_URL=https://YOUR-STAGING-VERCEL-URL
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_STAGING_VALUE
SUPABASE_SERVICE_ROLE_KEY=sb_secret_STAGING_VALUE
NEXT_PUBLIC_VAPID_PUBLIC_KEY=YOUR_STAGING_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_STAGING_VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:YOUR_MONITORED_EMAIL
```

Keep the Production environment unchanged.

## 3. Run public checks

Install Chromium once:

```text
npx playwright install chromium
```

Test the local app:

```text
npm run test:e2e
```

Or safely inspect a deployed URL without submitting data:

```text
E2E_BASE_URL=https://smjena.vercel.app npm run test:e2e
```

## 4. Run the staging marketplace acceptance test

Set these as temporary shell variables or GitHub `staging` environment secrets. Do not put the secret values in `.env.example` or commit them.

```ini
E2E_ALLOW_STAGING_MUTATIONS=true
E2E_BASE_URL=https://YOUR-STAGING-VERCEL-URL
E2E_SUPABASE_URL=https://YOUR_STAGING_REF.supabase.co
E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_STAGING_VALUE
E2E_SUPABASE_SERVICE_ROLE_KEY=sb_secret_STAGING_VALUE
```

Then run:

```text
npm run test:e2e:staging
```

The test verifies the highest-risk cross-role story:

1. Creates isolated worker and employer fixtures.
2. Signs both roles into separate browser contexts.
3. Adds private contact phones through the interface.
4. Publishes a future shift through the employer interface.
5. Enables worker availability and claims the shift through the worker interface.
6. Confirms reciprocal phone visibility only after the match.
7. Confirms no payment-ledger row or paid state is invented by claiming.
8. Cancels through the worker interface and verifies that the position reopens and contact access expires.
9. Deletes all fixture data even when the test fails.

The GitHub workflow is manual and uses a protected `staging` environment so acceptance tests cannot mutate data on every pull request.

## Genuine manual checks that remain

- Email delivery: the automated suite creates staging-only users directly and does not prove that the SMTP provider delivered a magic link. Test real email delivery with controlled staging inboxes before release.
- Web Push delivery: permission prompts and actual delivery vary by browser and operating system. Test a real staging notification on at least Android Chrome and desktop Chrome/Safari.
- Payments: the current ledger records obligations only. The suite does not and must not assert that bank money moved.
