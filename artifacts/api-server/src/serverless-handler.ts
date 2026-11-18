import app from "./app";
import { warmAllBackendCaches } from "./lib/cache";
import { logger } from "./lib/logger";

// Pre-warm caches on cold start if possible
warmAllBackendCaches().catch((err) => {
  logger.warn({ err }, "Initial serverless cache warm failed non-fatally");
});

/**
 * Self-contained Vercel Serverless Function handler
 */
export default function handler(req: any, res: any) {
  // Normalize URL prefix if stripped by reverse proxy
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
