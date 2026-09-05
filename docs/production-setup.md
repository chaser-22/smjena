# Production setup

SMJENA requires a Supabase project and a Vercel project. No privileged key is exposed to the browser.

## 1. Create the database

1. Create a Supabase project in a European region.
2. Apply every file in `supabase/migrations` in filename order, or link the Supabase CLI and run `supabase db push`.
3. Confirm that Row Level Security is enabled on every public table.

The migrations create authenticated profiles, worker and employer records, shifts, assignments, trusted crews, ratings, a payment ledger, push subscriptions and a privacy-conscious product-event table. Shift claiming is an atomic database function, so two workers cannot take the same final place. Product events contain IDs, constrained event names and timestamps—not names, emails, free-form text or device fingerprints—and are not readable through the browser API.

## 2. Configure authentication

In Supabase Authentication:

1. Enable Email authentication.
2. Set the production Site URL to the Vercel domain.
3. Add `https://YOUR_DOMAIN/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
4. Configure a production SMTP provider before launch so magic-link delivery does not depend on shared development limits.

## 3. Generate Web Push keys

Run:

```bash
npx web-push generate-vapid-keys
```

Store the public key as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Store the private key only as `VAPID_PRIVATE_KEY`. `VAPID_SUBJECT` should be a monitored `mailto:` address belonging to SMJENA.

## 4. Environment variables

Copy `.env.example` to `.env.local` for local development. Add the same values in Vercel for Production and Preview as appropriate.

- `NEXT_PUBLIC_SITE_URL`: canonical app URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: browser-safe publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key used to dispatch push notifications. Never prefix it with `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: browser-safe Web Push key.
- `VAPID_PRIVATE_KEY`: server-only Web Push key.
- `VAPID_SUBJECT`: contact URI for push delivery.

## 5. Deploy

Import the GitHub repository into Vercel. Keep the detected Next.js build settings and add the environment variables before the first production deployment.

## External production services still requiring contracts

The database contains a real, auditable payment ledger, but moving money requires a licensed payment/payout provider that supports the SMJENA legal entity and Montenegro. Identity and business verification, SMS fallback, invoicing and tax reporting likewise require selected providers and credentials. Those integrations must be completed before enabling financial settlement in production.
