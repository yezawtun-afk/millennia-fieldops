# Millennia FieldOps — Project Report

**Project:** Millennia FieldOps (updated build)
**Type:** Capstone project — field data collection system for Millennia Village quarry restoration
**Repository:** https://github.com/yezawtun-afk/millennia-fieldops-rewrite (branch `main`)
**Report date:** 17 October 2026
**Status:** **Live and demo-ready** — mobile APK built, web dashboard deployed, database seeded.

---

## 1. Executive summary

Millennia FieldOps is a mobile-first field data collection system for monitoring the
rehabilitation of the Millennia Village quarry site. Field workers on the ground record
biodiversity, soil/water and environmental-hazard observations — often with no connectivity.
Supervisors and administrators review, verify and manage those observations from a web
dashboard, and every review decision is notified back to the worker who submitted the record.

The system was built with three parts sharing **one Supabase backend**:

| Part | Folder | Technology | Users |
| --- | --- | --- | --- |
| Mobile field app | `mobile/` | React Native (Expo) + TypeScript + expo-sqlite | Field workers |
| Web admin dashboard | `web/` | Next.js (App Router) + TypeScript + Tailwind CSS | Supervisors & admins |
| Backend & database | `supabase/` | Supabase (PostgreSQL, Auth, Storage, REST) | Shared |

Maps use **Leaflet.js** with **OpenStreetMap** tiles on both platforms.

**End-of-project state (all verified on 17 Oct 2026):**

- **Mobile:** installable Android APK built in the Expo cloud (build `faa3abd0`, profile `preview`,
  internal distribution), package `my.millennia.fieldops`, app version 2.0.0.
- **Web:** deployed at **https://millennia-fieldops-rewrite.vercel.app/** (HTTP 200, login redirect working).
- **Database:** schema, 5 monitoring zones, 3 role-correct profiles, 71 demo records and
  40 worker notifications all present and verified over the production REST API.
- All 21 commits pushed; working tree clean.

---

## 2. Problem and objectives

Quarry rehabilitation monitoring generates field data in exactly the environment where data
capture is hardest: remote terrain, unreliable networks, and multiple data types
(numerical readings, photos, hazard reports) collected by non-technical staff.

The system meets each difficulty directly:

- **No connectivity in the field** → offline-first capture with drafts and an upload outbox.
- **Unstructured manual reports** → three fixed record types (flora & biodiversity,
  soil & water, environmental hazard) with type-specific fields.
- **Risks that are not equal** → three severity levels (low / medium / critical).
- **Records lost or ignored without feedback** → full review workflow with comments and
  automatic notifications back to the submitter.
- **Role confusion** → three roles (field_worker, supervisor, admin) enforced in the database.

---

## 3. Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  Mobile field app       │        │  Web admin dashboard     │
│  Expo / React Native    │        │  Next.js (Vercel)        │
│  ┌───────────────┐      │        │  ┌────────────────────┐  │
│  UI screens     │      │        │  Dashboard / Records / │  │
│  AuthContext    │      │        │  Map / Users / Zones   │  │
│  ┌───────────────┐     │        │  ┌────────────────────┐ │  │
│  expo-sqlite    │◄─►   │        │  Supabase JS (SSR     │ │  │
│  drafts +       │ sync │        │  cookies, /api/export)│ │  │
│  outbox queue   │      │        │  └────────────────────┘ │  │
│  └───────────────┘      │        └───────────┬──────────────┘
└───────────┬─────────────┘                    │
            │           both HTTPS             │
            ▼                                  ▼
   ┌─────────────────────────────────────────────────┐
   │                Supabase                          │
   │  PostgreSQL (RLS) · Auth · Storage · REST API    │
   │  zones · records · notifications · profiles      │
   └─────────────────────────────────────────────────┘
```

Key architectural decision: the **mobile app owns its own local copy of the truth**
(expo-sqlite). A record is written to SQLite first, then synced to Supabase when a
connection exists. This is what makes the app genuinely usable on the ridge with no signal.

---

## 4. Feature inventory

### 4.1 Mobile app (field workers)

- Email/password sign-in and self-registration (Supabase Auth, session persisted on device).
- Field dashboard home screen with role, zone overview and pending stats.
- Capture three record types:

  | Type | Caption |
  | --- | --- |
  | Flora & biodiversity | species / biodiversity plots |
  | Soil & water | soil and water readings |
  | Environmental hazard | hazard with **low / medium / critical** severity |

- Automatic GPS capture (expo-location) and photos (camera or gallery via expo-image-picker).
- **Offline-first:** finished records go to an *outbox* and upload automatically when
  connectivity returns (with a manual "Sync now"); unfinished records park as *drafts*
  and can be completed later from My Records.
- My Records shows each record's review status and the supervisor's comment.
- Notifications inbox when a record is approved or rejected.

### 4.2 Web dashboard (supervisors & admins)

- Secure login with role-based access control on routes and data.
- Dashboard statistics: counts by type, by status, by zone and by date, plus hazards by
  severity, with charts.
- Records management: search, filter, full detail view with photos.
- Interactive Leaflet map of the site: records plotted over the monitoring zones.
- Review and verification: approve / reject with a comment, sent back to the worker.
- Hazard report export to PDF (`/api/export` route using pdfkit).
- User management: create accounts, assign roles, deactivate / reactivate.
- Zone management: create and edit the monitoring zones shown on the map.

### 4.3 Backend (Supabase)

- PostgreSQL schema with 4 domain tables and 1 storage bucket (`03_storage.sql`)
  for record photos.
- Row Level Security on every table; roles enforced in the database, not the UI.
- `handle_new_user()` trigger: every new sign-up gets a `profiles` row automatically.
- Review notification trigger: approving/rejecting a record inserts a notification for
  the submitter.
- Deployed SQL lives in 9 numbered files (`01_schema` … `08_backfill_profiles`,
  `07_demo_data`), plus a generated one-paste bundle `setup_all.sql`
  (see `tools/bundle-db-sql.ps1`).

---

## 5. Data model

| Table | Purpose | Notes |
| --- | --- | --- |
| `profiles` | one row per auth user: full name, email, role, `is_active` | auto-created by trigger; roles: `field_worker`, `supervisor`, `admin` |
| `zones` | the 5 monitoring zones of Millennia Village | name, description, colour, centre lat/lng, radius in metres |
| `records` | the field observations | type, severity, status (`pending`/`approved`/`rejected`), GPS, photos, reviewer + comment |
| `notifications` | per-user messages for review decisions | scoped per user by RLS |
| storage | record photos | private bucket; paths referenced by `records` |

---

## 6. Security model

- **Authentication:** Supabase Auth (email/password). Sessions are persisted on the mobile
  device and in SSR cookies on the web.
- **Authorisation:** Row Level Security policies (02_policies.sql) are the enforcement
  point — a field worker can only see their own records and their own notifications;
  supervisors/admins see everything; deactivated users (`is_active = false`) are locked out.
- **Key hygiene:** the mobile and web apps only carry the *publishable/anon* key, which is
  public by design — RLS is what protects data. The **service role key** is required only
  for server-side admin actions (web "create user" flows) and belongs in server-side env
  vars, never in the mobile app.
- **Offline integrity:** records stored locally in SQLite while offline are uploaded on
  reconnect under the signed-in user's identity; RLS validates every insert server-side.

---

## 7. Deployment

| Component | Infrastructure | Detail |
| --- | --- | --- |
| Mobile APK | Expo EAS Build (cloud) | profile `preview` → APK for internal distribution; profile `production` → AAB for Play publishing |
| Web dashboard | Vercel | root directory `web/`, env vars from `web/.env.local` |
| Database | Supabase cloud | project `bjlyskwoxpkvepbwaxfc`; schema via `setup_all.sql` one-paste |

**Demo accounts (verified working):**

| Account | Password | Role |
| --- | --- | --- |
| `admin@millennia.my` | `Admin1234` | admin |
| `supervisor@millennia.my` | `Super1234` | supervisor |
| `worker@millennia.my` | `Worker1234` | field_worker |

**Live database contents (verified 17 Oct 2026):** 5 zones, 3 role-correct profiles,
71 demo records across all types/severities/statuses (from `07_demo_data.sql`),
40 notifications visible to the worker account.

**Build/Expo details:** project linked as `@yezawtun_afk/millennia-fieldops`
(projectId `51abb8a6-6521-42ba-b27e-a421b6f72b92`), Android keystore generated and
managed in the cloud (build credentials versionCode 1), real app icons and splash
image generated locally via `tools/make-app-icons.ps1` (forest background, mint "M" monogram).

---

## 8. Engineering journey — problems solved

A build of this kind always hits a few hard blockers. The final rounds, in order:

1. **EAS upload died with `EPERM ... symlink` on a OneDrive junction.**
   The project lives inside OneDrive, where `node_modules` / `.next` are replaced with
   junctions (see `tools/onedrive-links.ps1`) to avoid sync corruption. EAS Build's
   upload filter (the `ignore` npm package) matched files but **not directories** with
   trailing-slash-only rules like `web/.next/`, so it tried to copy the junction itself
   and died. Fix: rewrite `.gitignore` folder rules **without trailing slashes**
   (`web/.next`, `node_modules`, …) — verified with a direct Node test against EAS's
   bundled `ignore` implementation. Documented in `.gitignore` comments and in DEPLOY.md.

2. **First APK build failed: resource `drawable/splashscreen_logo` not found** at
   `:app:processReleaseResources`. Root cause: `expo-splash-screen` plugin configured
   without an `image`; the Android side then re-declared a resource from a legacy
   plugin path that no longer existed. Fix: add
   `image: "./assets/splash-icon.png"` + `imageWidth: 200` to the plugin config and
   regenerate the splash asset (monogram on transparent ground). Second build — success.
   (This is also why "expert mode" matters: fetching cloud logs via `eas build:view --json`
   → `logFiles[]` gave the exact Gradle error, and everything else in the log was
   deprecation noise.)

3. **Accounts existed but no data appeared in the DB.** The test users had been created
   **before** the schema (and its auto-create-profile trigger) existed, so they were valid
   auth users with **no `profiles` row** — the apps would log in and then fail everywhere.
   Fix: `08_backfill_profiles.sql`, an idempotent repair insert mirroring the trigger plus
   explicit role promotions; also seeded the empty `zones` table. Then `07_demo_data.sql`
   for a populated demo. **Lesson recorded:** in Supabase projects, auth users and the
   schema trigger must be set up together — the trigger only fires on *new* sign-ups.

4. **"Are the tables really there?" — a 404 that wasn't.** Initial REST probes returned
   HTTP 404 for zones/profiles/records. Node showed the actual PostgREST error body and a
   re-probe returned 200: the SQL had landed in the meantime. Worth noting for future
   diagnostics: **read the raw response body** before trusting a status code — and
   remember RLS can return an empty list for a perfectly loaded table (notifications for
   the admin account read as 0 because scoped rows belong to the worker).

---

## 9. Verification performed (17 Oct 2026)

| Check | Result |
| --- | --- |
| Vercel site reachable, `/` redirects to `/login`, page title correct | ✅ |
| Supabase auth health (`/auth/v1/health`) | ✅ 200 |
| Login for admin / supervisor / worker test accounts | ✅ all three |
| `zones` table — 5 named zones with correct colours/radii | ✅ |
| `profiles` — 3 rows, roles admin / supervisor / field_worker | ✅ |
| `records` — 71 demo rows | ✅ |
| `notifications` — worker sees 40 (per-user RLS) | ✅ |
| Mobile splash/config sanity (`expo config --type prebuild`) | ✅ clean |
| EAS cloud build `faa3abd0` profile `preview` | ✅ FINISHED, APK produced |

**End-to-end demo smoke test (recommended order):** worker signs in on the APK → captures a
record offline (airplane mode) → reconnects → auto-upload → admin approves on the web →
worker receives notification → admin exports hazard PDF.

---

## 10. Known limitations and outstanding items

- **Web admin "create user"** may return 401 if the Vercel `SUPABASE_SERVICE_ROLE_KEY`
  environment variable is still the old/invalid value; if not re-deployed, mobile
  self-registration is the documented fallback. Fix: set the correct service-role secret
  in Vercel project env vars and redeploy.
- **No automated test suite / ESLint for the mobile app** (lint suggested as follow-up).
- **`npm audit` pass** on a branch — post-demo hygiene item, low risk for a demo system.
- **Push notifications** are in-app inbox only (no APNs/FCM push delivery).
- Demo data must be cleared/re-run per demo (`07_demo_data.sql` deletes all records).

---

## 11. Future work

1. Real push notifications to field phones (expo-notifications + FCM).
2. Deployable AAB (profile `production`) and a Play Store listing; or Play-internal test track.
3. Automated tests (web: Playwright login + review happy-path; API: PostgREST contract tests).
4. Offline map tiles for full no-coverage operation.
5. Zone geofence prompts on capture (auto-select nearest zone from GPS).
6. Reporting trends over time (e.g. correlate hazard severity by zone per month).

---

## 12. Repository map

```
millennia-fieldops-rewrite/
├── mobile/                    React Native (Expo) field app
│   ├── app.json               icons, splash (with image), EAS projectId/owner
│   ├── eas.json               build profiles + EXPO_PUBLIC_* Supabase env
│   └── src/
│       ├── screens/           Home, Login, Register, NewRecord, MyRecords,
│       │                      RecordDetails, Notifications
│       ├── context/           AuthContext (session)
│       └── navigation/        RootNavigator
├── web/                       Next.js admin dashboard (deployed to Vercel)
│   └── src/app/
│       ├── (app)/dashboard/   stats + charts
│       ├── (app)/records/     list + [id] detail/review
│       ├── (app)/map/         Leaflet map
│       ├── (app)/zones/       zone management
│       ├── (app)/users/       user management
│       └── api/export/     →  hazard PDF export (pdfkit)
├── supabase/                  01_schema … 07_demo_data, 08_backfill_profiles,
│                              generated setup_all.sql bundle (gitignored)
├── tools/                     make-app-icons.ps1 · bundle-db-sql.ps1 · onedrive-links.ps1
└── docs/                      README · ARCHITECTURE · DATABASE · WORKFLOWS
                               · SETUP · DEPLOY · PROJECT_REPORT (this file)
```

## 13. Documentation index

| Document | What it covers |
| --- | --- |
| `README.md` | overview of the three parts and install prerequisites |
| `docs/ARCHITECTURE.md` | system design and data flow |
| `docs/DATABASE.md` | tables, roles and security |
| `docs/WORKFLOWS.md` | worker and supervisor journeys step by step |
| `docs/SETUP.md` | developer setup (including the SQLite/OneDrive note) |
| `docs/DEPLOY.md` | full deployment guide: EAS build, Vercel, DB seeding, troubleshooting |
| `docs/PROJECT_REPORT.md` | this report |

---

*Prepared by the Millennia FieldOps project — everything above reflects the verified
state of the live system as of 17 October 2026 (21 commits, HEAD `cfeb302`, working
tree clean).*
