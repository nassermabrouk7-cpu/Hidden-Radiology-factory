require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const tables = ['telegram_config', 'settings', 'integrations', 'channels'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(5);
    if (!error && data && data.length>0) console.log(`✅ ${t}:`, data);
    else console.log(`- ${t}: ${error ? error.message : 'فاضي'}`);
  }
})();