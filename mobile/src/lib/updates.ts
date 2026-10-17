// In-app updates, through expo-updates / EAS Update.
//
// How it works: this build listens on a release *channel* (see the `channel`
// entry in mobile/eas.json). Running `eas update --channel preview` publishes a
// new JavaScript bundle to that channel; the app then downloads it on the next
// launch (app.json sets checkAutomatically: ON_LOAD) or on demand from the
// "App updates" card on the Home screen. No new APK, no reinstall.
//
// A new APK is still needed whenever *native* code changes (a new Expo module,
// permissions, icons). Then bump `expo.version` in app.json so installed apps
// see it as a different runtime and cannot pull an incompatible bundle.
//
// expo-updates is switched off in development and in Expo Go, so every helper
// here has to cope with `Updates.isEnabled === false`.
import Constants from "expo-constants";
import * as Updates from "expo-updates";

export interface UpdateCheck {
  /** False in dev builds and Expo Go, where OTA updates do not exist. */
  supported: boolean;
  /** True when a newer bundle is waiting on the update server. */
  available: boolean;
  message: string;
}

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

/**
 * Which bundle is actually running: the one baked into the APK, or an
 * over-the-air update that has since been downloaded. Shown on the Home card so
 * an update landing can be seen without guessing.
 */
export function runningBundle(): string {
  if (!Updates.isEnabled) return "development build (updates off)";
  if (!Updates.updateId) return "built-in bundle";
  const when = Updates.createdAt;
  if (!when) return "downloaded update";
  return `downloaded update of ${when.toLocaleDateString()} ${when.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** Asks the update server whether a newer bundle exists. Downloads nothing. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  if (!Updates.isEnabled) {
    return {
      supported: false,
      available: false,
      message: "This build cannot update itself. Install the newest APK from the Expo build page.",
    };
  }

  try {
    const result = await Updates.checkForUpdateAsync();
    return {
      supported: true,
      available: result.isAvailable,
      message: result.isAvailable
        ? "A new version is ready to download."
        : "You are on the latest version.",
    };
  } catch (error) {
    return {
      supported: true,
      available: false,
      message:
        error instanceof Error
          ? `Could not reach the update server: ${error.message}`
          : "Could not reach the update server.",
    };
  }
}

/**
 * Downloads the waiting bundle and restarts into it. Only call this after
 * checkForUpdate() reported `available`.
 */
export async function applyUpdate(): Promise<{ ok: boolean; message: string }> {
  if (!Updates.isEnabled) {
    return { ok: false, message: "This build cannot update itself." };
  }

  try {
    const fetched = await Updates.fetchUpdateAsync();
    if (!fetched.isNew) {
      return { ok: true, message: "You were already on the latest version." };
    }
    // Restarts the app on the new bundle; the code below never runs.
    await Updates.reloadAsync();
    return { ok: true, message: "Update applied." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not download the update.",
    };
  }
}
