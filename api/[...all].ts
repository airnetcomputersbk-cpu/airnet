import type { Request, Response } from "express";
import app from "../artifacts/api-server/src/app";

/**
 * Vercel Serverless Function Catch-All entrypoint for AIRNET COMPUTERS API
 * Handles all /api/* routes (e.g. /api/services, /api/admin/login, etc.)
 */
export default function handler(req: Request, res: Response) {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  return app(req, res);
}
