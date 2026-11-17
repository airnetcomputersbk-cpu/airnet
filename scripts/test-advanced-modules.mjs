// Advanced End-to-End Test Suite for Airnet Computers
// Tests Pathway, Documents/Drive, AI Suggestions, Reports Analytics, and Advanced Integrations
import http from "node:http";

const API_BASE = "http://127.0.0.1:5001";
const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || "airnet";

export const advancedResults = [];
let adminToken = "";

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (adminToken && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  const start = Date.now();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const duration = Date.now() - start;
    const contentType = res.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else if (contentType.includes("application/pdf")) {
      const buf = await res.arrayBuffer();
      data = { isBuffer: true, length: buf.byteLength };
    } else {
      data = await res.text().catch(() => null);
    }
    return { ok: res.ok, status: res.status, data, duration };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, duration: Date.now() - start };
  }
}

async function test(id, module, scenario, executor) {
  process.stdout.write(`[TEST] [${id}] ${scenario.padEnd(65)} ... `);
  const start = Date.now();
  try {
    const result = await executor();
    const duration = Date.now() - start;
    if (result.passed) {
      console.log(`\x1b[32m✔ PASS\x1b[0m \x1b[90m(${duration}ms)\x1b[0m`);
      advancedResults.push({ id, module, scenario, status: "PASS", duration, actual: result.actual });
    } else {
      console.log(`\x1b[31m✖ FAIL\x1b[0m: ${result.error || "Unexpected result"}`);
      advancedResults.push({ id, module, scenario, status: "FAIL", duration, error: result.error });
    }
  } catch (err) {
    console.log(`\x1b[31m✖ EXCEPTION\x1b[0m: ${err.message}`);
    advancedResults.push({ id, module, scenario, status: "FAIL", error: err.message });
  }
}

async function run() {
  console.log("========================================================================");
  console.log("  ADVANCED MODULES QA TEST SUITE: Pathway, Documents, AI, Reports");
  console.log("========================================================================");

  // 1. Auth Setup
  const loginRes = await api("/api/admin/login", { method: "POST", body: { password: ADMIN_PASSWORD } });
  if (loginRes.ok && loginRes.data?.token) {
    adminToken = loginRes.data.token;
    console.log(`✔ Authenticated as Admin (token: ${adminToken})\n`);
  } else {
    console.error("Failed to authenticate as admin for test suite");
    process.exit(1);
  }

  // =========================================================================
  // MODULE 12: Government Services API
  // =========================================================================
  console.log("--- Module 12: Government Services API ---");

  await test("TC-GOV-01", "Government Services", "Public GET /api/government-services returns full seeded list", async () => {
    const res = await api("/api/government-services");
    return {
      passed: res.ok && Array.isArray(res.data) && res.data.length >= 19,
      actual: `Found ${res.data?.length} services`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-GOV-02", "Government Services", "Admin GET /api/admin/government-services returns ordered list", async () => {
    const res = await api("/api/admin/government-services");
    const isOrdered = res.data && res.data.every((s, i) => s.position === i + 1);
    return {
      passed: res.ok && isOrdered,
      actual: `Verified sequential 1..${res.data?.length} order`,
      error: `Ordering mismatch or status ${res.status}`,
    };
  });

  // =========================================================================
  // MODULE 13: Customer Documents & Google Drive API
  // =========================================================================
  console.log("\n--- Module 13: Customer Documents & Google Drive API ---");

  await test("TC-DOC-01", "Customer Documents", "Retrieve customer documents dossiers list (/api/admin/documents/customers)", async () => {
    const res = await api("/api/admin/documents/customers");
    const hasList = res.ok && Array.isArray(res.data?.customers);
    return {
      passed: hasList,
      actual: `Retrieved ${res.data?.customers?.length} customer dossiers (Completed: ${res.data?.totalCompleted}, All: ${res.data?.totalAll})`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-DOC-02", "Customer Documents", "Check Google Drive OAuth & folder connection status", async () => {
    const res = await api("/api/admin/google-drive/status");
    return {
      passed: res.ok && res.data && typeof res.data.connected === "boolean",
      actual: `Drive status: ${res.data?.connected ? "Connected" : "Disconnected"} (${res.data?.accountEmail || "None"})`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-DOC-03", "Customer Documents", "Retrieve Document Activity Audit Logs", async () => {
    const res = await api("/api/admin/documents/activity-logs");
    return {
      passed: res.ok && Array.isArray(res.data),
      actual: `Retrieved ${res.data?.length} audit log entries`,
      error: `Status: ${res.status}`,
    };
  });

  // =========================================================================
  // MODULE 14: Pathway Floating System & Universal Extension API
  // =========================================================================
  console.log("\n--- Module 14: Pathway Floating System & Universal Extension API ---");

  await test("TC-PTH-01", "Pathway Floating System", "Unauthenticated GET /api/pathway/customers returns live customer dossiers", async () => {
    const res = await api("/api/pathway/customers", { headers: { Authorization: "" } });
    const hasCustomers = res.ok && Array.isArray(res.data?.customers) && res.data.customers.length > 0;
    return {
      passed: hasCustomers,
      actual: `Retrieved ${res.data?.customers?.length} dossiers (Total: ${res.data?.total})`,
      error: `Failed to retrieve unauthenticated pathway customers: ${res.status}`,
    };
  });

  let testCustId = null;
  await test("TC-PTH-02", "Pathway Floating System", "Retrieve individual customer dossier by ID (/api/pathway/customer/:id)", async () => {
    const listRes = await api("/api/pathway/customers");
    testCustId = listRes.data?.customers?.[0]?.customerId || listRes.data?.customers?.[0]?.id;
    if (!testCustId) return { passed: false, error: "No customer found to query" };

    const res = await api(`/api/pathway/customer/${encodeURIComponent(testCustId)}`, { headers: { Authorization: "" } });
    const c = res.data?.customer;
    const hasDetails = res.ok && c && c.customerName && c.serviceName && Array.isArray(c.steps);
    return {
      passed: hasDetails,
      actual: `Customer: ${c?.customerName}, Service: ${c?.serviceName}, Steps: ${c?.steps?.length}`,
      error: `Failed to fetch customer details for ID ${testCustId}: ${res.status}`,
    };
  });

  await test("TC-PTH-03", "Pathway Floating System", "Verify embedded standalone script delivery (/api/pathway/embed.js)", async () => {
    const res = await api("/api/pathway/embed.js");
    const isScript = res.ok && typeof res.data === "string" && res.data.includes("airnet-pathway-embed-root");
    return {
      passed: isScript,
      actual: `Delivered valid JavaScript payload (${res.data?.length} bytes)`,
      error: `Status: ${res.status}`,
    };
  });

  // =========================================================================
  // MODULE 15: AI Suggestions & Recommendations Engine
  // =========================================================================
  console.log("\n--- Module 15: AI Suggestions & Recommendations Engine ---");

  await test("TC-AIS-01", "AI Recommendations", "Fetch smart AI suggestions & service patterns (/api/admin/ai-suggestions)", async () => {
    const res = await api("/api/admin/ai-suggestions");
    const hasData = res.ok && res.data && Array.isArray(res.data.recommendations);
    return {
      passed: hasData,
      actual: `Found ${res.data?.recommendations?.length} recommendations (Total: ${res.data?.totalRecommendations}, Approved: ${res.data?.approvedCount})`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-AIS-02", "AI Recommendations", "Trigger AI re-analysis on demand (/api/admin/ai-suggestions/reanalyze)", async () => {
    const res = await api("/api/admin/ai-suggestions/reanalyze", { method: "POST" });
    const hasData = res.ok && res.data && res.data.totalRecommendations !== undefined;
    return {
      passed: hasData,
      actual: `Re-analyzed system: Total ${res.data?.totalRecommendations} recommendations generated`,
      error: `Status: ${res.status}`,
    };
  });

  // =========================================================================
  // MODULE 16: Daily Reports & Scheduler Engine
  // =========================================================================
  console.log("\n--- Module 16: Daily Reports & Scheduler Engine ---");

  await test("TC-DLR-01", "Daily Reports", "Fetch Daily Report settings & configured email schedule", async () => {
    const res = await api("/api/admin/reports-daily/settings");
    const s = res.data?.settings;
    const ok = res.ok && s && s.adminEmail && s.scheduledTime;
    return {
      passed: ok,
      actual: `Admin: ${s?.adminEmail}, Recipient: ${s?.recipientEmail}, Scheduled: ${s?.scheduledTime} ${s?.timeZone}`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-DLR-02", "Daily Reports", "Calculate dynamic daily metrics snapshot (/api/admin/reports-daily/data)", async () => {
    const res = await api("/api/admin/reports-daily/data");
    const ok = res.ok && res.data && res.data.reportDate && res.data.totalRequests !== undefined;
    return {
      passed: ok,
      actual: `ReportDate: ${res.data?.reportDate}, TotalRequests: ${res.data?.totalRequests}, Overdue: ${res.data?.overdueRequestsCount}, Attention: ${res.data?.immediateAttention?.length}`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-DLR-03", "Daily Reports", "Generate and stream Daily Report PDF document (/api/admin/reports-daily/pdf)", async () => {
    const res = await api("/api/admin/reports-daily/pdf");
    const ok = res.ok && res.data && res.data.isBuffer && res.data.length > 1000;
    return {
      passed: ok,
      actual: `Generated PDF stream of ${res.data?.length} bytes`,
      error: `Status: ${res.status}`,
    };
  });

  // =========================================================================
  // MODULE 17: Reports & Analytics Engine
  // =========================================================================
  console.log("\n--- Module 17: Reports & Analytics Engine ---");

  await test("TC-RPA-01", "Reports & Analytics", "Verify records ledger list returns valid accounting data", async () => {
    const res = await api("/api/admin/records");
    return {
      passed: res.ok && Array.isArray(res.data),
      actual: `Found ${res.data?.length} ledger records`,
      error: `Status: ${res.status}`,
    };
  });

  await test("TC-RPA-02", "Reports & Analytics", "Verify application tracker tasks return complete payment fields", async () => {
    const res = await api("/api/admin/tracker");
    const hasTasks = res.ok && Array.isArray(res.data);
    const validFields = hasTasks && res.data.every((t) => t.paymentType !== undefined && t.amountPaid !== undefined);
    return {
      passed: hasTasks && validFields,
      actual: `Verified ${res.data?.length} tracker tasks with paymentType & amountPaid`,
      error: `Status: ${res.status}`,
    };
  });

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log("\n========================================================================");
  console.log("  ADVANCED QA SUITE RESULTS");
  console.log("========================================================================");
  const passed = advancedResults.filter(r => r.status === "PASS").length;
  const failed = advancedResults.filter(r => r.status === "FAIL").length;
  console.log(`Total Executed: ${advancedResults.length}`);
  console.log(`✔ Passed:       ${passed}`);
  console.log(`✖ Failed:       ${failed}`);
  console.log(`Pass Rate:      ${Math.round((passed / advancedResults.length) * 100)}%`);

  if (failed > 0) process.exit(1);
}

run();
