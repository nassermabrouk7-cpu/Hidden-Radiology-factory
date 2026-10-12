const fs = require("fs");

for (const file of [".env.local", ".env.production.local", ".env.vercel.local"]) {
  if (!fs.existsSync(file)) {
    console.log(file + ": MISSING");
    continue;
  }

  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^\s*(?:export\s+)?NEXT_PUBLIC_SUPABASE_URL\s*=\s*["']?([^"'#\r\n\s]+)["']?/m);

  let host = "NOT_FOUND";
  if (match) {
    try { host = new URL(match[1]).hostname; }
    catch { host = "INVALID_URL"; }
  }

  console.log(file + ": " + host);
}
