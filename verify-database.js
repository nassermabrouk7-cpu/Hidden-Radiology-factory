require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDatabase() {
  console.log('=== Supabase Database Verification ===\n');

  // 1. Check products count
  console.log('1. Checking products count...');
  const { data: products, error: productsError, count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  if (productsError) {
    console.log('❌ ERROR:', productsError.message);
    return;
  }

  console.log(`✅ Found ${productsCount} products in products table`);

  // 2. Sample products
  if (productsCount > 0) {
    const { data: sampleProducts } = await supabase
      .from('products')
      .select('id, title_ar, title_en, price')
      .limit(3);

    console.log('\nSample products:');
    sampleProducts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title_ar || p.title_en} - ${p.price}`);
    });
  }

  // 3. Check marketing tables
  console.log('\n2. Checking marketing tables...');

  const tables = ['marketing_campaigns', 'marketing_content', 'marketing_generation_daily_runs'];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: ERROR - ${error.message}`);
    } else {
      console.log(`✅ ${table}: EXISTS (${data} rows)`);
    }
  }

  // 4. Check constraints on marketing_content
  console.log('\n3. Checking marketing_content platform constraint...');

  // Try to insert telegram to see if constraint allows it
  const { error: insertError } = await supabase
    .from('marketing_content')
    .insert({
      campaign_id: '00000000-0000-0000-0000-000000000000',
      product_id: 'test',
      platform: 'telegram',
      language: 'ar',
      content_type: 'product',
      title: 'Test',
      hook: 'Test',
      body: 'Test',
      cta: 'Test',
      hashtags: [],
      status: 'queued'
    })
    .select();

  if (insertError && insertError.message.includes('check constraint')) {
    console.log('❌ Platform constraint REJECTS telegram');
    console.log(`   Error: ${insertError.message}`);
  } else if (insertError && insertError.message.includes('foreign key')) {
    console.log('⚠️  Foreign key error (expected - test campaign_id invalid)');
    console.log('   This is OK - means table exists and has foreign key');
  } else {
    console.log('✅ Platform constraint ALLOWS telegram (or constraint missing)');
  }

  // 5. Check marketing_generation_daily_runs structure
  console.log('\n4. Checking marketing_generation_daily_runs structure...');
  const { data: genRunsColumns, error: genRunsError } = await supabase
    .from('marketing_generation_daily_runs')
    .select('*')
    .limit(0);

  if (genRunsError) {
    console.log('❌ marketing_generation_daily_runs ERROR:', genRunsError.message);
  } else {
    console.log('✅ marketing_generation_daily_runs structure OK');
  }

  // 6. Verify function exists
  console.log('\n5. Checking claim_marketing_generation_daily_run function...');
  try {
    const { data: funcResult, error: funcError } = await supabase
      .rpc('claim_marketing_generation_daily_run', { p_run_date: new Date().toISOString().split('T')[0] });

    if (funcError) {
      console.log('❌ Function ERROR:', funcError.message);
    } else {
      console.log('✅ Function EXISTS and EXECUTABLE');
      console.log(`   Result: ${funcResult}`);
    }
  } catch (e) {
    console.log('❌ Function does not exist or cannot be called');
  }

  console.log('\n=== Verification Complete ===');
}

verifyDatabase().catch(console.error);
