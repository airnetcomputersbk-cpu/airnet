// @ts-nocheck
import app from "../artifacts/api-server/src/app";

/**
 * Vercel Serverless Function entrypoint for AIRNET COMPUTERS Express API
 */
export default function handler(req: any, res: any) {
  // Normalize req.url if Vercel serverless stripped the /api prefix
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
