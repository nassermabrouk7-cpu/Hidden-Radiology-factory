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
    .select("*")
    .eq("campaign_id", "209c8584-e5f1-43d7-bdf9-a2fada385eac")
    .order("scheduled_at", { ascending: true });
  if (error) throw error;
  const posts = (data || []).map(r => ({
    id: r.id,
    platform: r.platform,
    status: r.status,
    scheduled_at: r.scheduled_at,
    title_ar: r.title_ar,
    title_en: r.title_en,
    body: r.body,
    caption: r.caption,
    text: r.text,
    cta: r.cta,
    hashtags: r.hashtags,
    destination_url: r.destination_url,
    metadata: r.metadata
  }));
  console.log(JSON.stringify({ count: posts.length, posts }, null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
