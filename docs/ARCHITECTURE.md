# Architecture

Millennia FieldOps is one backend shared by two front ends.

```text
                         ┌──────────────────────────────┐
                         │        Supabase (cloud)      │
                         │  ┌────────────────────────┐  │
   Field worker          │  │ PostgreSQL + RLS       │  │        Supervisor / Admin
 ┌───────────────┐       │  ├────────────────────────┤  │       ┌───────────────────┐
 │ Expo mobile   │ HTTPS │  │ Supabase Auth (JWT)    │  │ HTTPS │ Next.js dashboard │
 │ app (RN + TS) │◄─────►│  ├────────────────────────┤  │◄─────►│ (App Router + TS) │
 ├───────────────┤       │  │ Supabase Storage       │  │       ├───────────────────┤
 │ expo-sqlite   │       │  │ (record photos)        │  │       │ Server + client   │
 │ offline queue │       │  ├────────────────────────┤  │       │ components        │
 └───────────────┘       │  │ REST API (PostgREST)   │  │       └───────────────────┘
                         │  └────────────────────────┘  │
                         └──────────────────────────────┘
```

## Why this stack (matches the proposal)

| Proposal requirement | How it is met |
| --- | --- |
| Mobile app with camera, GPS, file storage | **Expo (React Native)** using `expo-camera`, `expo-image-picker`, `expo-location`, `expo-file-system` |
| Offline storage on the phone | **SQLite** via `expo-sqlite` (records + photo files) |
| Web dashboard | **Next.js** (App Router) with **Tailwind CSS** |
| One shared backend | **Supabase**: PostgreSQL, Auth, Storage, REST API |
| Role-based access | Postgres **Row Level Security** + a `profiles.role` column |
| Mapping / GIS | **Leaflet.js** + **OpenStreetMap** tiles |
| Language | **TypeScript** on both front ends; **SQL** for the backend |

## Data flow

1. A field worker signs in on the mobile app. Supabase Auth returns a JWT that is
   stored on the device (AsyncStorage) so the session survives app restarts.
2. New records are written to the **local SQLite database** first, with a
   `pending_upload` status. Photos are copied into the app's file system.
3. When the device has a connection, the **sync engine** uploads photo files to
   Supabase Storage, then inserts the record row. On success the local row is removed.
4. Supervisors/admins open the **web dashboard**, which reads the same rows (RLS allows
   every signed-in user to read). A reviewer approves or rejects, which fires a
   database trigger that inserts a **notification** row for the worker.
5. The mobile app shows the notification and the supervisor's comment.

## Security model

- Authentication: Supabase Auth (email + password).
- Authorisation: every table has Row Level Security. A helper function
  `public.current_role()` reads the caller's role from `profiles`.
  - Reading records: any signed-in user.
  - Inserting a record: only as yourself (`submitted_by = auth.uid()`).
  - Approving/rejecting: only `supervisor` or `admin`.
  - Deleting records, managing users and zones: only `admin`.
  - Notifications: only your own.
- Storage: the `record-photos` bucket is private. A signed-in user may read any photo,
  upload into their own folder, and delete their own photos (admins may delete any).

## Offline-first details (mobile)

- `src/lib/sqlite.ts` opens an expo-sqlite database with two tables:
  `outbox` (the record payload + status) and `outbox_photos` (local file URIs).
- `src/lib/sync.ts` loops the outbox in order, uploading photos then the record,
  with an increasing back-off on network errors and a hard stop on `pending` items
  that the server refused (those wait for the user to fix them).
- The Home and My Records screens show a "waiting to upload" banner with **Sync now**.
