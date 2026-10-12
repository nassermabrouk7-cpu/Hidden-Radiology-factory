require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("ENV_MISSING: Supabase URL or service key is not loaded.");
  process.exit(1);
}

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false }
});

(async () => {
  const campaignId = "209c8584-e5f1-43d7-bdf9-a2fada385eac";

  const campaigns = await db
    .from("marketing_campaigns")
    .select("id,name,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (campaigns.error) {
    console.log("CAMPAIGNS_ERROR:", campaigns.error.message);
  } else {
    console.log("CAMPAIGNS:", JSON.stringify(
      (campaigns.data || []).map(c => ({
        id: c.id,
        name: c.name,
        created_at: c.created_at
      })), null, 2
    ));
  }

  const content = await db
    .from("marketing_content")
    .select("campaign_id,status,platform")
    .eq("campaign_id", campaignId);

  if (content.error) {
    console.log("CONTENT_ERROR:", content.error.message);
  } else {
    const rows = content.data || [];
    const statuses = {};
    for (const r of rows) {
      const k = `${r.status} | ${r.platform}`;
      statuses[k] = (statuses[k] || 0) + 1;
    }
    console.log("TARGET_CONTENT:", JSON.stringify({
      count: rows.length,
      statuses
    }, null, 2));
  }
})().catch(e => {
  console.error("CHECK_FAILED:", e.message);
  process.exit(1);
});
