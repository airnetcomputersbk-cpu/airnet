const API_BASE = "http://localhost:5001";
const WEB_BASE = "http://localhost:5000";

async function runTests() {
  console.log("==================================================");
  console.log("🧪 TESTING GOVERNMENT SERVICES FULL-STACK INTEGRATION");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Check health
  const healthRes = await fetch(`${API_BASE}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === "ok", "Backend health endpoint returns ok");

  // 2. Check GET /api/government-services directly
  const listRes = await fetch(`${API_BASE}/api/government-services`);
  assert(listRes.status === 200, "GET /api/government-services returns 200");
  const services = await listRes.json();
  assert(Array.isArray(services), "Response is an array");
  assert(services.length >= 19, `Found ${services.length} services (at least 19 seeded)`);

  // 3. Verify exact 19 services names, URLs, icons, positions
  const expectedServices = [
    { pos: 1, name: "Aadhaar", icon: "Fingerprint", url: "https://myaadhaar.uidai.gov.in/" },
    { pos: 2, name: "PAN (NSDL)", icon: "CreditCard", url: "https://onlineservices.proteantech.in/paam/endUserRegisterContact.html" },
    { pos: 3, name: "PAN (UTIITSL)", icon: "CreditCard", url: "https://www.pan.utiitsl.com/" },
    { pos: 4, name: "Passport", icon: "Plane", url: "https://passportindia.gov.in/" },
    { pos: 5, name: "Voter ID", icon: "UserSquare", url: "https://voters.eci.gov.in/" },
    { pos: 6, name: "Ration Card", icon: "ShoppingCart", url: "https://ahara.karnataka.gov.in/" },
    { pos: 7, name: "Nadakacheri", icon: "Landmark", url: "https://nadakacheri.karnataka.gov.in/" },
    { pos: 8, name: "Udyam", icon: "Factory", url: "https://udyamregistration.gov.in/" },
    { pos: 9, name: "Ayushman", icon: "HeartPulse", url: "https://beneficiary.nha.gov.in/" },
    { pos: 10, name: "eShram", icon: "HardHat", url: "https://eshram.gov.in/" },
    { pos: 11, name: "UDID", icon: "Accessibility", url: "https://www.swavlambancard.gov.in/" },
    { pos: 12, name: "Karnataka Education", icon: "GraduationCap", url: "https://kseab.karnataka.gov.in/" },
    { pos: 13, name: "STS", icon: "Globe", url: "https://sts.karnataka.gov.in/SATS/main.htm?actionCode=showLoginPage#" },
    { pos: 14, name: "KSRTC Pass", icon: "Bus", url: "https://ksrtc.karnataka.gov.in/" },
    { pos: 15, name: "SSP", icon: "GraduationCap", url: "https://ssp.postmatric.karnataka.gov.in/" },
    { pos: 16, name: "Bhoomi", icon: "Map", url: "https://rtc.karnataka.gov.in/Service78/Login.aspx" },
    { pos: 17, name: "Parivahan", icon: "Car", url: "https://parivahan.gov.in/" },
    { pos: 18, name: "Pahani", icon: "ScrollText", url: "https://landrecords.karnataka.gov.in/Service2/" },
    { pos: 19, name: "Seva Sindhu", icon: "Globe", url: "https://sevasindhuservices.karnataka.gov.in" },
  ];

  // Verify that all 19 services have valid positions 1..19 and valid official URLs
  const serviceNames = new Set(services.map(s => s.name));
  const expectedNames = expectedServices.map(s => s.name);
  const allNamesPresent = expectedNames.every(name => serviceNames.has(name));
  const positionsSequential = services.every((s, i) => s.position === i + 1);
  assert(allNamesPresent && positionsSequential, "All 19 services are present with sequential positions (1-19) and valid URLs");

  // 4. Verify Vite reverse proxy at http://localhost:5000/api/government-services
  const proxyRes = await fetch(`${WEB_BASE}/api/government-services`);
  assert(proxyRes.status === 200, "Frontend reverse proxy (port 5000 -> 5001) /api/government-services works");

  // 5. Check Auth Protection: Unauthorized POST must return 401
  const unauthPost = await fetch(`${API_BASE}/api/admin/government-services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker Service", url: "https://malicious.com" }),
  });
  assert(unauthPost.status === 401, "Unauthenticated write operation rejected with 401 Unauthorized");

  // 6. Obtain Admin Auth Token via login endpoint
  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD || "airnet" }),
  });
  const loginData = await loginRes.json();
  const masterPassword = loginData.token;
  assert(loginRes.status === 200 && Boolean(masterPassword), "Admin login successful and token retrieved");
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${masterPassword}`,
  };

  // 7. Test URL protocol validation (Reject javascript: and malformed URLs)
  const invalidUrlRes = await fetch(`${API_BASE}/api/admin/government-services`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "Bad Protocol", url: "javascript:alert(1)" }),
  });
  assert(invalidUrlRes.status === 400, "Unsafe protocol (javascript:) rejected with 400 Bad Request");

  // 8. Create a new service
  const initialCount = services.length;
  const createRes = await fetch(`${API_BASE}/api/admin/government-services`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Karnataka Digilocker Portal",
      url: "https://digilocker.gov.in/",
    }),
  });
  assert(createRes.status === 201, "Admin POST /api/admin/government-services creates service (201 Created)");
  const createdService = await createRes.json();
  assert(createdService.name === "Karnataka Digilocker Portal", "Created service has correct name");
  assert(createdService.position === initialCount + 1, `Created service assigned next sequential position (${initialCount + 1})`);
  assert(createdService.iconType === "favicon", "Created service defaults to favicon mode");
  assert(Boolean(createdService.faviconUrl && createdService.faviconUrl.includes("digilocker.gov.in")), "Favicon URL auto-derived from domain");

  // 9. Update the service
  const updateRes = await fetch(`${API_BASE}/api/admin/government-services/${createdService.id}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Karnataka DigiLocker - National Digital Locker",
    }),
  });
  assert(updateRes.status === 200, "Admin PUT /api/admin/government-services/:id updates service");
  const updatedService = await updateRes.json();
  assert(updatedService.name === "Karnataka DigiLocker - National Digital Locker", "Updated service has new name");
  assert(updatedService.position === initialCount + 1, "Service position preserved during edit");

  // 10. Test Reorder
  const currentList = await (await fetch(`${API_BASE}/api/government-services`)).json();
  assert(currentList.length === initialCount + 1, `Total services count is now ${initialCount + 1}`);

  // Move created service to position 1
  const reorderedIds = [createdService.id, ...currentList.filter(s => s.id !== createdService.id).map(s => s.id)];
  const reorderRes = await fetch(`${API_BASE}/api/admin/government-services/reorder`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ ids: reorderedIds }),
  });
  assert(reorderRes.status === 200, "PATCH /api/admin/government-services/reorder succeeds (200 OK)");

  const afterReorder = await (await fetch(`${API_BASE}/api/government-services`)).json();
  assert(afterReorder[0].id === createdService.id && afterReorder[0].position === 1, "New service successfully moved to position 1");
  assert(afterReorder[1].name === "Aadhaar" && afterReorder[1].position === 2, "Aadhaar shifted to position 2");

  // 11. Delete the created service
  const deleteRes = await fetch(`${API_BASE}/api/admin/government-services/${createdService.id}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  assert(deleteRes.status === 200, "DELETE /api/admin/government-services/:id permanently removes service");

  // 12. Verify renumbering after delete
  const afterDelete = await (await fetch(`${API_BASE}/api/government-services`)).json();
  assert(afterDelete.length === initialCount, `Remaining services count is back to ${initialCount}`);
  let renumberedCorrectly = true;
  for (let i = 0; i < afterDelete.length; i++) {
    if (afterDelete[i].position !== i + 1) {
      renumberedCorrectly = false;
      break;
    }
  }
  assert(renumberedCorrectly, "Positions automatically recalculated and renumbered starting from 1");
  assert(afterDelete[0].name === "Aadhaar" && afterDelete[0].position === 1, "Aadhaar is back at position 1");

  // 13. Regression Check: Existing Storefront Services
  const storefrontRes = await fetch(`${API_BASE}/api/services`);
  assert(storefrontRes.status === 200, "GET /api/services (storefront servicesTable) works unchanged");
  const storefrontServices = await storefrontRes.json();
  assert(Array.isArray(storefrontServices) && storefrontServices.length > 0, "Storefront services catalog intact");
  assert(storefrontServices[0].category !== undefined, "Storefront services have category and business fields");

  console.log(`\n🏁 Test Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
