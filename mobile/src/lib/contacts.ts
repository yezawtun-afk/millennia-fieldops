// Phone numbers a field worker may need in a hurry.
//
// The supervisor number is not hard-coded: it is read from the account of
// whoever holds the supervisor role, so it stays right when the person
// changes. It is also cached on the phone, because the moment you most need to
// call someone is the moment you have no signal.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupervisorContact } from "./api";

// Malaysia's national emergency number. A site hotline can replace this by
// changing one line - the number is never typed anywhere else.
export const EMERGENCY_NUMBER = "999";

const CACHE_KEY = "millennia-fieldops.supervisors";

export async function readCachedSupervisors(): Promise<SupervisorContact[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SupervisorContact =>
        Boolean(item) && typeof item.id === "string" && typeof item.phone === "string"
    );
  } catch {
    // A corrupt cache is not worth a crash; the network read will replace it.
    return [];
  }
}

export async function cacheSupervisors(list: SupervisorContact[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch {
    // Best effort: the numbers still work for this session.
  }
}
