import app from "./app";
import { warmAllBackendCaches } from "./lib/cache";
import { logger } from "./lib/logger";

// Pre-warm caches on cold start if possible
warmAllBackendCaches().catch((err) => {
  logger.warn({ err }, "Initial serverless cache warm failed non-fatally");
});

export default app;
