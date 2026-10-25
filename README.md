# Millennia FieldOps (updated build)

A field data collection system for Millennia Village, built **exactly to the project
proposal**. It has three parts that share one Supabase backend:

| Part | Folder | Technology | Who uses it |
| --- | --- | --- | --- |
| Mobile field app | `mobile/` | React Native (Expo) + TypeScript + expo-sqlite | Field workers |
| Web admin dashboard | `web/` | Next.js (App Router) + TypeScript + Tailwind CSS | Supervisors & admins |
| Backend & database | `supabase/` | Supabase (PostgreSQL, Auth, Storage, REST API) | Shared |

Maps use **Leaflet.js** with **OpenStreetMap** tiles.

> This folder is a fresh build created to match the proposal's stated stack
> (React Native/Expo, Next.js, Supabase, SQLite, TypeScript). The earlier
> `Millennia Village3_openai` folder used a different stack (PWA + Express + Prisma)
> and is left untouched.

---

## Status: deployed and demo-ready (Oct 2026)

| Component | Where | Notes |
| --- | --- | --- |
| Web dashboard | https://millennia-fieldops-rewrite.vercel.app/ | Next.js on Vercel |
| Android app | EAS Build (APK, internal distribution) | build profiles in `mobile/eas.json`; the newest APK is linked on the Expo build page, and later JavaScript changes arrive over the air (`eas update`) |
| Database | Supabase | schema + 5 zones + demo data loaded |

Demo accounts and a full end-of-project snapshot live in
[`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md)
([Word copy](docs/PROJECT_REPORT.docx)); the deployment runbook is
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## The three parts

### 1. Mobile app (`mobile/`) - for field workers
- **Email or phone number + password** sign-in (Supabase Auth), session kept on the phone.
  The profile is cached too, so the app still knows who you are when it starts with no
  connection. Phone sign-in needs no SMS: the number is resolved by the web dashboard's
  `/api/auth/login` route (see the note in `docs/DEPLOY.md`).
- **Request an account** instead of instant sign-up: the form asks for name, **phone number**
  (required - it is how you sign in), an optional email address and a password. An
  administrator approves or declines the request in the web dashboard; until then the
  account cannot read any data. Phone-first accounts get a private placeholder address
  internally, because Supabase Auth needs one; the dashboards never show it.
- Capture **flora & biodiversity**, **soil & water** and **environmental hazard** records.
- **Three languages**: English (default), Bahasa Melayu and 简体中文. The globe button in the
  header switches instantly and the choice is remembered on the phone.
- Automatic **GPS** (expo-location) and **photos** (expo-camera / expo-image-picker).
  Photos are **compressed on the phone before upload** (long edge 1600 px, quality 0.6,
  a second pass for very large files), so uploads use less data and storage.
- **Offline-first**: records and photos are saved in **SQLite** (expo-sqlite). Offline, the
  app says so and asks you to use **Save as draft** (the "Save record" button needs a
  connection); a draft is opened from My Records and submitted later. Records already
  queued upload automatically when a connection returns ("Sync now" also available).
- A **sync badge** on Home shows the truth at a glance: 🟢 Synced, 🟡 Syncing… (with the
  number left), 🔴 Offline (number queued), plus an amber **Needs retry** state and a
  relative "last upload" time.
- **Supervisors and admins can review records on the phone**: the Review tab lists pending
  records oldest first and opens a full record with Approve / Reject (a comment is required
  to reject). Field workers never see the tab.
- **My Records** shows each record's review status and the supervisor's comment -
  and lets the worker **delete their own record while it is still pending**
  (also useful: cancel anything still sitting in the upload queue).
- **Site map for every role**: the Map tab plots every record that has GPS, coloured by
  type, over the monitoring zones - the same Leaflet/OpenStreetMap picture as the
  website, inside a WebView. Tap a pin to open the record, filter by type, or switch to
  your own records only.
- **Notifications** tell the worker when a record is approved or rejected - announced on the
  phone within ~20 seconds while the app is open, with an unread badge on the tab.
- **Updates from inside the app**: the Home screen has an "App" card
  (expo-updates / EAS Update), so JavaScript improvements can be published without
  reinstalling the APK. It shows whether the app is running the bundle from the APK or a
  downloaded update, and the app offers a restart when a new one is waiting. (The build
  that introduced this had to be installed once - after that, updates are over the air.)
  A published update never changes the version number: `2.1.0` identifies the native
  build, not the JavaScript running inside it.
  The Supabase values must exist as EAS environment variables for `preview`/`production`
  before publishing, or the update ships without a backend URL; see `docs/DEPLOY.md`.

### 2. Web dashboard (`web/`) - for supervisors and admins
- Secure login with **email or phone number** and a password, role-based access
  (supervisor vs admin). Deactivated, pending and declined accounts are refused by the
  database as well as by the app.
- Dashboard statistics: counts by type, status, **zone** and date, plus hazards by severity.
- Records management: search, filter, view full details and photos.
- Interactive **Leaflet map** of the site, opening on Millennia Village (2.752616,
  101.906463) with records plotted over the monitoring zones.
- **Add a monitoring zone straight from the map** (supervisors and administrators):
  press *Add zone*, click the centre, drag the radius slider with a live preview, type a
  name, pick a colour and save - the circle appears without leaving the map. Clicking a
  zone on the map deletes it; its records are kept and simply lose the zone.
- Review and verification: approve/reject with a comment (sent back to the worker).
- **Live pages**: every screen re-fetches its data in place every ten seconds (the green
  "Live" label in the header), so a record sent from the phone appears without pressing
  refresh - and anything half-typed, such as a review comment, is kept.
- **Notification bell** in the header: a red dot for field workers when a decision on one
  of their records is unread, and for supervisors/admins when records have arrived since
  they last opened the bell. The panel lists the news and can mark it all read.
- **User management**: review account requests (approve / decline), create accounts, assign
  roles, **deactivate/reactivate**, and **delete** an account permanently (refused for
  anyone who already submitted field records - deactivate those instead).
- **Delete records**: administrators can remove a record permanently (bin icon in the
  records list or on the record page); its photos and notifications go with it.
- Monitoring **zones**: draw a new one on the map; delete one from its popup (its records
  keep their details and become unzoned).
- **Reports and export**: CSV of filtered records and a **PDF hazard summary**.
- **Three languages** (English, Bahasa Melayu, 简体中文) with a language picker in the
  header; the choice is stored in a cookie.
- **Activity log** (administrators only): an append-only audit trail of record and account
  changes, e.g. "Supervisor Sarah approved Record #104" or "Admin Alex deleted User #12".

### 3. Backend (`supabase/`)
- PostgreSQL schema with enums, indexes, Row Level Security and triggers.
- Supabase Storage bucket for photos.
- SQL seed for the 5 monitoring zones and demo data.

---

## Quick start

Full step-by-step instructions are in [`docs/SETUP.md`](docs/SETUP.md). In short:

1. Create a free project at https://supabase.com.
2. In the Supabase **SQL Editor**, run `supabase/setup_all.sql` — a generated
   one-paste bundle of the numbered setup files, `01_schema` through
   `12_job_completion` (regenerate it with `tools/bundle-db-sql.ps1`, or
   paste the numbered files in order). `07_demo_data` and `08_backfill_profiles`
   are left out because they change data; `11_zone_control` is superseded and
   repeats rules already in `01` and `02`. The two data-changing extras are
   documented in `docs/DEPLOY.md`. Upgrading a live database instead? Run `02_policies.sql`,
   `09_delete_own_pending.sql`, `10_audit_logs.sql` and `12_job_completion.sql`
   again — all are safe to re-run.
3. Copy your project URL and publishable/anon key into `web/.env.local` and
   `mobile/.env`. For cloud builds **and over-the-air updates**, also store them on
   EAS (the `env` block in `mobile/eas.json` covers builds; `eas env:set` covers
   `eas update` - see `docs/DEPLOY.md`).
4. `cd web && npm install && npm run dev` for the dashboard.
5. `cd mobile && npm install && npx expo start` for the mobile app.

To ship it: `docs/DEPLOY.md` covers the EAS cloud APK build (including the
`web/.next`-ignore gotcha), Vercel deployment with root directory `web`, and
database seeding / admin promotion / troubleshooting.

Architecture and the database diagram are in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATABASE.md`](docs/DATABASE.md)
and [`docs/WORKFLOWS.md`](docs/WORKFLOWS.md).

---

## Project layout

```text
Millennia FieldOps updated 5/
  README.md
  docs/                     Architecture, database, workflows, setup, deploy guide,
                            project report (PROJECT_REPORT.md / .docx)
  supabase/                 SQL: schema, policies, storage, triggers, seed,
                            demo data, profile backfill; generated setup_all.sql
  tools/                    make-app-icons.ps1, bundle-db-sql.ps1, onedrive-links.ps1
  web/                      Next.js dashboard (TypeScript + Tailwind)
    src/app/                Pages (App Router)
    src/components/         Sidebar, badges, map, forms
    src/lib/                Supabase clients, types, format, CSV/PDF
  mobile/                   Expo React Native app (TypeScript)
    src/screens/            One file per screen
    src/lib/                Supabase client, SQLite queue, sync, GPS, photos
    src/context/            Auth and toast providers
```
