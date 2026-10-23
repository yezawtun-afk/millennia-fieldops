# Setup guide

You need three things: a free Supabase project, and Node.js 20+ on your computer.
Everything below uses **PowerShell** on Windows.

---

## 1. Create the Supabase project

1. Go to https://supabase.com and sign in (GitHub sign-in works).
2. Click **New project**. Give it a name (e.g. `millennia-fieldops`), pick a database
   password and a region, then click **Create new project**. Wait ~2 minutes.
3. Open **Project Settings -> API** and copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)

You will paste these into the web and mobile `.env` files below.

---

## 2. Create the database

In the Supabase dashboard, open **SQL Editor -> New query**. Run these files from the
`supabase/` folder **in this order** (paste the whole file, then click **Run**):

1. `01_schema.sql` - enums, tables, indexes
2. `02_policies.sql` - Row Level Security
3. `03_storage.sql` - the photo bucket and its rules
4. `04_triggers.sql` - auto-create profiles, review notifications
5. `05_seed.sql` - the 5 monitoring zones. Safe to re-run: it upserts on the zone
   name, so running it again moves the five village zones to the coordinates in the file.
6. `06_severity_levels.sql` - **only for a database created before this file existed**:
   rebuilds the hazard severity enum as Low / Medium / Critical. It is safe to run
   anyway (it does nothing if there is no `high` value left).
7. `07_demo_data.sql` - **optional demo data**: ~70 randomised records plus their
   review notifications. It starts by deleting every existing record, so only run it
   when you want a clean demo set. You need at least one signed-up account first.
8. `08_backfill_profiles.sql` - **optional repair** for accounts created before the
   profile trigger existed; it adds the missing `profiles` rows.
9. `09_delete_own_pending.sql` - lets a field worker delete their own record while it
   is still pending (administrators keep full delete).
10. `10_audit_logs.sql` - the admin-only **activity log**: an append-only `audit_logs`
    table, triggers that write an entry when a record or account changes, and a policy
    that lets only administrators read it. Safe to run again.
11. `11_zone_control.sql` - lets **supervisors** add and delete zones (not just admins),
    and lets a zone be deleted even when records point at it: the records are kept and
    simply lose their zone. Safe to run again.

The generated `setup_all.sql` bundles 01-06, 09 and 10 in one paste (the zone rules
from 11 are already part of it); the two optional files are kept separate because they
change data.

> **Already have a live database?** Re-run `01_schema.sql`, `02_policies.sql`,
> `04_triggers.sql`, `09_delete_own_pending.sql`, `10_audit_logs.sql` and
> `11_zone_control.sql`. All six are safe to run again.
> `01` adds the new `profiles` columns (`phone`, `status`, the approval fields) to an
> existing table; `02` makes every policy require an **approved and active** account;
> `04` makes new sign-ups start as **pending** and stores the phone number; `11` gives
> supervisors the zone controls and lets a deleted zone keep its records. Existing
> accounts stay approved, so nobody is locked out.

### Create your first admin

Supabase Auth owns the account list, so signing up is done from the app. To make the
first admin:

1. Run the **mobile** or **web** app and **request an account** with your email
   (this creates the `profiles` row as a `field_worker`, waiting for approval).
2. Back in the SQL Editor run:

   ```sql
   update public.profiles
   set role = 'admin', status = 'approved'
   where email = 'you@example.com';
   ```

3. Sign out and back in. You are now an admin: the **Accounts** page shows a
   **Requests waiting for review** panel, and you can create the other accounts from there.

If you requested the account with only a phone number, match on the number instead:

```sql
update public.profiles
set role = 'admin', status = 'approved'
where phone = '+60123456789';
```

---

## 3. The web dashboard (`web/`)

```powershell
cd "web"
Copy-Item .env.example .env.local    # then open .env.local and paste your URL + anon key
npm install
npm run dev
```

Open http://localhost:3000 and log in.

Other scripts: `npm run build` and `npm start` for production.

---

## 4. The mobile app (`mobile/`)

```powershell
cd "mobile"
Copy-Item .env.example .env          # then open .env and paste your URL + anon key
npm install
npx expo start
```

Then either:
- press **a** to open an Android emulator, **i** for iOS (macOS only), or
- scan the QR code with the **Expo Go** app on a real phone.

The app needs camera, location and media-library permissions for photos and GPS.

> **Trying the app on a real phone?** Expo Go loads the app over your local network by
> default; that is enough to test. Supabase is reached over the internet, so records
> and review flow work from anywhere with a connection.

---

## 5. Windows tip: keep heavy folders out of OneDrive

If this project lives inside a **OneDrive** folder (it usually does), OneDrive tries to
sync `node_modules` (tens of thousands of tiny files) and `web\.next` (hundreds of MB of
cache). That is slow, and it can corrupt or silently revert dependency files - which
breaks the app with confusing errors.

The fix is to keep those folders outside OneDrive and leave a **junction** (a folder
shortcut Windows, Node, Metro and Next.js all treat as a real folder) in their place.
OneDrive skips junctions.

The bundled script handles `mobile\node_modules`, `web\node_modules` and `web\.next`:

```powershell
# from the project root
powershell -ExecutionPolicy Bypass -File tools\onedrive-links.ps1
```

It prints where the files now live:

```
node_modules store: C:\Users\<you>\AppData\Local\node_modules-store
```

Run it after a fresh clone, after copying the project to another PC, or any time one of
those folders reappears as a real folder. It is safe to run repeatedly.

> If a project's `node_modules` is empty after this, run `npm install` inside that
> project folder to download the dependencies into the new location.

---

## 6. Deploy

Step-by-step instructions are in **[DEPLOY.md](DEPLOY.md)**. In short:

- **Web dashboard** -> Vercel (https://vercel.com): import the repo, set the root
  directory to `web`, add the Supabase environment variables.
- **Backend / database / storage** -> already live on Supabase cloud.
- **Mobile app** -> `eas build --platform android --profile preview` produces an
  installable APK (Expo builds it in the cloud, no Android Studio needed). Expo Go
  still works for quick testing.
  The current APK is version **2.1.0**, the first one with the Map tab: the map needs
  `react-native-webview`, which is native code and so cannot arrive as an over-the-air
  update. Phones still on 2.0.0 keep working but show no Map tab until the new APK is
  installed.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid API key` or blank data | The URL/anon key in `.env` is wrong or missing - paste them again. |
| Sign-up says "Email not confirmed" | In Supabase: **Authentication -> Providers -> Email** and turn **Confirm email** off for testing. |
| A new user cannot do anything | New accounts start as `field_worker`. Promote them in the dashboard **Users** page (or with SQL above). |
| Photos upload but do not show | Confirm the `record-photos` bucket exists (step 2.3) and that you are signed in. |
| Mobile app stuck "waiting to upload" | Check the phone has internet. It uploads on its own as soon as the connection is back; press **Sync now** on the Home screen to force it. |
| `Cannot find module 'expo/config-plugins'` or a warning about the **legacy expo-cli** | Your `mobile/package.json` was reverted by OneDrive. Fix: `git checkout -- mobile/package.json mobile/package-lock.json`, then `cd mobile` and `npm install`. Then run `tools\onedrive-links.ps1` (step 5) to stop it happening again. |
