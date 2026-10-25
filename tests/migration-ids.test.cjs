const { test } = require("node:test");
const assert = require("node:assert/strict");
const { findDuplicateMigrationIds } = require("../scripts/check-migration-ids.cjs");
const { readFileSync, readdirSync } = require("node:fs");
const { resolve } = require("node:path");

test("Supabase migration ID guard detects duplicate numeric prefixes", () => {
  const duplicates = findDuplicateMigrationIds([
    "202610220001_meta_token_health_alerts.sql",
    "202610220001_single_channel_publish_lock.sql",
    "202610250001_reliable_publishing_and_meta_vault.sql",
  ]);
  assert.deepEqual(duplicates, [[
    "202610220001",
    ["202610220001_meta_token_health_alerts.sql", "202610220001_single_channel_publish_lock.sql"],
  ]]);
});

test("repository Supabase migration IDs are unique", () => {
  const migrationDirectory = resolve(__dirname, "../supabase/migrations");
  const files = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith(".sql"));
  assert.deepEqual(findDuplicateMigrationIds(files), []);
});

test("daily publishing and Meta vault migration restricts state to the server role", () => {
  const sql = readFileSync(resolve(__dirname, "../supabase/migrations/202610250001_reliable_publishing_and_meta_vault.sql"), "utf8").toLowerCase();
  assert.match(sql, /product_publish_daily_runs[\s\S]*run_date date primary key[\s\S]*idempotency_key text not null unique/);
  assert.match(sql, /security definer[\s\S]*set search_path = ''[\s\S]*claim_product_publish_daily_run/);
  assert.match(sql, /revoke all on table public\.product_publish_daily_runs from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.claim_product_publish_daily_run\(date, text\) to service_role/);
  assert.match(sql, /meta_token_vault[\s\S]*ciphertext text not null[\s\S]*auth_tag text not null/);
  assert.match(sql, /revoke all on table public\.meta_token_vault from public, anon, authenticated/);
  assert.match(sql, /claim_meta_token_refresh_lock/);
  assert.match(sql, /claim_meta_token_refresh_attempt/);
  assert.match(sql, /status in \('invalid', 'expired', 'expiring', 'not_configured', 'unknown', 'unavailable', 'refresh_failed'\)/);
});
