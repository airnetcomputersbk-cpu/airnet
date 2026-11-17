import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migration");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const INITIAL_SERVICES = [
  { position: 1, name: "Aadhaar", url: "https://myaadhaar.uidai.gov.in/", iconKey: "Fingerprint" },
  { position: 2, name: "PAN (NSDL)", url: "https://onlineservices.proteantech.in/paam/endUserRegisterContact.html", iconKey: "CreditCard" },
  { position: 3, name: "PAN (UTIITSL)", url: "https://www.pan.utiitsl.com/", iconKey: "CreditCard" },
  { position: 4, name: "Passport", url: "https://passportindia.gov.in/", iconKey: "Plane" },
  { position: 5, name: "Voter ID", url: "https://voters.eci.gov.in/", iconKey: "UserSquare" },
  { position: 6, name: "Ration Card", url: "https://ahara.karnataka.gov.in/", iconKey: "ShoppingCart" },
  { position: 7, name: "Nadakacheri", url: "https://nadakacheri.karnataka.gov.in/", iconKey: "Landmark" },
  { position: 8, name: "Birth/Death", url: "https://ejanma.karnataka.gov.in/", iconKey: "Activity" },
  { position: 9, name: "Udyam", url: "https://udyamregistration.gov.in/", iconKey: "Factory" },
  { position: 10, name: "Ayushman", url: "https://beneficiary.nha.gov.in/", iconKey: "HeartPulse" },
  { position: 11, name: "eShram", url: "https://eshram.gov.in/", iconKey: "HardHat" },
  { position: 12, name: "UDID", url: "https://www.swavlambancard.gov.in/", iconKey: "Accessibility" },
  { position: 13, name: "Karnataka Education", url: "https://kseab.karnataka.gov.in/", iconKey: "GraduationCap" },
  { position: 14, name: "KSRTC Pass", url: "https://ksrtc.karnataka.gov.in/", iconKey: "Bus" },
  { position: 15, name: "SSP", url: "https://ssp.postmatric.karnataka.gov.in/", iconKey: "GraduationCap" },
  { position: 16, name: "Bhoomi", url: "https://rtc.karnataka.gov.in/Service78/Login.aspx", iconKey: "Map" },
  { position: 17, name: "Parivahan", url: "https://parivahan.gov.in/", iconKey: "Car" },
  { position: 18, name: "Pahani", url: "https://landrecords.karnataka.gov.in/Service2/", iconKey: "ScrollText" },
  { position: 19, name: "Seva Sindhu", url: "https://sevasindhuservices.karnataka.gov.in", iconKey: "Globe" },
];

export async function initGovernmentServicesTable() {
  const client = await pool.connect();
  try {
    console.log("Ensuring government_services table exists in database...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS government_services (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        icon_key TEXT NOT NULL DEFAULT 'Globe',
        icon_type TEXT NOT NULL DEFAULT 'builtin',
        favicon_url TEXT,
        position INTEGER NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_gov_services_position ON government_services (position);
    `);

    const countRes = await client.query("SELECT COUNT(*)::int AS count FROM government_services");
    const count = countRes.rows[0]?.count || 0;
    console.log(`Current government_services count: ${count}`);

    if (count === 0) {
      console.log("Seeding 19 initial government services...");
      for (const item of INITIAL_SERVICES) {
        await client.query(
          `INSERT INTO government_services (id, name, url, icon_key, icon_type, position, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
           ON CONFLICT (id) DO NOTHING`,
          [item.position, item.name, item.url, item.iconKey, "builtin", item.position]
        );
      }
      // Set the sequence to after the highest id
      await client.query(`
        SELECT setval(pg_get_serial_sequence('government_services', 'id'), COALESCE((SELECT MAX(id) FROM government_services), 1) + 1, false);
      `);
      console.log("Successfully seeded 19 initial government services!");
    } else {
      console.log("government_services already has data, preserving existing records.");
    }
  } finally {
    client.release();
  }
}

// If executed directly:
if (process.argv[1] && process.argv[1].endsWith("init-government-services.mjs")) {
  initGovernmentServicesTable()
    .then(() => {
      console.log("Migration complete.");
      return pool.end();
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      pool.end();
      process.exit(1);
    });
}
