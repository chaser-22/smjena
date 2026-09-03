# SMJENA

SMJENA is an emergency labor marketplace for hospitality built on a production database and authorization model. Employers publish a clearly priced shift, available workers claim it without an application queue, and the system records attendance, completion, reputation and money owed.

The first market is Montenegro. The initial operational categories are waiters, bartenders, kitchen staff, cleaners and hotel staff.

## What is implemented

- Passwordless Supabase authentication with permanent worker and employer roles.
- Postgres source of truth; no local-only marketplace state.
- Row Level Security, explicit grants and server-side authorization for every mutation.
- Atomic shift claiming that prevents overbooking and blocks multiple active shifts per worker.
- Employer posting, crew-first access, public broadcast, pay increases and replacement requests.
- Worker availability, claiming, check-in, check-out and an auditable EUR payment ledger entry.
- Completed-shift ratings and trusted-worker crews.
- Real database-derived earnings and operational metrics; unknown metrics display as unknown rather than fabricated values.
- Supabase Realtime dashboard refresh.
- VAPID-secured Web Push subscription storage and targeted shift notifications.
- Installable PWA, offline fallback, security headers and Vercel deployment support.

## Security model

The publishable Supabase key is safe for the browser because database access is restricted by grants and Row Level Security. The service-role key is used only in server code for notification dispatch. Sensitive operations authenticate the user again, validate untrusted input and rely on database functions for concurrency-sensitive state changes.

## Run locally

Follow [the production setup guide](docs/production-setup.md), then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Quality checks:

```bash
npm run lint
npm run build
npm audit --omit=dev
```

## Production boundaries

Authentication, authorization, marketplace data, realtime updates, Web Push and the transaction ledger are implemented. Actual payouts, identity verification, business verification, SMS fallback, invoices and tax reporting require external providers and legal accounts. See [Production setup](docs/production-setup.md).
