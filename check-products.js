require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProducts() {
  console.log('Checking products table structure...\n');

  // Check if products table exists
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'products');

  if (tablesError) {
    console.error('Error checking tables:', tablesError);
    return;
  }

  if (!tables || tables.length === 0) {
    console.log('❌ products table does not exist in public schema');
  } else {
    console.log('✅ products table exists');
  }

  // Try to query products
  console.log('\nQuerying products table...');
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .limit(5);

  if (productsError) {
    console.error('❌ Error querying products:', productsError.message);
    return;
  }

  if (!products || products.length === 0) {
    console.log('❌ No products found in table');
  } else {
    console.log(`✅ Found ${products.length} products`);
    console.log('\nSample product structure:');
    console.log(JSON.stringify(products[0], null, 2));
  }

  // Check for is_active column
  console.log('\nChecking for is_active column...');
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'products')
    .eq('table_schema', 'public');

  if (columnsError) {
    console.error('Error checking columns:', columnsError.message);
    } else {
    const hasIsActive = columns?.some(col => col.column_name === 'is_active');
    if (hasIsActive) {
      console.log('✅ is_active column exists');
    } else {
      console.log('❌ is_active column does not exist - this is why loadValidProducts fails');
    }
  }
}

checkProducts().catch(console.error);
