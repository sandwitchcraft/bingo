/**
 * The Supabase client. The one place the anonymous backend is reached from.
 *
 * Backs two features: "report incorrect sort" (writes to `reports`) and the opt-in
 * "help improve Bin-go" training-image contribution (writes to `training_images` + the
 * `scan-photos` bucket). See `src/features/reports/reports.ts` for the helpers callers use.
 *
 * The key is the **publishable** key (`sb_publishable_…`), which maps to the `anon` Postgres
 * role — the only credential that belongs in client code. The legacy `anon` JWT and the
 * `service_role`/secret keys must never ship in the app. Both values come from `.env.local`
 * (gitignored) via Expo's `EXPO_PUBLIC_*` inlining, not source.
 */
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  // The app has no accounts and never signs anyone in, so there is no session to keep.
  // Turning persistence off means supabase-js doesn't reach for an AsyncStorage auth
  // adapter (which we don't provide) or spin up its session/lock machinery in RN.
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
