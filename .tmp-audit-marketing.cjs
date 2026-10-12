require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

(async () => {
  for (const table of ["marketing_campaigns", "marketing_content"]) {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(table + " ERROR:", error.message);
    } else {
      console.log(table + " TOTAL:", count);
    }
  }

  const { data, error } = await db
    .from("marketing_content")
    .select("campaign_id,status,platform,language")
    .limit(100);

  if (error) {
    console.log("DETAIL ERROR:", error.message);
  } else {
    const groups = {};
    for (const row of data || []) {
      const key = [row.campaign_id, row.status, row.platform, row.language].join(" | ");
      groups[key] = (groups[key] || 0) + 1;
    }
    console.log("CONTENT GROUPS:", JSON.stringify(groups, null, 2));
  }
})().catch(e => console.log("ERROR:", e.message));
