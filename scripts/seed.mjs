import pg from "pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed in production.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Run this through `npm run db:seed` so .env is loaded.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const HOUR = 60 * 60 * 1000;

function at(dayOffset, hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const tenants = [
  {
    slug: "demo-salon",
    name: "Glow Salon",
    users: [
      { email: "owner@glowsalon.test", name: "Ayesha Khan", role: "owner" },
      { email: "staff@glowsalon.test", name: "Sara Ahmed", role: "staff" },
    ],
    bookings: [
      ["Maryam Ali", "maryam@example.com", "Haircut & Styling", at(-3, 11), 1, "completed", null],
      ["Hina Raza", "hina@example.com", "Bridal Makeup Trial", at(-1, 15), 2, "completed", "Bring reference photos"],
      ["Noor Fatima", "noor@example.com", "Hair Color", at(0, 10), 2, "scheduled", null],
      ["Zainab Malik", "zainab@example.com", "Manicure", at(0, 14, 30), 1, "scheduled", null],
      ["Iqra Shah", "iqra@example.com", "Facial", at(1, 12), 1, "scheduled", "Sensitive skin"],
      ["Sana Iqbal", "sana@example.com", "Haircut & Styling", at(2, 16), 1, "scheduled", null],
      ["Areeba Noman", "areeba@example.com", "Hair Treatment", at(4, 11), 2, "cancelled", "Customer rescheduled"],
      ["Mehwish Tariq", "mehwish@example.com", "Bridal Package", at(6, 9), 4, "scheduled", "Wedding on Saturday"],
      ["Laiba Hassan", "laiba@example.com", "Manicure & Pedicure", at(9, 13), 2, "scheduled", null],
    ],
  },
  {
    slug: "demo-clinic",
    name: "City Care Clinic",
    users: [{ email: "admin@citycare.test", name: "Dr. Bilal Qureshi", role: "owner" }],
    bookings: [
      ["Usman Farooq", "usman@example.com", "General Checkup", at(0, 9), 1, "scheduled", null],
      ["Fatima Zahra", "fatima@example.com", "Dental Cleaning", at(1, 10), 1, "scheduled", null],
      ["Hamza Butt", "hamza@example.com", "Follow-up Visit", at(3, 15), 1, "scheduled", null],
    ],
  },
];

try {
  await client.query("begin");
  for (const t of tenants) {
    const { rows } = await client.query(
      `insert into tenants (name, slug) values ($1, $2)
       on conflict (slug) do update set name = excluded.name
       returning id`,
      [t.name, t.slug],
    );
    const tenantId = rows[0].id;

    for (const u of t.users) {
      await client.query(
        `insert into users (tenant_id, email, name, role) values ($1, $2, $3, $4)
         on conflict (tenant_id, email) do update set name = excluded.name, role = excluded.role`,
        [tenantId, u.email, u.name, u.role],
      );
    }

    await client.query("delete from bookings where tenant_id = $1", [tenantId]);
    for (const [name, email, service, start, hours, status, notes] of t.bookings) {
      await client.query(
        `insert into bookings
           (tenant_id, customer_name, customer_email, service, starts_at, ends_at, status, notes)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tenantId, name, email, service, start, new Date(start.getTime() + hours * HOUR), status, notes],
      );
    }
    console.log(`Seeded ${t.name} (${t.slug}): ${t.users.length} users, ${t.bookings.length} bookings`);
  }
  await client.query("commit");
} catch (err) {
  await client.query("rollback");
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}