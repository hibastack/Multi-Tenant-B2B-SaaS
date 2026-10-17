import fs from "node:fs";
import path from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run this through `npm run db:migrate` so .env is loaded.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const dir = path.join(process.cwd(), "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("select name from schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    console.log(`Applying ${file} ...`);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      ran++;
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  console.log(ran === 0 ? "Database is already up to date." : `Done. Applied ${ran} migration(s).`);
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}