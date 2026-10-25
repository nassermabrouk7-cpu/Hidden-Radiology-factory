const fs = require("node:fs");
const path = require("node:path");

function findDuplicateMigrationIds(files) {
  const ids = new Map();
  for (const file of files) {
    const match = /^(\d{12})_.*\.sql$/.exec(path.basename(file));
    if (!match) continue;
    const entries = ids.get(match[1]) || [];
    entries.push(path.basename(file));
    ids.set(match[1], entries);
  }
  return [...ids.entries()].filter(([, entries]) => entries.length > 1);
}

function checkMigrationIds(migrationDirectory = path.resolve(__dirname, "../supabase/migrations")) {
  const files = fs.readdirSync(migrationDirectory)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => path.join(migrationDirectory, file));
  const duplicates = findDuplicateMigrationIds(files);
  if (duplicates.length) {
    for (const [id, entries] of duplicates) {
      console.error(`Duplicate Supabase migration ID ${id}: ${entries.join(", ")}`);
    }
    return false;
  }
  console.log("Supabase migration IDs are unique.");
  return true;
}

if (require.main === module && !checkMigrationIds()) process.exitCode = 1;

module.exports = { checkMigrationIds, findDuplicateMigrationIds };
