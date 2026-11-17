import pg from "../lib/db/node_modules/pg/lib/index.js";
import { performance } from "perf_hooks";

const { Pool } = pg;
const dbUrl = "postgresql://postgres:AirnetAdmin123!@34.73.135.147:5432/airnet_db";

console.log("Benchmarking PostgreSQL connection to Google Cloud VM...");

const pool = new Pool({
  connectionString: dbUrl,
  max: 10,
  idleTimeoutMillis: 300000, // 5 minutes
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

async function run() {
  console.log("Acquiring 1st client (includes TCP + Auth)...");
  const t0 = performance.now();
  const client1 = await pool.connect();
  const t1 = performance.now();
  console.log(`Client 1 connected in ${(t1 - t0).toFixed(1)}ms`);

  console.log("Running simple SELECT 1...");
  const t2 = performance.now();
  await client1.query("SELECT 1");
  const t3 = performance.now();
  console.log(`SELECT 1 executed in ${(t3 - t2).toFixed(1)}ms`);

  console.log("Running SELECT * FROM services...");
  const t4 = performance.now();
  const resServices = await client1.query("SELECT * FROM services");
  const t5 = performance.now();
  console.log(`SELECT * FROM services (${resServices.rows.length} rows) in ${(t5 - t4).toFixed(1)}ms`);

  client1.release();

  console.log("\nAcquiring 2nd client from pool (connection reused)...");
  const t6 = performance.now();
  const client2 = await pool.connect();
  const t7 = performance.now();
  console.log(`Client 2 connected in ${(t7 - t6).toFixed(1)}ms`);

  console.log("Running SELECT * FROM services on reused connection...");
  const t8 = performance.now();
  await client2.query("SELECT * FROM services");
  const t9 = performance.now();
  console.log(`SELECT * FROM services in ${(t9 - t8).toFixed(1)}ms`);

  client2.release();
  await pool.end();
}

run().catch(console.error);
