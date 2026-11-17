import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  console.log("Connecting to database...");
  const client = await pool.connect();
  try {
    console.log("Creating application_tasks table if not exists...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS application_tasks (
        id SERIAL PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        mobile_number TEXT NOT NULL,
        service_name TEXT NOT NULL,
        application_number TEXT,
        current_step TEXT NOT NULL DEFAULT 'Application Received',
        status TEXT NOT NULL DEFAULT 'In Progress',
        progress_percent INTEGER NOT NULL DEFAULT 20,
        steps JSONB NOT NULL DEFAULT '[]'::jsonb,
        priority TEXT NOT NULL DEFAULT 'Normal',
        target_date TEXT,
        assigned_staff TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Table application_tasks is ready!");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
