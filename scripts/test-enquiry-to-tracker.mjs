// Automated Test: Verifying "Accepted" Enquiry automatically moves to Application Tracker
import pg from "../lib/db/node_modules/pg/lib/index.js";
import fs from "fs";

console.log("==================================================================");
console.log("TEST: ENQUIRY STATUS 'ACCEPTED' -> AUTOMATIC MOVE TO TRACKER");
console.log("==================================================================");

const BASE_URL = "http://127.0.0.1:5001";

async function run() {
  try {
    // 1. Login as admin
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD || "airnet" })
    });
    const setCookie = loginRes.headers.get("set-cookie");
    const sessionCookie = setCookie ? setCookie.split(";")[0] : "";
    const headers = { "cookie": sessionCookie, "Content-Type": "application/json" };

    // 2. Create a test enquiry with status "New"
    const uniqueName = `TestCustomer_${Date.now()}`;
    const createRes = await fetch(`${BASE_URL}/api/admin/enquiries`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customerName: uniqueName,
        mobileNumber: "9876543210",
        serviceId: "pan-card",
        notes: "Requested Service: PAN Card Application\n\nUrgent processing required",
        applicationStatus: "New"
      })
    });

    if (!createRes.ok) throw new Error(`Failed to create enquiry: ${createRes.status}`);
    const newEnquiry = await createRes.json();
    console.log(`[PASS] Created test enquiry ID: ${newEnquiry.id}, Customer: "${newEnquiry.customerName}", Status: "${newEnquiry.applicationStatus}"`);

    // 3. Update status to "Accepted"
    console.log(`[TEST] Changing enquiry status to 'Accepted'...`);
    const acceptRes = await fetch(`${BASE_URL}/api/admin/enquiries/${newEnquiry.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ applicationStatus: "Accepted" })
    });

    if (!acceptRes.ok) throw new Error(`Failed to accept enquiry: ${acceptRes.status}`);
    const acceptedData = await acceptRes.json();
    console.log(`[PASS] Enquiry updated. Backend response:`, {
      id: acceptedData.id,
      applicationStatus: acceptedData.applicationStatus,
      movedToTracker: acceptedData.movedToTracker,
      trackingId: acceptedData.trackingId
    });

    if (acceptedData.applicationStatus !== "Accepted") {
      throw new Error(`Expected status 'Accepted', got '${acceptedData.applicationStatus}'`);
    }

    // 4. Verify in Application Tracker API (/api/admin/tracker)
    console.log(`[TEST] Verifying Application Tracker has the moved task...`);
    const trackerRes = await fetch(`${BASE_URL}/api/admin/tracker`, { headers });
    if (!trackerRes.ok) throw new Error(`Failed to fetch tracker: ${trackerRes.status}`);
    const tasks = await trackerRes.json();

    const matchedTask = tasks.find(t => t.customerName === uniqueName);
    if (!matchedTask) {
      throw new Error(`Task for "${uniqueName}" NOT FOUND in Application Tracker!`);
    }

    console.log(`[PASS] Application Task successfully found in Application Tracker:`, {
      id: matchedTask.id,
      customerId: matchedTask.customerId,
      customerName: matchedTask.customerName,
      serviceName: matchedTask.serviceName,
      currentStep: matchedTask.currentStep,
      status: matchedTask.status,
      progressPercent: matchedTask.progressPercent
    });

    if (matchedTask.status !== "In Progress") {
      throw new Error(`Expected task status 'In Progress', got '${matchedTask.status}'`);
    }
    if (!matchedTask.steps || matchedTask.steps.length === 0) {
      throw new Error(`Task has no steps defined!`);
    }

    console.log(`[PASS] Task steps count: ${matchedTask.steps.length}`);
    console.log(`[PASS] Step 1 status: "${matchedTask.steps[0].status}"`);

    // 5. Clean up test records
    console.log(`[CLEANUP] Cleaning up test records...`);
    await fetch(`${BASE_URL}/api/admin/enquiries/${newEnquiry.id}`, { method: "DELETE", headers });
    await fetch(`${BASE_URL}/api/admin/tracker/${matchedTask.id}`, { method: "DELETE", headers });
    console.log(`[PASS] Cleanup completed.`);

    console.log("\n==================================================================");
    console.log(">>> ALL ENQUIRY TO TRACKER MOVE TESTS PASSED (100%) <<<");
    console.log("==================================================================");
  } catch (err) {
    console.error("[FAIL]", err);
    process.exit(1);
  }
}

run();
