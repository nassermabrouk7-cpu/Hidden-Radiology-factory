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

  // Query information_schema directly
  const { data: existingTables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (error) {
    console.error('Error querying tables:', error);
    return;
  }

  if (existingTables) {
    console.log('Tables in public schema:');
    existingTables.forEach(t => console.log(`  - ${t.table_name}`));

    const channelTables = existingTables
      .map(t => t.table_name)
      .filter(name => name.includes('channel') || name.includes('campaign') || name.includes('social') || name.includes('telegram') || name.includes('facebook') || name.includes('instagram'));

    if (channelTables.length > 0) {
      console.log('\nChannel/Campaign related tables:');
      channelTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('\nNo channel/campaign tables found');
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
