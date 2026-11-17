import app from "../artifacts/api-server/dist/serverless.mjs";

/**
 * Pure JavaScript Vercel Serverless Function entrypoint
 * No TypeScript compilation or declaration files required
 */
export default function handler(req, res) {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
