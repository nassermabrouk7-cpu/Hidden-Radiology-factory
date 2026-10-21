const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Checking Supabase tables...\n');

  // Check for known tables
  const knownTables = [
    'products',
    'marketing_campaigns',
    'marketing_content',
    'orders',
    'download_logs',
    'security_events',
    'fulfillment_events',
    'product_relationships',
    'system_alerts',
    'channels',
    'campaigns',
    'social_posts',
    'telegram_channels',
    'facebook_pages',
    'instagram_accounts'
  ];

  for (const tableName of knownTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!error) {
        console.log(`✅ ${tableName} - EXISTS`);
      } else {
        console.log(`❌ ${tableName} - NOT FOUND`);
      }
    } catch (e) {
      console.log(`❌ ${tableName} - ERROR: ${e.message}`);
    }
  }

  // Check storage buckets
  console.log('\nChecking storage buckets...');
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets) {
      console.log('Storage buckets:');
      buckets.forEach(b => console.log(`  - ${b.name} (public: ${b.public})`));
    }
  } catch (e) {
    console.log('  Could not list buckets (may require different permissions)');
  }
}

checkTables().then(() => process.exit(0)).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
