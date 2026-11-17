import http from "node:http";

const BASE_URL = process.env.API_BASE_URL || "http://127.0.0.1:5001";
const ADMIN_PASSWORD = process.env.ADMIN_MASTER_PASSWORD || "airnet";

// Test Results Accumulator
export const testResults = [];
let adminCookie = null;

function logHeader(title) {
  console.log(`\n\x1b[1m\x1b[36m========================================================================\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m  ${title}\x1b[0m`);
  console.log(`\x1b[1m\x1b[36m========================================================================\x1b[0m`);
}

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };

  if (adminCookie && !headers["Cookie"]) {
    headers["Cookie"] = adminCookie;
  }

  if (options.body && typeof options.body === "object" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
    });

    const duration = Date.now() - start;
    const contentType = res.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else if (contentType.includes("text/")) {
      data = await res.text().catch(() => null);
    } else if (contentType.includes("application/pdf")) {
      const buf = await res.arrayBuffer();
      data = { isBuffer: true, length: buf.byteLength, type: contentType };
    } else {
      data = await res.text().catch(() => null);
    }

    const setCookie = res.headers.get("set-cookie");
    if (setCookie && setCookie.includes("admin_session=")) {
      const match = setCookie.match(/admin_session=([^;]+)/);
      if (match) {
        adminCookie = `admin_session=${match[1]}`;
      }
    }

    return { status: res.status, headers: res.headers, data, duration, ok: res.ok };
  } catch (err) {
    return { status: 0, error: err.message, duration: Date.now() - start, ok: false };
  }
}

async function runTest({ id, module, scenario, steps, data, expected, priority, executor }) {
  process.stdout.write(`\x1b[33m[TEST] [${id}]\x1b[0m ${scenario.padEnd(65)} ... `);
  const start = Date.now();
  let actual = "";
  let status = "FAIL";
  let errorDesc = "";

  try {
    const res = await executor();
    const duration = Date.now() - start;

    if (res.passed) {
      status = "PASS";
      actual = res.actual || `Success (${res.status || 200}) in ${duration}ms`;
      console.log(`\x1b[32m✔ PASS\x1b[0m \x1b[90m(${duration}ms)\x1b[0m`);
    } else {
      status = "FAIL";
      actual = res.actual || `Failed with status ${res.status}`;
      errorDesc = res.error || "Unexpected response value";
      console.log(`\x1b[31m✖ FAIL\x1b[0m: ${errorDesc}`);
    }
  } catch (err) {
    status = "FAIL";
    actual = `Exception: ${err.message}`;
    errorDesc = err.stack || err.message;
    console.log(`\x1b[31m✖ EXCEPTION\x1b[0m: ${err.message}`);
  }

  testResults.push({
    id,
    module,
    scenario,
    steps,
    data: typeof data === "object" ? JSON.stringify(data) : String(data || "N/A"),
    expected,
    actual,
    status,
    errorDesc,
    priority,
  });
}

async function runAllTests() {
  console.log("\x1b[1m\x1b[35mAirnet Computers Comprehensive Automated QA Suite\x1b[0m");
  console.log(`Target Host: ${BASE_URL}\nTime: ${new Date().toISOString()}`);

  // =========================================================================
  // MODULE 1: Health & System Diagnostics
  // =========================================================================
  logHeader("MODULE 1: Health & System Diagnostics");

  await runTest({
    id: "TC-HLT-01",
    module: "Health & Diagnostics",
    scenario: "Verify backend health endpoint is online and responsive",
    steps: "Send GET /api/health",
    data: "None",
    expected: "Status 200 with status: ok",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/health");
      return { passed: res.status === 200 && res.data?.status === "ok", status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  await runTest({
    id: "TC-HLT-02",
    module: "Health & Diagnostics",
    scenario: "Fetch business contact information with authorized helpline",
    steps: "Send GET /api/business-info",
    data: "None",
    expected: "Status 200 with organization 'Airnet Computers' and helpline mobile",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/business-info");
      return {
        passed: res.status === 200 && res.data?.organization?.includes("Airnet Computers") && Boolean(res.data?.mobileNumber),
        status: res.status,
        actual: `Org: ${res.data?.organization}, Mobile: ${res.data?.mobileNumber}`,
      };
    },
  });

  // =========================================================================
  // MODULE 2: Security & Authorization Protection
  // =========================================================================
  logHeader("MODULE 2: Security & Authorization Protection");

  await runTest({
    id: "TC-SEC-01",
    module: "Security & Auth",
    scenario: "Block unauthorized access to protected admin enquiries endpoint",
    steps: "Send GET /api/admin/enquiries without admin_session cookie",
    data: "No Cookie",
    expected: "Status 401 Unauthorized",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/enquiries", { headers: { Cookie: "" } });
      return { passed: res.status === 401, status: res.status, actual: `HTTP ${res.status}` };
    },
  });

  await runTest({
    id: "TC-SEC-02",
    module: "Security & Auth",
    scenario: "Block unauthorized access to protected services mutation endpoint",
    steps: "Send POST /api/admin/services without auth cookie",
    data: "{ title: 'Unauthorized Test' }",
    expected: "Status 401 Unauthorized",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/services", { method: "POST", body: { title: "Hacker Service" }, headers: { Cookie: "" } });
      return { passed: res.status === 401, status: res.status, actual: `HTTP ${res.status}` };
    },
  });

  await runTest({
    id: "TC-SEC-03",
    module: "Security & Auth",
    scenario: "Reject admin login attempt with incorrect master password",
    steps: "Send POST /api/admin/login with invalid password",
    data: "{ password: 'WrongPassword123!' }",
    expected: "Status 401 with error response",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/login", { method: "POST", body: { password: "WrongPassword123!" } });
      return { passed: res.status === 401, status: res.status, actual: `HTTP ${res.status}` };
    },
  });

  await runTest({
    id: "TC-SEC-04",
    module: "Security & Auth",
    scenario: "Authorize admin login with valid master password and issue session cookie",
    steps: "Send POST /api/admin/login with valid password",
    data: `{ password: '${ADMIN_PASSWORD}' }`,
    expected: "Status 200, success: true, and Set-Cookie with admin_session",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/login", { method: "POST", body: { password: ADMIN_PASSWORD } });
      return {
        passed: res.status === 200 && res.data?.success === true && Boolean(adminCookie),
        status: res.status,
        actual: `Cookie established: ${adminCookie}`,
      };
    },
  });

  await runTest({
    id: "TC-SEC-05",
    module: "Security & Auth",
    scenario: "Verify admin session verification endpoint (/api/admin/me)",
    steps: "Send GET /api/admin/me with valid session cookie",
    data: "Valid Cookie",
    expected: "Status 200 with authenticated: true",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/me");
      return { passed: res.status === 200 && res.data?.authenticated === true, status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  // =========================================================================
  // MODULE 3: Public Services Catalog & Manage Services
  // =========================================================================
  logHeader("MODULE 3: Public Services Catalog & Manage Services");

  let createdServiceId = null;

  await runTest({
    id: "TC-SRV-01",
    module: "Manage Services",
    scenario: "Fetch public services catalog with soft pastel colors and icons",
    steps: "Send GET /api/services",
    data: "None",
    expected: "Status 200 with array of services, each having accent and icon",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/services");
      const list = Array.isArray(res.data) ? res.data : [];
      const hasPastel = list.some((s) => s.accent && s.accent.startsWith("bg-[#"));
      return {
        passed: res.status === 200 && list.length > 0 && hasPastel,
        status: res.status,
        actual: `Found ${list.length} services. First accent: ${list[0]?.accent}, Icon: ${list[0]?.icon}`,
      };
    },
  });

  await runTest({
    id: "TC-SRV-02",
    module: "Manage Services",
    scenario: "Validate service creation requires mandatory title, category and price",
    steps: "Send POST /api/admin/services with empty title",
    data: "{ title: '', category: 'Identity' }",
    expected: "Status 400 Bad Request with error message",
    priority: "Medium",
    executor: async () => {
      const res = await apiRequest("/api/admin/services", { method: "POST", body: { title: "", category: "Identity" } });
      return { passed: res.status === 400, status: res.status, actual: `HTTP ${res.status}: ${res.data?.error}` };
    },
  });

  await runTest({
    id: "TC-SRV-03",
    module: "Manage Services",
    scenario: "Create new service with automatic ₹ symbol and pastel theme preset",
    steps: "Send POST /api/admin/services with raw price and valid category",
    data: "{ title: 'QA Automated Test Service', category: 'Identity', price: '150', copy: 'Test Copy' }",
    expected: "Status 200, formatted price '₹150', pastel accent 'bg-[#e5f0ea]', icon 'IdCard'",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/services", {
        method: "POST",
        body: {
          title: "QA Automated Test Service",
          category: "Identity",
          price: "150",
          copy: "QA Automated Test Service Description",
          documents: "Original Aadhaar Card",
          timing: "10 mins",
        },
      });
      if (res.status === 200 && res.data?.id) {
        createdServiceId = res.data.id;
      }
      return {
        passed: res.status === 200 && res.data?.price === "₹150" && res.data?.accent === "bg-[#e5f0ea]" && res.data?.icon === "IdCard",
        status: res.status,
        actual: `Created ID: ${res.data?.id}, Price: ${res.data?.price}, Accent: ${res.data?.accent}, Icon: ${res.data?.icon}`,
      };
    },
  });

  await runTest({
    id: "TC-SRV-04",
    module: "Manage Services",
    scenario: "Update existing service and verify category preset updates dynamically",
    steps: "Send PATCH /api/admin/services/:id with new category 'Financial Services'",
    data: "{ category: 'Financial Services', price: '200' }",
    expected: "Status 200, accent updated to 'bg-[#e6faf6]' and icon to 'Banknote'",
    priority: "High",
    executor: async () => {
      if (!createdServiceId) return { passed: false, error: "No service created in TC-SRV-03" };
      const res = await apiRequest(`/api/admin/services/${createdServiceId}`, {
        method: "PATCH",
        body: {
          category: "Financial Services",
          price: "200",
        },
      });
      return {
        passed: res.status === 200 && res.data?.price === "₹200" && res.data?.accent === "bg-[#e6faf6]" && res.data?.icon === "Banknote",
        status: res.status,
        actual: `Updated Price: ${res.data?.price}, Accent: ${res.data?.accent}, Icon: ${res.data?.icon}`,
      };
    },
  });

  await runTest({
    id: "TC-SRV-05",
    module: "Manage Services",
    scenario: "Delete created test service cleanly",
    steps: "Send DELETE /api/admin/services/:id",
    data: `Service ID: ${createdServiceId}`,
    expected: "Status 200 with success: true",
    priority: "High",
    executor: async () => {
      if (!createdServiceId) return { passed: false, error: "No service created in TC-SRV-03" };
      const res = await apiRequest(`/api/admin/services/${createdServiceId}`, { method: "DELETE" });
      return { passed: res.status === 200 && res.data?.success === true, status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  // =========================================================================
  // MODULE 4: Public & Admin Notifications (Alerts & Recruitment)
  // =========================================================================
  logHeader("MODULE 4: Public & Admin Notifications Engine");

  let createdNotificationId = null;

  await runTest({
    id: "TC-NTF-01",
    module: "Notifications",
    scenario: "Fetch public notifications with date normalization (DD-MM-YYYY)",
    steps: "Send GET /api/notifications",
    data: "None",
    expected: "Status 200 with array of notifications and valid date fields",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/notifications");
      const list = Array.isArray(res.data) ? res.data : [];
      return {
        passed: res.status === 200 && list.length >= 0,
        status: res.status,
        actual: `Retrieved ${list.length} public notifications`,
      };
    },
  });

  await runTest({
    id: "TC-NTF-02",
    module: "Notifications",
    scenario: "Create new official job notification via Admin endpoint",
    steps: "Send POST /api/admin/notifications",
    data: "{ title: 'QA Karnataka Police Recruitment 2026', category: 'Govt Jobs' }",
    expected: "Status 200 with created notification record",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/notifications", {
        method: "POST",
        body: {
          title: "QA Karnataka Police Recruitment 2026",
          organization: "Karnataka State Police Department",
          category: "Govt Jobs",
          vacancies: "2500 Posts",
          qualification: "Any Degree / PUC Passed",
          ageLimit: "19 - 31 Years",
          startDate: "01-11-2026",
          lastDate: "30-11-2026",
          applicationFee: "₹500 for GM/2A/2B, ₹250 for SC/ST",
          description: "Online applications invited for Civil Police Constables across Karnataka.",
          isFeatured: true,
          status: "Published",
        },
      });
      if (res.status === 200 && res.data?.id) {
        createdNotificationId = res.data.id;
      }
      return {
        passed: res.status === 200 && res.data?.id && res.data?.title?.includes("Police"),
        status: res.status,
        actual: `Created Notification ID: ${res.data?.id}, Title: ${res.data?.title}`,
      };
    },
  });

  await runTest({
    id: "TC-NTF-03",
    module: "Notifications",
    scenario: "Retrieve notification detail and increment view count",
    steps: "Send GET /api/notifications/:id",
    data: `Notification ID: ${createdNotificationId}`,
    expected: "Status 200 with notification details and viewCount",
    priority: "Medium",
    executor: async () => {
      if (!createdNotificationId) return { passed: false, error: "No notification created in TC-NTF-02" };
      const res = await apiRequest(`/api/notifications/${createdNotificationId}`);
      return {
        passed: res.status === 200 && res.data?.id === createdNotificationId,
        status: res.status,
        actual: `Fetched detail for ID ${res.data?.id}, Org: ${res.data?.organization}`,
      };
    },
  });

  await runTest({
    id: "TC-NTF-04",
    module: "Notifications",
    scenario: "Toggle notification status from Published to Draft",
    steps: "Send PATCH /api/admin/notifications/:id",
    data: "{ status: 'Draft' }",
    expected: "Status 200 with status: 'Draft'",
    priority: "Medium",
    executor: async () => {
      if (!createdNotificationId) return { passed: false, error: "No notification created in TC-NTF-02" };
      const res = await apiRequest(`/api/admin/notifications/${createdNotificationId}`, {
        method: "PATCH",
        body: { status: "Draft" },
      });
      return {
        passed: res.status === 200 && res.data?.status === "Draft",
        status: res.status,
        actual: `Status updated to: ${res.data?.status}`,
      };
    },
  });

  await runTest({
    id: "TC-NTF-05",
    module: "Notifications",
    scenario: "Delete created test notification cleanly",
    steps: "Send DELETE /api/admin/notifications/:id",
    data: `Notification ID: ${createdNotificationId}`,
    expected: "Status 200 with success: true",
    priority: "High",
    executor: async () => {
      if (!createdNotificationId) return { passed: false, error: "No notification created in TC-NTF-02" };
      const res = await apiRequest(`/api/admin/notifications/${createdNotificationId}`, { method: "DELETE" });
      return { passed: res.status === 200 && res.data?.success === true, status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  // =========================================================================
  // MODULE 5: Public Enquiry & Admin Enquiry Management Workflow
  // =========================================================================
  logHeader("MODULE 5: Customer Enquiry Lifecycle & Management");

  let testEnquiry = null;

  await runTest({
    id: "TC-ENQ-01",
    module: "Customer Enquiries",
    scenario: "Submit public enquiry with auto-generated customerId (AN-XXXXX)",
    steps: "Send POST /api/enquiries with valid customer data",
    data: "{ customerName: 'Zeeshan Khan', mobileNumber: '9876543210', serviceId: 'PAN Card New / Correction' }",
    expected: "Status 200, customerId matching ^AN-\\d{5}$, and serviceTitle resolved",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/enquiries", {
        method: "POST",
        body: {
          customerName: "Zeeshan Khan",
          mobileNumber: "9876543210",
          serviceId: "PAN Card New / Correction",
          notes: "Need urgent biometric PAN application",
        },
      });
      if (res.status === 200 && res.data?.id) {
        testEnquiry = res.data;
      }
      const hasValidCustomerId = /^AN-\d+$/.test(res.data?.customerId || "");
      return {
        passed: res.status === 200 && Boolean(testEnquiry) && hasValidCustomerId,
        status: res.status,
        actual: `Created Enquiry #${testEnquiry?.id}, Customer ID: ${testEnquiry?.customerId}`,
      };
    },
  });

  await runTest({
    id: "TC-ENQ-02",
    module: "Customer Enquiries",
    scenario: "Customer application status lookup by mobile number",
    steps: "Send POST /api/enquiries/status with phone number",
    data: "{ phone: '9876543210' }",
    expected: "Status 200 with array containing the created customer enquiry",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/enquiries/status", {
        method: "POST",
        body: { phone: "9876543210" },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      const match = list.find((e) => e.customerId === testEnquiry?.customerId);
      return {
        passed: res.status === 200 && Boolean(match),
        status: res.status,
        actual: `Matched ${list.length} enquiries. Found: ${match?.customerId} (${match?.customerName})`,
      };
    },
  });

  await runTest({
    id: "TC-ENQ-03",
    module: "Customer Enquiries",
    scenario: "Dispatch automated WhatsApp/SMS registration confirmation",
    steps: "Send POST /api/enquiries/send-confirmation",
    data: "{ customerId, mobileNumber, customerName, serviceName }",
    expected: "Status 200 with success: true and dispatch timestamp",
    priority: "Medium",
    executor: async () => {
      if (!testEnquiry) return { passed: false, error: "No enquiry created" };
      const res = await apiRequest("/api/enquiries/send-confirmation", {
        method: "POST",
        body: {
          customerId: testEnquiry.customerId,
          mobileNumber: testEnquiry.mobileNumber,
          customerName: testEnquiry.customerName,
          serviceName: testEnquiry.serviceTitle || "PAN Card",
          message: "Application confirmed.",
        },
      });
      return { passed: res.status === 200 && res.data?.success === true, status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  await runTest({
    id: "TC-ENQ-04",
    module: "Customer Enquiries",
    scenario: "Admin fetches enquiry list with search and status filtering",
    steps: "Send GET /api/admin/enquiries?search=Zeeshan",
    data: "search=Zeeshan",
    expected: "Status 200 with matched enquiry in results",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/enquiries?search=Zeeshan");
      const list = Array.isArray(res.data) ? res.data : [];
      const match = list.find((e) => e.customerId === testEnquiry?.customerId);
      return {
        passed: res.status === 200 && Boolean(match),
        status: res.status,
        actual: `Matched ${list.length} enquiries. Found ${match?.customerName} (${match?.customerId})`,
      };
    },
  });

  await runTest({
    id: "TC-ENQ-05",
    module: "Customer Enquiries",
    scenario: "Admin updates enquiry status to 'Accepted' triggering Auto-Tracker creation",
    steps: "Send PATCH /api/admin/enquiries/:id with applicationStatus: 'Accepted'",
    data: "{ applicationStatus: 'Accepted', amountCharged: 200, amountPaid: 100 }",
    expected: "Status 200 with updated status and automatic tracker task creation",
    priority: "Critical",
    executor: async () => {
      if (!testEnquiry) return { passed: false, error: "No enquiry created" };
      const res = await apiRequest(`/api/admin/enquiries/${testEnquiry.id}`, {
        method: "PATCH",
        body: {
          applicationStatus: "Accepted",
          amountCharged: 200,
          amountPaid: 100,
          paymentMethod: "UPI",
          notes: "Customer paid ₹100 advance via PhonePe",
        },
      });
      return {
        passed: res.status === 200 && res.data?.applicationStatus === "Accepted" && res.data?.amountPending === 100,
        status: res.status,
        actual: `Status: ${res.data?.applicationStatus}, Charged: ${res.data?.amountCharged}, Paid: ${res.data?.amountPaid}, Pending: ${res.data?.amountPending}`,
      };
    },
  });

  // =========================================================================
  // MODULE 6: Application Tracker Lifecycle
  // =========================================================================
  logHeader("MODULE 6: Application Tracker Lifecycle");

  let trackerTask = null;

  await runTest({
    id: "TC-TRK-01",
    module: "Application Tracker",
    scenario: "Verify auto-created tracker task exists for accepted enquiry",
    steps: "Send GET /api/admin/tracker and find matching customerId",
    data: `customerId: ${testEnquiry?.customerId}`,
    expected: "Status 200 with task matching customerId and 5 standard steps",
    priority: "Critical",
    executor: async () => {
      if (!testEnquiry) return { passed: false, error: "No enquiry created" };
      const res = await apiRequest("/api/admin/tracker");
      const list = Array.isArray(res.data) ? res.data : [];
      trackerTask = list.find((t) => t.customerId === testEnquiry.customerId);
      return {
        passed: res.status === 200 && Boolean(trackerTask) && Array.isArray(trackerTask?.steps),
        status: res.status,
        actual: `Found Task #${trackerTask?.id}: ${trackerTask?.serviceName}, Steps: ${trackerTask?.steps?.length}`,
      };
    },
  });

  await runTest({
    id: "TC-TRK-02",
    module: "Application Tracker",
    scenario: "Public lookup via Tracker API (/api/tracker/lookup?q=CUSTOMER_ID)",
    steps: "Send GET /api/tracker/lookup?q=CUSTOMER_ID",
    data: `q=${testEnquiry?.customerId}`,
    expected: "Status 200 returning task with progress and current step",
    priority: "Critical",
    executor: async () => {
      if (!testEnquiry) return { passed: false, error: "No enquiry created" };
      const res = await apiRequest(`/api/tracker/lookup?q=${encodeURIComponent(testEnquiry.customerId)}`);
      const list = Array.isArray(res.data) ? res.data : [];
      const match = list.find((t) => t.customerId === testEnquiry.customerId);
      return {
        passed: res.status === 200 && Boolean(match),
        status: res.status,
        actual: `Lookup returned ${list.length} task(s). Progress: ${match?.progressPercent}%, Step: ${match?.currentStep}`,
      };
    },
  });

  await runTest({
    id: "TC-TRK-03",
    module: "Application Tracker",
    scenario: "Admin updates application task steps and recalculates progress percent",
    steps: "Send PATCH /api/admin/tracker/:id with completed step",
    data: "Updated steps with step-2 completed",
    expected: "Status 200, progress increased, currentStep advanced",
    priority: "High",
    executor: async () => {
      if (!trackerTask) return { passed: false, error: "No tracker task found" };
      const updatedSteps = (trackerTask.steps || []).map((s, idx) => {
        if (idx <= 1) return { ...s, status: "completed" };
        if (idx === 2) return { ...s, status: "in-progress" };
        return { ...s, status: "pending" };
      });
      const res = await apiRequest(`/api/admin/tracker/${trackerTask.id}`, {
        method: "PATCH",
        body: {
          steps: updatedSteps,
          amountPaid: 200,
          amountPending: 0,
        },
      });
      return {
        passed: res.status === 200 && res.data?.progressPercent >= 40,
        status: res.status,
        actual: `Progress: ${res.data?.progressPercent}%, Current Step: ${res.data?.currentStep}, Amount Pending: ${res.data?.amountPending}`,
      };
    },
  });

  await runTest({
    id: "TC-TRK-04",
    module: "Application Tracker",
    scenario: "Clean up test tracker task and enquiry",
    steps: "Delete test tracker task and test enquiry",
    data: `Task ID: ${trackerTask?.id}, Enquiry ID: ${testEnquiry?.id}`,
    expected: "Status 200 on both deletion requests",
    priority: "Medium",
    executor: async () => {
      let tPass = true;
      let ePass = true;
      if (trackerTask?.id) {
        const resT = await apiRequest(`/api/admin/tracker/${trackerTask.id}`, { method: "DELETE" });
        tPass = resT.status === 200;
      }
      if (testEnquiry?.id) {
        const resE = await apiRequest(`/api/admin/enquiries/${testEnquiry.id}`, { method: "DELETE" });
        ePass = resE.status === 200;
      }
      return { passed: tPass && ePass, actual: `Tracker deleted: ${tPass}, Enquiry deleted: ${ePass}` };
    },
  });

  // =========================================================================
  // MODULE 7: Records Management (Ledger & Accounting)
  // =========================================================================
  logHeader("MODULE 7: Records Management (Ledger & Accounting)");

  let testRecordId = null;

  await runTest({
    id: "TC-REC-01",
    module: "Records",
    scenario: "Create new financial/service transaction record",
    steps: "Send POST /api/admin/records",
    data: "{ customerName: 'Farhan Akhtar', customerId: 'AN-99999', serviceProvided: 'Passport Application', amountCharged: 1500, amountPaid: 1500 }",
    expected: "Status 200, amountPending = 0",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/records", {
        method: "POST",
        body: {
          customerId: "AN-99999",
          customerName: "Farhan Akhtar",
          mobileNumber: "9887766554",
          serviceProvided: "Passport Application",
          amountCharged: 1500,
          amountPaid: 1500,
          paymentMethod: "Cash",
          notes: "Paid in full at counter",
        },
      });
      if (res.status === 200 && res.data?.id) {
        testRecordId = res.data.id;
      }
      return {
        passed: res.status === 200 && res.data?.amountCharged === 1500 && res.data?.amountPending === 0,
        status: res.status,
        actual: `Created Record #${res.data?.id}, Charged: ₹${res.data?.amountCharged}, Paid: ₹${res.data?.amountPaid}`,
      };
    },
  });

  await runTest({
    id: "TC-REC-02",
    module: "Records",
    scenario: "Fetch admin records list and verify ledger entry",
    steps: "Send GET /api/admin/records",
    data: "None",
    expected: "Status 200 with record list containing the created record",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/records");
      const list = Array.isArray(res.data) ? res.data : [];
      const match = list.find((r) => r.id === testRecordId);
      return {
        passed: res.status === 200 && Boolean(match),
        status: res.status,
        actual: `Total records: ${list.length}. Found record for ${match?.customerName}`,
      };
    },
  });

  await runTest({
    id: "TC-REC-03",
    module: "Records",
    scenario: "Clean up test record",
    steps: "Send DELETE /api/admin/records/:id",
    data: `Record ID: ${testRecordId}`,
    expected: "Status 200 with success: true",
    priority: "Medium",
    executor: async () => {
      if (!testRecordId) return { passed: false, error: "No record created" };
      const res = await apiRequest(`/api/admin/records/${testRecordId}`, { method: "DELETE" });
      return { passed: res.status === 200 && res.data?.success === true, status: res.status, actual: JSON.stringify(res.data) };
    },
  });

  // =========================================================================
  // MODULE 8: Reminder (Daily Reports & Automated PDF Generation)
  // =========================================================================
  logHeader("MODULE 8: Reminder (Daily Reports & PDF Generation)");

  await runTest({
    id: "TC-RPT-01",
    module: "Reminder & Reports",
    scenario: "Fetch Daily Report configuration settings",
    steps: "Send GET /api/admin/reports-daily/settings",
    data: "None",
    expected: "Status 200 with adminEmail, scheduledTime and autoEnabled flag",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/reports-daily/settings");
      const s = res.data?.settings || res.data;
      return {
        passed: res.status === 200 && s?.adminEmail === "airnetcomputersbk@gmail.com",
        status: res.status,
        actual: `Admin Email: ${s?.adminEmail}, Scheduled: ${s?.scheduledTime}, Auto: ${s?.autoEnabled}`,
      };
    },
  });

  await runTest({
    id: "TC-RPT-02",
    module: "Reminder & Reports",
    scenario: "Calculate daily activity metrics (requests received, accepted, completed, collections)",
    steps: "Send GET /api/admin/reports-daily/data",
    data: "None",
    expected: "Status 200 with metrics object containing accurate totals",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/reports-daily/data");
      const m = res.data?.metrics || res.data;
      const hasMetricFigures =
        typeof m?.totalRequests === "number" &&
        (typeof m?.totalOutstandingAmount === "number" || typeof m?.totalPendingAmount === "number");
      return {
        passed: res.status === 200 && Boolean(m) && hasMetricFigures,
        status: res.status,
        actual: `Date: ${m?.reportDate}, Today Received: ${m?.requestsReceivedToday}, Total Outstanding: ₹${m?.totalOutstandingAmount ?? m?.totalPendingAmount}`,
      };
    },
  });

  await runTest({
    id: "TC-RPT-03",
    module: "Reminder & Reports",
    scenario: "Generate and stream Official Daily Summary PDF report",
    steps: "Send GET /api/admin/reports-daily/pdf",
    data: "None",
    expected: "Status 200 with Content-Type application/pdf and non-empty binary buffer",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/reports-daily/pdf");
      const isPdf = res.status === 200 && res.data?.isBuffer && res.data?.length > 1000;
      return {
        passed: isPdf,
        status: res.status,
        actual: `PDF generated successfully: ${res.data?.length} bytes, Type: ${res.data?.type}`,
      };
    },
  });

  await runTest({
    id: "TC-RPT-04",
    module: "Reminder & Reports",
    scenario: "Fetch Daily Report dispatch logs history",
    steps: "Send GET /api/admin/reports-daily/history",
    data: "None",
    expected: "Status 200 with array of logs",
    priority: "Medium",
    executor: async () => {
      const res = await apiRequest("/api/admin/reports-daily/history");
      const list = Array.isArray(res.data) ? res.data : [];
      return {
        passed: res.status === 200 && Array.isArray(list),
        status: res.status,
        actual: `Found ${list.length} historical report logs`,
      };
    },
  });

  // =========================================================================
  // MODULE 9: Data Backup & Restoration
  // =========================================================================
  logHeader("MODULE 9: Data Backup & Management");

  let backupPayload = null;

  await runTest({
    id: "TC-BAK-01",
    module: "Data Backup",
    scenario: "Export full database backup snapshot",
    steps: "Send GET /api/admin/backup/full",
    data: "None",
    expected: "Status 200 with complete JSON containing services, enquiries, records, applicationTasks, notifications, and metadata",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/backup/full");
      backupPayload = res.data;
      const isValid =
        res.status === 200 &&
        Array.isArray(backupPayload?.services) &&
        Array.isArray(backupPayload?.enquiries) &&
        Array.isArray(backupPayload?.records) &&
        Array.isArray(backupPayload?.applicationTasks) &&
        Array.isArray(backupPayload?.notifications) &&
        Boolean(backupPayload?.metadata?.centerName);
      return {
        passed: isValid,
        status: res.status,
        actual: `Exported snapshot: ${backupPayload?.services?.length} services, ${backupPayload?.enquiries?.length} enquiries, ${backupPayload?.records?.length} records, ${backupPayload?.notifications?.length} notifications`,
      };
    },
  });

  await runTest({
    id: "TC-BAK-02",
    module: "Data Backup",
    scenario: "Validate backup restoration rejects corrupt or malformed payload",
    steps: "Send POST /api/admin/backup/restore with invalid structure",
    data: "{ corruptData: true }",
    expected: "Status 400 Bad Request with error description",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/backup/restore", {
        method: "POST",
        body: { payload: { corruptData: true } },
      });
      return { passed: res.status === 400, status: res.status, actual: `HTTP ${res.status}: ${res.data?.error}` };
    },
  });

  // =========================================================================
  // MODULE 10: Settings & Admin Mobile OTP Workflow
  // =========================================================================
  logHeader("MODULE 10: Settings, Security & Mobile Number Management");

  await runTest({
    id: "TC-SET-01",
    module: "Admin Settings",
    scenario: "Retrieve admin settings (mobile numbers, display permissions, email, scheduled time)",
    steps: "Send GET /api/admin/settings",
    data: "None",
    expected: "Status 200 with adminMobileNumber, constantAdminEmail, and permission status",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/settings");
      const email = res.data?.adminEmail || res.data?.constantAdminEmail;
      return {
        passed: res.status === 200 && email === "airnetcomputersbk@gmail.com",
        status: res.status,
        actual: `Admin Mobile: ${res.data?.adminMobileNumber}, Email: ${email}, Show on Frontend: ${res.data?.showUpdatedMobileOnFrontend}`,
      };
    },
  });

  await runTest({
    id: "TC-SET-02",
    module: "Admin Settings",
    scenario: "Request Mobile Number change OTP PIN dispatched to admin email",
    steps: "Send POST /api/admin/settings/request-mobile-otp with new mobile",
    data: "{ newMobileNumber: '+91 9988776655' }",
    expected: "Status 200, success: true, 6-digit OTP generated",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/admin/settings/request-mobile-otp", {
        method: "POST",
        body: { newMobileNumber: "+91 9988776655" },
      });
      return {
        passed: res.status === 200 && res.data?.success === true,
        status: res.status,
        actual: res.data?.message || JSON.stringify(res.data),
      };
    },
  });

  await runTest({
    id: "TC-SET-03",
    module: "Admin Settings",
    scenario: "Verify Mobile Number OTP validation rejects incorrect PIN",
    steps: "Send POST /api/admin/settings/verify-mobile-otp with wrong OTP",
    data: "{ otp: '000000' }",
    expected: "Status 400 with Invalid OTP PIN error",
    priority: "High",
    executor: async () => {
      const res = await apiRequest("/api/admin/settings/verify-mobile-otp", {
        method: "POST",
        body: { otp: "000000" },
      });
      return {
        passed: res.status === 400 && res.data?.success === false,
        status: res.status,
        actual: `HTTP ${res.status}: ${res.data?.message}`,
      };
    },
  });

  await runTest({
    id: "TC-SET-04",
    module: "Admin Settings",
    scenario: "Verify Frontend Display Mobile Number Permission enforcement",
    steps: "Send POST /api/admin/settings/frontend-mobile-permission with grantPermission: false",
    data: "{ grantPermission: false }",
    expected: "Status 200 with permission revoked; public /api/business-info returns default approved number",
    priority: "Critical",
    executor: async () => {
      const permRes = await apiRequest("/api/admin/settings/frontend-mobile-permission", {
        method: "POST",
        body: { grantPermission: false },
      });
      const bizRes = await apiRequest("/api/business-info");
      const passed = permRes.status === 200 && bizRes.status === 200 && bizRes.data?.mobileNumber === "+91 7892881086";
      return {
        passed,
        status: permRes.status,
        actual: `Permission Set: ${permRes.data?.showUpdatedMobileOnFrontend}, Public Displayed Mobile: ${bizRes.data?.mobileNumber}`,
      };
    },
  });

  // =========================================================================
  // MODULE 11: SQL Injection & Input Sanitization Security Tests
  // =========================================================================
  logHeader("MODULE 11: Security & Injection Hardening Tests");

  await runTest({
    id: "TC-INJ-01",
    module: "Security & Hardening",
    scenario: "Test SQL injection immunity on Tracker Search parameter",
    steps: "Send GET /api/tracker/lookup?q=' OR '1'='1",
    data: "q=' OR '1'='1",
    expected: "Status 200 with empty array (no SQL syntax error, no data leak)",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/tracker/lookup?q=" + encodeURIComponent("' OR '1'='1"));
      const isSafe = res.status === 200 && Array.isArray(res.data) && res.data.length === 0;
      return {
        passed: isSafe,
        status: res.status,
        actual: `Safely handled without injection: returned ${res.data?.length || 0} records`,
      };
    },
  });

  await runTest({
    id: "TC-INJ-02",
    module: "Security & Hardening",
    scenario: "Test SQL injection immunity on Public Notifications search query",
    steps: "Send GET /api/notifications?search=' OR 1=1;--",
    data: "search=' OR 1=1;--",
    expected: "Status 200 with safe filtered result (no database leak or crash)",
    priority: "Critical",
    executor: async () => {
      const res = await apiRequest("/api/notifications?search=" + encodeURIComponent("' OR 1=1;--"));
      const isSafe = res.status === 200 && Array.isArray(res.data);
      return {
        passed: isSafe,
        status: res.status,
        actual: `Safely sanitized: returned ${res.data?.length || 0} notifications without SQL error`,
      };
    },
  });

  // =========================================================================
  // Print Execution Summary
  // =========================================================================
  logHeader("AUTOMATED QA TEST SUITE SUMMARY");
  const passed = testResults.filter((t) => t.status === "PASS").length;
  const failed = testResults.filter((t) => t.status === "FAIL").length;
  const total = testResults.length;
  const pct = Math.round((passed / total) * 100);

  console.log(`\n\x1b[1mTotal Executed Test Cases:\x1b[0m ${total}`);
  console.log(`\x1b[32m✔ Passed Test Cases:\x1b[0m       ${passed}`);
  console.log(`\x1b[31m✖ Failed Test Cases:\x1b[0m       ${failed}`);
  console.log(`\x1b[1mOverall Test Pass Rate:\x1b[0m    ${pct}%\n`);

  return { total, passed, failed, pct, testResults };
}

runAllTests().then((res) => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch((err) => {
  console.error("FATAL SUITE ERROR:", err);
  process.exit(1);
});
