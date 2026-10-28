require('dotenv').config({path:'.env.local'});
const secret = (process.env.CRON_SECRET || '').trim();
const prodUrl = 'https://hidden-radiology-project-chi.vercel.app/api/publish-one';
const payload = {
  productId: '5b669afb-7693-48a5-a0e2-e82e194ba405',
  channel: 'facebook',
  dryRun: true
};

if(!secret || secret.includes('SENSITIVE')){
  console.log('CRON_SECRET not found or is [SENSITIVE] in .env.local');
  console.log('Add real CRON_SECRET to .env.local first');
  process.exit(1);
}

console.log('Testing with secret len:', secret.length);
console.log('Payload:', payload);

fetch(prodUrl, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + secret,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(payload)
})
.then(r=>r.text())
.then(t=>{
  console.log('\n---RESPONSE---');
  console.log(t);
  try {
    const j = JSON.parse(t);
    if(j.valid || j.dryRun) console.log('\n✅ SUCCESS - Publishing is working!');
    if(j.error === 'Unauthorized') console.log('\n❌ Still 401 - CRON_SECRET mismatch in Vercel');
  } catch(e){}
})
.catch(e=>console.error('Fetch error:', e));
