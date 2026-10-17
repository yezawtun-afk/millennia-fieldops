# Deploy guide

Three things get deployed separately:

| Piece | Where it runs | Host |
| --- | --- | --- |
| Database, auth, photo storage | Supabase cloud | Supabase (already live) |
| Web dashboard (`web/`) | Serverless | Vercel |
| Mobile app (`mobile/`) | On the phone | Expo EAS Build -> installable APK |

Everything below uses **PowerShell** on Windows.

---

## 0. One-time prerequisites

```powershell
node --version          # need 20 or newer
npm install -g eas-cli  # the Expo build tool
eas login               # your free expo.dev account
```

`eas login` asks for your Expo email/username and password. The password stays hidden
while you type - that is normal. Check it worked with `eas whoami`.

---

## 1. Build the Android APK

An **APK** is the file you install directly on a phone (like a `.exe` on Windows). Expo
builds it on its own servers, so you do **not** need Android Studio.

From the project root:

```powershell
cd "mobile"
eas build --platform android --profile preview
```

- The first run asks **"Generate a new Android Keystore?"** - answer **Y** (Enter). This
  is the signing key that makes Android accept the app. Keep it in your Expo account;
  you need the same one for every future update.
- The build then uploads your code and takes roughly **10-20 minutes**. You can close
  the terminal; the build keeps running on Expo's servers.
- When it finishes the terminal prints a build page URL, e.g.
  `https://expo.dev/accounts/<you>/projects/millennia-fieldops/builds/<id>`.

### Installing it on the phone

Open that build page on the phone (or scan its QR code) and tap **Install**. Android
will warn about installing from a browser - allow it. The app appears as
**Millennia FieldOps** with its own icon; it does *not* need Expo Go.

### Rebuilding after a code change

```powershell
cd "mobile"
eas build --platform android --profile preview
```

The keystore already exists, so it will not ask again. New builds get a higher version
number automatically.

### What the profiles mean (`mobile/eas.json`)

| Profile | Output | Use it for |
| --- | --- | --- |
| `preview` | `.apk`, internal distribution | Testing and the capstone demo |
| `production` | `.aab` | Uploading to the Google Play Store |

Both profiles carry the Supabase URL and publishable key in their `env` block. This is
deliberate: `mobile/.env` is git-ignored, so Expo's servers never see it. The publishable
key is safe to ship inside an app - Row Level Security is what protects the data.

---

## 2. Deploy the web dashboard to Vercel

The repo is private, so Vercel needs permission to read it. Signing in to Vercel with
GitHub handles that automatically.

1. Go to https://vercel.com and click **Sign up / Log in -> Continue with GitHub**.
2. Click **Add New... -> Project**, then **Import Git Repository** and pick
   `yezawtun-afk/millennia-fieldops-rewrite`. (If it is not listed, click
   *Adjust GitHub App Permissions* and grant access to that repo.)
3. On the configuration screen set:
   - **Root Directory**: `web`  <- important, the Next.js app is in a subfolder
   - **Framework Preset**: Next.js (auto-detected)
   - Leave build and output settings alone.
4. Open **Environment Variables** and add these three (name -> value):

   | Name | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project>.supabase.co` | Supabase -> Project Settings -> API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your publishable/anon key | same page |
   | `SUPABASE_SERVICE_ROLE_KEY` | your real `service_role` secret | optional; only the admin "create user" button needs it. Mark it **Sensitive**. |

5. Click **Deploy**. The first build takes 2-4 minutes, then you get a URL such as
   `https://millennia-fieldops-rewrite.vercel.app`.

Every later `git push` to `main` redeploys automatically.

### Command line alternative

```powershell
cd "web"
npm install -g vercel
vercel login                       # opens the browser once
vercel link                        # walks you through linking to a Vercel project
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel --prod
```

`vercel env add` prompts you to paste the value; repeat it (or add the same variables to
the *Preview* environment) if you want preview deployments to work too.

### Things to know after deploying

- **Hazard summary PDF** needs `pdfkit` to stay unbundled. That is already configured in
  `web/next.config.mjs` (`serverExternalPackages: ["pdfkit"]`); do not remove it or the
  export route returns HTTP 500.
- Vercel clones from GitHub, so the local `node_modules` / `.next` junctions are not
  uploaded - that is fine and expected.
- The **web** login uses the same Supabase accounts as the mobile app.

---

## 3. Database before the first demo

The Supabase project starts empty - every page will error until these run.

The quick way is one paste. Build the combined script:

```powershell
# from the project root
powershell -ExecutionPolicy Bypass -File tools\bundle-db-sql.ps1
```

That writes `supabase\setup_all.sql` (all of `01`..`06` in the right order). Open it
in VS Code, select all, copy, then in Supabase go to **SQL Editor -> New query**, paste
and click **Run**. It takes a few seconds and should say "Success. No rows returned".

> `setup_all.sql` is generated, so it is git-ignored - re-run the script if the numbered
> files change. Prefer doing it by hand? Run `01_schema.sql`, `02_policies.sql`,
> `03_storage.sql`, `04_triggers.sql`, `05_seed.sql` in that order, then optional
> `06_severity_levels.sql`. See [SETUP.md](SETUP.md) step 2 for details.

Then create your first admin account:

1. Sign up once from the mobile app (or the deployed web app).
2. In the SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Sign out and back in.

`07_demo_data.sql` is separate on purpose: it deletes every existing record, and it
needs at least one field worker account to already exist. Run it only when you want a
fresh randomised demo set.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `eas: command not found` | The install finished after your terminal opened. Close it, open a new PowerShell window, retry. |
| `You have access to multiple accounts` | Add `--account <name>`: `eas init --account yezawtun_afk`. |
| `Generating a new Keystore is not supported in --non-interactive mode` | Run the build **without** `--non-interactive` so you can answer `Y` to the keystore question. |
| `EAS project not configured` | Run `eas init --account yezawtun_afk` inside `mobile/`. |
| `EPERM: operation not permitted, symlink ... -shallow-clone ...` during "Compressing project files" | EAS CLI filters the upload with the `ignore` package, which cannot match a **directory-only** pattern. A rule such as `web/.next/` in `.gitignore` therefore fails to exclude `web/.next`, so EAS tries to copy it and cannot recreate a junction/symlink on Windows. Write folder rules without the trailing slash (`web/.next`); git treats them the same. |
| `Failed to resolve plugin for module "expo-image-picker" ... Do you have node modules installed?` | `mobile/node_modules` is missing or empty. Run `npm install` inside `mobile`, and re-run `tools\onedrive-links.ps1` if the folder looks empty. |
| APK installs but shows a blank/error screen | The Supabase values were not baked in. Check the `env` block in `mobile/eas.json` matches `mobile/.env`, then rebuild. |
| Vercel build fails with "No Next.js version detected" | The **Root Directory** is not set to `web`. |
| Deployed site loads but every page errors | Missing environment variables on Vercel. Add them and **Redeploy**. |
| "Create user" in the web Users page fails with 401 | `SUPABASE_SERVICE_ROLE_KEY` on Vercel is wrong or missing. Users can also self-register from the mobile app. |
