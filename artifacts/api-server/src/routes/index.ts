import { Router, type IRouter } from "express";
import healthRouter from "./health";
import { normalizeDateToDMY } from "../lib/extractor.js";
import { 
  db, 
  enquiriesTable, 
  servicesTable, 
  applicationTasksTable, 
  notificationsTable 
} from "@workspace/db";
import { eq, and, desc, or, ilike, inArray, isNull, sql } from "drizzle-orm";
import { getFrontendDisplayedMobileNumber, CONSTANT_ADMIN_EMAIL } from "../lib/admin-auth-service";
import { getCache, setCache, invalidateCache } from "../lib/cache";
import { broadcastEvent } from "../lib/events";
import { resolveGovernmentServiceUrl } from "../lib/government-services-resolver";

const router: IRouter = Router();

router.use(healthRouter);

router.post("/enquiries", async (req, res) => {
  try {
    let { customerName, mobileNumber, serviceId, notes } = req.body;

    // Smart Foreign Key matching
    let finalServiceId: string | null = null;
    let finalNotes = notes || "";
    const requestedServiceTitle = typeof serviceId === "string" ? serviceId.trim() : "";
    
    if (requestedServiceTitle) {
      // Check if it strictly matches an existing service ID in servicesTable
      const matchingById = await db.select().from(servicesTable).where(eq(servicesTable.id, requestedServiceTitle));
      if (matchingById.length > 0) {
        finalServiceId = matchingById[0].id;
      } else {
        // Check if it matches an existing service title
        const matchingByTitle = await db.select().from(servicesTable).where(eq(servicesTable.title, requestedServiceTitle));
        if (matchingByTitle.length > 0) {
          finalServiceId = matchingByTitle[0].id;
        } else {
          // It's a notification post title or custom service
          finalServiceId = null;
          finalNotes = `Requested Service: ${requestedServiceTitle}\n\n${finalNotes}`.trim();
        }
      }
    }

    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const customerId = `AN-${randomDigits}`;

    const [newEnquiry] = await db.insert(enquiriesTable).values({
      customerId,
      customerName: (customerName || "").toString().trim(),
      mobileNumber: (mobileNumber || "").toString().trim(),
      serviceId: finalServiceId,
      notes: finalNotes,
      applicationStatus: "New"
    }).returning();

    invalidateCache("enquiries:*", "admin:enquiries");

    const enquiryPayload = {
      ...newEnquiry,
      serviceTitle: requestedServiceTitle || (newEnquiry.serviceId ?? "Custom Service")
    };
    broadcastEvent("enquiries", "create", enquiryPayload);

    res.json(enquiryPayload);
  } catch (error) {
    console.error("Failed to submit enquiry:", error);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

router.post("/enquiries/status", async (req, res) => {
  try {
    const { ids, phone, customerId } = req.body;

    const conditions = [];

    if (Array.isArray(ids) && ids.length > 0) {
      conditions.push(inArray(enquiriesTable.id, ids));
    }
    if (phone && typeof phone === "string" && phone.trim()) {
      const p = phone.trim();
      const digits = p.replace(/\D/g, "");
      if (digits.length >= 10) {
        conditions.push(
          or(
            ilike(enquiriesTable.mobileNumber, `%${digits.slice(-10)}%`),
            ilike(enquiriesTable.mobileNumber, `%${p}%`)
          )
        );
      } else {
        conditions.push(ilike(enquiriesTable.mobileNumber, `%${p}%`));
      }
    }
    if (customerId && typeof customerId === "string" && customerId.trim()) {
      conditions.push(eq(enquiriesTable.customerId, customerId.trim()));
    }

    if (conditions.length === 0) {
      res.json([]);
      return;
    }

    const matchedEnquiries = await db
      .select({
        id: enquiriesTable.id,
        customerId: enquiriesTable.customerId,
        customerName: enquiriesTable.customerName,
        mobileNumber: enquiriesTable.mobileNumber,
        serviceId: enquiriesTable.serviceId,
        applicationStatus: enquiriesTable.applicationStatus,
        amountCharged: enquiriesTable.amountCharged,
        amountPaid: enquiriesTable.amountPaid,
        amountPending: enquiriesTable.amountPending,
        paymentMethod: enquiriesTable.paymentMethod,
        notes: enquiriesTable.notes,
        createdAt: enquiriesTable.createdAt,
        updatedAt: enquiriesTable.updatedAt,
        serviceTitle: servicesTable.title,
      })
      .from(enquiriesTable)
      .leftJoin(servicesTable, eq(enquiriesTable.serviceId, servicesTable.id))
      .where(or(...conditions))
      .orderBy(desc(enquiriesTable.createdAt));

    // Get any associated application tasks to fetch real-time milestone progress
    const customerIds = matchedEnquiries
      .map(e => e.customerId)
      .filter((id): id is string => Boolean(id));

    const tasks = customerIds.length > 0
      ? await db.select().from(applicationTasksTable).where(inArray(applicationTasksTable.customerId, customerIds))
      : [];

    const taskMap = new Map<string, any>();
    tasks.forEach(t => {
      if (t.customerId) taskMap.set(t.customerId, t);
    });

    const enriched = await Promise.all(
      matchedEnquiries.map(async enq => {
        const task = enq.customerId ? taskMap.get(enq.customerId) : null;
        let serviceTitle = enq.serviceTitle;
        if (!serviceTitle && enq.notes) {
          const m = enq.notes.match(/Requested Service:\s*([^\n\r]+)/);
          if (m && m[1]) serviceTitle = m[1].trim();
        }
        if (!serviceTitle) serviceTitle = enq.serviceId || "General Service Enquiry";

        const isCompleted = enq.applicationStatus === "Completed" || task?.status === "Completed";
        const progressPercent = task?.progressPercent ?? (isCompleted ? 100 : enq.applicationStatus === "Accepted" ? 40 : enq.applicationStatus === "On Hold" ? 25 : 15);
        const currentStep = task?.currentStep ?? (isCompleted 
          ? "Application Completed & Ready for Pickup" 
          : enq.applicationStatus === "Accepted" 
          ? "Application Accepted & Processing" 
          : enq.applicationStatus === "On Hold"
          ? "On Hold for Follow-up"
          : "Application Received");

        const resolvedUrl = task?.applyUrl || (await resolveGovernmentServiceUrl(serviceTitle));

        return {
          ...enq,
          serviceTitle,
          applyUrl: resolvedUrl,
          progressPercent,
          currentStep,
          steps: task?.steps || [
            { id: "step-1", title: "Enquiry & Documents Received", status: "completed" },
            { id: "step-2", title: "Verification & Data Entry", status: progressPercent >= 40 ? "completed" : "in-progress" },
            { id: "step-3", title: "Official Portal Submission", status: progressPercent >= 60 ? "completed" : progressPercent >= 40 ? "in-progress" : "pending" },
            { id: "step-4", title: "Department Verification & Approval", status: isCompleted ? "completed" : "pending" },
            { id: "step-5", title: "Ready for Delivery / Delivered", status: isCompleted ? "completed" : "pending" },
          ],
          taskStatus: task?.status || enq.applicationStatus,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error("Error fetching statuses:", error);
    res.status(500).json({ error: "Failed to fetch statuses" });
  }
});

router.get("/tracker/lookup", async (req, res) => {
  try {
    const query = String(req.query.q || req.query.query || "").trim();

    if (!query) {
      res.status(400).json({ error: "Search query required" });
      return;
    }

    let tasks = await db
      .select({
        id: applicationTasksTable.id,
        customerId: applicationTasksTable.customerId,
        customerName: applicationTasksTable.customerName,
        mobileNumber: applicationTasksTable.mobileNumber,
        serviceName: applicationTasksTable.serviceName,
        applyUrl: applicationTasksTable.applyUrl,
        applicationNumber: applicationTasksTable.applicationNumber,
        currentStep: applicationTasksTable.currentStep,
        status: applicationTasksTable.status,
        progressPercent: applicationTasksTable.progressPercent,
        steps: applicationTasksTable.steps,
        targetDate: applicationTasksTable.targetDate,
        paymentType: applicationTasksTable.paymentType,
        amountPaid: applicationTasksTable.amountPaid,
        amountPending: applicationTasksTable.amountPending,
        createdAt: applicationTasksTable.createdAt,
        updatedAt: applicationTasksTable.updatedAt,
      })
      .from(applicationTasksTable)
      .where(
        or(
          eq(applicationTasksTable.customerId, query),
          eq(applicationTasksTable.applicationNumber, query),
          ilike(applicationTasksTable.mobileNumber, `%${query}%`)
        )
      );

    // Fallback: If not found in tracker tasks, check enquiries table
    if (tasks.length === 0) {
      const enqs = await db
        .select()
        .from(enquiriesTable)
        .where(
          or(
            eq(enquiriesTable.customerId, query),
            ilike(enquiriesTable.mobileNumber, `%${query}%`)
          )
        );

      if (enqs.length > 0) {
        tasks = await Promise.all(
          enqs.map(async (e: any) => {
            let sName = e.serviceId;
            if (!sName && e.notes) {
              const m = e.notes.match(/Requested Service:\s*([^\n\r]+)/);
              if (m && m[1]) sName = m[1].trim();
            }
            if (!sName) sName = "Customer Service";

            const resolvedApplyUrl = await resolveGovernmentServiceUrl(sName);
            const isCompleted = e.applicationStatus === "Completed";
            const progress = isCompleted ? 100 : (e.applicationStatus === "Accepted" ? 30 : 15);
            const currentStep = isCompleted 
              ? "Application Completed & Ready for Pickup" 
              : (e.applicationStatus === "Accepted" ? "Application Accepted & In Progress" : "Application Received");

            return {
              id: e.id,
              customerId: e.customerId || `AN-${e.id}`,
              customerName: e.customerName,
              mobileNumber: e.mobileNumber,
              serviceName: sName,
              applyUrl: resolvedApplyUrl,
              applicationNumber: `APP-${e.customerId || e.id}`,
              currentStep,
              status: e.applicationStatus || "In Progress",
              progressPercent: progress,
              steps: [
                { id: "step-1", title: "Application & Documents Received", status: "completed" },
                { id: "step-2", title: "Verification & Portal Submission", status: progress >= 30 ? "in-progress" : "pending" },
                { id: "step-3", title: "Government Verification", status: isCompleted ? "completed" : "pending" },
                { id: "step-4", title: "Approval & Certificate Generation", status: isCompleted ? "completed" : "pending" },
                { id: "step-5", title: "Ready for Delivery / Delivered", status: isCompleted ? "completed" : "pending" }
              ],
              targetDate: null,
              paymentType: e.paymentMethod || "Cash",
              amountPaid: e.amountPaid || 0,
              amountPending: e.amountPending || 0,
              createdAt: e.createdAt,
              updatedAt: e.updatedAt || e.createdAt,
            };
          })
        );
      }
    } else {
      // Ensure all found tasks have an applyUrl resolved
      tasks = await Promise.all(
        tasks.map(async (t) => {
          if (t.applyUrl) return t;
          const url = await resolveGovernmentServiceUrl(t.serviceName);
          return { ...t, applyUrl: url };
        })
      );
    }

    res.json(tasks);
  } catch (error) {
    console.error("Error in tracker lookup:", error);
    res.status(500).json({ error: "Failed to search tracker" });
  }
});

router.post("/tracker/send-progress", async (req, res) => {
  try {
    const { customerId, mobileNumber, customerName, serviceName, message } = req.body;
    console.log(`[Tracker Notification] Progress message dispatched for ${customerName} (${customerId}) to ${mobileNumber}`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sentTo: mobileNumber,
      customerName,
      message,
    });
  } catch (error) {
    console.error("Error dispatching tracker progress message:", error);
    res.status(500).json({ error: "Failed to dispatch progress message" });
  }
});

router.post("/enquiries/send-confirmation", async (req, res) => {
  try {
    const { customerId, mobileNumber, customerName, serviceName, message } = req.body;
    console.log(`[Customer Notification] Automatic Registration Confirmation sent to ${customerName} (${mobileNumber}) for ${serviceName}. Customer ID: ${customerId}`);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      sentTo: mobileNumber,
      customerId,
      customerName,
      serviceName,
      message,
    });
  } catch (error) {
    console.error("Error dispatching enquiry confirmation message:", error);
    res.status(500).json({ error: "Failed to dispatch confirmation message" });
  }
});

router.get("/notifications", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  try {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    // Fast-path cache for primary homepage fetch
    const isStandardAll = (!category || category === "All") && (!search || !search.trim());
    if (isStandardAll) {
      const cached = getCache<any[]>("notifications:public:all");
      if (cached) {
        res.setHeader("X-Cache", "HIT");
        res.json(cached);
        return;
      }
    }

    const statusClause = or(
      eq(notificationsTable.status, "Published"),
      ilike(notificationsTable.status, "published"),
      eq(notificationsTable.status, "Active"),
      ilike(notificationsTable.status, "active"),
      isNull(notificationsTable.status)
    );
    const conditions = statusClause ? [statusClause] : [];

    if (category && category !== "All") {
      conditions.push(eq(notificationsTable.category, category));
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      const searchClause = or(
        ilike(notificationsTable.title, q),
        ilike(notificationsTable.organization, q),
        ilike(notificationsTable.qualification, q),
        ilike(notificationsTable.description, q)
      );
      if (searchClause) {
        conditions.push(searchClause);
      }
    }

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.isFeatured), desc(notificationsTable.createdAt));

    const formatted = notifications.map(n => ({
      ...n,
      startDate: normalizeDateToDMY(n.startDate) || n.startDate,
      lastDate: normalizeDateToDMY(n.lastDate) || n.lastDate,
    }));

    if (isStandardAll) {
      setCache("notifications:public:all", formatted, 3600); // 1 hour cache with instant mutation invalidation
      res.setHeader("X-Cache", "MISS");
    }

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.get("/notifications/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [notification] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    // Increment viewCount asynchronously without blocking response
    db.update(notificationsTable)
      .set({ viewCount: sql`${notificationsTable.viewCount} + 1` })
      .where(eq(notificationsTable.id, id))
      .catch((e) => console.error("View count update error:", e));

    const formatted = {
      ...notification,
      startDate: normalizeDateToDMY(notification.startDate) || notification.startDate,
      lastDate: normalizeDateToDMY(notification.lastDate) || notification.lastDate,
    };

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching notification details:", error);
    res.status(500).json({ error: "Failed to fetch notification" });
  }
});

router.get("/business-info", async (_req, res) => {
  try {
    const cached = getCache<any>("business-info");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const mobile = await getFrontendDisplayedMobileNumber();
    const info = {
      organization: "Airnet Computers",
      tagline: "Online Service Center & Citizen Facilitation Hub",
      proprietor: "Md Amjad Ali",
      mobileNumber: mobile,
      helpline: mobile,
      adminEmail: CONSTANT_ADMIN_EMAIL,
      address: "Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327",
      mapsUrl: "https://maps.app.goo.gl/B6R9Jy9GfA1VdMoB8",
    };
    setCache("business-info", info, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(info);
  } catch (error) {
    console.error("Error fetching business info:", error);
    res.json({
      organization: "Airnet Computers",
      proprietor: "Md Amjad Ali",
      mobileNumber: "+91 7892881086",
      helpline: "+91 7892881086",
      adminEmail: "airnetcomputersbk@gmail.com",
      address: "Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327",
      mapsUrl: "https://maps.app.goo.gl/B6R9Jy9GfA1VdMoB8",
    });
  }
});

export default router;
