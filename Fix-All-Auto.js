#!/usr/bin/env node
// fix-all-auto.js - يعمل كل حاجة تلقائي
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const ROOT = 'E:\\hidden-radiology-factory';
process.chdir(ROOT);

console.log('=== Hidden Radiology - FULL AUTO FIX ===\n');

function getEnvValue(key, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const regex = new RegExp(`^${key}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, 'm');
    const m = content.match(regex);
    if (m) return m[1].trim();
  } catch {}
  return null;
}

function run(cmd, opts={}) {
  console.log(`> ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: opts.silent ? 'pipe' : 'inherit', ...opts });
    return out;
  } catch (e) {
    if (!opts.allowFail) console.log(e.stdout || e.message);
    return e.stdout || '';
  }
}

// 1. Get REAL token
let token = getEnvValue('FACEBOOK_PAGE_ACCESS_TOKEN', path.join(ROOT, '.env.local'));
if (!token || token.includes('SENSITIVE') || token.length < 20) {
  token = getEnvValue('FACEBOOK_PAGE_ACCESS_TOKEN', path.join(ROOT, '.env'));
}
if (!token || token.includes('SENSITIVE') || token.length < 20) {
  token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
}

if (!token || token.includes('SENSITIVE') || token.length < 20) {
  console.error('\n❌ التوكن مش موجود في .env.local');
  console.error('افتح .env.local وحط التوكن الحقيقي:');
  console.error('FACEBOOK_PAGE_ACCESS_TOKEN=EAAG...');
  console.error('\nوبعدين شغل السكريبت تاني: node fix-all-auto.js\n');
  process.exit(1);
}

if (token.includes('|') || /^\[.*\]$/.test(token) || /SENSITIVE|REDACTED/i.test(token)) {
  console.error('FACEBOOK_PAGE_ACCESS_TOKEN looks malformed or is a placeholder.');
  process.exit(1);
}

// 2. Get Page ID from Facebook
console.log('\n[1/4] بجيب Page ID من Facebook API...');
(async () => {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/me/accounts?access_token=${encodeURIComponent(token)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'Facebook API request failed');
    if (!Array.isArray(data.data)) throw new Error('Facebook API returned no page list');
    
    let page = data.data.find(p => p.name && p.name.toLowerCase().includes('hidden')) || data.data[0];
    if (!page) throw new Error('No pages found');
    
    const realPageId = String(page.id || '').trim();
    if (!/^\d+$/.test(realPageId)) throw new Error('Facebook returned a malformed Page ID; refusing to update Vercel.'); // تنظيف لو فيه |
    console.log(`\n✅ Real Page ID = ${realPageId} (${page.name})\n`);
    
    if (realPageId === '1080854664848106') {
      throw new Error('This is App ID not Page ID!');
    }

    // 3. Fix code if bug exists - search for wrong usage
    console.log('[2/4] بفحص الكود...');
    const filesToCheck = [
      'app/api/test-publish/route.ts',
      'app/api/publish/route.ts',
      'lib/facebook.ts',
      'lib/social/facebook.ts'
    ];
    for (const f of filesToCheck) {
      const fp = path.join(ROOT, f);
      if (fs.existsSync(fp)) {
        let content = fs.readFileSync(fp, 'utf8');
        if (content.includes('FACEBOOK_PAGE_ACCESS_TOKEN') && content.includes('Object with ID') === false) {
          // check if pageId var uses ACCESS_TOKEN
          const lines = content.split('\n');
          lines.forEach((line,i)=>{
            if (line.includes('pageId') && line.includes('ACCESS_TOKEN') && !line.includes('PAGE_ID')) {
              console.log(`⚠️  Bug in ${f}:${i+1} - uses ACCESS_TOKEN as ID`);
            }
          });
        }
      }
    }

    // 4. Update Vercel
    console.log('[3/4] بحدث Vercel...');
    try { run('vercel env rm FACEBOOK_PAGE_ID production --yes', {silent:true, allowFail:true}); } catch {}
    try { run('vercel env rm FACEBOOK_PAGE_ID preview --yes', {silent:true, allowFail:true}); } catch {}
    try { run('vercel env rm FACEBOOK_PAGE_ID development --yes', {silent:true, allowFail:true}); } catch {}
    
    fs.writeFileSync(path.join(ROOT, 'env_temp.txt'), realPageId, 'utf8');
    run(`type env_temp.txt | vercel env add FACEBOOK_PAGE_ID production --force`);
    fs.unlinkSync(path.join(ROOT, 'env_temp.txt'));
    console.log(`✅ Updated FACEBOOK_PAGE_ID=${realPageId}`);

    // Ensure token in Vercel is clean (no |)
    // Don't overwrite token if already correct, just ensure page id

    // 5. Deploy
    console.log('\n[4/4] بعمل Deploy...');
    run('vercel --prod --yes');

    // 6. Test
    console.log('\n[5/5] باختبر...');
    await new Promise(r=>setTimeout(r, 12000));
    try {
      const testRes = await fetch('https://hidden-radiology-project-chi.vercel.app/api/test-publish', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({bookId:'5b669afb-7693-48a5-a0e2-e82e194ba405', channels:['facebook']})
      });
      const testJson = await testRes.json();
      console.log(JSON.stringify(testJson, null, 2));
      if (testJson.success || (testJson.results && testJson.results[0]?.success)) {
        console.log('\n🎉 نجح! Facebook شغال!');
      } else {
        console.log('\n❌ لسه فاشل - شوف الخطأ فوق');
        console.log('لو لسه بيقول ID فيه | يبقى لازم تمسح .env.local وتعيد بناءه');
      }
    } catch (e) {
      console.log('Test error', e.message);
    }

  } catch (e) {
    console.error('\n❌ Error:', e.message);
    console.error(e.stack);
  }
})();
