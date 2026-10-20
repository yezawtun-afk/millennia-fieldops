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

### Updating an installed app without a new APK (over-the-air)

The app is built with **expo-updates**, so JavaScript-only changes can be published to
phones that already have it installed:

```powershell
cd "mobile"
eas update --channel preview --message "what changed"
```

- The phone picks the update up on its next launch. Users can also pull it in manually:
  **Home -> App updates -> Check for updates**, and the app offers a restart when it finds
  one.
- The build listens on the channel named in `mobile/eas.json` (`preview` for the APK,
  `production` for the Play build), so use `--channel preview` for the demo APK.
- Publish only *JavaScript* changes. Anything native (a new Expo package, permissions,
  icons, `app.json` plugin changes) still needs a new build — otherwise the app would
  download code it cannot run.
- **Before the first `eas update`, the Supabase values must exist as EAS environment
  variables**, not only in `mobile/.env`. `eas update` builds the bundle on the CLI's
  machine and only fills in `EXPO_PUBLIC_*` from the EAS environment named by
  `--environment`; a plain `.env` file is not enough, and the resulting bundle then has
  no backend URL (the app opens and every request fails). Set them once:

  ```powershell
  cd "mobile"
  eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://<project>.supabase.co" --environment preview --environment production --visibility plaintext --non-interactive
  eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..." --environment preview --environment production --visibility plaintext --non-interactive
  ```

  They are now stored on EAS for the `preview` and `production` environments, so future
  updates and builds both pick them up.
- **Check the published bundle before trusting it.** The quickest reliable way is to
  fetch the manifest the app itself would fetch and look inside the bundle it points to
  (`verify-ota.js` in the notes below does this end to end):

  ```
  GET https://u.expo.dev/<projectId>?channel-name=preview&runtime-version=<appVersion>&platform=android
  headers: expo-platform: android, expo-protocol-version: 1, accept: multipart/mixed
  ```

  The response is multipart: the `manifest` part has `launchAsset.url`; the `extensions`
  part has `assetRequestHeaders` (keyed by `launchAsset.key`) — the CDN returns 403
  without that signed header. Download the bundle with it and confirm the Supabase host
  appears in the file.
- **Undo a bad update:** `eas update:rollback <update-group-id> --non-interactive`. With
  no earlier update on the branch it publishes a "roll back to the embedded update", so
  installed apps keep the bundle from their APK.
- Bump `expo.version` in `mobile/app.json` when you do ship a new APK: `runtimeVersion`
  uses the `appVersion` policy, so a new version is treated as a new runtime and old
  builds stop receiving the new bundles.

### What the profiles mean (`mobile/eas.json`)

| Profile | Output | Use it for |
| --- | --- | --- |
| `preview` | `.apk`, internal distribution | Testing and the capstone demo |
| `production` | `.aab` | Uploading to the Google Play Store |

Each profile sets a `channel` (`preview`, `production`) that `eas update` publishes to.

Both profiles set `autoIncrement: true`, so every new build gets a fresh Android version
code and installs straight over the previous APK. (Without it, Android may refuse an
install of the same version code with "App not installed".)

Both profiles carry the Supabase URL and publishable key in their `env` block. This is
deliberate: `mobile/.env` is git-ignored, so Expo's servers never see it. The publishable
key is safe to ship inside an app - Row Level Security is what protects the data.

### iOS (optional): what it takes to also run the app on an iPhone

The source code already supports iOS - the same React Native screens work on both
platforms, and the iOS camera/location/photo permission texts are already configured in
`mobile/app.json`. The gap is **signing and distribution**: Apple requires every iPhone
app to be signed with Apple certificates and installed one of three ways, and all three
need a paid **Apple Developer Program** account (US$99/year, ~1 day to approve):

| Route | Install link style | Best for |
| --- | --- | --- |
| **TestFlight** (recommended) | email invite from your Apple account | team/assessor testing |
| App Store | public | long-term release; adds a 1-3 day Apple review |
| Ad-hoc | up to 100 registered device UDIDs | small fixed-set testing |

If you enrol, the steps are:

1. In `mobile/app.json`, give the iOS app its own identity. Add `"bundleIdentifier"` to
   the `ios` block (same convention as the Android package, lowercase):
   ```json
   "ios": {
     "supportsTablet": true,
     "bundleIdentifier": "my.millennia.fieldops",
     ...
   }
   ```
2. ```powershell
   cd "mobile"
   eas build --platform ios --profile preview
   ```
   EAS Build runs the whole iOS compile **on Apple hardware in Expo's cloud** - you never
   need a Mac. First run, it asks you to **log in with your Apple Developer account**
   (your Apple ID email + a session-specific password created at
   https://appleid.apple.com), then it creates the certificates, App IDs and
   **provisioning profiles** automatically.
3. TestFlight route: run `eas build --platform ios --profile production` instead, pick
   **Submit to TestFlight**, and invite testers from your App Store Connect
   account at https://appstoreconnect.apple.com (People -> TestFlight). Testers install
   the "TestFlight" app from the App Store, open the invite, and Millennia FieldOps
   installs like a normal app.

Without an Apple Developer account there is no supported way to install the app on an
iPhone for other people. For a capstone demo, the Android APK plus the web dashboard
is sufficient; mention in your report that the codebase is cross-platform and that iOS
distribution is gated only by Apple's paid signing requirement.

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

That writes `supabase\setup_all.sql` (every numbered setup file - `01`..`06` plus
`09_delete_own_pending` - in the right order). Open it in VS Code, select all, copy,
then in Supabase go to **SQL Editor -> New query**, paste and click **Run**. It takes a
few seconds and should say "Success. No rows returned".

> `setup_all.sql` is generated, so it is git-ignored - re-run the script if the numbered
> files change. Prefer doing it by hand? Run `01_schema.sql`, `02_policies.sql`,
> `03_storage.sql`, `04_triggers.sql`, `05_seed.sql`, `09_delete_own_pending.sql` in
> that order, then the optional `06_severity_levels.sql`. See [SETUP.md](SETUP.md)
> step 2 for details. On a live database, re-run only `02_policies.sql` and
> `09_delete_own_pending.sql`.

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

Setup done but the apps still fail after login? If accounts were created **before**
the schema existed, they have no `profiles` row. Run `08_backfill_profiles.sql`
(then the two `update` lines inside it, with the `--` removed, to promote your admin
and supervisor).

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
| APK install says "App not installed" | An APK with the same version code is already on the phone. Either uninstall the old app first (this also clears any unsent drafts), or give the profile `"autoIncrement": true` (already set for both profiles) and rebuild. |
| Vercel build fails with "No Next.js version detected" | The **Root Directory** is not set to `web`. |
| Deployed site loads but every page errors | Missing environment variables on Vercel. Add them and **Redeploy**. |
| "Create user" in the web Users page fails with 401 | `SUPABASE_SERVICE_ROLE_KEY` on Vercel is wrong or missing. Users can also self-register from the mobile app. |
| Web says "Check for updates" is unavailable / the Home card says the build cannot update itself | That APK was built before `expo-updates` was added, so it cannot receive over-the-air bundles. Install the newest APK once; every APK built from then on can update itself. |
| `eas update` fails with "channel not found" or "no compatible runtime" | The build profile has no `channel` (it does now: `preview` / `production`) or `expo.version` in `app.json` was bumped after the APK was built. Bump the version only together with a new APK, then update on the matching channel. |
