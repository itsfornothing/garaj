# Ada Bajaj deployment (first live copy)

All commands from the repo root. Status markers: ✅ ready now · 🔲 needs your account/login.

## 1. Postgres (API database)  🔲
Pick one — needs ~2 minutes on your side:

**Neon (recommended for demo ping speed):**
   1. Sign up at https://neon.tech (GitHub login works).
   2. Create project `garaj` → copy connection string.
- Or **Railway**: `npm i -g railway && railway login` → new project → Postgres → copy `DATABASE_URL`.
- Or **Supabase**: create project → Settings → Database → connection string (Transaction pooler form).

## 2. Migrate + seed the hosted DB  ✅ once step 1 gives the URL
```bash
DATABASE_URL="postgres://…neon/supabase/railway…" \
  $(brew --prefix)/opt/postgresql@14/bin/psql "$DATABASE_URL" \
  -f db/migrations/0001_init.sql -f db/seeds/demo.sql -f db/seeds/demo_financial.sql
```
(Neon needs `?sslmode=require` in the URL.)

## 3. API on Vercel  ✅ vercel CLI is already logged in (itsfornothing)
```bash
cd app/api && npx vercel deploy --prod
```
Then set the env var (CLI):
```bash
npx vercel env add DATABASE_URL production   # paste the same hosted URL
npx vercel redeploy --prod
```
Keep forever note: cron job (§16 renewal organ) comes later with G4 — the API deployer's free tier suspends idle cron, fine for the demo ping.

## 4. Web on Vercel  ✅ project already linked (halids-projects…/garaj)
```bash
cd app/web && npx vercel deploy --prod
npx vercel env add API_URL production    # paste the API URL from step 3
npx vercel redeploy --prod
```

## 5. Mobile target  🔲
Set `EXPO_PUBLIC_API_URL` to the API URL before `eas build:
```bash
cd app/mobile && EXPO_PUBLIC_API_URL="https://garaj-api.vercel.app" npx eas build --profile development
```
(EAS account required; Expo Go on-device is SDK 57 during the 57→58 transition, so a dev build is mandatory.)

## Order of operations
DB (1-2) → API (3) → Web (4): the home screen's fetches respond via `API_URL`.
Web-only deploy works too — API remains here, plus ` DATABASE_URL` unchanged, but fix will just show "fetch failed" states until step 3 lands.
