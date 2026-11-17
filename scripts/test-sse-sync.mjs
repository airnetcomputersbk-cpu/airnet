import http from "node:http";

console.log("=== Testing SSE Bus /api/events/live ===");

const req = http.request(
  {
    hostname: "localhost",
    port: 5001,
    path: "/api/events/live",
    method: "GET",
    headers: {
      Accept: "text/event-stream",
    },
  },
  (res) => {
    console.log("SSE Status Code:", res.statusCode);
    console.log("Content-Type:", res.headers["content-type"]);

    let receivedData = "";
    res.on("data", (chunk) => {
      receivedData += chunk.toString();
      console.log("Received SSE chunk:\n" + chunk.toString());
      if (receivedData.includes('"type":"connected"')) {
        console.log("PASS: SSE connection established successfully!");
        req.destroy();
        process.exit(0);
      }
    });
  }
);

req.on("error", (err) => {
  console.error("SSE Error:", err.message);
  process.exit(1);
});

req.setTimeout(5000, () => {
  console.error("Timeout waiting for SSE connect event");
  req.destroy();
  process.exit(1);
});

req.end();
