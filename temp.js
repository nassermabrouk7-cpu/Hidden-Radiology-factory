require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  // حاول insert فيه original_price لو مش موجود هيعمل error بس هنكمل
  const { data } = await supabase.from('products').select('id').limit(1);
  console.log("✅ جاهز للـ deploy الجديد");
})();