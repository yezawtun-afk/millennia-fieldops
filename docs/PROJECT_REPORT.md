# Millennia FieldOps — Project Report

**Project:** Millennia FieldOps (updated build)
**Type:** Capstone project — field data collection system for Millennia Village quarry restoration
**Repository:** https://github.com/yezawtun-afk/millennia-fieldops-rewrite (branch `main`)
**Report date:** 20 October 2026
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

Maps use **Leaflet.js** with **OpenStreetMap** tiles; the web map opens on the village
itself (**2.752616, 101.906463**), with the five monitoring zones drawn around it.

**End-of-project state (all verified on 20 Oct 2026):**

- **Mobile:** installable Android APK built in the Expo cloud (build `b0700c82`, profile
  `preview`, internal distribution), package `my.millennia.fieldops`, app version 2.0.0,
  versionCode 3. The app also supports **over-the-air updates** (expo-updates), so later
  JavaScript changes reach an installed phone through `eas update` without a new APK.
- **Web:** deployed at **https://millennia-fieldops-rewrite.vercel.app/** (HTTP 200, login redirect working).
- **Database:** schema, 5 monitoring zones, 4 profiles (admin, supervisor, two field
  workers), 70 demo records and 40 worker notifications all present and verified over
  the production REST API.
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

- **Email or phone number + password** sign-in (Supabase Auth, session persisted on
  device). Phone numbers need no SMS provider: the number is resolved to an account by the
  web dashboard's `/api/auth/login` route, which verifies the password before returning a
  session.
- **Account requests instead of instant sign-up**: the form collects name, a required
  **phone number** (the sign-in identifier), an optional email address and a password.
  Every request is created as `pending`, which the database treats as "may read nothing";
  an administrator approves or declines it from the web dashboard. The request is created
  server-side, so no email confirmation is needed and phone-first people get in.
- Field dashboard home screen: greeting and role, a strip of approved / in review /
  rejected / draft counts (taken from every record, not just the visible list), one-tap
  capture by record type, the upload queue with **Sync now**, the five most recent
  records with their review status, and the app version / update check.
- Capture three record types:

  | Type | Caption |
  | --- | --- |
  | Flora & biodiversity | species / biodiversity plots |
  | Soil & water | soil and water readings |
  | Environmental hazard | hazard with **low / medium / critical** severity |

- Automatic GPS capture (expo-location) and photos (camera or gallery via expo-image-picker).
- **Zone suggestion from GPS:** once a fix is taken, the form works out which monitoring
  circle the phone is standing in (or the nearest one within 120 m) and offers it as a
  one-tap suggestion. It never selects automatically - a boundary between two zones is
  exactly where a silent guess would be wrong.
- **Repeat last observation:** on an untouched form, the type, zone and the fields that
  define it are carried over from the record submitted last (kept in the phone's own
  database, so it works offline). Title, notes, photos, GPS and the measured values are
  deliberately left blank - they describe one particular sighting, and a stale value is
  worse than an empty field.
- **Offline-first:** records and photos are written to the phone's own SQLite database
  first. When the phone is offline the app says so plainly and disables "Save record"
  (submitting needs the server), directing the worker to **Save as draft** instead; the
  draft is reopened from My Records and submitted once there is signal. Anything already
  queued uploads automatically when connectivity returns (with a manual "Sync now"), and
  the signed-in profile is cached on the device so a cold start offline still works.
  Unfinished records park as *drafts* and can be completed later.
- My Records shows each record's review status and the supervisor's comment.
- The worker can **delete their own record while it is still pending** (before review),
  and cancel anything still queued for upload. Once a supervisor has reviewed a record
  it becomes part of the site history and only an administrator can remove it.
- Notifications inbox when a record is approved or rejected, **announced on the phone
  within about 20 seconds while the app is open** (the notification tab also carries an
  unread badge).
- **In-app updates** (expo-updates / EAS Update): the Home screen's App card shows the
  installed version and a manual check, and JavaScript improvements can be published to
  installed phones without a new APK.

### 4.2 Web dashboard (supervisors & admins)

- Secure login with role-based access control on routes and data. Deactivated, pending and
  declined accounts are refused by the database as well as by the app. The login field
  accepts an **email address or a phone number** with the same password; neither uses a
  one-time code.
- Dashboard overview: exact totals for records, records waiting review, approved, rejected
  and active hazards; submissions per week across the last eight weeks; a by-zone table
  split by record type; a review queue (oldest first); hazard counts by severity; and the
  five most recent submissions. Charts are drawn directly in the page - one hue per chart,
  no charting library.
- Records management: search (title, species, notes), filter by type, status, severity and
  zone, and a detail view with signed photo links.
- Interactive Leaflet map of the site: records plotted over the monitoring zones.
- Review and verification: approve / reject with a comment, sent back to the worker.
- **Delete records** (administrators): permanently remove a record from the list or the
  record page, with a two-click confirmation; its photos and notifications are removed
  with it.
- Hazard report export to PDF (`/api/export` route using pdfkit).
- User management: a **Requests waiting for review** panel (approve / decline), account
  creation, role assignment, **deactivate / reactivate**, and permanent **delete** (never
  for yourself or the last administrator, and refused when the account already owns field
  records - deactivate those instead).
- Zone management: create and edit the monitoring zones shown on the map.

### 4.3 Backend (Supabase)

- PostgreSQL schema with 4 domain tables and 1 storage bucket (`03_storage.sql`)
  for record photos.
- Row Level Security on every table; roles enforced in the database, not the UI.
- `handle_new_user()` trigger: every new sign-up gets a `profiles` row automatically,
  as `field_worker` with `status = 'pending'` and the phone number from the sign-up
  metadata. Accounts created by an administrator are approved straight away.
- Review notification trigger: approving/rejecting a record inserts a notification for
  the submitter.
- Deployed SQL lives in 9 numbered files (`01_schema` through
  `09_delete_own_pending`; `07_demo_data` and `08_backfill_profiles` are
  optional/repair scripts), together with a generated one-paste bundle `setup_all.sql`
  (see `tools/bundle-db-sql.ps1`).

---

## 5. Data model

| Table | Purpose | Notes |
| --- | --- | --- |
| `profiles` | one row per auth user: full name, email, optional `phone`, role, `is_active`, approval `status` (`pending`/`approved`/`declined`) + decision fields | auto-created by trigger as pending; roles: `field_worker`, `supervisor`, `admin` |
| `zones` | the 5 monitoring zones of Millennia Village | name, description, colour, centre lat/lng, radius in metres |
| `records` | the field observations | type, severity, status (`pending`/`approved`/`rejected`), GPS, photos, reviewer + comment |
| `notifications` | per-user messages for review decisions | scoped per user by RLS |
| storage | record photos | private bucket; paths referenced by `records` |

---

## 6. Security model

- **Authentication:** Supabase Auth (email + password). A phone number is a profile
  attribute, not a Supabase identity: `/api/auth/login` (web, server-side service role)
  normalises the number, verifies the password, then returns a normal session to the app.
  The email behind the number is never returned, and unknown numbers and wrong passwords
  get the same answer. Sessions are persisted on the mobile device and in SSR cookies on
  the web.
- **Authorisation:** Row Level Security policies (02_policies.sql) are the enforcement
  point — every **approved and active** user may read the site's records and zones, while a
  field worker can only delete their own record and only while it is pending, and only
  sees their own notifications. Supervisors/admins review everything; deactivated users
  (`is_active = false`), pending requests and declined requests are refused by every policy
  (a pending person can still read their own profile row, which is how the app explains the
  wait).
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
| Mobile over-the-air updates | EAS Update (expo-updates) | build channels `preview` / `production`; `eas update --channel preview` publishes JavaScript changes to installed phones, which pick them up on next launch or via **Home → App → Check for update**. The version number (`2.0.0`) is the native runtime and does not change when an update is published. Native changes still require a new build. The Supabase values are stored as EAS *environment variables* for `preview` and `production` (not only in `mobile/.env`), so published bundles carry the backend config. |
| Web dashboard | Vercel | root directory `web/`, env vars from `web/.env.local` |
| Database | Supabase cloud | project `bjlyskwoxpkvepbwaxfc`; schema via `setup_all.sql` one-paste |

**Demo accounts (verified working):**

| Account | Password | Role |
| --- | --- | --- |
| `admin@millennia.my` | `Admin1234` | admin |
| `supervisor@millennia.my` | `Super1234` | supervisor |
| `worker@millennia.my` | `Worker1234` | field_worker |

**Live database contents (verified 20 Oct 2026):** 5 zones laid around Millennia Village
(2.752616, 101.906463), 4 profiles (admin, supervisor, two field workers), 70 demo records
across all types/severities/statuses (from `07_demo_data.sql`), and 40 notifications
visible to the worker account. Every record sits inside its zone's radius.

**Build/Expo details:** project linked as `@yezawtun_afk/millennia-fieldops`
(projectId `51abb8a6-6521-42ba-b27e-a421b6f72b92`), Android keystore generated and
managed in the cloud (build credentials versionCode 1), app icons and splash image
generated locally via `tools/make-app-icons.ps1` (the "Millennia / Village" wordmark in
cream on forest green, `#1D2F24`).

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

5. **An over-the-air update that would have broken the app — caught before shipping.**
   With `expo-updates` in place, the first `eas update` published a bundle that had been
   exported **without** `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the
   values lived in `mobile/.env` (gitignored), while `eas update` only injects
   `EXPO_PUBLIC_*` from the **EAS environment** named by `--environment`. The bundle was
   therefore code that could not reach the backend at all. Detection method, which is the
   reusable part: fetch the manifest the way an installed app does
   (`u.expo.dev/<projectId>?channel-name=preview&runtime-version=2.0.0&platform=android`
   with `expo-protocol-version: 1`), read the **multipart** body's `manifest` part for
   `launchAsset.url` and its `extensions` part for the signed `assetRequestHeaders` the
   private CDN demands (403 without them, ×3 confirmed), download the bundle and grep it
   for the Supabase host. Fix: `eas env:set … --environment preview --environment
   production`, then republish. Remedy in the meantime:
   `eas update:rollback <groupId>` (with no prior update it republishes "roll back to the
   embedded update", so phones keep the bundle inside their APK). The same byte-level
   check was then run against the **APK** itself (unzip `assets/index.android.bundle`,
   search for the host) — both paths now verified, and the check is repeatable
   (`verify-ota.js`, `verify-apk.ps1` in the working notes).

---

## 9. Verification performed (17–20 Oct 2026)

| Check | Result |
| --- | --- |
| Vercel site reachable, `/` redirects to `/login`, page title correct | ✅ |
| Supabase auth health (`/auth/v1/health`) | ✅ 200 |
| Login for admin / supervisor / worker test accounts | ✅ all three |
| `zones` table — 5 named zones around the village, colours/radii intact | ✅ |
| Every record inside its own zone's radius, none further than 1.5 km from the site | ✅ 70 of 70 |
| `profiles` — 4 rows, roles admin / supervisor / field_worker | ✅ |
| `records` — 70 demo rows (14 per zone) | ✅ |
| `notifications` — worker sees 40 (per-user RLS) | ✅ |
| Mobile splash/config sanity (`expo config --type prebuild`) | ✅ clean |
| Mobile TypeScript check after the offline/updates/notification work (`tsc --noEmit`) | ✅ clean |
| Web TypeScript check and production build after the restyle | ✅ clean, 10 routes |
| EAS cloud build `b0700c82` profile `preview` | ✅ FINISHED, versionCode 3, APK produced |
| Published APK contains the Supabase config (byte search of the bundle) | ✅ host + key present |
| Over-the-air update published to channel `preview`, runtime `2.0.0` | ✅ manifest served, bundle contains the Supabase config |
| First OTA attempt without EAS environment variables | ❌ caught and rolled back before any phone could apply it |

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
- **Push notifications** are not true background push: the app announces a review within
  about 20 seconds *while it is running*, and anything that happened while the app was
  closed appears on the next launch. Real background delivery needs a Firebase project,
  an Expo push token and a server-side sender (see future work).
- **Phone-first accounts have no self-service password reset** (reset mail needs a real
  address). An administrator can set a new password from the Supabase dashboard; adding a
  reset action to the Accounts page is listed under future work.
- Demo data must be cleared/re-run per demo (`07_demo_data.sql` deletes all records).

---

## 11. Future work

1. Real background push notifications (Firebase project + Expo push token + a
   server-side sender such as a Supabase Edge Function on the review trigger).
2. Deployable AAB (profile `production`) and a Play Store listing; or Play-internal test track.
3. Automated tests (web: Playwright login + review happy-path; API: PostgREST contract tests).
4. Offline map tiles for full no-coverage operation.
5. Zone awareness while walking: the capture form now suggests a zone from GPS, but the
   map does not yet highlight which zone the phone is currently inside.
6. Reporting trends over time (e.g. correlate hazard severity by zone per month).
7. iOS TestFlight distribution - the code is already cross-platform and the iOS
   permission strings are configured in `app.json`; the only requirement is the paid
   Apple Developer Program (US$99/yr). The full runbook is in `docs/DEPLOY.md` ("iOS
   (optional)").
8. Admin-initiated password reset for phone-only accounts (the Accounts page already has
   the service-role plumbing).

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
│       ├── lib/               api · sqlite (drafts/outbox) · sync · network ·
│       │                      notifications (watcher) · updates (OTA)
│       ├── context/           AuthContext (session + cached profile)
│       └── navigation/        RootNavigator
├── web/                       Next.js admin dashboard (deployed to Vercel)
│   └── src/app/
│       ├── (app)/dashboard/   stats + charts
│       ├── (app)/records/     list + [id] detail/review
│       ├── (app)/map/         Leaflet map
│       ├── (app)/zones/       zone management
│       ├── (app)/users/       user management
│       └── api/export/     →  hazard PDF export (pdfkit)
├── supabase/                  01_schema … 09_delete_own_pending, 07_demo_data,
│                              08_backfill_profiles, generated setup_all.sql (gitignored)
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
state of the live system as of 20 October 2026 (working tree clean, everything pushed;
the restyle and review fixes are in commit `540914d`, the re-siting in `d89d05c`).*
