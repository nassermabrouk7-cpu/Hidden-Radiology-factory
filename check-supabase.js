require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", url ? "موجود ✅" : "مش موجود ❌");
console.log("KEY:", key ? "موجود ✅" : "مش موجود ❌");

if (!url || !key) {
  console.log("\n❌ المفاتيح مش مقروءة - افتح .env.local وشوف:");
  process.exit(1);
}

async function check() {
  const supabase = createClient(url, key);
  
  console.log("\n--- الحملات الحالية ---");
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', {ascending: false}).limit(10);
  
  if (error) { console.log("Error:", error); return; }
  
  console.log(`عندك ${data.length} حملات:\n`);
  data.forEach((c, i) => {
    console.log(`${i+1}. ${c.book_id} | price: $${c.price} | original: $${c.original_price || 'N/A'} | ${c.hook}`);
  });
  
  console.log("\n--- بتدور على جداول الأسعار الأصلية ---");
  const tables = ['books', 'products', 'courses', 'ebooks', 'prices'];
  for (const t of tables) {
    const { data: d, error: e } = await supabase.from(t).select('*').limit(5);
    if (!e && d && d.length > 0) {
      console.log(`\n✅ جدول ${t} موجود:`, JSON.stringify(d, null, 2));
    } else {
      console.log(`- جدول ${t}: ${e ? e.message : 'فاضي'}`);
    }
  }
}

check();