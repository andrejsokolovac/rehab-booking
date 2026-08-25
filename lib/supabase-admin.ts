import "server-only";

import { createClient } from "@supabase/supabase-js";

function getRequiredEnvironmentVariable(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SECRET_KEY",
) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Nedostaje obavezna server environment promenljiva: ${name}.`);
  }

  return value;
}

const supabaseUrl = getRequiredEnvironmentVariable(
  "NEXT_PUBLIC_SUPABASE_URL",
);
const supabaseSecretKey = getRequiredEnvironmentVariable(
  "SUPABASE_SECRET_KEY",
);

export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});
