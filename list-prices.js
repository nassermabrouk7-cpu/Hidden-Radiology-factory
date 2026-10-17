require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const { data } = await supabase.from('products').select('title_ar, price, category').eq('is_active', true).order('price', {ascending:false});
  console.log(`\n📚 عندك ${data.length} منتج بأسعارهم الحقيقية:\n`);
  data.forEach(p=> console.log(`- ${p.title_ar} | $${p.price} | ${p.category}`));
})();