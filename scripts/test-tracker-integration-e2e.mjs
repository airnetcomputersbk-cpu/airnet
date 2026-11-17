const API_BASE = "http://localhost:5001";
let ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "airnet";

let testPassed = 0;
let testFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    testPassed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    testFailed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 RUNNING APPLICATION TRACKER & GOV SERVICES INTEGRATION TESTS");
  console.log("=======================================================\n");

  let authHeaders = {};

  // 1. Admin Login
  console.log("Test 1: Admin Authentication");
  try {
    let loginRes = await fetch(`${API_BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASSWORD }),
    });
    if (!loginRes.ok) {
      // Try fallback passwords
      for (const p of ["admin123", "Admin@123", "password", "airnet123"]) {
        loginRes = await fetch(`${API_BASE}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: p }),
        });
        if (loginRes.ok) {
          ADMIN_PASSWORD = p;
          break;
        }
      }
    }
    const setCookie = loginRes.headers.get("set-cookie");
    const cookie = setCookie ? setCookie.split(";")[0] : `admin_session=${ADMIN_PASSWORD}`;
    authHeaders = {
      Authorization: `Bearer ${ADMIN_PASSWORD}`,
      Cookie: cookie,
    };
    assert(loginRes.ok, `Admin login successful with password "${ADMIN_PASSWORD}"`);
  } catch (err) {
    assert(false, `Admin login threw error: ${err.message}`);
  }

  // 2. Fetch Centralized Government Services
  console.log("\nTest 2: Centralized Government Services Database");
  let govServices = [];
  try {
    const res = await fetch(`${API_BASE}/api/government-services`);
    assert(res.ok, "Fetched government services successfully");
    govServices = await res.json();
    assert(Array.isArray(govServices) && govServices.length >= 19, `Found ${govServices.length} government services`);
    const passport = govServices.find((s) => s.name.toLowerCase().includes("passport"));
    assert(passport && passport.url === "https://passportindia.gov.in/", "Passport URL configured correctly in government services database");
    const voter = govServices.find((s) => s.name.toLowerCase().includes("voter"));
    assert(voter && voter.url === "https://voters.eci.gov.in/", "Voter ID URL configured correctly");
  } catch (err) {
    assert(false, `Failed to fetch government services: ${err.message}`);
  }

  // 3. Create Enquiry for Government Service (Passport) and Accept It
  console.log("\nTest 3: Enquiry Accept -> Automatic Application Tracker Integration (Known Service: Passport)");
  try {
    const customerPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const enqRes = await fetch(`${API_BASE}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Integration Test User Passport",
        mobileNumber: customerPhone,
        serviceId: "Passport",
        notes: "Requested Service: Passport Application",
      }),
    });
    assert(enqRes.ok, "Created enquiry for Passport service");
    const enqData = await enqRes.json();
    assert(Boolean(enqData.id), `Enquiry created with ID ${enqData.id}`);

    // Accept Enquiry
    const acceptRes = await fetch(`${API_BASE}/api/admin/enquiries/${enqData.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ applicationStatus: "Accepted" }),
    });
    assert(acceptRes.ok, "Accepted enquiry via admin endpoint");
    const acceptData = await acceptRes.json();
    assert(
      acceptData.applyUrl === "https://passportindia.gov.in/",
      `Enquiry acceptance returned correct Passport portal URL: ${acceptData.applyUrl}`
    );

    // Verify task exists in Tracker
    const trackerLookupRes = await fetch(`${API_BASE}/api/tracker/lookup?q=${encodeURIComponent(customerPhone)}`);
    assert(trackerLookupRes.ok, "Queried tracker lookup for accepted customer");
    const lookupTasks = await trackerLookupRes.json();
    assert(lookupTasks.length > 0, "Found customer task in Tracker");
    const matchedTask = lookupTasks[0];
    assert(
      matchedTask.applyUrl === "https://passportindia.gov.in/",
      `Task in tracker has exact applyUrl: ${matchedTask.applyUrl}`
    );
  } catch (err) {
    assert(false, `Test 3 failed: ${err.message}`);
  }

  // 4. Create Enquiry for Unknown Service -> Fallback to https://www.google.com
  console.log("\nTest 4: Enquiry Accept -> Fallback to Google for Unknown Service");
  try {
    const customerPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const enqRes = await fetch(`${API_BASE}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Integration Test User Unknown",
        mobileNumber: customerPhone,
        serviceId: "Custom Private Consultation 123",
        notes: "Requested Service: Custom Private Consultation 123",
      }),
    });
    assert(enqRes.ok, "Created enquiry for custom service");
    const enqData = await enqRes.json();

    // Accept Enquiry
    const acceptRes = await fetch(`${API_BASE}/api/admin/enquiries/${enqData.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ applicationStatus: "Accepted" }),
    });
    assert(acceptRes.ok, "Accepted enquiry for custom service");
    const acceptData = await acceptRes.json();
    assert(
      acceptData.applyUrl === "https://www.google.com",
      `Unknown service correctly fell back to google.com: ${acceptData.applyUrl}`
    );

    // Verify task in Tracker also has fallback URL
    const trackerLookupRes = await fetch(`${API_BASE}/api/tracker/lookup?q=${encodeURIComponent(customerPhone)}`);
    const lookupTasks = await trackerLookupRes.json();
    assert(lookupTasks.length > 0, "Found customer task in Tracker for custom service");
    assert(
      lookupTasks[0].applyUrl === "https://www.google.com",
      `Tracker task applyUrl correctly is https://www.google.com: ${lookupTasks[0].applyUrl}`
    );
  } catch (err) {
    assert(false, `Test 4 failed: ${err.message}`);
  }

  // 5. Direct Creation in Application Tracker (e.g. "Voter ID")
  console.log("\nTest 5: Direct Application Tracker Creation Auto-Resolves Gov Service URL");
  try {
    const custId = `AN-${Math.floor(10000 + Math.random() * 90000)}`;
    const directRes = await fetch(`${API_BASE}/api/admin/tracker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        customerId: custId,
        customerName: "Direct Voter Applicant",
        mobileNumber: "9123456789",
        serviceName: "Voter ID",
      }),
    });
    assert(directRes.ok, "Created task directly via /api/admin/tracker");
    const createdTask = await directRes.json();
    assert(
      createdTask.applyUrl === "https://voters.eci.gov.in/",
      `Direct task auto-resolved Voter ID portal URL: ${createdTask.applyUrl}`
    );

    // Fetch tracker list via GET /api/admin/tracker
    const allTrackerRes = await fetch(`${API_BASE}/api/admin/tracker`, {
      headers: { ...authHeaders },
    });
    assert(allTrackerRes.ok, "Fetched admin tracker list");
    const allTasks = await allTrackerRes.json();
    const foundInList = allTasks.find((t) => t.customerId === custId);
    assert(
      foundInList && foundInList.applyUrl === "https://voters.eci.gov.in/",
      "Admin tracker list returns task with correct applyUrl"
    );
  } catch (err) {
    assert(false, `Test 5 failed: ${err.message}`);
  }

  // 6. Public Lookup Endpoint /api/tracker/lookup
  console.log("\nTest 6: Public Tracker Lookup Endpoint");
  try {
    const lookupRes = await fetch(`${API_BASE}/api/tracker/lookup?q=9123456789`);
    assert(lookupRes.ok, "Public lookup succeeded");
    const results = await lookupRes.json();
    assert(results.length > 0, "Found results in public tracker");
    const voterTask = results.find((r) => r.serviceName === "Voter ID");
    assert(
      voterTask && voterTask.applyUrl === "https://voters.eci.gov.in/",
      `Public lookup returns correct applyUrl for Voter ID: ${voterTask?.applyUrl}`
    );
  } catch (err) {
    assert(false, `Test 6 failed: ${err.message}`);
  }

  // 7. Verify Sync Ledger Endpoint Resolves applyUrl
  console.log("\nTest 7: Sync Ledger Endpoint applyUrl Resolution");
  try {
    const customerPhone = `98765${Math.floor(10000 + Math.random() * 90000)}`;
    const enqRes = await fetch(`${API_BASE}/api/enquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Ledger Sync User Aadhaar",
        mobileNumber: customerPhone,
        serviceId: "Aadhaar",
        notes: "Aadhaar Card update enquiry",
      }),
    });
    const enqData = await enqRes.json();

    const syncRes = await fetch(`${API_BASE}/api/admin/enquiries/${enqData.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        amountCharged: 100,
        amountPaid: 50,
        paymentMethod: "UPI",
        applicationStatus: "Completed",
        syncToTracker: true,
      }),
    });
    assert(syncRes.ok, "Synced enquiry to ledger and tracker");

    const lookupRes = await fetch(`${API_BASE}/api/tracker/lookup?q=${encodeURIComponent(customerPhone)}`);
    const tasks = await lookupRes.json();
    assert(tasks.length > 0, "Tracker task created during ledger sync");
    assert(
      tasks[0].applyUrl === "https://myaadhaar.uidai.gov.in/",
      `Ledger-synced task has Aadhaar portal URL: ${tasks[0].applyUrl}`
    );
  } catch (err) {
    assert(false, `Test 7 failed: ${err.message}`);
  }

  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED`);
  console.log("=======================================================\n");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runTests();
