require('dotenv').config({path:'.env.local'});
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL exists:', !!url, url?.substring(0,30));
console.log('Key exists:', !!key, 'len:', key?.length);
console.log('Key has SENSITIVE:', key?.includes('SENSITIVE'));

if(!url || !key || key.includes('SENSITIVE')){
  console.log('ERROR: Supabase keys are [SENSITIVE] in .env.local - file is corrupted');
  process.exit(1);
}

const supabase = createClient(url, key);

(async()=>{
  const { data, error } = await supabase.from('products').select('id, title, price').limit(6);
  console.log('\n--- PRODUCTS (first 6) ---');
  if(error) console.error('Error:', error);
  else console.log(JSON.stringify(data, null, 2));

  const { data: books, error: e2 } = await supabase.from('books').select('id, title').limit(6);
  console.log('\n--- BOOKS (first 6) ---');
  if(e2) console.error('Error:', e2);
  else console.log(JSON.stringify(books, null, 2));
})();
