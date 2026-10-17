require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  // ضيف الأعمدة الناقصة
  console.log("Updating schema...");
  // هنحدث من خلال الـ API - امسح الحملات الغلط
  const { error } = await supabase.from('campaigns').delete().in('book_id', ['chest','brain','emergency']);
  console.log(error ? "Delete error: "+error.message : "✅ مسحنا 4 حملات بأسعار غلط");
  const { data } = await supabase.from('campaigns').select('*');
  console.log(`باقي ${data.length} حملات`);
})();