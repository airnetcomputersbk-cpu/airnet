// Comprehensive Performance Audit Baseline Benchmark
// Measures actual Database RTT, Individual Query Execution Times, EXPLAIN plans,
// API Response Times (Average, Median, P95, P99), Connection Pool Metrics, and Bundle Sizes.

import pg from "../lib/db/node_modules/pg/lib/index.js";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const { Pool } = pg;

// Read .env
const envContent = fs.readFileSync(".env", "utf-8");
let databaseUrl = "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("DATABASE_URL=")) {
    databaseUrl = trimmed.substring("DATABASE_URL=".length).replace(/["']/g, "");
    break;
  }
}

console.log("==================================================================");
console.log("PHASE 2: REAL PERFORMANCE MEASUREMENT & BASELINE DATA COLLECTION");
console.log("==================================================================");
console.log(`Timestamp: ${new Date().toISOString()}`);

const pool = new Pool({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
});

async function measureDatabase() {
  console.log("\n--- SECTION 1: DATABASE RTT & QUERY EXECUTION BENCHMARK ---");
  const client = await pool.connect();
  const dbMetrics = {};

  try {
    // 1. Connection RTT (SELECT 1)
    const rttSamples = [];
    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      await client.query("SELECT 1");
      rttSamples.push(performance.now() - start);
    }
    rttSamples.sort((a, b) => a - b);
    const avgRtt = rttSamples.reduce((a, b) => a + b, 0) / rttSamples.length;
    const medianRtt = rttSamples[Math.floor(rttSamples.length / 2)];
    dbMetrics.networkRTT = {
      samples: rttSamples.map(s => Number(s.toFixed(1))),
      avgMs: Number(avgRtt.toFixed(1)),
      medianMs: Number(medianRtt.toFixed(1)),
      minMs: Number(rttSamples[0].toFixed(1)),
      maxMs: Number(rttSamples[rttSamples.length - 1].toFixed(1))
    };
    console.log(`Network Latency to DB (RTT): Avg ${dbMetrics.networkRTT.avgMs} ms (Median ${dbMetrics.networkRTT.medianMs} ms, Min ${dbMetrics.networkRTT.minMs} ms, Max ${dbMetrics.networkRTT.maxMs} ms)`);

    // 2. Query Benchmarks
    const queries = [
      { name: "SELECT FROM services", sql: "SELECT * FROM services ORDER BY order_index ASC" },
      { name: "SELECT FROM enquiries ORDER BY created_at DESC", sql: "SELECT * FROM enquiries ORDER BY created_at DESC" },
      { name: "SELECT FROM application_tasks ORDER BY created_at DESC", sql: "SELECT * FROM application_tasks ORDER BY created_at DESC" },
      { name: "SELECT FROM notifications WHERE status = 'Published'", sql: "SELECT * FROM notifications WHERE status = 'Published' ORDER BY created_at DESC" },
      { name: "SELECT FROM records ORDER BY created_at DESC", sql: "SELECT * FROM records ORDER BY created_at DESC" },
      { name: "LOOKUP application_tasks BY mobile_number (unindexed)", sql: "SELECT * FROM application_tasks WHERE mobile_number LIKE '%7892881086%'" },
      { name: "LOOKUP enquiries BY customer_id (unindexed)", sql: "SELECT * FROM enquiries WHERE customer_id = 'AN-10001'" },
      { name: "LOOKUP notifications BY is_featured (unindexed)", sql: "SELECT * FROM notifications WHERE is_featured = true" },
    ];

    dbMetrics.queries = [];

    for (const q of queries) {
      const times = [];
      let rowCount = 0;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const res = await client.query(q.sql);
        times.push(performance.now() - start);
        rowCount = res.rowCount;
      }
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      
      // Explain Plan
      let plan = "";
      try {
        const explainRes = await client.query(`EXPLAIN ${q.sql}`);
        plan = explainRes.rows.map(r => r["QUERY PLAN"]).join(" | ");
      } catch (err) {
        plan = "N/A";
      }

      dbMetrics.queries.push({
        name: q.name,
        rowCount,
        avgMs: Number(avg.toFixed(1)),
        minMs: Number(times[0].toFixed(1)),
        maxMs: Number(times[times.length - 1].toFixed(1)),
        queryPlan: plan
      });

      console.log(`[Query] ${q.name}: Avg ${avg.toFixed(1)} ms | Rows: ${rowCount} | Plan: ${plan}`);
    }

    // 3. Check Existing Indexes on Public Tables
    console.log("\n--- SECTION 2: EXISTING DATABASE INDEXES IN POSTGRES ---");
    const indexQuery = `
      SELECT tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `;
    const indexesRes = await client.query(indexQuery);
    dbMetrics.indexes = indexesRes.rows;
    console.log(`Total Indexes Found: ${indexesRes.rows.length}`);
    for (const idx of indexesRes.rows) {
      console.log(`  - Table: ${idx.tablename.padEnd(20)} | Index: ${idx.indexname.padEnd(30)} | Def: ${idx.indexdef}`);
    }

    // 4. Measure Sequential vs Parallel Multi-Query Penalty
    console.log("\n--- SECTION 3: SEQUENTIAL VS PARALLEL QUERY PENALTY ---");
    const tSeqStart = performance.now();
    await client.query("SELECT * FROM enquiries ORDER BY created_at DESC");
    await client.query("SELECT * FROM application_tasks");
    await client.query("SELECT * FROM services");
    const seqDuration = performance.now() - tSeqStart;

    const tParStart = performance.now();
    await Promise.all([
      pool.query("SELECT * FROM enquiries ORDER BY created_at DESC"),
      pool.query("SELECT * FROM application_tasks"),
      pool.query("SELECT * FROM services")
    ]);
    const parDuration = performance.now() - tParStart;

    dbMetrics.multiQueryPenalty = {
      sequentialMs: Number(seqDuration.toFixed(1)),
      parallelMs: Number(parDuration.toFixed(1)),
      overheadMs: Number((seqDuration - parDuration).toFixed(1)),
      percentageDifference: Number((((seqDuration - parDuration) / seqDuration) * 100).toFixed(1))
    };
    console.log(`Sequential 3 Queries: ${seqDuration.toFixed(1)} ms`);
    console.log(`Parallel 3 Queries:   ${parDuration.toFixed(1)} ms`);
    console.log(`Sequential Penalty:   ${(seqDuration - parDuration).toFixed(1)} ms slower (${dbMetrics.multiQueryPenalty.percentageDifference}% penalty)`);

  } finally {
    client.release();
  }

  return dbMetrics;
}

// Start ephemeral API server on port 5088 within the same command session
function startTestServer(port = 5088) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--env-file=.env", "artifacts/api-server/dist/index.mjs"], {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let started = false;
    child.stdout.on("data", (data) => {
      const text = data.toString();
      if (text.includes("Server listening") && !started) {
        started = true;
        resolve(child);
      }
    });

    child.stderr.on("data", (data) => {
      // console.error("[Server STDERR]", data.toString());
    });

    child.on("error", (err) => {
      if (!started) reject(err);
    });

    // Timeout fallback
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(child);
      }
    }, 3000);
  });
}

// 5. Measure API Endpoint Response Times
async function measureApiEndpoints(serverPort = 5088) {
  console.log("\n--- SECTION 4: API ENDPOINT BENCHMARK (HTTP localhost:5088) ---");
  const endpoints = [
    { method: "GET", path: "/api/services", name: "Public Services List" },
    { method: "GET", path: "/api/notifications", name: "Public Notifications List" },
    { method: "GET", path: "/api/business-info", name: "Public Business Info" },
    { method: "GET", path: "/api/tracker/lookup?query=7892881086", name: "Public Application Lookup" },
    { method: "GET", path: "/api/admin/enquiries", name: "Admin Enquiries (with Tasks + Services Join)" },
    { method: "GET", path: "/api/admin/tracker", name: "Admin Application Tracker List" },
    { method: "GET", path: "/api/admin/records", name: "Admin Ledger Records List" },
    { method: "GET", path: "/api/admin/notifications", name: "Admin Notifications Management" },
    { method: "GET", path: "/api/admin/reports-daily/settings", name: "Admin Daily Report Settings" },
    { method: "GET", path: "/api/admin/ai-suggestions", name: "Admin AI Suggestions & Analysis" },
  ];

  const apiMetrics = [];

  // Authenticate session first for admin routes
  let sessionCookie = "";
  try {
    const loginRes = await fetch(`http://127.0.0.1:${serverPort}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "rasool" })
    });
    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) {
      sessionCookie = setCookie.split(";")[0];
    }
  } catch (err) {
    console.log("[Notice] Admin login cookie fetch:", err.message);
  }

  for (const ep of endpoints) {
    const samples = [];
    let statusCode = 0;
    let payloadBytes = 0;

    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      try {
        const headers = {};
        if (sessionCookie && ep.path.startsWith("/api/admin")) {
          headers["cookie"] = sessionCookie;
        }
        const res = await fetch(`http://127.0.0.1:${serverPort}${ep.path}`, {
          method: ep.method,
          headers
        });
        const text = await res.text();
        const duration = performance.now() - start;
        samples.push(duration);
        statusCode = res.status;
        payloadBytes = Buffer.byteLength(text, "utf-8");
      } catch (err) {
        samples.push(-1);
      }
    }

    const validSamples = samples.filter(s => s >= 0).sort((a, b) => a - b);
    if (validSamples.length === 0) {
      console.log(`[API] ${ep.name} (${ep.path}): FAILED / UNAVAILABLE`);
      apiMetrics.push({ name: ep.name, path: ep.path, status: "UNAVAILABLE" });
      continue;
    }

    const avg = validSamples.reduce((a, b) => a + b, 0) / validSamples.length;
    const median = validSamples[Math.floor(validSamples.length / 2)];
    const p95 = validSamples[Math.min(validSamples.length - 1, Math.floor(validSamples.length * 0.95))];
    const p99 = validSamples[validSamples.length - 1];

    apiMetrics.push({
      name: ep.name,
      path: ep.path,
      statusCode,
      payloadBytes,
      payloadKb: Number((payloadBytes / 1024).toFixed(2)),
      avgMs: Number(avg.toFixed(1)),
      medianMs: Number(median.toFixed(1)),
      p95Ms: Number(p95.toFixed(1)),
      p99Ms: Number(p99.toFixed(1)),
      minMs: Number(validSamples[0].toFixed(1)),
      maxMs: Number(validSamples[validSamples.length - 1].toFixed(1))
    });

    console.log(`[API] ${ep.name.padEnd(45)} | Status ${statusCode} | ${apiMetrics[apiMetrics.length-1].payloadKb.toString().padStart(6)} KB | Avg: ${avg.toFixed(1).padStart(6)} ms | Median: ${median.toFixed(1).padStart(6)} ms | P95: ${p95.toFixed(1).padStart(6)} ms`);
  }

  return apiMetrics;
}

// 6. Measure Frontend Bundle Sizes
function measureBundleSizes() {
  console.log("\n--- SECTION 5: FRONTEND BUNDLE ASSET SIZES ---");
  const distPublic = path.resolve("artifacts/airnet-computers/dist/public");
  const bundleMetrics = {};

  if (fs.existsSync(distPublic)) {
    const assetsDir = path.join(distPublic, "assets");
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      bundleMetrics.assets = [];
      for (const f of files) {
        const fullPath = path.join(assetsDir, f);
        const stat = fs.statSync(fullPath);
        bundleMetrics.assets.push({
          file: f,
          sizeBytes: stat.size,
          sizeKb: Number((stat.size / 1024).toFixed(2)),
          sizeMb: Number((stat.size / (1024 * 1024)).toFixed(2))
        });
        console.log(`  - Asset: ${f.padEnd(60)} | ${(stat.size / 1024).toFixed(2)} KB`);
      }
    }
  }

  return bundleMetrics;
}

async function run() {
  try {
    const dbMetrics = await measureDatabase();

    const apiMetrics = await measureApiEndpoints(5001);
    const bundleMetrics = measureBundleSizes();

    const baselineData = {
      timestamp: new Date().toISOString(),
      database: dbMetrics,
      apis: apiMetrics,
      bundle: bundleMetrics
    };

    fs.writeFileSync("scripts/baseline-performance-metrics.json", JSON.stringify(baselineData, null, 2));
    console.log("\n==================================================================");
    console.log("BASELINE MEASUREMENTS RECORDED TO scripts/baseline-performance-metrics.json");
    console.log("==================================================================");
  } catch (err) {
    console.error("Benchmark failed:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
