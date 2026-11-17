import http from "node:http";
import { performance } from "perf_hooks";

console.log("==================================================================");
console.log("  SIMULATING USER PAGE REFRESH: BENCHMARKING ALL ENDPOINTS SPEED  ");
console.log("==================================================================");

function request(path, cookie = "") {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const req = http.request(
      {
        hostname: "localhost",
        port: 5001,
        path,
        method: "GET",
        headers: cookie ? { Cookie: cookie } : {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const duration = performance.now() - start;
          resolve({
            path,
            statusCode: res.statusCode,
            cacheHeader: res.headers["x-cache"] || "NONE",
            duration: duration.toFixed(2),
            itemCount: Array.isArray(JSON.parse(data || "[]")) ? JSON.parse(data).length : "Object",
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  // Login to get admin cookie
  const loginRes = await new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 5001,
        path: "/api/admin/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (res) => {
        const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0] || "";
        resolve(cookie);
      }
    );
    req.write(JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD || "airnet" }));
    req.end();
  });

  const endpoints = [
    { path: "/api/services", auth: false, desc: "Public Services Catalog" },
    { path: "/api/notifications", auth: false, desc: "Public Notifications List" },
    { path: "/api/business-info", auth: false, desc: "Public Business & Contact Info" },
    { path: "/api/admin/enquiries", auth: true, desc: "Admin Enquiry Management" },
    { path: "/api/admin/tracker", auth: true, desc: "Admin Application Tracker" },
    { path: "/api/admin/records", auth: true, desc: "Admin Accounts & Ledger Records" },
    { path: "/api/admin/notifications", auth: true, desc: "Admin Notifications Management" },
    { path: "/api/admin/reports-daily/settings", auth: true, desc: "Admin Daily Report Settings" },
    { path: "/api/admin/settings", auth: true, desc: "Admin Master Settings & Mobile" },
    { path: "/api/admin/pathway/customers", auth: false, desc: "Pathway Floating Hub Customers" },
    { path: "/api/admin/documents/customers", auth: true, desc: "Customer Documents & Storage" },
  ];

  console.log("\nSimulating 1st Page Refresh (all 9 endpoints loaded):");
  console.log("------------------------------------------------------------------");
  for (const ep of endpoints) {
    const cookie = ep.auth ? loginRes : "";
    const res = await request(ep.path, cookie);
    console.log(`  ${ep.path.padEnd(35)} | ${res.duration.padStart(6)} ms | X-Cache: ${res.cacheHeader.padEnd(4)} | Status: ${res.statusCode} (${ep.desc})`);
  }

  console.log("\nSimulating 2nd Page Refresh (immediate user re-refresh / navigation):");
  console.log("------------------------------------------------------------------");
  const refreshTimes = [];
  for (const ep of endpoints) {
    const cookie = ep.auth ? loginRes : "";
    const res = await request(ep.path, cookie);
    refreshTimes.push(parseFloat(res.duration));
    console.log(`  ${ep.path.padEnd(35)} | ${res.duration.padStart(6)} ms | X-Cache: ${res.cacheHeader.padEnd(4)} | Status: ${res.statusCode} (${ep.desc})`);
  }

  const avgRefreshTime = (refreshTimes.reduce((a, b) => a + b, 0) / refreshTimes.length).toFixed(2);
  console.log("\n==================================================================");
  console.log(`  AVERAGE DATA FETCHING LATENCY DURING REFRESH: ${avgRefreshTime} ms`);
  console.log("==================================================================");

  if (parseFloat(avgRefreshTime) < 50) {
    console.log(">>> SUCCESS: BACKEND DATA FETCHING IS INSTANTANEOUS (< 50ms)! <<<");
    process.exit(0);
  } else {
    console.log(">>> WARNING: Average latency exceeded 50ms <<<");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
