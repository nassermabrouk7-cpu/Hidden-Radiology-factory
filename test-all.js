require('dotenv').config({path:'.env.local'});
const secret = process.env.CRON_SECRET.trim();
const url = 'https://hidden-radiology-project-chi.vercel.app/api/publish-one';

const ids = [
  'ab4bcc70-639c-42ea-b6f3-bd668000ea05',
  'ef17dc6e-20a1-4963-8cbf-a174c963828c',
  '64a08cc8-8792-4be3-86b1-fd3cbff8e721',
  '657ab576-428f-4030-9789-87036e66021c',
  '1b61c039-9bd8-4b68-a776-6f6c014839f0',
  '5b669afb-7693-48a5-a0e2-e82e194ba405'
];

async function test(id){
  const r = await fetch(url, {
    method:'POST',
    headers:{'Authorization':'Bearer '+secret,'Content-Type':'application/json'},
    body: JSON.stringify({productId:id, channel:'facebook', dryRun:true})
  });
  const t = await r.text();
  console.log(id + ' => ' + t.substring(0,200));
}

(async()=>{ for(const id of ids){ await test(id); } })();
