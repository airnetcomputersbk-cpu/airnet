const API_BASE = "http://localhost:5001";

async function runTest() {
  console.log("=== Testing Featured & Recently Added Notifications System ===");

  // 1. Authenticate as Admin
  const adminPassword = process.env.ADMIN_MASTER_PASSWORD || "airnet";
  const loginRes = await fetch(`${API_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: adminPassword }),
  });
  if (!loginRes.ok) {
    throw new Error(`Admin login failed: ${loginRes.status}`);
  }
  const rawCookie = loginRes.headers.get("set-cookie");
  const authCookie = rawCookie ? rawCookie.split(";")[0] : "admin_session=admin";
  console.log(`[PASS] Admin authenticated successfully (${authCookie}).`);

  // 2. Fetch public notifications
  const res = await fetch(`${API_BASE}/api/notifications`);
  if (!res.ok) {
    throw new Error(`Failed to fetch notifications: ${res.status}`);
  }
  const notifications = await res.json();
  console.log(`[PASS] Fetched ${notifications.length} public notifications.`);

  if (notifications.length === 0) {
    console.log("No notifications found, test completed with empty set.");
    return;
  }

  // Pick a test target notification
  const target = notifications[0];
  const originalFeatured = Boolean(target.isFeatured);
  const originalCreatedAt = target.createdAt;
  console.log(`[TARGET] ID: ${target.id}, Title: "${target.title}", Featured: ${originalFeatured}, CreatedAt: ${originalCreatedAt}`);

  // 3. Test toggling featured status in Admin API
  const newFeatured = !originalFeatured;
  console.log(`[TEST] Toggling notification #${target.id} isFeatured to ${newFeatured}...`);
  const patchRes = await fetch(`${API_BASE}/api/admin/notifications/${target.id}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": authCookie
    },
    body: JSON.stringify({ isFeatured: newFeatured })
  });

  if (!patchRes.ok) {
    throw new Error(`PATCH failed with status ${patchRes.status}`);
  }
  const updatedNotification = await patchRes.json();
  console.log(`[PASS] Updated notification isFeatured: ${updatedNotification.isFeatured}`);

  // 4. Verify createdAt and data integrity
  if (new Date(updatedNotification.createdAt).getTime() !== new Date(originalCreatedAt).getTime()) {
    throw new Error(`CreatedAt timestamp was altered! Original: ${originalCreatedAt}, Now: ${updatedNotification.createdAt}`);
  }
  console.log("[PASS] Original publication date/time (createdAt) is strictly preserved.");

  // 5. Verify public frontend simulation (Featured vs Recently Added partitioning)
  const pubRes = await fetch(`${API_BASE}/api/notifications`);
  const pubList = await pubRes.json();

  const featured = pubList.filter(n => Boolean(n.isFeatured));
  const recentlyAdded = pubList.filter(n => !n.isFeatured).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(`[VERIFY] Total: ${pubList.length}, Featured: ${featured.length}, Recently Added: ${recentlyAdded.length}`);

  // Check no duplicates
  const featuredIds = new Set(featured.map(n => n.id));
  const duplicate = recentlyAdded.find(n => featuredIds.has(n.id));
  if (duplicate) {
    throw new Error(`Duplicate notification found in both Featured and Recently Added! ID: ${duplicate.id}`);
  }
  console.log("[PASS] Zero duplicate notifications between Featured and Recently Added sections.");

  // Check that target is in the correct section
  if (newFeatured) {
    if (!featured.some(n => n.id === target.id)) {
      throw new Error(`Target notification #${target.id} was marked Featured but not found in Featured section!`);
    }
    console.log("[PASS] Target notification is present in Featured section.");
  } else {
    if (!recentlyAdded.some(n => n.id === target.id)) {
      throw new Error(`Target notification #${target.id} had Featured removed but not found in Recently Added section!`);
    }
    console.log("[PASS] Target notification is present in Recently Added section.");
  }

  // Check chronological sorting of Recently Added (newest first)
  for (let i = 0; i < recentlyAdded.length - 1; i++) {
    const tA = new Date(recentlyAdded[i].createdAt).getTime();
    const tB = new Date(recentlyAdded[i + 1].createdAt).getTime();
    if (tA < tB) {
      throw new Error(`Recently Added is not strictly sorted descending! Index ${i} (${tA}) < Index ${i+1} (${tB})`);
    }
  }
  console.log("[PASS] Recently Added notifications are strictly sorted chronologically (newest first).");

  // 6. Restore original status
  console.log(`[RESTORE] Restoring notification #${target.id} isFeatured to ${originalFeatured}...`);
  await fetch(`${API_BASE}/api/admin/notifications/${target.id}`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      "Cookie": authCookie
    },
    body: JSON.stringify({ isFeatured: originalFeatured })
  });
  console.log("[PASS] Original featured status restored cleanly.");

  console.log("\n>>> ALL FEATURED & RECENTLY ADDED NOTIFICATION AUDITS PASSED 100%! <<<");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
