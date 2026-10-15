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
5. `05_seed.sql` - the 5 monitoring zones

### Create your first admin

Supabase Auth owns the account list, so signing up is done from the app. To make the
first admin:

1. Run the **mobile** or **web** app and **sign up** with your email
   (this creates the `profiles` row as a `field_worker`).
2. Back in the SQL Editor run:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

3. Sign out and back in. You are now an admin and can invite others from the dashboard.

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

## 5. Deploy

- **Web dashboard** -> Vercel (https://vercel.com): import the repo, set the root
  directory to `web`, and add `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
- **Backend / database / storage** -> already live on Supabase cloud.
- **Mobile app** -> run with Expo Go for demos, or build with `eas build`
  (https://docs.expo.dev/build/introduction/).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid API key` or blank data | The URL/anon key in `.env` is wrong or missing - paste them again. |
| Sign-up says "Email not confirmed" | In Supabase: **Authentication -> Providers -> Email** and turn **Confirm email** off for testing. |
| A new user cannot do anything | New accounts start as `field_worker`. Promote them in the dashboard **Users** page (or with SQL above). |
| Photos upload but do not show | Confirm the `record-photos` bucket exists (step 2.3) and that you are signed in. |
| Mobile app stuck "waiting to upload" | Check the phone has internet, then press **Sync now** on the Home screen. |
