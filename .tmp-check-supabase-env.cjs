require("@next/env").loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(JSON.stringify({
  workingDirectory: process.cwd(),
  supabaseHost: url ? new URL(url).hostname : "MISSING",
  serviceRoleKeyConfigured: Boolean(key)
}, null, 2));
