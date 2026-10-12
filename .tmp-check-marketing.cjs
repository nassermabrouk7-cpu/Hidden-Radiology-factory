require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

(async () => {
  const { data, error } = await db
    .from("marketing_content")
    .select("campaign_id,status,platform");

  if (error) throw error;

  const groups = {};
  for (const r of data || []) {
    const key = `${r.campaign_id} | ${r.status} | ${r.platform}`;
    groups[key] = (groups[key] || 0) + 1;
  }

  console.log(JSON.stringify({
    total: (data || []).length,
    groups
  }, null, 2));
})().catch(e => {
  console.error(e.message);
  process.exit(1);
});
