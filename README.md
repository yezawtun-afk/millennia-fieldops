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
| Android app | EAS Build (APK, internal distribution) | build profiles in `mobile/eas.json` |
| Database | Supabase | schema + 5 zones + demo data loaded |

Demo accounts and a full end-of-project snapshot live in
[`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md)
([Word copy](docs/PROJECT_REPORT.docx)); the deployment runbook is
[`docs/DEPLOY.md`](docs/DEPLOY.md).

---

## The three parts

### 1. Mobile app (`mobile/`) - for field workers
- Email/password sign-in (Supabase Auth), session kept on the phone.
- Capture **flora & biodiversity**, **soil & water** and **environmental hazard** records.
- Automatic **GPS** (expo-location) and **photos** (expo-camera / expo-image-picker).
- **Offline-first**: records and photos are saved in **SQLite** (expo-sqlite). Finished
  records upload automatically when a connection returns ("Sync now" also available),
  and unfinished ones can be parked as **drafts** and completed later from My Records.
- **My Records** shows each record's review status and the supervisor's comment.
- **Notifications** tell the worker when a record is approved or rejected.

### 2. Web dashboard (`web/`) - for supervisors and admins
- Secure login with role-based access (supervisor vs admin).
- Dashboard statistics: counts by type, status, **zone** and date, plus hazards by severity.
- Records management: search, filter, view full details and photos.
- Interactive **Leaflet map** of the site with records and monitoring zones.
- Review and verification: approve/reject with a comment (sent back to the worker).
- **User management**: create accounts, assign roles, and **deactivate/reactivate** accounts.
- Monitoring **zones** management.
- **Reports and export**: CSV of filtered records and a **PDF hazard summary**.

### 3. Backend (`supabase/`)
- PostgreSQL schema with enums, indexes, Row Level Security and triggers.
- Supabase Storage bucket for photos.
- SQL seed for the 5 monitoring zones and demo data.

---

## Quick start

Full step-by-step instructions are in [`docs/SETUP.md`](docs/SETUP.md). In short:

1. Create a free project at https://supabase.com.
2. In the Supabase **SQL Editor**, run `supabase/setup_all.sql` — a generated
   one-paste bundle of `01_schema` … `06_severity_levels`
   (regenerate it with `tools/bundle-db-sql.ps1`, or run the numbered files
   in order). 07/08 are optional extras documented in `docs/DEPLOY.md`.
3. Copy your project URL and publishable/anon key into `web/.env.local` and
   `mobile/.env` (or into the EAS profile `env` block for cloud builds).
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
