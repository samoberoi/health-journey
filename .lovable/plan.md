# Restore ByeByeDiabetes from GitHub

Your source at `samoberoi/byebyediabetes-6bc84f7f` is a large, complete app:
- **270+ source files** across ~15 feature areas (admin, coach, partner, patient, onboarding, diet, fasting, exercises, lab, chat, payments…)
- **181 Supabase migrations** (full schema, RLS, functions, triggers)
- **17 edge functions** (Razorpay, Thyrocare, food AI, translations, notifications, seed scripts…)
- Auth uses phone-as-email trick with fixed OTP `111111` — matches your instruction.

The source stack is **Vite + React + React Router + Supabase**. The current Lovable scaffold is TanStack Start (different framework). Since your source is already a working Vite/RRD app, I'll restore it as-is rather than port hundreds of files to a new router.

## Approach

### Phase 1 — Replace scaffold with source (single turn)
1. Wipe the TanStack scaffold (`src/`, `src/routes/`, `src/router.tsx`, TS/Vite config, etc.).
2. Copy the entire GitHub repo into the project: `src/`, `public/`, `index.html`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `components.json`, `postcss.config.js`, `package.json`.
3. Install dependencies via bun.

### Phase 2 — Enable Lovable Cloud and rebuild backend
1. Enable Lovable Cloud (fresh Supabase project). The `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are auto-injected — the source's `client.ts` already reads them.
2. Concatenate all 181 migrations in timestamp order and apply as one big migration (order-preserving). If a specific migration fails, I'll fix it inline and continue.
3. Copy `supabase/functions/*` into the project so each edge function deploys. Config values (`verify_jwt = false` for the two webhooks) are re-applied.
4. Add stubs for third-party secrets (`RAZORPAY_*`, `THYROCARE_*`, translation provider, etc.) — actual values you can fill later; app runs without them for non-payment flows.

### Phase 3 — Seed admin & baseline data
1. Invoke the existing `seed-admin-account` edge function with phone `9999999999`. Auth is `9999999999@bbd.app` / password `bbd_9999999999_secure`, OTP hardcoded to `111111` in `Auth.tsx`.
2. Optionally invoke `seed-coach-account` and `seed-test-user` so you can log in as each role.
3. Confirm login flow end-to-end on the preview.

### Phase 4 — Verify
- Build passes.
- Preview loads splash → auth.
- Login as `9999999999` + OTP `111111` lands on admin dashboard.
- Spot-check one query per role dashboard.

## Technical notes
- 181 migrations dated 2026-04 through 2026-05 — they were authored ahead in time; Postgres doesn't care, so they apply cleanly.
- Edge functions that hit third-party APIs (Razorpay, Thyrocare) will error until you add the corresponding secrets. Non-payment flows work without them.
- No code changes to the app itself — this is a faithful restore. Any tweaks/features come after.
- Capacitor iOS bits (`capacitor.config.ts`, `resources/`, `remotion/`) I'll copy but not build — web-only for now.

## What I need from you before starting
Just approval to proceed. On approval, I'll execute all four phases in sequence. Expect several long tool calls (git clone into project, `bun install`, one big migration, function deploys, seed invocations).

## Risks / open items
- If a migration references a Supabase-managed extension not enabled in the fresh project, I'll enable it (`pgcrypto`, `pg_net`, `pg_cron`, etc.) before re-running.
- If the seed edge function assumes a specific admin phone other than `9999999999`, I'll patch it to use yours.
- Third-party secrets: I won't guess values — placeholders only, you provide real keys when ready.
