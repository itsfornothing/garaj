# GarAj (ጋራዥ)

Amharic-first garage management SaaS for Ethiopian garages and EV service centers.
Built as a public build — every module is meant to be shown live to the customers who'd use it.

## Layout

```
app/
  web/     Next.js (App Router) — public showcase + live demo + dashboard PWA (offline-ready)
  api/     Fastify — all business logic, transactions, payments, cron (no logic in edge functions)
  mobile/  Expo (React Native) — staff app for mobile-first Ethiopian users
db/
  migrations/  PostgreSQL DDL (from docs/garaj-brief-v4.md §4b), applies clean from empty DB
  seeds/       three demo shops (general / tire / EV) with realistic Amharic data
docs/
  garaj-brief-v4.md  full specification (gates, schema, workflows, security acceptance)
```

## Stack

- **PostgreSQL** (works locally or on Supabase later — same DDL)
- **Next.js** public + PWA dashboard | **Fastify** API | **Expo** mobile
- **Chapa** payments (test mode first), Telegram + SMS channels, ETB only, Amharic-first

## Quickstart

```bash
# db
psql -h localhost -p 5432 -d garaj_dev -f db/migrations/0001_init.sql
psql -h localhost -p 5432 -d garaj_dev -f db/seeds/demo.sql

# web
cd app/web && npm install && npm run dev

# api
cd app/api && npm install && npm run dev

# mobile
cd app/mobile && npm install && npx expo start
```

## Lawful-build rules (see docs/garaj-brief-v4.md)

Clean-room: behavioral observation only of competitor software; no code/assets/UI copying.
No competitor claims ("first/only") without a verified ledger. Tax constants are provisional
until reviewed with current MoR guidance + an Ethiopian tax professional.
