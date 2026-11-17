import app from "./app";
import { logger } from "./lib/logger";
import { startDailyReportScheduler } from "./lib/daily-report-scheduler";
import { warmAllBackendCaches } from "./lib/cache";

const rawPort = process.env["PORT"] || "5001";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Pre-warm backend in-memory cache for instant 0ms responses on page refresh
  warmAllBackendCaches().catch((wErr) => {
    logger.warn({ err: wErr }, "Error during initial cache pre-warming");
  });

  // Start background daily report scheduler
  try {
    startDailyReportScheduler();
  } catch (schedErr) {
    logger.error({ err: schedErr }, "Failed to start daily report scheduler");
  }
});
