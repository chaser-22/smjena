# SMJENA

SMJENA is an emergency labor network for hospitality: employers fill a shift in minutes, while trusted local workers earn today without CVs, cover letters, or a long selection process.

The first market is Montenegro. The product is deliberately narrow at launch—waiters, bartenders, kitchen staff, hosts, and other urgent hospitality roles in Budva, Tivat, Kotor, and Podgorica. The same operating model can expand across the Balkans after local liquidity and trust are proven.

## Product focus

SMJENA is not another job board. It optimizes one result: **a verified worker arriving for a clearly priced shift on time**.

- Workers see pay, distance, hours, employer trust, and remaining places before claiming.
- A shift is claimed in one action; there is no application queue.
- Employers can publish in under 30 seconds, notify their trusted crew first, then broadcast publicly.
- Check-in, check-out, ratings, reliability score, instant replacement, and transparent earnings create the trust loop.
- Positive feedback is tied to real progress—accepted work, arrival, completion, money earned, and reputation—not artificial streak pressure or random rewards.

## Interactive MVP

This repository contains a responsive, installable Next.js web app with connected demo state:

- Worker availability, live SOS feed, claim confirmation, active-shift countdown, check-in/out, earnings, score, goals, crews, and completion reward.
- Employer shift creation, templates, crew-first dispatch, fill progress, pay boost, public broadcast, simulated cancellation, replacement activation, ratings, and trusted-worker roster.
- Actions in one role immediately update the other role. Demo state persists in local storage and can be reset from the employer view.
- PWA manifest, production service worker, offline fallback, social metadata, and Vercel-aware canonical metadata.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production check:

```bash
npm run build
npm start
```

## Deploy on Vercel

Import the GitHub repository into Vercel. The framework preset should be detected as Next.js; no custom build or output settings are required. Set `NEXT_PUBLIC_SITE_URL` to the final production URL if a custom domain is used.

## Production integration boundaries

The current experience is a complete interactive product prototype, not yet a multi-user production marketplace. The following boundaries are intentionally isolated behind the state hook and should be replaced next:

1. Authentication and role-specific profiles.
2. Database and real-time shift matching.
3. Geolocation, radius queries, and maps.
4. Push/SMS notifications and background dispatch.
5. Identity/business verification, payment authorization, payouts, invoices, and local compliance.
6. Server-enforced check-in, fraud controls, cancellation rules, moderation, and support tooling.

Recommended product sequence: launch a concierge-backed pilot in one dense coastal area, measure time-to-fill and show-up rate, then automate payments and expand city by city.
