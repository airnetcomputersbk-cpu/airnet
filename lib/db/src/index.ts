import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

const { Pool } = pg;

const defaultDbUrl = "postgresql://postgres:AirnetAdmin123!@34.73.135.147:5432/airnet_db";
const dbConnectionString = (process.env.DATABASE_URL || defaultDbUrl).trim();

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

export const pool = new Pool({
  connectionString: dbConnectionString,
  min: isServerless ? 0 : 2,
  max: isServerless ? 5 : 20,
  idleTimeoutMillis: isServerless ? 10000 : 0,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  statement_timeout: 10000,
  application_name: "airnet_api",
  ssl: dbConnectionString.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

// Periodic TCP & NAT keepalive heartbeat ping every 25 seconds (standalone server only, skipped in serverless)
if (!isServerless) {
  const heartbeat = setInterval(() => {
    pool.query("SELECT 1").catch(() => {});
  }, 25000);
  if (heartbeat.unref) heartbeat.unref();
}

export const db = drizzle(pool, { schema });

export * from "./schema/index";
