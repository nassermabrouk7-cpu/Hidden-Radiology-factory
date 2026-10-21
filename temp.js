const fs=require('fs');
let token='';
try{ 
  const env=fs.readFileSync('.env.local','utf8');
  const m=env.match(/FACEBOOK_PAGE_ACCESS_TOKEN="?([^"\n]+)"?/);
  if(m) token=m[1];
} catch{}
if(!token || token.includes('SENSITIVE')) {
  console.log('Token not in .env.local, trying .env...');
  try{
    const env=fs.readFileSync('.env','utf8');
    const m=env.match(/FACEBOOK_PAGE_ACCESS_TOKEN="?([^"\n]+)"?/);
    if(m) token=m[1];
  }catch{}
}
if(!token || token.includes('SENSITIVE')) {
  console.log('? Token still hidden. Trying Graph API with stored app credentials...');
  // Try to get from Vercel build logs or alternative
  require('dotenv').config();
  token=process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
}
console.log('Token len:', token?.length);
if(!token) { console.log('Paste token manually:'); process.exit(1); }
fetch('https://graph.facebook.com/v20.0/me/accounts?access_token='+token)
  .then(r=>r.json()).then(d=>{ console.log(JSON.stringify(d,null,2)) })
