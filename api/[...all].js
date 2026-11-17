import app from "../artifacts/api-server/dist/serverless.mjs";

/**
 * Pure JavaScript Catch-All Vercel Serverless Function entrypoint
 */
export default function handler(req, res) {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
