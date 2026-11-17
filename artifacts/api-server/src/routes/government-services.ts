import { Router, type Request, type Response, type NextFunction } from "express";
import { db, governmentServicesTable, type GovernmentService } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import { getCache, setCache, invalidateCache } from "../lib/cache";
import { broadcastEvent } from "../lib/events";

export const governmentServicesRouter = Router();

function isValidHttpUrl(stringUrl: string): boolean {
  if (!stringUrl || typeof stringUrl !== "string") return false;
  const trimmed = stringUrl.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getFaviconUrl(stringUrl: string): string {
  try {
    const parsed = new URL(stringUrl.trim());
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return "";
  }
}

// 1. GET /api/government-services (Public / Admin read)
governmentServicesRouter.get("/", async (req: Request, res: Response) => {
  try {
    const cacheKey = "government_services:all";
    const cached = getCache<GovernmentService[]>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const services = await db
      .select()
      .from(governmentServicesTable)
      .orderBy(asc(governmentServicesTable.position));

    setCache(cacheKey, services, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(services);
  } catch (error) {
    console.error("[GovServices] Failed to fetch services:", error);
    res.status(500).json({ error: "Failed to fetch government services" });
  }
});

// 2. PATCH /api/government-services/reorder (Admin update ordering)
// Placed before /:id route to prevent route collision
governmentServicesRouter.patch("/reorder", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { items, ids } = req.body;
    let targetIds: number[] = [];

    if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids.map(Number).filter((n) => !isNaN(n) && n > 0);
    } else if (Array.isArray(items) && items.length > 0) {
      // Sort items by position to extract target order
      const sorted = [...items].sort((a, b) => (a.position || 0) - (b.position || 0));
      targetIds = sorted.map((it) => Number(it.id)).filter((n) => !isNaN(n) && n > 0);
    }

    if (targetIds.length === 0) {
      res.status(400).json({ error: "Invalid reorder payload: array of IDs or items required" });
      return;
    }

    await db.transaction(async (tx) => {
      for (let i = 0; i < targetIds.length; i++) {
        const id = targetIds[i];
        const newPos = i + 1;
        await tx
          .update(governmentServicesTable)
          .set({ position: newPos, updatedAt: new Date() })
          .where(eq(governmentServicesTable.id, id));
      }
    });

    invalidateCache("government_services:*");
    broadcastEvent("government_services", "reorder", { ids: targetIds });

    res.json({ success: true, message: "Position saved", updatedCount: targetIds.length });
  } catch (error) {
    console.error("[GovServices] Failed to reorder services:", error);
    res.status(500).json({ error: "Failed to persist service order" });
  }
});

// 3. POST /api/government-services (Admin create new service)
governmentServicesRouter.post("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, url, iconKey, iconType, faviconUrl } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      res.status(400).json({ error: "Service name is required" });
      return;
    }

    const trimmedUrl = typeof url === "string" ? url.trim() : "";
    if (!isValidHttpUrl(trimmedUrl)) {
      res.status(400).json({ error: "Valid website URL starting with http:// or https:// is required" });
      return;
    }

    // Determine icon configuration (default to favicon mode for new services)
    const effectiveIconType = iconType === "builtin" ? "builtin" : "favicon";
    const effectiveFaviconUrl = faviconUrl?.trim() || getFaviconUrl(trimmedUrl);
    const effectiveIconKey = typeof iconKey === "string" && iconKey.trim() ? iconKey.trim() : "Globe";

    // Calculate next sequential position
    const currentServices = await db
      .select({ position: governmentServicesTable.position })
      .from(governmentServicesTable);
    const maxPos = currentServices.reduce((max, s) => Math.max(max, s.position || 0), 0);
    const nextPosition = maxPos + 1;

    const [newService] = await db
      .insert(governmentServicesTable)
      .values({
        name: trimmedName,
        url: trimmedUrl,
        iconKey: effectiveIconKey,
        iconType: effectiveIconType,
        faviconUrl: effectiveFaviconUrl,
        position: nextPosition,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    invalidateCache("government_services:*");
    broadcastEvent("government_services", "create", newService);

    res.status(201).json(newService);
  } catch (error) {
    console.error("[GovServices] Failed to create service:", error);
    res.status(500).json({ error: "Failed to create service" });
  }
});

// 4. PUT /api/government-services/:id (Admin update service)
governmentServicesRouter.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    const { name, url, iconKey, iconType, faviconUrl } = req.body;

    const updatePayload: Partial<typeof governmentServicesTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        res.status(400).json({ error: "Service name cannot be empty" });
        return;
      }
      updatePayload.name = trimmedName;
    }

    if (url !== undefined) {
      const trimmedUrl = typeof url === "string" ? url.trim() : "";
      if (!isValidHttpUrl(trimmedUrl)) {
        res.status(400).json({ error: "Valid website URL starting with http:// or https:// is required" });
        return;
      }
      updatePayload.url = trimmedUrl;
      // If URL changed and no explicit favicon provided, regenerate favicon
      if (!faviconUrl && updatePayload.iconType !== "builtin") {
        updatePayload.faviconUrl = getFaviconUrl(trimmedUrl);
      }
    }

    if (iconKey !== undefined) {
      updatePayload.iconKey = iconKey.trim() || "Globe";
    }

    if (iconType !== undefined) {
      updatePayload.iconType = iconType;
    }

    if (faviconUrl !== undefined) {
      updatePayload.faviconUrl = faviconUrl;
    }

    const [updatedService] = await db
      .update(governmentServicesTable)
      .set(updatePayload)
      .where(eq(governmentServicesTable.id, id))
      .returning();

    if (!updatedService) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    invalidateCache("government_services:*");
    broadcastEvent("government_services", "update", updatedService);

    res.json(updatedService);
  } catch (error) {
    console.error("[GovServices] Failed to update service:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// 5. DELETE /api/government-services/:id (Admin delete service and renumber positions)
governmentServicesRouter.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    // Delete record
    const deleted = await db
      .delete(governmentServicesTable)
      .where(eq(governmentServicesTable.id, id))
      .returning({ id: governmentServicesTable.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Service not found" });
      return;
    }

    // Renumber remaining positions starting from 1
    const remaining = await db
      .select({ id: governmentServicesTable.id })
      .from(governmentServicesTable)
      .orderBy(asc(governmentServicesTable.position), asc(governmentServicesTable.id));

    await db.transaction(async (tx) => {
      for (let i = 0; i < remaining.length; i++) {
        await tx
          .update(governmentServicesTable)
          .set({ position: i + 1, updatedAt: new Date() })
          .where(eq(governmentServicesTable.id, remaining[i].id));
      }
    });

    invalidateCache("government_services:*");
    broadcastEvent("government_services", "delete", { id });

    res.json({ success: true, deletedId: id, remainingCount: remaining.length });
  } catch (error) {
    console.error("[GovServices] Failed to delete service:", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
});
