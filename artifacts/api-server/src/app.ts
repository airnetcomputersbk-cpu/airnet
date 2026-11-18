import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import path from "path";
import fs from "fs";
import { logger } from "./lib/logger";
import router from "./routes";
import { adminRouter } from "./routes/admin";
import { governmentServicesRouter } from "./routes/government-services";
import { pathwayEmbedRouter } from "./routes/pathway-embed";
import { nativeCompression } from "./lib/compression";
import { getCache, setCache } from "./lib/cache";
import { sseHandler } from "./lib/events";
import { db, servicesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const app = express();

app.use(nativeCompression);

const uploadsDir = process.env.VERCEL
  ? path.resolve("/tmp", "uploads")
  : path.resolve(process.cwd(), "artifacts/api-server/uploads");
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  // Read-only filesystem fallback for serverless
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);
      return callback(null, origin);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(uploadsDir));

app.use(
  pinoHttp({
    logger,
    autoLogging: process.env.NODE_ENV !== "test",
  }),
);

// URL normalization middleware for reverse proxies and Vercel Services
app.use((req, res, next) => {
  if (req.url && !req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
    req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
  }
  next();
});

// Dual-mount router to handle both /api/* and rewritten paths
app.use("/api", router);
app.use("/api/pathway", pathwayEmbedRouter);
app.use("/api/admin", adminRouter);
app.use("/api/google-drive", (req, res, next) => {
  req.url = `/google-drive${req.url === "/" ? "" : req.url}`;
  adminRouter(req, res, next);
});
app.use("/api/documents", (req, res, next) => {
  req.url = `/documents${req.url === "/" ? "" : req.url}`;
  adminRouter(req, res, next);
});

app.use("/api/government-services", governmentServicesRouter);
app.use("/api/admin/government-services", governmentServicesRouter);
app.patch("/api/services/reorder", (req, res, next) => {
  req.url = "/reorder";
  governmentServicesRouter(req, res, next);
});

// Fallback mounts if /api prefix is stripped by reverse proxy
app.use("/admin", adminRouter);
app.use("/pathway", pathwayEmbedRouter);
app.use("/government-services", governmentServicesRouter);
app.patch("/services/reorder", (req, res, next) => {
  req.url = "/reorder";
  governmentServicesRouter(req, res, next);
});
app.use(router);

// Real-Time Server-Sent Events (SSE) stream for instant multi-device data synchronization
app.get("/api/events/live", sseHandler);
app.get("/events/live", sseHandler);

const handleServicesFetch = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.query.type === "government") {
    req.url = "/";
    governmentServicesRouter(req, res, next);
    return;
  }
  try {
    const cacheKey = "services:active";
    const cached = getCache<any[]>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const allServices = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.isActive, true))
      .orderBy(asc(servicesTable.orderIndex));

    setCache(cacheKey, allServices, 3600); // 1 hour TTL with instant mutation invalidation
    res.setHeader("X-Cache", "MISS");
    res.json(allServices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
};

app.get("/api/services", handleServicesFetch);
app.get("/services", handleServicesFetch);

// Production: Serve frontend static build and client-side SPA routing fallback
const clientDistDir = path.resolve(process.cwd(), "artifacts/airnet-computers/dist/public");
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      return res.sendFile(path.join(clientDistDir, "index.html"));
    }
    next();
  });
}

export default app;
