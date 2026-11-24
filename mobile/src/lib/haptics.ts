// Confirmation you can feel.
//
// A field worker wearing gloves, squinting into the sun, cannot always see the
// toast that says "saved". A short vibration says it without a glance at the
// screen. Every call here is fire-and-forget: a phone without a haptic engine,
// or one where the person turned the buzz off, must never turn a successful
// action into an error dialog.
//
// The switch on the Profile screen flips this module's `enabled` flag, so the
// screens below never need to read a preference just to say "done".
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(next: boolean): void {
  enabled = next;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

// `expo-haptics` throws when the platform cannot buzz (simulators, some
// Android tablets); swallowing keeps the promise out of the caller's way.
function play(action: () => Promise<void>): void {
  if (!enabled || Platform.OS === "web") return;
  action().catch(() => undefined);
}

// A photo landed, a draft was parked: something small happened.
export function tap(): void {
  play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

// A record reached the phone's database, a job was marked done, a review was
// approved. The strong "you are finished" pattern rather than a plain tap.
export function success(): void {
  play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

// Attention, not failure: an unclear photo, a reading outside its range, a
// record sent back.
export function warning(): void {
  play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

// Something was attempted and did not work.
export function error(): void {
  play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
