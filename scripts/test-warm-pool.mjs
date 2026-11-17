import pg from "../lib/db/node_modules/pg/lib/index.js";
import { performance } from "perf_hooks";

const { Pool } = pg;
const dbUrl = "postgresql://postgres:AirnetAdmin123!@34.73.135.147:5432/airnet_db";

const pool = new Pool({
  connectionString: dbUrl,
  min: 3, // keep at least 3 connections warm
  max: 20,
  idleTimeoutMillis: 0, // never drop warm connections
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

async function run() {
  console.log("=== Testing Pre-Warmed Pool ===");
  // Pre-warm connections concurrently
  const t0 = performance.now();
  const clients = await Promise.all([
    pool.connect(),
    pool.connect(),
    pool.connect(),
  ]);
  console.log(`Pre-warmed 3 connections in ${(performance.now() - t0).toFixed(1)}ms`);

  // Release them back to pool so they are instantly available
  clients.forEach((c) => c.release());

  console.log("\nSimulating user page refresh (acquiring connection from warm pool)...");
  for (let i = 1; i <= 5; i++) {
    const startAcquire = performance.now();
    const c = await pool.connect();
    const acquireTime = performance.now() - startAcquire;

    const startQuery = performance.now();
    await c.query("SELECT * FROM services LIMIT 10");
    const queryTime = performance.now() - startQuery;
    c.release();

    console.log(`Request ${i}: Connection acquired in ${acquireTime.toFixed(2)}ms | Query executed in ${queryTime.toFixed(1)}ms | Total: ${(acquireTime + queryTime).toFixed(1)}ms`);
  }

  await pool.end();
}

run().catch(console.error);
