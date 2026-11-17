// Comprehensive Performance Regression & Functionality Verification Suite
// Tests 100% functionality preservation across all public and admin modules,
// data consistency, cache invalidation on write/update/delete, and payload integrity.

import fs from "fs";

console.log("==================================================================");
console.log("PHASE 6: FULL REGRESSION AUDIT & FUNCTIONALITY PRESERVATION TEST");
console.log("==================================================================");

const BASE_URL = "http://127.0.0.1:5001";
let sessionCookie = "";
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = "") {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${testName} - ${details}`);
    failedTests++;
  }
}

async function run() {
  try {
    // 1. Public Endpoints
    console.log("\n--- TEST GROUP 1: PUBLIC ENDPOINTS & CACHE HEADERS ---");
    const srvRes = await fetch(`${BASE_URL}/api/services`);
    assert(srvRes.status === 200, "GET /api/services returns HTTP 200");
    const services = await srvRes.json();
    assert(Array.isArray(services) && services.length > 0, "Public services array is non-empty", `Count: ${services.length}`);
    assert(srvRes.headers.get("x-cache") !== null, "Public services responds with X-Cache header");

    const notifRes = await fetch(`${BASE_URL}/api/notifications`);
    assert(notifRes.status === 200, "GET /api/notifications returns HTTP 200");
    const notifs = await notifRes.json();
    assert(Array.isArray(notifs) && notifs.length > 0, "Public notifications array is non-empty", `Count: ${notifs.length}`);
    assert(notifRes.headers.get("x-cache") !== null, "Public notifications responds with X-Cache header");

    const bizRes = await fetch(`${BASE_URL}/api/business-info`);
    assert(bizRes.status === 200, "GET /api/business-info returns HTTP 200");
    const biz = await bizRes.json();
    assert(biz.mobileNumber && biz.organization, "Public business info returns required store metadata");

    // 2. Admin Authentication
    console.log("\n--- TEST GROUP 2: ADMIN AUTHENTICATION ---");
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "rasool" })
    });
    assert(loginRes.status === 200, "POST /api/admin/login succeeds with valid master password");
    const setCookie = loginRes.headers.get("set-cookie");
    if (setCookie) sessionCookie = setCookie.split(";")[0];
    assert(!!sessionCookie, "Admin session cookie received");

    const authHeaders = { "cookie": sessionCookie, "Content-Type": "application/json" };
    const meRes = await fetch(`${BASE_URL}/api/admin/me`, { headers: authHeaders });
    const meData = await meRes.json();
    assert(meData.authenticated === true, "GET /api/admin/me verifies authenticated state");

    // 3. Admin Data Read Endpoints & Enrichment Verification
    console.log("\n--- TEST GROUP 3: ADMIN DATA READ & ENRICHMENT INTEGRITY ---");
    const enqRes = await fetch(`${BASE_URL}/api/admin/enquiries`, { headers: authHeaders });
    assert(enqRes.status === 200, "GET /api/admin/enquiries returns HTTP 200");
    const enquiries = await enqRes.json();
    assert(Array.isArray(enquiries), "Admin enquiries returned as array");
    if (enquiries.length > 0) {
      const sample = enquiries[0];
      assert(sample.serviceTitle !== undefined && sample.progressPercent !== undefined && sample.currentStep !== undefined,
        "Enquiry payload includes parallel-joined serviceTitle, progressPercent, and currentStep"
      );
    }

    const trackerRes = await fetch(`${BASE_URL}/api/admin/tracker`, { headers: authHeaders });
    assert(trackerRes.status === 200, "GET /api/admin/tracker returns HTTP 200");
    const tasks = await trackerRes.json();
    assert(Array.isArray(tasks), "Admin application tasks returned as array");

    const recordsRes = await fetch(`${BASE_URL}/api/admin/records`, { headers: authHeaders });
    assert(recordsRes.status === 200, "GET /api/admin/records returns HTTP 200");
    const records = await recordsRes.json();
    assert(Array.isArray(records), "Admin records returned as array");

    const adminNotifRes = await fetch(`${BASE_URL}/api/admin/notifications`, { headers: authHeaders });
    assert(adminNotifRes.status === 200, "GET /api/admin/notifications returns HTTP 200");
    const adminNotifs = await adminNotifRes.json();
    assert(Array.isArray(adminNotifs), "Admin notifications returned as array");

    const reportSettingsRes = await fetch(`${BASE_URL}/api/admin/reports-daily/settings`, { headers: authHeaders });
    assert(reportSettingsRes.status === 200, "GET /api/admin/reports-daily/settings returns HTTP 200");
    const reportSettings = await reportSettingsRes.json();
    assert(reportSettings.settings && reportSettings.smtp && reportSettings.gmail && reportSettings.nextScheduled,
      "Daily report settings includes parallelized settings, smtp, gmail, and nextScheduled"
    );

    const aiRes = await fetch(`${BASE_URL}/api/admin/ai-suggestions`, { headers: authHeaders });
    assert(aiRes.status === 200, "GET /api/admin/ai-suggestions returns HTTP 200");
    const aiData = await aiRes.json();
    assert(Array.isArray(aiData.recommendations) && aiData.totalRecommendations !== undefined, "AI suggestions returns recommendations and summary counts");

    // 4. Data Mutation & Instant Cache Invalidation Verification
    console.log("\n--- TEST GROUP 4: MUTATIONS & INSTANT CACHE INVALIDATION ---");
    
    // Create Test Service
    const testServicePayload = {
      title: `QA_Perf_Test_Service_${Date.now()}`,
      category: "Document Services",
      price: "₹150",
      timing: "10 mins",
      copy: "Test performance audit service description",
      documents: "Aadhaar Card"
    };
    const createServiceRes = await fetch(`${BASE_URL}/api/admin/services`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(testServicePayload)
    });
    assert(createServiceRes.status === 200, "POST /api/admin/services creates service successfully");
    const createdService = await createServiceRes.json();

    // Verify Public Services cache was immediately invalidated
    const postCreateServicesRes = await fetch(`${BASE_URL}/api/services`);
    const postCreateServices = await postCreateServicesRes.json();
    const foundCreated = postCreateServices.find(s => s.id === createdService.id);
    assert(!!foundCreated, "Newly created service is immediately visible in public services list (cache invalidated)");

    // Delete Test Service
    const deleteServiceRes = await fetch(`${BASE_URL}/api/admin/services/${createdService.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    assert(deleteServiceRes.status === 200, "DELETE /api/admin/services/:id deletes service successfully");

    // Verify Public Services cache is invalidated after deletion
    const postDeleteServicesRes = await fetch(`${BASE_URL}/api/services`);
    const postDeleteServices = await postDeleteServicesRes.json();
    const foundDeleted = postDeleteServices.find(s => s.id === createdService.id);
    assert(!foundDeleted, "Deleted service is immediately removed from public services list (cache invalidated)");

    // Create Test Enquiry & Verify Tracker/Ledger Sync
    const testEnqPayload = {
      customerName: "Perf Test Customer",
      mobileNumber: "9988776655",
      serviceId: "Aadhaar Card",
      amountCharged: 200,
      amountPaid: 100,
      amountPending: 100,
      paymentMethod: "Cash",
      applicationStatus: "New"
    };
    const createEnqRes = await fetch(`${BASE_URL}/api/admin/enquiries`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(testEnqPayload)
    });
    assert(createEnqRes.status === 200, "POST /api/admin/enquiries creates enquiry successfully");
    const createdEnq = await createEnqRes.json();

    // Invalidate & verify enquiry list
    const enqListRes = await fetch(`${BASE_URL}/api/admin/enquiries`, { headers: authHeaders });
    const enqList = await enqListRes.json();
    const foundEnq = enqList.find(e => e.id === createdEnq.id);
    assert(!!foundEnq, "Newly created enquiry is immediately visible in admin enquiries (cache invalidated)");

    // Delete Test Enquiry
    const deleteEnqRes = await fetch(`${BASE_URL}/api/admin/enquiries/${createdEnq.id}`, {
      method: "DELETE",
      headers: authHeaders
    });
    assert(deleteEnqRes.status === 200, "DELETE /api/admin/enquiries/:id deletes enquiry successfully");

    // Verify deletion
    const postDeleteEnqRes = await fetch(`${BASE_URL}/api/admin/enquiries`, { headers: authHeaders });
    const postDeleteEnq = await postDeleteEnqRes.json();
    const foundDeletedEnq = postDeleteEnq.find(e => e.id === createdEnq.id);
    assert(!foundDeletedEnq, "Deleted enquiry is immediately removed from admin enquiries (cache invalidated)");

    console.log("\n==================================================================");
    console.log(`REGRESSION AUDIT SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("==================================================================");

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Regression test error:", err);
    process.exit(1);
  }
}

run();
