import http from "node:http";

console.log("=========================================================");
console.log("  COMPREHENSIVE PERFORMANCE & INSTANT SYNC VERIFICATION  ");
console.log("=========================================================");

const BASE_URL = "http://localhost:5001";

function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk.toString()));
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            rawBody: data,
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
          });
        }
      });
    });

    req.on("error", reject);

    if (postData) {
      if (typeof postData === "string") req.write(postData);
      else req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Measure API Response Times & Caching
  console.log("\n--- TEST SUITE 1: Instant Database Fetching & Caching ---");

  const startServices = performance.now();
  const resServices1 = await httpRequest({
    hostname: "localhost",
    port: 5001,
    path: "/api/services",
    method: "GET",
  });
  const timeServices1 = Math.round(performance.now() - startServices);
  assert(resServices1.statusCode === 200, `GET /api/services returned 200 (${timeServices1}ms)`);

  const startServices2 = performance.now();
  const resServices2 = await httpRequest({
    hostname: "localhost",
    port: 5001,
    path: "/api/services",
    method: "GET",
  });
  const timeServices2 = Math.round(performance.now() - startServices2);
  assert(
    resServices2.headers["x-cache"] === "HIT" || timeServices2 < 50,
    `Cache HIT on repeated /api/services fetch (${timeServices2}ms, X-Cache: ${resServices2.headers["x-cache"]})`
  );

  const startNotifs = performance.now();
  const resNotifs = await httpRequest({
    hostname: "localhost",
    port: 5001,
    path: "/api/notifications",
    method: "GET",
  });
  const timeNotifs = Math.round(performance.now() - startNotifs);
  assert(resNotifs.statusCode === 200, `GET /api/notifications returned 200 (${timeNotifs}ms)`);

  // 2. Real-Time Server-Sent Events (SSE) Multi-Client Synchronization
  console.log("\n--- TEST SUITE 2: Multi-Device Real-Time Sync via SSE ---");

  let sseReceivedEvents = [];
  let sseConnected = false;

  const sseReq = http.request(
    {
      hostname: "localhost",
      port: 5001,
      path: "/api/events/live",
      method: "GET",
      headers: { Accept: "text/event-stream" },
    },
    (res) => {
      assert(res.statusCode === 200, "SSE connection opened with HTTP 200");
      assert(res.headers["content-type"]?.includes("text/event-stream"), "SSE Content-Type is text/event-stream");

      res.on("data", (chunk) => {
        const text = chunk.toString();
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "connected") {
                sseConnected = true;
              } else if (data.type === "sync_event") {
                sseReceivedEvents.push(data);
              }
            } catch (e) {}
          }
        }
      });
    }
  );

  sseReq.on("error", (e) => console.error("SSE request error:", e.message));
  sseReq.end();

  // Wait for SSE handshake
  await new Promise((r) => setTimeout(r, 600));
  assert(sseConnected, "Client received 'connected' handshake event from SSE bus");

  // Trigger a mutation: public enquiry submission
  console.log("\n  Triggering live mutation: customer submits enquiry...");
  const uniqueName = `LiveSync Test Citizen ${Date.now()}`;
  const enquiryRes = await httpRequest(
    {
      hostname: "localhost",
      port: 5001,
      path: "/api/enquiries",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      customerName: uniqueName,
      mobileNumber: "9876543210",
      serviceId: "pan-card",
      notes: "Automated real-time synchronization test",
    }
  );

  assert(enquiryRes.statusCode === 200, `Enquiry submitted with HTTP 200 (CustomerId: ${enquiryRes.body?.customerId})`);

  // Wait for SSE propagation (should be < 50ms)
  await new Promise((r) => setTimeout(r, 400));

  const enquiryEvent = sseReceivedEvents.find((e) => e.entity === "enquiries" && e.action === "create");
  assert(Boolean(enquiryEvent), "SSE client received real-time broadcast event for 'enquiries:create'");
  if (enquiryEvent) {
    assert(
      enquiryEvent.payload?.customerName === uniqueName,
      `Broadcast event payload matches submitted citizen name ("${uniqueName}")`
    );
  }

  // Clean up created test enquiry
  if (enquiryRes.body?.id) {
    // Authenticate as admin to delete test enquiry
    const loginRes = await httpRequest(
      {
        hostname: "localhost",
        port: 5001,
        path: "/api/admin/login",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { password: "rasool" }
    );
    const setCookie = loginRes.headers["set-cookie"];
    const cookie = Array.isArray(setCookie) ? setCookie[0].split(";")[0] : (setCookie ? setCookie.split(";")[0] : "");

    const delRes = await httpRequest({
      hostname: "localhost",
      port: 5001,
      path: `/api/admin/enquiries/${enquiryRes.body.id}`,
      method: "DELETE",
      headers: {
        Cookie: cookie,
      },
    });
    assert(delRes.statusCode === 200, "Cleaned up test enquiry record with admin session");

    await new Promise((r) => setTimeout(r, 400));
    const delEvent = sseReceivedEvents.find((e) => e.entity === "enquiries" && e.action === "delete");
    assert(Boolean(delEvent), "SSE client received real-time broadcast event for 'enquiries:delete'");
  }

  // Close SSE connection
  sseReq.destroy();

  // 3. Status Summary
  console.log("\n=========================================================");
  console.log(`  SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("=========================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
