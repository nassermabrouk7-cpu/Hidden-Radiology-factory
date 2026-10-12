const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');

function readEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

async function main() {
  const env = { ...readEnv('.env.local'), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase URL or key not found in .env.local');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db
    .from('products')
    .select('title_ar,title_en,language,cover_url')
    .limit(100);

  if (error) throw error;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  const cards = data.map((p, i) =>
    `<article><h3>${i + 1}. ${esc(p.title_en || p.title_ar || 'Product')}</h3>
    <p>${esc(p.title_ar)} | ${esc(p.language)}</p>
    ${p.cover_url ? `<img loading="lazy" src="${esc(p.cover_url)}" alt="${esc(p.title_en || p.title_ar || 'Book cover')}">` : '<p>No cover URL</p>'}
    </article>`
  ).join('\n');

  const html = `<!doctype html><html><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Original product covers</title>
  <style>body{font:14px Arial;margin:20px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}article{border:1px solid #ccc;border-radius:8px;padding:12px;overflow-wrap:anywhere}img{width:100%;height:260px;object-fit:contain;background:#f4f4f4}</style>
  </head><body><h1>Original product covers (${data.length})</h1><main>${cards}</main></body></html>`;

  fs.writeFileSync('cover-review.html', html, 'utf8');
  console.log(`Created preview for ${data.length} products.`);
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
