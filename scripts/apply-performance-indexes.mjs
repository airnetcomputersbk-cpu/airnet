// Script to create necessary secondary indexes on PostgreSQL database tables
import pg from "../lib/db/node_modules/pg/lib/index.js";
import fs from "fs";

const { Pool } = pg;

const envContent = fs.readFileSync(".env", "utf-8");
let databaseUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/["']/g, "");
    break;
  }
}

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
});

async function applyIndexes() {
  console.log("Connecting to PostgreSQL to apply performance indexes...");
  const client = await pool.connect();
  try {
    const indexStatements = [
      // 1. Enquiries Table
      "CREATE INDEX IF NOT EXISTS idx_enquiries_customer_id ON enquiries (customer_id);",
      "CREATE INDEX IF NOT EXISTS idx_enquiries_mobile_number ON enquiries (mobile_number);",
      "CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries (application_status);",
      "CREATE INDEX IF NOT EXISTS idx_enquiries_created_at_desc ON enquiries (created_at DESC);",

      // 2. Application Tasks Table
      "CREATE INDEX IF NOT EXISTS idx_app_tasks_customer_id ON application_tasks (customer_id);",
      "CREATE INDEX IF NOT EXISTS idx_app_tasks_mobile_number ON application_tasks (mobile_number);",
      "CREATE INDEX IF NOT EXISTS idx_app_tasks_status ON application_tasks (status);",
      "CREATE INDEX IF NOT EXISTS idx_app_tasks_created_at_desc ON application_tasks (created_at DESC);",

      // 3. Notifications Table
      "CREATE INDEX IF NOT EXISTS idx_notifications_featured ON notifications (is_featured);",
      "CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);",
      "CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications (category);",
      "CREATE INDEX IF NOT EXISTS idx_notifications_created_at_desc ON notifications (created_at DESC);",

      // 4. Services Table
      "CREATE INDEX IF NOT EXISTS idx_services_active_order ON services (is_active, order_index ASC);",
      "CREATE INDEX IF NOT EXISTS idx_services_category ON services (category);",

      // 5. Records Table
      "CREATE INDEX IF NOT EXISTS idx_records_customer_id ON records (customer_id);",
      "CREATE INDEX IF NOT EXISTS idx_records_mobile ON records (mobile_number);",
      "CREATE INDEX IF NOT EXISTS idx_records_created_at_desc ON records (created_at DESC);",

      // 6. Chat Messages Table
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_id ON chat_messages (conversation_id);",

      // 7. Daily Report Logs Table
      "CREATE INDEX IF NOT EXISTS idx_report_logs_date ON daily_report_logs (report_date DESC);",
    ];

    console.log(`Executing ${indexStatements.length} index creation statements...`);
    for (const sql of indexStatements) {
      const start = performance.now();
      await client.query(sql);
      const dur = performance.now() - start;
      console.log(`[OK] (${dur.toFixed(1)} ms) ${sql}`);
    }

    // Verify created indexes
    const checkRes = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `);
    console.log(`\nVerified: Total indexes on public schema now: ${checkRes.rows.length}`);
    for (const row of checkRes.rows) {
      console.log(`  - ${row.tablename.padEnd(20)}: ${row.indexname}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

applyIndexes().catch((err) => {
  console.error("Index creation failed:", err);
  process.exit(1);
});
