// Native Node.js HTTP compression middleware using built-in zlib
import zlib from "zlib";
import type { Request, Response, NextFunction } from "express";

export function nativeCompression(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = req.headers["accept-encoding"] || "";
  if (!acceptEncoding.includes("gzip")) {
    return next();
  }

  const originalSend = res.send.bind(res);

  res.send = function (body: any): Response {
    if (res.headersSent) {
      return originalSend(body);
    }

    // Only compress text/json responses above 1024 bytes
    let buffer: Buffer | null = null;
    if (typeof body === "string") {
      buffer = Buffer.from(body, "utf-8");
    } else if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (body && typeof body === "object") {
      const json = JSON.stringify(body);
      buffer = Buffer.from(json, "utf-8");
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    if (buffer && buffer.length > 1024) {
      try {
        const compressed = zlib.gzipSync(buffer, { level: 6 });
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader("Content-Length", compressed.length);
        return originalSend(compressed);
      } catch (err) {
        // Fallback to uncompressed if gzip fails
        return originalSend(buffer);
      }
    }

    return originalSend(body);
  };

  next();
}
