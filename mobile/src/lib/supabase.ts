// The single Supabase client used across the mobile app.
// The session is stored with AsyncStorage so sign-in survives app restarts,
// which also allows opening the app while offline.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "Supabase is not configured. Copy mobile/.env.example to mobile/.env and add your project URL and anon key."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Local helper types for the storage calls.
export const PHOTO_BUCKET = "record-photos";
