# GarAj deployment (first live demo)

Order matters: DB → API → web. Statuses: ✅ ready now · 🔲 needs your account/login.

## 1. Hosted Postgres 🔲
**Neon (recommended for demo speed):**
   1. Sign up at https://neon.tech (GitHub login works).
   2. Create project `garaj` → copy the **direct** connection string (the one WITHOUT `-pooler`).
- Or **Railway**: `railway login` (CLI installed) → new project → Postgres → copy `DATABASE_URL`.
- Or **Supabase**: project → Settings → Database → URI (session mode, port 5432).

### Pooling rule (important, §4a)
- **API connects DIRECT, not through pg-pooler.** The §4a background cron uses
  `pg_try_advisory_lock`, which is session-bound — pgbouncer's transaction mode
  silently breaks it.
- The web tier never touches Postgres (it only calls the API), so pooler
  advantages don't apply. One long-running API process + `max: 10` pool is plenty.
- Neon URL must contain `?sslmode=require`; the API detects it and enables TLS.

## 2. Migrate + seed the hosted DB ✅ once step 1 gives the URL
```bash
DATABASE_URL="postgres://…" \
  $(brew --prefix)/opt/postgresql@14/bin/psql "$DATABASE_URL" \
  -f db/migrations/0001_init.sql -f db/seeds/demo.sql -f db/seeds/demo_financial.sql
```

## 3. API on Railway (long-running container) 🔲 `railway login` first
Why not Vercel for the API: Fastify calls `app.listen` — a real port on a real
process. Vercel serverless kills idle listeners between requests. Railway also
matches brief §4a (background cron with advisory locks runs fine in a container).

```bash
cd app/api
railway init          # name: garaj-api, team: your default workspace
railway variables set DATABASE_URL="postgres://…DIRECT…?sslmode=require"
railway up            # nixpacks: npm ci → npm start (node --import tsx src/index.ts)
railway domain        # prints the public URL, e.g. https://garaj-api.up.railway.app
```
Sanity check: `curl https://garaj-api.up.railway.app/healthz` → `{"ok":true,…}`.
Railway injects `PORT`; the code already binds `0.0.0.0:$PORT`.

## 4. Web on Vercel ✅ project already linked (halids-projects…/garaj)
```bash
cd app/web && npx vercel deploy --prod
npx vercel env add API_URL production    # paste the Railway API URL from step 3
npx vercel redeploy --prod
```

## 5. Mobile target 🔲
Point the app at the API before an EAS build (Expo Go on-device is SDK 57 during
the 57→58 transition, so a dev build is mandatory anyway):
```bash
cd app/mobile && EXPO_PUBLIC_API_URL="https://garaj-api.up.railway.app" \
  npx eas build --profile development
```

## CORS note
The API reflects any request Origin (`@fastify/cors, origin: true`) — fine while
no cookies exist. When sessions land (G3+), switch to an explicit origin list
via a `CORS_ORIGINS` env var on the API service.
