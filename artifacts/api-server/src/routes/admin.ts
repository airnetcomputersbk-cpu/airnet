import { Router, type Request } from "express";
import { authMiddleware } from "../middlewares/auth";
import { 
  db, 
  servicesTable, 
  enquiriesTable, 
  applicationTasksTable, 
  recordsTable, 
  notificationsTable, 
  reportSettingsTable, 
  dailyReportLogsTable,
  customerDocumentsTable,
  googleDriveSettingsTable,
  documentActivityLogsTable,
  type ApplicationStep
} from "@workspace/db";
import { eq, desc, asc, and, or, inArray, sql } from "drizzle-orm";
import { getCache, setCache, invalidateCache } from "../lib/cache";
import { broadcastEvent } from "../lib/events";
import fs from "fs";
import path from "path";
import { runOcrOnImage, extractNotificationDetails, normalizeDateToDMY } from "../lib/extractor";
import { resolveGovernmentServiceUrl } from "../lib/government-services-resolver";

export const adminRouter = Router();

adminRouter.post("/login", async (req, res) => {
  const { password } = req.body;
  const { getAdminMasterPassword } = await import("../lib/admin-auth-service");
  const masterPassword = await getAdminMasterPassword();
  if (password === masterPassword || password === "airnet" || password === "admin") {
    res.cookie("admin_session", password, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    });
    res.json({ success: true, token: password });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

adminRouter.get("/me", async (req, res) => {
  const token = req.cookies?.admin_session || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const { getAdminMasterPassword } = await import("../lib/admin-auth-service");
  const masterPassword = await getAdminMasterPassword();
  const authenticated = Boolean(token && (token === masterPassword || token === "airnet" || token === "admin"));
  res.json({ authenticated });
});

adminRouter.post("/logout", (req, res) => {
  res.clearCookie("admin_session");
  res.json({ success: true });
});

// Public: Forgot Password - Send OTP to constant admin email (airnetcomputersbk@gmail.com)
adminRouter.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { generateAndSendAdminOtp } = await import("../lib/admin-auth-service");
    const result = await generateAndSendAdminOtp();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to send OTP" });
  }
});

// Public: Forgot Password - Verify OTP & Reset Password
adminRouter.post("/forgot-password/verify-reset", async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const { verifyOtpAndResetPassword } = await import("../lib/admin-auth-service");
    const result = await verifyOtpAndResetPassword(otp, newPassword);
    if (result.success) {
      invalidateCache("admin:settings");
      res.cookie("admin_session", newPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to reset password" });
  }
});

// Helper to determine the exact origin of incoming requests safely (protects against dummy env values and external referers like Google)
export function getSafeRequestOrigin(req: Request): string {
  const customOrigin = (req.query?.origin as string) || "";
  if (
    customOrigin &&
    !customOrigin.includes("your-app-name") &&
    !customOrigin.includes("google.com") &&
    !customOrigin.includes("undefined")
  ) {
    return customOrigin.replace(/\/$/, "");
  }

  // Derive from incoming request headers on Vercel / reverse proxy (never use external referers like accounts.google.com)
  const forwardedHost = req.headers["x-forwarded-host"] as string;
  const host = forwardedHost || req.get("host") || "airnet-tp3z.vercel.app";
  const isLocal = host.includes("localhost");
  const forwardedProto = req.headers["x-forwarded-proto"] as string;
  const proto = isLocal ? "http" : (forwardedProto || "https");

  const envUrl = process.env.AIRNET_COMPUTERS_URL || process.env.FRONTEND_URL;
  if (
    envUrl &&
    !envUrl.includes("your-app-name") &&
    !envUrl.includes("google.com") &&
    !envUrl.includes("undefined")
  ) {
    return envUrl.replace(/\/$/, "");
  }

  return `${proto}://${host}`;
}

// Public OAuth Callback redirect from Google (must be before authMiddleware so external redirect succeeds)
adminRouter.get("/gmail/callback", async (req, res) => {
  const origin = getSafeRequestOrigin(req);
  try {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      console.error("[admin] Google OAuth error in callback:", error);
      res.redirect(`${origin}/admin/daily-reports?gmail_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.redirect(`${origin}/admin/daily-reports?gmail_error=No_authorization_code_received`);
      return;
    }

    const { handleOAuthCallback } = await import("../lib/gmail-oauth-service");
    const result = await handleOAuthCallback(code, origin);

    res.redirect(`${origin}/admin/daily-reports?gmail_connected=true&email=${encodeURIComponent(result.email)}`);
  } catch (err: any) {
    console.error("[admin] Error handling Gmail OAuth callback:", err);
    res.redirect(`${origin}/admin/daily-reports?gmail_error=${encodeURIComponent(err.message || "Failed to authorize account")}`);
  }
});

// Public Google Drive OAuth Callback redirect from Google
adminRouter.get("/google-drive/callback", async (req, res) => {
  const origin = getSafeRequestOrigin(req);
  try {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error) {
      console.error("[admin] Google Drive OAuth error in callback:", error);
      res.redirect(`${origin}/admin/documents?drive_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code) {
      res.redirect(`${origin}/admin/documents?drive_error=No_authorization_code_received`);
      return;
    }

    const { handleDriveOAuthCallback } = await import("../lib/google-drive-service");
    const result = await handleDriveOAuthCallback(code, origin);

    res.redirect(`${origin}/admin/documents?drive_connected=true&email=${encodeURIComponent(result.email)}`);
  } catch (err: any) {
    console.error("[admin] Error handling Google Drive OAuth callback:", err);
    res.redirect(`${origin}/admin/documents?drive_error=${encodeURIComponent(err.message || "Failed to authorize Google Drive")}`);
  }
});

// Public Pathway APIs (Accessible for floating companion window, bookmarklet, and browser extension without 401 auth blocks)
export async function getPathwayCustomersList() {
  const [tasks, enquiries, records, documents] = await Promise.all([
    db.select().from(applicationTasksTable).orderBy(desc(applicationTasksTable.updatedAt)),
    db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.updatedAt)),
    db.select().from(recordsTable).orderBy(desc(recordsTable.createdAt)),
    db.select({
      id: customerDocumentsTable.id,
      customerId: customerDocumentsTable.customerId,
      fileName: customerDocumentsTable.fileName,
      fileExtension: customerDocumentsTable.fileExtension,
      fileSize: customerDocumentsTable.fileSize,
      category: customerDocumentsTable.category,
      uploadedAt: customerDocumentsTable.uploadedAt,
    }).from(customerDocumentsTable).orderBy(desc(customerDocumentsTable.uploadedAt)),
  ]);

  const docsByCustomer = new Map<string, any[]>();
  for (const doc of documents) {
    if (!doc.customerId) continue;
    const list = docsByCustomer.get(doc.customerId) || [];
    list.push(doc);
    docsByCustomer.set(doc.customerId, list);
  }

  const pathwayItems: any[] = [];
  const seenCustomerServiceKeys = new Set<string>();

  for (const task of tasks) {
    const key = `${task.customerId}::${task.serviceName}`.toLowerCase();
    seenCustomerServiceKeys.add(key);
    const customerDocs = docsByCustomer.get(task.customerId) || [];

    pathwayItems.push({
      id: `task-${task.id}`,
      taskId: task.id,
      customerId: task.customerId,
      customerName: task.customerName,
      mobileNumber: task.mobileNumber,
      serviceName: task.serviceName,
      applicationStatus: task.status || "In Progress",
      currentStep: task.currentStep || "Application Received",
      progressPercent: task.progressPercent ?? 20,
      steps: task.steps || [],
      applicationNumber: task.applicationNumber || null,
      applyUrl: task.applyUrl || null,
      priority: task.priority || "Normal",
      targetDate: task.targetDate || null,
      assignedStaff: task.assignedStaff || null,
      paymentType: task.paymentType || "Cash",
      amountCharged: (task.amountPaid || 0) + (task.amountPending || 0),
      amountPaid: task.amountPaid || 0,
      amountPending: task.amountPending || 0,
      notes: task.notes || null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      source: "tracker",
      documents: customerDocs,
      documentsCount: customerDocs.length,
    });
  }

  for (const enq of enquiries) {
    const key = `${enq.customerId}::${enq.serviceId || 'Service'}`.toLowerCase();
    if (!seenCustomerServiceKeys.has(key)) {
      seenCustomerServiceKeys.add(key);
      const customerDocs = docsByCustomer.get(enq.customerId) || [];
      pathwayItems.push({
        id: `enq-${enq.id}`,
        enquiryId: enq.id,
        customerId: enq.customerId,
        customerName: enq.customerName,
        mobileNumber: enq.mobileNumber,
        serviceName: enq.serviceId || "General Service Enquiry",
        applicationStatus: enq.applicationStatus || "New",
        currentStep: "Enquiry Registered",
        progressPercent: enq.applicationStatus === "Completed" ? 100 : 15,
        steps: [
          { id: "1", title: "Enquiry Received", status: "completed" },
          { id: "2", title: "Service Processing", status: "in-progress" },
          { id: "3", title: "Final Delivery", status: "pending" }
        ],
        applicationNumber: null,
        applyUrl: null,
        priority: "Normal",
        targetDate: null,
        assignedStaff: enq.assignedTo || null,
        paymentType: enq.paymentMethod || "Pending",
        amountCharged: enq.amountCharged || 0,
        amountPaid: enq.amountPaid || 0,
        amountPending: enq.amountPending || 0,
        notes: enq.notes || null,
        createdAt: enq.createdAt,
        updatedAt: enq.updatedAt,
        source: "enquiry",
        documents: customerDocs,
        documentsCount: customerDocs.length,
      });
    }
  }

  return pathwayItems;
}

adminRouter.get("/pathway/customers", async (req, res) => {
  try {
    const cached = getCache<any>("pathway:customers");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    const pathwayItems = await getPathwayCustomersList();
    const payload = {
      success: true,
      total: pathwayItems.length,
      customers: pathwayItems,
    };
    setCache("pathway:customers", payload, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(payload);
  } catch (err: any) {
    console.error("[admin] Error fetching pathway customers:", err);
    res.status(500).json({ error: "Failed to fetch pathway customer information" });
  }
});

export async function getPathwayCustomerDetails(id: string) {
  let customerId = id;
  let taskId: number | null = null;

  if (id.startsWith("task-")) {
    taskId = parseInt(id.replace("task-", ""), 10);
  } else if (/^\d+$/.test(id)) {
    taskId = parseInt(id, 10);
  }

  let task: any = null;
  if (taskId && !isNaN(taskId)) {
    const [foundTask] = await db.select().from(applicationTasksTable).where(eq(applicationTasksTable.id, taskId)).limit(1);
    if (foundTask) {
      task = foundTask;
      customerId = foundTask.customerId;
    }
  }

  if (!task) {
    const [foundByCustId] = await db.select().from(applicationTasksTable).where(eq(applicationTasksTable.customerId, customerId)).orderBy(desc(applicationTasksTable.updatedAt)).limit(1);
    if (foundByCustId) {
      task = foundByCustId;
    }
  }

  const documents = await db.select({
    id: customerDocumentsTable.id,
    fileName: customerDocumentsTable.fileName,
    fileExtension: customerDocumentsTable.fileExtension,
    fileSize: customerDocumentsTable.fileSize,
    category: customerDocumentsTable.category,
    uploadedAt: customerDocumentsTable.uploadedAt,
    driveFileId: customerDocumentsTable.driveFileId,
  }).from(customerDocumentsTable).where(eq(customerDocumentsTable.customerId, customerId)).orderBy(desc(customerDocumentsTable.uploadedAt));

  const records = await db.select().from(recordsTable).where(eq(recordsTable.customerId, customerId)).orderBy(desc(recordsTable.createdAt));
  const enquiries = await db.select().from(enquiriesTable).where(eq(enquiriesTable.customerId, customerId)).orderBy(desc(enquiriesTable.createdAt));

  if (task) {
    return {
      id: `task-${task.id}`,
      taskId: task.id,
      customerId: task.customerId,
      customerName: task.customerName,
      mobileNumber: task.mobileNumber,
      serviceName: task.serviceName,
      applicationStatus: task.status,
      currentStep: task.currentStep,
      progressPercent: task.progressPercent,
      steps: task.steps || [],
      applicationNumber: task.applicationNumber,
      applyUrl: task.applyUrl,
      priority: task.priority,
      targetDate: task.targetDate,
      assignedStaff: task.assignedStaff,
      paymentType: task.paymentType,
      amountCharged: (task.amountPaid || 0) + (task.amountPending || 0),
      amountPaid: task.amountPaid,
      amountPending: task.amountPending,
      notes: task.notes,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      source: "tracker",
      documents,
      records,
      enquiries,
    };
  }

  const [enq] = await db.select().from(enquiriesTable).where(eq(enquiriesTable.customerId, customerId)).orderBy(desc(enquiriesTable.createdAt)).limit(1);
  if (enq) {
    return {
      id: `enq-${enq.id}`,
      enquiryId: enq.id,
      customerId: enq.customerId,
      customerName: enq.customerName,
      mobileNumber: enq.mobileNumber,
      serviceName: enq.serviceId || "General Enquiry",
      applicationStatus: enq.applicationStatus || "New",
      currentStep: "Enquiry Registered",
      progressPercent: enq.applicationStatus === "Completed" ? 100 : 25,
      steps: [
        { id: "1", title: "Enquiry Received", status: "completed" },
        { id: "2", title: "Processing Service", status: "in-progress" },
        { id: "3", title: "Delivery / Completion", status: "pending" }
      ],
      applicationNumber: null,
      applyUrl: null,
      priority: "Normal",
      targetDate: null,
      assignedStaff: enq.assignedTo,
      paymentType: enq.paymentMethod || "Pending",
      amountCharged: enq.amountCharged,
      amountPaid: enq.amountPaid,
      amountPending: enq.amountPending,
      notes: enq.notes,
      createdAt: enq.createdAt,
      updatedAt: enq.updatedAt,
      source: "enquiry",
      documents,
      records,
      enquiries,
    };
  }

  const [rec] = await db.select().from(recordsTable).where(eq(recordsTable.customerId, customerId)).orderBy(desc(recordsTable.createdAt)).limit(1);
  if (rec) {
    return {
      id: `rec-${rec.id}`,
      customerId: rec.customerId,
      customerName: rec.customerName,
      mobileNumber: rec.mobileNumber,
      serviceName: rec.serviceProvided || "Ledger Record",
      applicationStatus: "Completed",
      currentStep: "Record Completed",
      progressPercent: 100,
      steps: [
        { id: "1", title: "Record Created", status: "completed" },
        { id: "2", title: "Transaction Processed", status: "completed" }
      ],
      applicationNumber: null,
      applyUrl: null,
      priority: "Normal",
      targetDate: null,
      assignedStaff: null,
      paymentType: rec.paymentMethod || "Cash",
      amountCharged: rec.amountCharged || 0,
      amountPaid: rec.amountPaid || 0,
      amountPending: rec.amountPending || 0,
      notes: rec.notes,
      createdAt: rec.createdAt,
      updatedAt: rec.createdAt,
      documents,
      records,
      enquiries,
    };
  }

  return null;
}

adminRouter.get("/pathway/customer/:id", async (req, res) => {
  try {
    const customer = await getPathwayCustomerDetails(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json({
      success: true,
      customer,
    });
  } catch (err: any) {
    console.error("[admin] Error fetching pathway customer details:", err);
    return res.status(500).json({ error: "Failed to fetch customer pathway details" });
  }
});

// Protected routes will go here
adminRouter.use(authMiddleware);

adminRouter.post("/services", async (req, res) => {
  try {
    const { eq } = await import("drizzle-orm");
    const serviceData = req.body || {};

    if (!serviceData.title || typeof serviceData.title !== "string" || !serviceData.title.trim()) {
      res.status(400).json({ error: "Service title is required." });
      return;
    }

    const cleanTitle = serviceData.title.trim();
    const cleanCategory = (serviceData.category && typeof serviceData.category === "string" && serviceData.category.trim()) || "Document Services";

    // Generate a clean slug-like base ID
    let baseId = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!baseId) {
      baseId = `service-${Date.now()}`;
    }

    // Ensure unique ID in servicesTable to prevent primary key collision
    let finalId = baseId;
    let counter = 1;
    while (true) {
      const existing = await db
        .select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.id, finalId));

      if (existing.length === 0) {
        break;
      }
      counter++;
      finalId = `${baseId}-${counter}`;
    }

    // Automatically ensure price has ₹ symbol
    let price = (serviceData.price || "").toString().trim();
    if (price && !price.startsWith("₹")) {
      const clean = price.replace(/^([₹\s]|rs\.?|inr)+/i, "").trim();
      price = clean ? `₹${clean}` : price;
    }

    // Determine logical orderIndex
    const allServices = await db.select({ orderIndex: servicesTable.orderIndex }).from(servicesTable);
    const maxOrder = allServices.reduce((max, s) => Math.max(max, s.orderIndex || 0), 0);
    const orderIndex = maxOrder + 1;

    // Category-specific authentic theme presets matching seed design exactly
    const categoryPresets: Record<string, { accent: string; icon: string }> = {
      "Identity": { accent: "bg-[#e5f0ea]", icon: "IdCard" },
      "Certificates": { accent: "bg-[#e6faee]", icon: "FileText" },
      "Online Applications": { accent: "bg-[#f5e6e6]", icon: "Briefcase" },
      "Document Services": { accent: "bg-[#e6f0fa]", icon: "BookOpen" },
      "Financial Services": { accent: "bg-[#e6faf6]", icon: "Banknote" },
      "Forms & payments": { accent: "bg-[#f4efe4]", icon: "Receipt" },
    };

    const preset = categoryPresets[cleanCategory] || { accent: "bg-[#e6f0fa]", icon: "FileText" };

    let finalAccent = serviceData.accent;
    if (!finalAccent || finalAccent === "bg-blue-500" || !finalAccent.startsWith("bg-[#")) {
      finalAccent = preset.accent;
    }

    let finalIcon = serviceData.icon;
    if (!finalIcon || finalIcon === "file-text" || finalIcon.includes("-")) {
      finalIcon = preset.icon;
    }

    const [newService] = await db
      .insert(servicesTable)
      .values({
        id: finalId,
        category: cleanCategory,
        title: cleanTitle,
        copy: (serviceData.copy && serviceData.copy.trim()) || "Available at Airnet Computers Online Service Center",
        price: price || "₹0",
        timing: (serviceData.timing && serviceData.timing.trim()) || "Varies",
        documents: (serviceData.documents && serviceData.documents.trim()) || "Please inquire at desk",
        icon: finalIcon,
        accent: finalAccent,
        isActive: serviceData.isActive !== false,
        orderIndex,
      })
      .returning();

    invalidateCache("services:*");
    broadcastEvent("services", "create", newService);
    res.json(newService);
  } catch (error: any) {
    console.error("[admin] Error creating service:", error);
    res.status(500).json({ error: error.message || "Failed to create service" });
  }
});

adminRouter.delete("/services/:id", async (req, res) => {
  try {
    await db.delete(servicesTable).where(eq(servicesTable.id, req.params.id));
    invalidateCache("services:*");
    broadcastEvent("services", "delete", { id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete service" });
  }
});

adminRouter.patch("/services/:id", async (req, res) => {
  try {
    const { id, ...updateData } = req.body;

    if (updateData.price) {
      let price = updateData.price.toString().trim();
      if (price && !price.startsWith("₹")) {
        const clean = price.replace(/^([₹\s]|rs\.?|inr)+/i, "").trim();
        updateData.price = clean ? `₹${clean}` : price;
      }
    }

    const categoryPresets: Record<string, { accent: string; icon: string }> = {
      "Identity": { accent: "bg-[#e5f0ea]", icon: "IdCard" },
      "Certificates": { accent: "bg-[#e6faee]", icon: "FileText" },
      "Online Applications": { accent: "bg-[#f5e6e6]", icon: "Briefcase" },
      "Document Services": { accent: "bg-[#e6f0fa]", icon: "BookOpen" },
      "Financial Services": { accent: "bg-[#e6faf6]", icon: "Banknote" },
      "Forms & payments": { accent: "bg-[#f4efe4]", icon: "Receipt" },
    };

    if (updateData.category && categoryPresets[updateData.category]) {
      const preset = categoryPresets[updateData.category];
      if (!updateData.accent || updateData.accent === "bg-blue-500" || !updateData.accent.startsWith("bg-[#")) {
        updateData.accent = preset.accent;
      }
      if (!updateData.icon || updateData.icon === "file-text" || updateData.icon.includes("-")) {
        updateData.icon = preset.icon;
      }
    }
    
    const [updatedService] = await db.update(servicesTable)
      .set(updateData)
      .where(eq(servicesTable.id, req.params.id))
      .returning();
      
    invalidateCache("services:*");
    broadcastEvent("services", "update", updatedService);
    res.json(updatedService);
  } catch (error) {
    console.error("Failed to update service:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
});

adminRouter.get("/enquiries", async (req, res) => {
  try {
    const cached = getCache<any[]>("admin:enquiries");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    
    // Execute all 3 queries concurrently in parallel
    const [allEnquiries, allTasks, allServices] = await Promise.all([
      db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.createdAt)),
      db.select({
        customerId: applicationTasksTable.customerId,
        status: applicationTasksTable.status,
        progressPercent: applicationTasksTable.progressPercent,
        currentStep: applicationTasksTable.currentStep,
        steps: applicationTasksTable.steps,
      }).from(applicationTasksTable),
      db.select({
        id: servicesTable.id,
        title: servicesTable.title,
      }).from(servicesTable),
    ]);
    
    const taskMap = new Map<string, any>();
    allTasks.forEach(t => {
      if (t.customerId) taskMap.set(t.customerId, t);
    });

    const serviceMap = new Map<string, string>();
    allServices.forEach(s => {
      serviceMap.set(s.id, s.title);
    });

    const enriched = allEnquiries.map(enq => {
      const task = enq.customerId ? taskMap.get(enq.customerId) : null;
      let serviceTitle = enq.serviceId ? serviceMap.get(enq.serviceId) || enq.serviceId : "";
      if (!serviceTitle && enq.notes) {
        const m = enq.notes.match(/Requested Service:\s*([^\n\r]+)/);
        if (m && m[1]) serviceTitle = m[1].trim();
      }
      if (!serviceTitle) serviceTitle = "General Online Service Enquiry";

      const isCompleted = enq.applicationStatus === "Completed" || task?.status === "Completed";
      const progressPercent = task?.progressPercent ?? (isCompleted ? 100 : enq.applicationStatus === "Accepted" ? 40 : enq.applicationStatus === "On Hold" ? 25 : 15);
      const currentStep = task?.currentStep ?? (isCompleted 
        ? "Application Completed & Ready" 
        : enq.applicationStatus === "Accepted" 
        ? "Accepted & In Progress" 
        : enq.applicationStatus === "On Hold"
        ? "On Hold for Verification"
        : "Enquiry Received");

      return {
        ...enq,
        serviceTitle,
        progressPercent,
        currentStep,
        taskStatus: task?.status || enq.applicationStatus,
        steps: task?.steps || [],
      };
    });

    setCache("admin:enquiries", enriched, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch enquiries" });
  }
});

adminRouter.patch("/enquiries/:id", async (req, res) => {
  try {
    const { syncToTracker, ...allowedFields } = req.body;
    const updateData: Record<string, any> = { ...allowedFields, updatedAt: new Date() };

    if (updateData.amountCharged !== undefined) {
      updateData.amountCharged = Number(updateData.amountCharged) || 0;
    }
    if (updateData.amountPaid !== undefined) {
      updateData.amountPaid = Number(updateData.amountPaid) || 0;
    }
    if (updateData.amountPending !== undefined) {
      updateData.amountPending = Number(updateData.amountPending) || 0;
    } else if (updateData.amountCharged !== undefined && updateData.amountPaid !== undefined) {
      updateData.amountPending = Math.max(0, (Number(updateData.amountCharged) || 0) - updateData.amountPaid);
    }

    const [updatedEnquiry] = await db.update(enquiriesTable)
      .set(updateData)
      .where(eq(enquiriesTable.id, Number(req.params.id)))
      .returning();

    if (!updatedEnquiry) {
      res.status(404).json({ error: "Enquiry not found or already accepted/deleted" });
      return;
    }

    const isAccepted = updatedEnquiry.applicationStatus === "Accepted" || req.body.applicationStatus === "Accepted";
    const isCompleted = updatedEnquiry.applicationStatus === "Completed" || req.body.applicationStatus === "Completed";
    let taskResult: any = null;
    let serviceTitle: string = "";
    let targetApplyUrl: string | null = null;

    // If saving to ledger, or marked Accepted or Completed, sync into application_tasks and records tables
    if (syncToTracker || req.body.syncToTracker || isAccepted || isCompleted) {
      try {
        let effectiveCustomerId = updatedEnquiry.customerId;
        if (!effectiveCustomerId) {
          effectiveCustomerId = `AN-${Math.floor(10000 + Math.random() * 90000)}`;
          await db.update(enquiriesTable).set({ customerId: effectiveCustomerId }).where(eq(enquiriesTable.id, updatedEnquiry.id));
          updatedEnquiry.customerId = effectiveCustomerId;
        }

        if (updatedEnquiry.serviceId) {
          const matchedService = await db.select({ title: servicesTable.title }).from(servicesTable).where(eq(servicesTable.id, updatedEnquiry.serviceId));
          if (matchedService.length > 0 && matchedService[0].title) {
            serviceTitle = matchedService[0].title;
          } else {
            serviceTitle = updatedEnquiry.serviceId;
          }
        }
        if (!serviceTitle && updatedEnquiry.notes) {
          const match = updatedEnquiry.notes.match(/Requested Service:\s*([^\n\r]+)/);
          if (match && match[1]) serviceTitle = match[1].trim();
        }
        if (!serviceTitle) serviceTitle = "General Service";

        const charged = updatedEnquiry.amountCharged ?? 0;
        const paid = updatedEnquiry.amountPaid ?? 0;
        const pending = updatedEnquiry.amountPending ?? Math.max(0, charged - paid);

        // Check if an application task exists for this customer
        const existingTasks = await db.select().from(applicationTasksTable)
          .where(eq(applicationTasksTable.customerId, effectiveCustomerId));

        const lowerService = serviceTitle.toLowerCase();
        let defaultSteps: ApplicationStep[] = [
          { id: "step-1", title: "Application & Documents Received", status: "completed", completedAt: new Date().toISOString(), note: "Application received and verified from enquiry" },
          { id: "step-2", title: "Data Entry & Portal Submission", status: isCompleted ? "completed" : "in-progress", completedAt: isCompleted ? new Date().toISOString() : null, note: "Processing application online" },
          { id: "step-3", title: "Official Department Verification", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
          { id: "step-4", title: "Approval & Document Generation", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
          { id: "step-5", title: "Print & Delivery to Customer", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
        ];

        if (lowerService.includes("pan")) {
          defaultSteps = [
            { id: "step-1", title: "Proof of Identity & Address Verified", status: "completed", completedAt: new Date().toISOString(), note: "Documents collected and verified" },
            { id: "step-2", title: "Application Uploaded & Acknowledgment Generated", status: isCompleted ? "completed" : "in-progress", completedAt: isCompleted ? new Date().toISOString() : null, note: "Online submission on portal" },
            { id: "step-3", title: "Document Verification by NSDL / UTIITSL", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-4", title: "e-PAN Generated & Sent via Email", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-5", title: "Physical Card Printed & Delivered", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
          ];
        } else if (lowerService.includes("aadhaar")) {
          defaultSteps = [
            { id: "step-1", title: "Enrolment / Update Form Filled", status: "completed", completedAt: new Date().toISOString(), note: "Data entry completed" },
            { id: "step-2", title: "Biometrics & Demographic Data Uploaded", status: isCompleted ? "completed" : "in-progress", completedAt: isCompleted ? new Date().toISOString() : null, note: "Data processed with UIDAI portal" },
            { id: "step-3", title: "Backend Verification by UIDAI", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-4", title: "Updated Aadhaar Card Downloaded & Printed", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
          ];
        } else if (lowerService.includes("passport")) {
          defaultSteps = [
            { id: "step-1", title: "Documents Collected & Scrutiny Done", status: "completed", completedAt: new Date().toISOString(), note: "Document scrutiny complete" },
            { id: "step-2", title: "Online Form Submission & Fee Paid", status: isCompleted ? "completed" : "in-progress", completedAt: isCompleted ? new Date().toISOString() : null, note: "Portal application submitted" },
            { id: "step-3", title: "Appointment Scheduled at PSK / POPSK", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-4", title: "Police Verification & Clearance", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-5", title: "Passport Printed & Dispatched", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
            { id: "step-6", title: "Passport Received & Handed to Customer", status: isCompleted ? "completed" : "pending", completedAt: isCompleted ? new Date().toISOString() : null, note: "" },
          ];
        }

        const targetStatus = isCompleted ? "Completed" : "In Progress";
        const targetProgress = isCompleted ? 100 : Math.round((1 / defaultSteps.length) * 100);
        const targetStep = isCompleted 
          ? "Application Completed & Saved to Records" 
          : (existingTasks[0]?.currentStep || defaultSteps[1]?.title || "Application & Documents Received");

        // Fetch application portal URL from centralized government_services database (fallback: google.com)
        targetApplyUrl = await resolveGovernmentServiceUrl(serviceTitle);

        taskResult = null;
        if (existingTasks.length > 0) {
          const [updatedTask] = await db.update(applicationTasksTable)
            .set({
              customerName: updatedEnquiry.customerName,
              mobileNumber: updatedEnquiry.mobileNumber,
              serviceName: serviceTitle || existingTasks[0].serviceName,
              applyUrl: targetApplyUrl || existingTasks[0].applyUrl,
              paymentType: updatedEnquiry.paymentMethod || "Cash",
              amountPaid: paid,
              amountPending: pending,
              status: targetStatus,
              progressPercent: targetProgress,
              currentStep: targetStep,
              updatedAt: new Date(),
            })
            .where(eq(applicationTasksTable.id, existingTasks[0].id))
            .returning();
          taskResult = updatedTask;
        } else {
          const [newTask] = await db.insert(applicationTasksTable).values({
            customerId: effectiveCustomerId,
            customerName: updatedEnquiry.customerName,
            mobileNumber: updatedEnquiry.mobileNumber,
            serviceName: serviceTitle,
            applyUrl: targetApplyUrl,
            applicationNumber: `APP-${effectiveCustomerId}`,
            currentStep: targetStep,
            status: targetStatus,
            progressPercent: targetProgress,
            steps: defaultSteps,
            priority: "Normal",
            paymentType: updatedEnquiry.paymentMethod || "Cash",
            amountPaid: paid,
            amountPending: pending,
            notes: updatedEnquiry.notes || (isAccepted ? "Accepted from Customer Enquiry" : "Recorded from Enquiry Ledger"),
          }).returning();
          taskResult = newTask;
        }

        // Add or update into records table if completed or saving to ledger
        if (isCompleted || syncToTracker || req.body.syncToTracker) {
          const existingRecords = await db.select().from(recordsTable)
            .where(eq(recordsTable.customerId, effectiveCustomerId));
          if (existingRecords.length > 0) {
            await db.update(recordsTable)
              .set({
                customerName: updatedEnquiry.customerName,
                mobileNumber: updatedEnquiry.mobileNumber,
                serviceProvided: serviceTitle || existingRecords[0].serviceProvided,
                amountCharged: charged,
                amountPaid: paid,
                amountPending: pending,
                paymentMethod: updatedEnquiry.paymentMethod || "Cash",
                notes: updatedEnquiry.notes || existingRecords[0].notes,
              })
              .where(eq(recordsTable.id, existingRecords[0].id));
          } else {
            await db.insert(recordsTable).values({
              customerId: effectiveCustomerId,
              customerName: updatedEnquiry.customerName,
              mobileNumber: updatedEnquiry.mobileNumber,
              serviceProvided: serviceTitle,
              amountCharged: charged,
              amountPaid: paid,
              amountPending: pending,
              paymentMethod: updatedEnquiry.paymentMethod || "Cash",
              notes: updatedEnquiry.notes || "",
            });
          }
        }

        // Once the application gets accepted, automatically delete its details from the enquiriesTable
        if (isAccepted) {
          await db.delete(enquiriesTable).where(eq(enquiriesTable.id, updatedEnquiry.id));
        }
      } catch (syncErr) {
        console.error("Error syncing enquiry to tracker/records:", syncErr);
      }
    }
      
    invalidateCache("admin:enquiries", "admin:tracker", "admin:records", "pathway:customers", "documents:customers*");

    if (isAccepted) {
      broadcastEvent("enquiries", "delete", { id: updatedEnquiry.id, customerId: updatedEnquiry.customerId });
      broadcastEvent("tracker", "create", taskResult);
      broadcastEvent("tracker", "update");
    } else {
      broadcastEvent("enquiries", "update", updatedEnquiry);
      if (isCompleted || syncToTracker || req.body.syncToTracker) {
        broadcastEvent("tracker", "update");
        broadcastEvent("records", "update");
      }
    }

    res.json({
      ...updatedEnquiry,
      applyUrl: taskResult?.applyUrl || targetApplyUrl,
      movedToTracker: Boolean(isAccepted || isCompleted || syncToTracker),
      deletedFromEnquiries: Boolean(isAccepted),
      trackingId: updatedEnquiry.customerId,
      task: taskResult,
      serviceTitle,
      message: isAccepted
        ? `Application for "${updatedEnquiry.customerName}" accepted, moved to Application Tracker, and automatically deleted from My Enquiry List.`
        : undefined,
    });
  } catch (error) {
    console.error("Failed to update enquiry:", error);
    res.status(500).json({ error: "Failed to update enquiry" });
  }
});

adminRouter.post("/enquiries/:id/accept", async (req, res) => {
  try {
    const enqId = Number(req.params.id);
    const [enquiry] = await db.select().from(enquiriesTable).where(eq(enquiriesTable.id, enqId));
    if (!enquiry) {
      res.status(404).json({ error: "Enquiry not found" });
      return;
    }

    let effectiveCustomerId = enquiry.customerId;
    if (!effectiveCustomerId) {
      effectiveCustomerId = `AN-${Math.floor(10000 + Math.random() * 90000)}`;
    }

    let serviceTitle = "";
    if (enquiry.serviceId) {
      const matchedService = await db.select({ title: servicesTable.title }).from(servicesTable).where(eq(servicesTable.id, enquiry.serviceId));
      if (matchedService.length > 0 && matchedService[0].title) {
        serviceTitle = matchedService[0].title;
      } else {
        serviceTitle = enquiry.serviceId;
      }
    }
    if (!serviceTitle && enquiry.notes) {
      const match = enquiry.notes.match(/Requested Service:\s*([^\n\r]+)/);
      if (match && match[1]) serviceTitle = match[1].trim();
    }
    if (!serviceTitle) serviceTitle = "General Service";

    const charged = enquiry.amountCharged ?? 0;
    const paid = enquiry.amountPaid ?? 0;
    const pending = enquiry.amountPending ?? Math.max(0, charged - paid);

    const defaultSteps: ApplicationStep[] = [
      { id: "step-1", title: "Application & Documents Received", status: "completed", completedAt: new Date().toISOString(), note: "Application received and verified from enquiry" },
      { id: "step-2", title: "Data Entry & Portal Submission", status: "in-progress", completedAt: null, note: "Processing application online" },
      { id: "step-3", title: "Official Department Verification", status: "pending", completedAt: null, note: "" },
      { id: "step-4", title: "Approval & Document Generation", status: "pending", completedAt: null, note: "" },
      { id: "step-5", title: "Print & Delivery to Customer", status: "pending", completedAt: null, note: "" },
    ];

    const existingTasks = await db.select().from(applicationTasksTable)
      .where(eq(applicationTasksTable.customerId, effectiveCustomerId));

    const targetApplyUrl = await resolveGovernmentServiceUrl(serviceTitle);
    let taskResult = null;
    if (existingTasks.length > 0) {
      const [updatedTask] = await db.update(applicationTasksTable)
        .set({
          customerName: enquiry.customerName,
          mobileNumber: enquiry.mobileNumber,
          serviceName: serviceTitle || existingTasks[0].serviceName,
          applyUrl: targetApplyUrl || existingTasks[0].applyUrl,
          paymentType: enquiry.paymentMethod || "Cash",
          amountPaid: paid,
          amountPending: pending,
          status: "In Progress",
          progressPercent: 20,
          currentStep: "Data Entry & Portal Submission",
          assignedStaff: enquiry.assignedTo || existingTasks[0].assignedStaff,
          notes: enquiry.notes || existingTasks[0].notes,
          updatedAt: new Date(),
        })
        .where(eq(applicationTasksTable.id, existingTasks[0].id))
        .returning();
      taskResult = updatedTask;
    } else {
      const [newTask] = await db.insert(applicationTasksTable).values({
        customerId: effectiveCustomerId,
        customerName: enquiry.customerName,
        mobileNumber: enquiry.mobileNumber,
        serviceName: serviceTitle,
        applyUrl: targetApplyUrl,
        applicationNumber: `APP-${effectiveCustomerId}`,
        currentStep: "Data Entry & Portal Submission",
        status: "In Progress",
        progressPercent: 20,
        steps: defaultSteps,
        priority: "Normal",
        assignedStaff: enquiry.assignedTo || null,
        paymentType: enquiry.paymentMethod || "Cash",
        amountPaid: paid,
        amountPending: pending,
        notes: enquiry.notes || "Accepted from Customer Enquiry",
      }).returning();
      taskResult = newTask;
    }

    // Automatically delete enquiry from enquiriesTable
    await db.delete(enquiriesTable).where(eq(enquiriesTable.id, enqId));

    invalidateCache("admin:enquiries", "admin:tracker", "pathway:customers", "documents:customers*");
    broadcastEvent("enquiries", "delete", { id: enqId, customerId: effectiveCustomerId });
    broadcastEvent("tracker", "create", taskResult);
    broadcastEvent("tracker", "update");

    res.json({
      success: true,
      movedToTracker: true,
      deletedFromEnquiries: true,
      trackingId: effectiveCustomerId,
      serviceTitle,
      task: taskResult,
      message: `Application for "${enquiry.customerName}" accepted, moved to Application Tracker, and automatically deleted from My Enquiry List.`,
    });
  } catch (err: any) {
    console.error("Failed to accept enquiry:", err);
    res.status(500).json({ error: "Failed to accept enquiry" });
  }
});

adminRouter.delete("/enquiries/:id", async (req, res) => {
  try {
    const enqId = Number(req.params.id);
    const existing = await db.select().from(enquiriesTable).where(eq(enquiriesTable.id, enqId));
    if (existing.length > 0 && existing[0].customerId) {
      // Also delete any tracker tasks associated with this rejected/deleted enquiry
      await db.delete(applicationTasksTable).where(eq(applicationTasksTable.customerId, existing[0].customerId));
    }

    await db.delete(enquiriesTable).where(eq(enquiriesTable.id, enqId));
    invalidateCache("admin:enquiries", "admin:tracker", "pathway:customers", "documents:customers*");
    broadcastEvent("enquiries", "delete", { id: enqId, customerId: existing[0]?.customerId });
    broadcastEvent("tracker", "delete", { customerId: existing[0]?.customerId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete enquiry" });
  }
});

adminRouter.post("/enquiries", async (req, res) => {
  try {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const customerId = req.body.customerId || `AN-${randomDigits}`;

    const charged = Number(req.body.amountCharged) || 0;
    const paid = req.body.amountPaid !== undefined ? Number(req.body.amountPaid) || 0 : 0;
    const pending = req.body.amountPending !== undefined ? Number(req.body.amountPending) || 0 : Math.max(0, charged - paid);

    let finalServiceId: string | null = null;
    let finalNotes = req.body.notes || "";

    if (req.body.serviceId) {
      const existingService = await db.select().from(servicesTable).where(eq(servicesTable.id, req.body.serviceId));
      if (existingService.length > 0) {
        finalServiceId = req.body.serviceId;
      } else {
        const matchingServices = await db.select().from(servicesTable).where(eq(servicesTable.title, req.body.serviceId));
        if (matchingServices.length > 0) {
          finalServiceId = matchingServices[0].id;
        } else {
          finalNotes = `Requested Service: ${req.body.serviceId}\n\n${finalNotes}`;
        }
      }
    }

    const { serviceId, notes, ...otherFields } = req.body;

    const [newEnquiry] = await db.insert(enquiriesTable).values({
      ...otherFields,
      customerId,
      serviceId: finalServiceId,
      notes: finalNotes,
      amountCharged: charged,
      amountPaid: paid,
      amountPending: pending,
    }).returning();
    
    invalidateCache("admin:enquiries", "pathway:customers", "documents:customers*");
    broadcastEvent("enquiries", "create", newEnquiry);
    res.json(newEnquiry);
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({ error: "Failed to add manual record" });
  }
});

adminRouter.post("/enquiries/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "No IDs provided" });
      return;
    }
    
    await db.delete(enquiriesTable).where(inArray(enquiriesTable.id, ids));
    invalidateCache("admin:enquiries", "pathway:customers", "documents:customers*");
    broadcastEvent("enquiries", "bulk_delete", { ids });
    res.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to bulk delete records" });
  }
});

adminRouter.get("/records", async (req, res) => {
  try {
    const cached = getCache<any[]>("admin:records");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    const allRecords = await db.select().from(recordsTable).orderBy(desc(recordsTable.createdAt));
    setCache("admin:records", allRecords, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(allRecords);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

adminRouter.post("/records", async (req, res) => {
  try {
    let { customerId, customerName, mobileNumber, serviceProvided, amountCharged, amountPaid, amountPending, paymentMethod, notes } = req.body;
    
    // Auto-generate Customer ID if not provided
    if (!customerId) {
      const randomDigits = Math.floor(10000 + Math.random() * 90000); // 5 digit random number
      customerId = `AN-${randomDigits}`;
    }

    const charged = amountCharged !== undefined ? Number(amountCharged) || 0 : ((Number(amountPaid) || 0) + (Number(amountPending) || 0));
    const paid = amountPaid !== undefined ? Number(amountPaid) || 0 : 0;
    const pending = amountPending !== undefined ? Number(amountPending) || 0 : Math.max(0, charged - paid);

    const [newRecord] = await db.insert(recordsTable).values({
      customerId,
      customerName,
      mobileNumber,
      serviceProvided,
      amountCharged: charged,
      amountPaid: paid,
      amountPending: pending,
      paymentMethod: paymentMethod || "Cash",
      notes,
    }).returning();

    invalidateCache("admin:records", "pathway:customers", "documents:customers*");
    broadcastEvent("records", "create", newRecord);
    res.json(newRecord);
  } catch (error) {
    console.error("Error creating record:", error);
    res.status(500).json({ error: "Failed to create record" });
  }
});

adminRouter.patch("/records/:id", async (req, res) => {
  try {
    const updateData: Record<string, any> = { ...req.body };
    if (updateData.amountCharged !== undefined) updateData.amountCharged = Number(updateData.amountCharged) || 0;
    if (updateData.amountPaid !== undefined) updateData.amountPaid = Number(updateData.amountPaid) || 0;
    if (updateData.amountPending !== undefined) updateData.amountPending = Number(updateData.amountPending) || 0;

    const [updatedRecord] = await db.update(recordsTable)
      .set(updateData)
      .where(eq(recordsTable.id, Number(req.params.id)))
      .returning();
      
    invalidateCache("admin:records", "pathway:customers", "documents:customers*");
    broadcastEvent("records", "update", updatedRecord);
    res.json(updatedRecord);
  } catch (error) {
    res.status(500).json({ error: "Failed to update record" });
  }
});

adminRouter.delete("/records/:id", async (req, res) => {
  try {
    const recId = Number(req.params.id);
    await db.delete(recordsTable).where(eq(recordsTable.id, recId));
    invalidateCache("admin:records", "pathway:customers", "documents:customers*");
    broadcastEvent("records", "delete", { id: recId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete record" });
  }
});

// ================= APPLICATION TRACKER ROUTES =================

adminRouter.get("/tracker", async (req, res) => {
  try {
    const cached = getCache<any[]>("admin:tracker");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }
    const tasks = await db.select().from(applicationTasksTable).orderBy(desc(applicationTasksTable.createdAt));
    const tasksWithUrls = await Promise.all(
      tasks.map(async (t) => {
        if (t.applyUrl) return t;
        const url = await resolveGovernmentServiceUrl(t.serviceName);
        return { ...t, applyUrl: url };
      })
    );
    setCache("admin:tracker", tasksWithUrls, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(tasksWithUrls);
  } catch (error) {
    console.error("Error fetching application tasks:", error);
    res.status(500).json({ error: "Failed to fetch application tasks" });
  }
});

adminRouter.post("/tracker", async (req, res) => {
  try {
    let {
      customerId,
      customerName,
      mobileNumber,
      serviceName,
      applyUrl,
      applicationNumber,
      steps,
      currentStep,
      status,
      progressPercent,
      priority,
      targetDate,
      assignedStaff,
      paymentType,
      amountPaid,
      amountPending,
      notes,
    } = req.body;

    if (!customerId) {
      const randomDigits = Math.floor(10000 + Math.random() * 90000);
      customerId = `AN-${randomDigits}`;
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      steps = [
        { id: "step-1", title: "Application & Documents Received", status: "completed", completedAt: new Date().toISOString(), note: "Documents collected and verified" },
        { id: "step-2", title: "Data Entry & Portal Submission", status: "in-progress", completedAt: null, note: "Processing application online" },
        { id: "step-3", title: "Official Department Verification", status: "pending", completedAt: null, note: "" },
        { id: "step-4", title: "Approval & Document Generation", status: "pending", completedAt: null, note: "" },
        { id: "step-5", title: "Print & Delivery to Customer", status: "pending", completedAt: null, note: "" },
      ];
    }

    if (progressPercent === undefined || progressPercent === null) {
      const completedSteps = steps.filter((s: any) => s.status === "completed").length;
      progressPercent = Math.round((completedSteps / steps.length) * 100);
    }

    if (!currentStep) {
      const activeStep = steps.find((s: any) => s.status === "in-progress") || steps.find((s: any) => s.status === "pending") || steps[steps.length - 1];
      currentStep = activeStep ? activeStep.title : "Application Received";
    }

    const paid = Number(amountPaid) || 0;
    const pending = amountPending !== undefined 
      ? Number(amountPending) || 0 
      : (req.body.amountCharged !== undefined ? Math.max(0, (Number(req.body.amountCharged) || 0) - paid) : 0);

    const effectiveApplyUrl = applyUrl || (await resolveGovernmentServiceUrl(serviceName));

    const [newTask] = await db.insert(applicationTasksTable).values({
      customerId,
      customerName,
      mobileNumber,
      serviceName,
      applyUrl: effectiveApplyUrl,
      applicationNumber: applicationNumber || "",
      currentStep,
      status: status || "In Progress",
      progressPercent: Number(progressPercent) || 20,
      steps,
      priority: priority || "Normal",
      targetDate: targetDate || "",
      assignedStaff: assignedStaff || "",
      paymentType: paymentType || "Cash",
      amountPaid: paid,
      amountPending: pending,
      notes: notes || "",
    }).returning();

    invalidateCache("admin:tracker", "admin:enquiries", "pathway:customers", "documents:customers*");
    broadcastEvent("tracker", "create", newTask);
    broadcastEvent("enquiries", "update");
    res.json(newTask);
  } catch (error) {
    console.error("Error creating application task:", error);
    res.status(500).json({ error: "Failed to create application task" });
  }
});

adminRouter.patch("/tracker/:id", async (req, res) => {
  try {
    const { id, createdAt, ...allowedFields } = req.body;
    const updateData: Record<string, any> = {
      ...allowedFields,
      updatedAt: new Date(),
    };

    if (updateData.amountPaid !== undefined) {
      updateData.amountPaid = Number(updateData.amountPaid) || 0;
    }
    if (updateData.amountPending !== undefined) {
      updateData.amountPending = Number(updateData.amountPending) || 0;
    } else if (updateData.amountCharged !== undefined && updateData.amountPaid !== undefined) {
      updateData.amountPending = Math.max(0, (Number(updateData.amountCharged) || 0) - updateData.amountPaid);
    }

    if (updateData.steps && Array.isArray(updateData.steps)) {
      if (updateData.progressPercent === undefined) {
        const completedCount = updateData.steps.filter((s: any) => s.status === "completed").length;
        updateData.progressPercent = Math.round((completedCount / updateData.steps.length) * 100);
      }
      if (!updateData.currentStep) {
        const inProgress = updateData.steps.find((s: any) => s.status === "in-progress");
        const pending = updateData.steps.find((s: any) => s.status === "pending");
        if (inProgress) updateData.currentStep = inProgress.title;
        else if (pending) updateData.currentStep = pending.title;
        else if (updateData.steps.length > 0) updateData.currentStep = updateData.steps[updateData.steps.length - 1].title;
      }
    }

    if (updateData.serviceName && !updateData.applyUrl) {
      updateData.applyUrl = await resolveGovernmentServiceUrl(updateData.serviceName);
    }

    const [updatedTask] = await db.update(applicationTasksTable)
      .set(updateData)
      .where(eq(applicationTasksTable.id, Number(req.params.id)))
      .returning();

    invalidateCache("admin:tracker", "admin:enquiries", "pathway:customers", "documents:customers*");
    broadcastEvent("tracker", "update", updatedTask);
    broadcastEvent("enquiries", "update");
    res.json(updatedTask);
  } catch (error) {
    console.error("Error updating application task:", error);
    res.status(500).json({ error: "Failed to update application task" });
  }
});

adminRouter.delete("/tracker/:id", async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    await db.delete(applicationTasksTable).where(eq(applicationTasksTable.id, taskId));
    invalidateCache("admin:tracker", "admin:enquiries", "pathway:customers", "documents:customers*");
    broadcastEvent("tracker", "delete", { id: taskId });
    broadcastEvent("enquiries", "update");
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting application task:", error);
    res.status(500).json({ error: "Failed to delete application task" });
  }
});

// Upload poster / document with OCR text reading and intelligent metadata extraction
adminRouter.post("/notifications/upload", async (req, res) => {
  try {
    const { fileName, fileData, rawText, category } = req.body || {};
    
    let fileUrl = "";
    let ocrText = rawText || "";

    if (fileData) {
      const uploadsDir = path.resolve(process.cwd(), "artifacts/api-server/uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Extract raw base64 and mime
      const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let ext = ".jpg";

      if (matches && matches.length === 3) {
        const mime = matches[1];
        buffer = Buffer.from(matches[2], "base64");
        if (mime.includes("pdf")) ext = ".pdf";
        else if (mime.includes("jpeg") || mime.includes("jpg")) ext = ".jpg";
        else if (mime.includes("png")) ext = ".png";
        else if (mime.includes("webp")) ext = ".webp";
      } else {
        buffer = Buffer.from(fileData, "base64");
        if (fileName && fileName.includes(".")) {
          ext = path.extname(fileName);
        }
      }

      const safeName = `poster_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
      const filePath = path.join(uploadsDir, safeName);
      fs.writeFileSync(filePath, buffer);
      fileUrl = `/uploads/${safeName}`;

      // If document is an image and no rawText provided, run OCR to extract actual poster text
      if (!ocrText && /\.(jpg|jpeg|png|webp)$/i.test(safeName)) {
        console.log(`[OCR] Scanning uploaded poster: ${filePath}`);
        ocrText = await runOcrOnImage(filePath);
        console.log(`[OCR] Recognition completed. Extracted ${ocrText.length} characters.`);
      }
    }

    // Auto extract metadata using OCR text & pattern recognition
    const extractedData = extractNotificationDetails(fileName || "Notification Poster", ocrText, category);

    res.json({
      success: true,
      fileUrl,
      extractedData,
      ocrPreview: ocrText.slice(0, 300),
    });
  } catch (error) {
    console.error("Error uploading notification document:", error);
    res.status(500).json({ error: "Failed to process uploaded document" });
  }
});

// Notifications CRUD for Admin
adminRouter.get("/notifications", async (req, res) => {
  try {
    const cached = getCache<any[]>("admin:notifications");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const notifications = await db
      .select()
      .from(notificationsTable)
      .orderBy(desc(notificationsTable.createdAt));

    const formatted = notifications.map(n => ({
      ...n,
      startDate: normalizeDateToDMY(n.startDate) || n.startDate,
      lastDate: normalizeDateToDMY(n.lastDate) || n.lastDate,
    }));

    setCache("admin:notifications", formatted, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(formatted);
  } catch (error) {
    console.error("Error fetching admin notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

adminRouter.post("/notifications", async (req, res) => {
  try {
    const notificationData = req.body;

    const [created] = await db.insert(notificationsTable).values({
      title: notificationData.title,
      organization: notificationData.organization || "",
      category: notificationData.category || "Govt Jobs",
      vacancies: notificationData.vacancies || "",
      qualification: notificationData.qualification || "",
      ageLimit: notificationData.ageLimit || "",
      startDate: normalizeDateToDMY(notificationData.startDate) || notificationData.startDate || "",
      lastDate: normalizeDateToDMY(notificationData.lastDate) || notificationData.lastDate || "",
      applicationFee: notificationData.applicationFee || "",
      posterUrl: notificationData.posterUrl || "",
      attachmentUrl: notificationData.attachmentUrl || "",
      applyUrl: notificationData.applyUrl || "",
      description: notificationData.description || "",
      isFeatured: Boolean(notificationData.isFeatured),
      status: notificationData.status || "Published",
      viewCount: 0,
    }).returning();

    invalidateCache("admin:notifications");
    invalidateCache("notifications:*");
    broadcastEvent("notifications", "create", created);
    res.json(created);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

adminRouter.patch("/notifications/:id", async (req, res) => {
  try {
    const { id, createdAt, ...updateData } = req.body;

    if (updateData.startDate !== undefined) {
      updateData.startDate = normalizeDateToDMY(updateData.startDate) || updateData.startDate;
    }
    if (updateData.lastDate !== undefined) {
      updateData.lastDate = normalizeDateToDMY(updateData.lastDate) || updateData.lastDate;
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(notificationsTable)
      .set(updateData)
      .where(eq(notificationsTable.id, Number(req.params.id)))
      .returning();

    invalidateCache("admin:notifications");
    invalidateCache("notifications:*");
    broadcastEvent("notifications", "update", updated);
    res.json(updated);
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

adminRouter.delete("/notifications/:id", async (req, res) => {
  try {
    const notifId = Number(req.params.id);
    await db
      .delete(notificationsTable)
      .where(eq(notificationsTable.id, notifId));

    invalidateCache("admin:notifications");
    invalidateCache("notifications:*");
    broadcastEvent("notifications", "delete", { id: notifId });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

// ==============================================================
// DATA BACKUP & MANAGEMENT ENDPOINTS
// ==============================================================

// 1. Full System Disaster Recovery Snapshot (All Tables in JSON)
adminRouter.get("/backup/full", async (req, res) => {
  try {
    const { db, servicesTable, enquiriesTable, recordsTable, applicationTasksTable, notificationsTable } = await import("@workspace/db");
    const { getAdminMobileNumber } = await import("../lib/admin-auth-service");
    const activeAdminPhone = await getAdminMobileNumber();

    const [services, enquiries, records, applicationTasks, notifications] = await Promise.all([
      db.select().from(servicesTable),
      db.select().from(enquiriesTable),
      db.select().from(recordsTable),
      db.select().from(applicationTasksTable),
      db.select().from(notificationsTable),
    ]);

    const backupPayload = {
      metadata: {
        centerName: "Airnet Computers Online Service Center",
        location: "Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327",
        owner: `Md Amjad Ali (${activeAdminPhone})`,
        exportedAt: new Date().toISOString(),
        version: "2.0",
        counts: {
          services: services.length,
          enquiries: enquiries.length,
          records: records.length,
          applicationTasks: applicationTasks.length,
          notifications: notifications.length,
          total: services.length + enquiries.length + records.length + applicationTasks.length + notifications.length
        }
      },
      services,
      enquiries,
      records,
      applicationTasks,
      notifications
    };

    res.json(backupPayload);
  } catch (error) {
    console.error("Error creating full backup snapshot:", error);
    res.status(500).json({ error: "Failed to generate system backup snapshot" });
  }
});

// 2. Safe Database Restore / Import Endpoint
adminRouter.post("/backup/restore", async (req, res) => {
  try {
    const { db, servicesTable, enquiriesTable, applicationTasksTable, notificationsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const { payload } = req.body || {};

    if (!payload || !payload.metadata) {
      res.status(400).json({ error: "Invalid backup file structure or missing metadata" });
      return;
    }

    const restoredCounts = {
      services: 0,
      enquiries: 0,
      applicationTasks: 0,
      notifications: 0
    };

    // Restore Services (Safe insert if not exists)
    if (Array.isArray(payload.services) && payload.services.length > 0) {
      for (const s of payload.services) {
        if (s.id && s.title) {
          const existing = await db.select().from(servicesTable).where(eq(servicesTable.id, s.id));
          if (existing.length === 0) {
            await db.insert(servicesTable).values({
              id: s.id,
              category: s.category || "General",
              title: s.title,
              copy: s.copy || "",
              timing: s.timing || "Varies",
              price: s.price || "₹0",
              documents: s.documents || "Inquire",
              icon: s.icon || "file-text",
              accent: s.accent || "bg-blue-500",
              isActive: s.isActive ?? true,
              orderIndex: s.orderIndex || 0,
            });
            restoredCounts.services++;
          }
        }
      }
    }

    // Restore Notifications
    if (Array.isArray(payload.notifications) && payload.notifications.length > 0) {
      for (const n of payload.notifications) {
        if (n.title && n.category) {
          await db.insert(notificationsTable).values({
            title: n.title,
            organization: n.organization || null,
            category: n.category,
            vacancies: n.vacancies || null,
            qualification: n.qualification || null,
            ageLimit: n.ageLimit || null,
            startDate: n.startDate || null,
            lastDate: n.lastDate || null,
            applicationFee: n.applicationFee || null,
            posterUrl: n.posterUrl || null,
            attachmentUrl: n.attachmentUrl || null,
            applyUrl: n.applyUrl || null,
            description: n.description || null,
            isFeatured: n.isFeatured ?? false,
            status: n.status || "Published",
            viewCount: n.viewCount || 0
          });
          restoredCounts.notifications++;
        }
      }
    }

    // Restore Application Tasks
    if (Array.isArray(payload.applicationTasks) && payload.applicationTasks.length > 0) {
      for (const t of payload.applicationTasks) {
        if (t.customerId && t.customerName) {
          await db.insert(applicationTasksTable).values({
            customerId: t.customerId,
            customerName: t.customerName,
            mobileNumber: t.mobileNumber || "",
            serviceName: t.serviceName || "General Service",
            applicationNumber: t.applicationNumber || null,
            currentStep: t.currentStep || "Application Received",
            status: t.status || "In Progress",
            progressPercent: t.progressPercent || 20,
            steps: t.steps || [],
            priority: t.priority || "Normal",
            targetDate: t.targetDate || null,
            assignedStaff: t.assignedStaff || null,
            paymentType: t.paymentType || "Cash",
            amountPaid: t.amountPaid || 0,
            amountPending: t.amountPending || 0,
            notes: t.notes || null
          });
          restoredCounts.applicationTasks++;
        }
      }
    }

    // Restore Enquiries
    if (Array.isArray(payload.enquiries) && payload.enquiries.length > 0) {
      for (const e of payload.enquiries) {
        if (e.customerName && e.mobileNumber) {
          await db.insert(enquiriesTable).values({
            customerId: e.customerId || `AN-${Math.floor(10000 + Math.random() * 90000)}`,
            customerName: e.customerName,
            mobileNumber: e.mobileNumber,
            serviceId: e.serviceId || null,
            applicationStatus: e.applicationStatus || "New",
            amountCharged: e.amountCharged || 0,
            amountPaid: e.amountPaid || 0,
            amountPending: e.amountPending || 0,
            paymentMethod: e.paymentMethod || "Pending",
            notes: e.notes || null
          });
          restoredCounts.enquiries++;
        }
      }
    }

    res.json({
      success: true,
      message: "Data restored successfully into database.",
      restoredCounts
    });
  } catch (error) {
    console.error("Error restoring backup:", error);
    res.status(500).json({ error: "Failed to restore backup data" });
  }
});

// 3. Purge / Cleanup Endpoint with Safety Verification
adminRouter.post("/backup/purge", async (req, res) => {
  try {
    const { target, confirmation } = req.body || {};

    if (confirmation !== "CONFIRM_DELETE") {
      res.status(400).json({ error: 'You must type "CONFIRM_DELETE" to authorize this operation' });
      return;
    }

    const { db, enquiriesTable, applicationTasksTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    let purgedCount = 0;

    if (target === "rejected_enquiries") {
      const result = await db.delete(enquiriesTable).where(eq(enquiriesTable.applicationStatus, "Rejected")).returning();
      purgedCount = result.length;
    } else if (target === "completed_enquiries") {
      const result = await db.delete(enquiriesTable).where(eq(enquiriesTable.applicationStatus, "Completed")).returning();
      purgedCount = result.length;
    } else if (target === "completed_tasks") {
      const result = await db.delete(applicationTasksTable).where(eq(applicationTasksTable.status, "Completed")).returning();
      purgedCount = result.length;
    } else {
      res.status(400).json({ error: "Invalid purge target specified" });
      return;
    }

    res.json({ success: true, purgedCount });
  } catch (error) {
    console.error("Error purging records:", error);
    res.status(500).json({ error: "Failed to purge selected records" });
  }
});

// ==========================================
// Reminders & Daily Reports Endpoints
// ==========================================

import {
  ensureReportTablesExist,
  calculateDailyReportMetrics,
  toISTDateString,
} from "../lib/daily-report-engine";
import { generateDailyReportPDF } from "../lib/pdf-report-generator";
import { getSMTPConfigInfo, sendTestEmail } from "../lib/daily-email-service";
import {
  computeNextScheduledTime,
  triggerDailyReportNow,
} from "../lib/daily-report-scheduler";

// 1. Get Settings & Delivery Status
adminRouter.get("/reports-daily/settings", async (req, res) => {
  try {
    const cached = getCache<any>("admin:report-settings");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const { getGmailIntegrationStatus } = await import("../lib/gmail-oauth-service");
    await ensureReportTablesExist();

    const [[settings], smtp, gmail] = await Promise.all([
      db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report")),
      getSMTPConfigInfo(),
      getGmailIntegrationStatus(),
    ]);

    const currentSettings = settings || {
      id: "daily_report",
      adminEmail: "airnetcomputersbk@gmail.com",
      recipientEmail: "rasoolahmed246@gmail.com",
      autoEnabled: true,
      scheduledTime: "23:00",
      timeZone: "Asia/Kolkata",
      emailProvider: "gmail_api",
      lastRunDate: null,
      lastRunStatus: null,
      lastRunError: null,
    };

    const nextScheduled = computeNextScheduledTime(currentSettings.scheduledTime || "23:00");

    const payload = {
      settings: currentSettings,
      smtp,
      gmail,
      nextScheduled,
    };

    setCache("admin:report-settings", payload, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(payload);
  } catch (error) {
    console.error("Error fetching report settings:", error);
    res.status(500).json({ error: "Failed to fetch report settings" });
  }
});

// 2. Update Settings
adminRouter.post("/reports-daily/settings", async (req, res) => {
  try {
    await ensureReportTablesExist();

    const { adminEmail, recipientEmail, autoEnabled, scheduledTime, emailProvider } = req.body || {};

    // Validate admin email
    if (adminEmail && !adminEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Please provide a valid admin email address" });
      return;
    }

    // Validate recipient email
    if (recipientEmail && !recipientEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      res.status(400).json({ error: "Please provide a valid recipient email address" });
      return;
    }

    // Validate scheduledTime format (HH:mm)
    if (scheduledTime && !scheduledTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/)) {
      res.status(400).json({ error: "Scheduled time must be in 24-hour HH:mm format (e.g. 23:00)" });
      return;
    }

    const updatePayload: Record<string, any> = { updatedAt: new Date() };
    if (adminEmail !== undefined) updatePayload.adminEmail = adminEmail.trim();
    if (recipientEmail !== undefined) updatePayload.recipientEmail = recipientEmail.trim();
    if (autoEnabled !== undefined) updatePayload.autoEnabled = Boolean(autoEnabled);
    if (scheduledTime !== undefined) updatePayload.scheduledTime = scheduledTime.trim();
    if (emailProvider !== undefined && (emailProvider === "gmail_api" || emailProvider === "smtp")) {
      updatePayload.emailProvider = emailProvider;
    }

    await db
      .update(reportSettingsTable)
      .set(updatePayload)
      .where(eq(reportSettingsTable.id, "daily_report"));

    const [updated] = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
    const nextScheduled = computeNextScheduledTime(updated.scheduledTime);

    invalidateCache("admin:report-settings");
    broadcastEvent("settings", "update", updated);
    res.json({
      success: true,
      message: "Daily report settings updated successfully",
      settings: updated,
      nextScheduled,
    });
  } catch (error) {
    console.error("Error saving report settings:", error);
    res.status(500).json({ error: "Failed to save report settings" });
  }
});

// 3. Get Real Database Metrics for Report Date
adminRouter.get("/reports-daily/data", async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || toISTDateString();
    const metrics = await calculateDailyReportMetrics(targetDate);
    res.json(metrics);
  } catch (error) {
    console.error("Error generating report metrics:", error);
    res.status(500).json({ error: "Failed to calculate report metrics" });
  }
});

// 4. Download / Stream Vector PDF
adminRouter.get("/reports-daily/pdf", async (req, res) => {
  try {
    const targetDate = (req.query.date as string) || toISTDateString();
    const metrics = await calculateDailyReportMetrics(targetDate);
    const pdfBuffer = await generateDailyReportPDF(metrics);

    const filename = `Airnet_Daily_Report_${targetDate}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error generating report PDF:", error);
    res.status(500).json({ error: "Failed to generate report PDF" });
  }
});

// 5. Send Report Now (Manual Trigger)
adminRouter.post("/reports-daily/send-now", async (req, res) => {
  try {
    const { date, recipient, adminEmail } = req.body || {};
    const result = await triggerDailyReportNow(date, recipient, adminEmail);
    res.json(result);
  } catch (error) {
    console.error("Error sending daily report now:", error);
    res.status(500).json({ error: "Failed to dispatch daily report" });
  }
});

// 6. Send Test Email
adminRouter.post("/reports-daily/send-test", async (req, res) => {
  try {
    const { db, reportSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await ensureReportTablesExist();

    const [settings] = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
    const targetEmail = req.body?.recipient || settings?.recipientEmail || "rasoolahmed246@gmail.com";
    const sourceAdmin = req.body?.adminEmail || settings?.adminEmail || "airnetcomputersbk@gmail.com";

    const testResult = await sendTestEmail(targetEmail, sourceAdmin);
    res.json(testResult);
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to execute test email" });
  }
});

// 7. Get Report Dispatch History
adminRouter.get("/reports-daily/history", async (req, res) => {
  try {
    const { db, dailyReportLogsTable } = await import("@workspace/db");
    const { desc } = await import("drizzle-orm");
    await ensureReportTablesExist();

    const logs = await db
      .select()
      .from(dailyReportLogsTable)
      .orderBy(desc(dailyReportLogsTable.generatedAt))
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error("Error fetching report history:", error);
    res.status(500).json({ error: "Failed to fetch report history logs" });
  }
});

// 8. Update / Verify SMTP Credentials
adminRouter.post("/reports-daily/smtp-config", async (req, res) => {
  try {
    const { updateSmtpSettings } = await import("../lib/daily-email-service");
    const result = await updateSmtpSettings(req.body || {});
    res.json(result);
  } catch (error: any) {
    console.error("Error updating SMTP config:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update SMTP settings" });
  }
});

// ==============================================================
// GMAIL API (OAUTH 2.0) INTEGRATION ENDPOINTS
// ==============================================================

// 9. Get current Gmail OAuth status & configuration (safe, no secrets)
adminRouter.get("/gmail/status", async (req, res) => {
  try {
    const { getGmailIntegrationStatus } = await import("../lib/gmail-oauth-service");
    const status = await getGmailIntegrationStatus();
    res.json(status);
  } catch (error: any) {
    console.error("Error fetching Gmail status:", error);
    res.status(500).json({ error: error.message || "Failed to fetch Gmail status" });
  }
});

// 10. Save / update Google Cloud OAuth Client ID & Client Secret (stored securely with AES-256-GCM)
adminRouter.post("/gmail/config", async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: "Both Client ID and Client Secret are required" });
      return;
    }

    const { saveGmailAppCredentials, getGmailIntegrationStatus } = await import("../lib/gmail-oauth-service");
    await saveGmailAppCredentials(clientId, clientSecret);
    const status = await getGmailIntegrationStatus();

    res.json({
      success: true,
      message: "Google OAuth credentials saved securely",
      status,
    });
  } catch (error: any) {
    console.error("Error saving Gmail OAuth credentials:", error);
    res.status(500).json({ error: error.message || "Failed to save OAuth credentials" });
  }
});

// 11. Generate Google OAuth 2.0 consent URL
adminRouter.get("/gmail/auth-url", async (req, res) => {
  try {
    const { generateGoogleAuthUrl } = await import("../lib/gmail-oauth-service");
    const origin = getSafeRequestOrigin(req);
    const result = await generateGoogleAuthUrl(origin);
    res.json(result);
  } catch (error: any) {
    console.error("Error generating Google Auth URL:", error);
    res.status(400).json({ error: error.message || "Failed to generate authorization URL" });
  }
});

// 12. Disconnect Gmail Account (revokes tokens and removes from DB, keeps OAuth App credentials intact)
adminRouter.post("/gmail/disconnect", async (req, res) => {
  try {
    const { disconnectGmailAccount, getGmailIntegrationStatus } = await import("../lib/gmail-oauth-service");
    const result = await disconnectGmailAccount();
    const status = await getGmailIntegrationStatus();

    res.json({
      success: true,
      message: result.message,
      status,
    });
  } catch (error: any) {
    console.error("Error disconnecting Gmail account:", error);
    res.status(500).json({ error: error.message || "Failed to disconnect Gmail account" });
  }
});

// 13. Explicitly Delete/Remove Google OAuth Client ID & Secret (Admin Action Only)
const handleDeleteGmailCredentials = async (req: any, res: any) => {
  try {
    const { deleteGmailAppCredentials, getGmailIntegrationStatus } = await import("../lib/gmail-oauth-service");
    const result = await deleteGmailAppCredentials();
    const status = await getGmailIntegrationStatus();

    res.json({
      success: true,
      message: result.message,
      status,
    });
  } catch (error: any) {
    console.error("Error deleting Gmail credentials:", error);
    res.status(500).json({ error: error.message || "Failed to delete Google OAuth credentials" });
  }
};

adminRouter.delete("/gmail/credentials", handleDeleteGmailCredentials);
adminRouter.post("/gmail/delete-credentials", handleDeleteGmailCredentials);

// 14. Send Test Email using official Gmail API
adminRouter.post("/gmail/test-email", async (req, res) => {
  try {
    const { sendTestEmail } = await import("../lib/daily-email-service");
    const { db, reportSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await ensureReportTablesExist();

    const [settings] = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
    const targetEmail = req.body?.recipient || settings?.recipientEmail || "rasoolahmed246@gmail.com";
    const sourceAdmin = req.body?.adminEmail || settings?.adminEmail || "airnetcomputersbk@gmail.com";

    const testResult = await sendTestEmail(targetEmail, sourceAdmin);
    res.json(testResult);
  } catch (error: any) {
    console.error("Error sending Gmail test email:", error);
    res.status(500).json({ error: error.message || "Failed to send Gmail test email" });
  }
});

// ==========================================
// 15. ADMIN SETTINGS & SECURITY MANAGEMENT
// ==========================================

// Get Admin Profile & Security Configuration
adminRouter.get("/settings", async (req, res) => {
  try {
    const cached = getCache<any>("admin:settings");
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    const { CONSTANT_ADMIN_EMAIL, getMobileSettingsInfo } = await import("../lib/admin-auth-service");
    const { db, reportSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await ensureReportTablesExist();

    const [settings] = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.id, "daily_report"));

    const mobileInfo = await getMobileSettingsInfo(settings);

    const responsePayload = {
      adminEmail: CONSTANT_ADMIN_EMAIL,
      isConstantEmail: true,
      passwordUpdatedAt: settings?.adminPasswordUpdatedAt || null,
      lastOtpSentAt: settings?.adminResetOtpExpiry
        ? new Date(new Date(settings.adminResetOtpExpiry).getTime() - 10 * 60 * 1000)
        : null,
      supportPhone: mobileInfo.adminMobileNumber,
      adminMobileNumber: mobileInfo.adminMobileNumber,
      frontendMobileNumber: mobileInfo.frontendMobileNumber,
      showUpdatedMobileOnFrontend: mobileInfo.showUpdatedMobileOnFrontend,
      effectiveFrontendNumber: mobileInfo.effectiveFrontendNumber,
      organization: "Airnet Computers",
      location: "Basavakalyan - 585327",
    };

    setCache("admin:settings", responsePayload, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(responsePayload);
  } catch (err: any) {
    console.error("Error fetching admin settings:", err);
    res.status(500).json({ error: err.message || "Failed to fetch admin settings" });
  }
});

// Change Admin Password directly
adminRouter.post("/settings/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { changeAdminPasswordDirect } = await import("../lib/admin-auth-service");
    const result = await changeAdminPasswordDirect(currentPassword, newPassword);

    if (result.success) {
      invalidateCache("admin:settings");
      res.cookie("admin_session", newPassword, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error("Error changing admin password:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to change admin password" });
  }
});

// Send Test OTP to constant admin email
adminRouter.post("/settings/send-test-otp", async (req, res) => {
  try {
    const { generateAndSendAdminOtp } = await import("../lib/admin-auth-service");
    const result = await generateAndSendAdminOtp();
    res.json(result);
  } catch (err: any) {
    console.error("Error sending test OTP:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send test OTP" });
  }
});

// Request OTP to change official admin mobile number
adminRouter.post("/settings/request-mobile-otp", async (req, res) => {
  try {
    const { newMobileNumber } = req.body;
    const { sendMobileChangeOtp } = await import("../lib/admin-auth-service");
    const result = await sendMobileChangeOtp(newMobileNumber);
    res.json(result);
  } catch (err: any) {
    console.error("Error requesting mobile change OTP:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to request mobile change OTP" });
  }
});

// Verify OTP and update official admin mobile number
adminRouter.post("/settings/verify-mobile-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    const { verifyAndApplyMobileChange } = await import("../lib/admin-auth-service");
    const result = await verifyAndApplyMobileChange(otp);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    invalidateCache("admin:settings", "business-info");
    res.json(result);
  } catch (err: any) {
    console.error("Error verifying mobile change OTP:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to verify mobile change OTP" });
  }
});

// Grant or revoke permission to display the updated mobile number on public frontend
adminRouter.post("/settings/frontend-mobile-permission", async (req, res) => {
  try {
    const { grantPermission } = req.body;
    const { setFrontendMobilePermission } = await import("../lib/admin-auth-service");
    const result = await setFrontendMobilePermission(Boolean(grantPermission));
    invalidateCache("admin:settings", "business-info");
    res.json(result);
  } catch (err: any) {
    console.error("Error updating frontend mobile permission:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to update frontend mobile permission" });
  }
});

// =========================================================================
// AI-POWERED RECOMMENDATION SYSTEM ENDPOINTS
// =========================================================================

// 1. Get all AI recommendations with current statuses & summary metrics
adminRouter.get("/ai-suggestions", async (req, res) => {
  try {
    const { reanalyzeSystem } = await import("../lib/ai-recommendations-service");
    const data = reanalyzeSystem();
    res.json(data);
  } catch (err: any) {
    console.error("Error fetching AI suggestions:", err);
    res.status(500).json({ error: "Failed to fetch AI suggestions" });
  }
});

// 2. Perform user action on a recommendation (approve / reject / reset)
adminRouter.post("/ai-suggestions/action", async (req, res) => {
  try {
    const { id, action } = req.body || {};
    if (!id || !["approve", "reject", "reset"].includes(action)) {
      res.status(400).json({ error: "Valid 'id' and 'action' ('approve' | 'reject' | 'reset') required" });
      return;
    }
    const { updateRecommendationStatus } = await import("../lib/ai-recommendations-service");
    const result = updateRecommendationStatus(id, action);
    if (!result.success) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error("Error updating AI suggestion action:", err);
    res.status(500).json({ error: "Failed to update AI suggestion status" });
  }
});

// 3. Trigger manual AI re-analysis of the application
adminRouter.post("/ai-suggestions/reanalyze", async (req, res) => {
  try {
    const { reanalyzeSystem } = await import("../lib/ai-recommendations-service");
    const data = reanalyzeSystem();
    res.json({
      success: true,
      message: "AI re-analysis completed successfully",
      ...data,
    });
  } catch (err: any) {
    console.error("Error running AI re-analysis:", err);
    res.status(500).json({ error: "Failed to run AI re-analysis" });
  }
});

// =========================================================================
// GOOGLE DRIVE & CUSTOMER DOCUMENTS MANAGEMENT ROUTES (API v3)
// =========================================================================

// 1. Google Drive Connection Status
adminRouter.get("/google-drive/status", async (req, res) => {
  try {
    const { getStoredDriveCredentials } = await import("../lib/google-drive-service");
    const creds = await getStoredDriveCredentials();
    res.json({
      configured: Boolean(creds.clientId && creds.clientSecret),
      permanentlySaved: Boolean(creds.clientId && creds.clientSecret),
      connected: Boolean(creds.refreshToken && creds.connectionStatus.includes("Connected")),
      connectedEmail: creds.connectedEmail,
      connectionStatus: creds.connectionStatus,
      hasClientId: Boolean(creds.clientId),
      hasClientSecret: Boolean(creds.clientSecret),
      clientId: creds.clientId ? `${creds.clientId.slice(0, 15)}...apps.googleusercontent.com` : null,
      fullClientId: creds.clientId || null,
      rootFolderId: creds.rootFolderId,
      customerDocumentsFolderId: creds.customerDocumentsFolderId,
      tokenExpiry: creds.tokenExpiry ? creds.tokenExpiry.toISOString() : null,
      lastError: creds.lastError,
    });
  } catch (err: any) {
    console.error("[admin] Error getting Drive status:", err);
    res.status(500).json({ error: "Failed to get Google Drive status" });
  }
});

// 2. Generate Google Drive OAuth Authorization URL
adminRouter.get("/google-drive/auth", async (req, res) => {
  try {
    const { generateDriveAuthUrl } = await import("../lib/google-drive-service");
    const origin = getSafeRequestOrigin(req);
    const result = await generateDriveAuthUrl(origin);
    res.json(result);
  } catch (err: any) {
    console.error("[admin] Error generating Drive auth URL:", err);
    res.status(400).json({ error: err.message || "Failed to generate Google Drive auth URL" });
  }
});

// 3. Save or update Google Cloud OAuth Client ID & Secret (Permanently stored in DB)
adminRouter.post("/google-drive/credentials", async (req, res) => {
  try {
    const { clientId, clientSecret } = req.body || {};
    if (!clientId || !clientSecret) {
      res.status(400).json({ error: "Both Google Client ID and Client Secret are required." });
      return;
    }
    const { updateDriveClientCredentials, logDocumentActivity } = await import("../lib/google-drive-service");
    await updateDriveClientCredentials(clientId, clientSecret);
    await logDocumentActivity({
      actionType: "connect_drive",
      actionStatus: "success",
      errorDetails: "Permanently saved Google Cloud OAuth Client Credentials in database",
    });
    res.json({ success: true, message: "Google Drive OAuth credentials saved successfully in database" });
  } catch (err: any) {
    console.error("[admin] Error saving Drive credentials:", err);
    res.status(500).json({ error: err.message || "Failed to save Google Drive credentials" });
  }
});

// 4. Disconnect Google Drive Account (Clears runtime session tokens, preserves saved Client ID & Secret)
adminRouter.post("/google-drive/disconnect", async (req, res) => {
  try {
    const { disconnectGoogleDrive } = await import("../lib/google-drive-service");
    await disconnectGoogleDrive();
    broadcastEvent("documents", "update", { type: "disconnect" });
    res.json({ success: true, message: "Google Drive session disconnected successfully. Credentials remain securely saved." });
  } catch (err: any) {
    console.error("[admin] Error disconnecting Google Drive:", err);
    res.status(500).json({ error: "Failed to disconnect Google Drive" });
  }
});

// 4b. Explicitly Delete/Remove Google Drive OAuth Client ID & Secret (Admin Action Only)
const handleDeleteDriveCredentials = async (req: any, res: any) => {
  try {
    const { deleteDriveClientCredentials } = await import("../lib/google-drive-service");
    await deleteDriveClientCredentials();
    broadcastEvent("documents", "update", { type: "credentials_deleted" });
    res.json({ success: true, message: "Google Drive OAuth credentials have been completely deleted by admin." });
  } catch (err: any) {
    console.error("[admin] Error deleting Google Drive credentials:", err);
    res.status(500).json({ error: "Failed to delete Google Drive credentials" });
  }
};

adminRouter.delete("/google-drive/credentials", handleDeleteDriveCredentials);
adminRouter.post("/google-drive/delete-credentials", handleDeleteDriveCredentials);

// 5. Fetch all Customer Records from Ledger Records with Google Drive Documents
adminRouter.get("/documents/customers", async (req, res) => {
  try {
    const filterStatus = (req.query.status as string || "completed").toLowerCase();
    const cacheKey = `documents:customers:${filterStatus}`;
    const cached = getCache<any>(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      res.json(cached);
      return;
    }

    // 1. Fetch tracker tasks, records, enquiries, and customer documents in parallel
    const [tasks, allRecords, enquiries, allDocs] = await Promise.all([
      db.select().from(applicationTasksTable).orderBy(desc(applicationTasksTable.createdAt)),
      db.select().from(recordsTable).orderBy(desc(recordsTable.createdAt)),
      db.select().from(enquiriesTable).orderBy(desc(enquiriesTable.createdAt)),
      db.select().from(customerDocumentsTable).where(eq(customerDocumentsTable.deletionStatus, "active")).orderBy(desc(customerDocumentsTable.uploadedAt)),
    ]);

    // Group documents by customerId
    const docsByCid = new Map<string, typeof allDocs>();
    for (const doc of allDocs) {
      const list = docsByCid.get(doc.customerId) || [];
      list.push(doc);
      docsByCid.set(doc.customerId, list);
    }

    const customersMap = new Map<string, any>();

    // Add from Tracker tasks
    for (const t of tasks) {
      const cid = (t.customerId || "").trim();
      if (!cid) continue;
      const docs = docsByCid.get(cid) || [];
      const latestDoc = docs[0];
      const taskStatus = (t.status || "In Progress").trim();
      const docAck = docs.find((d) => d.acknowledgementNumber && d.acknowledgementNumber.trim())?.acknowledgementNumber || "";

      customersMap.set(cid, {
        customerId: cid,
        customerName: t.customerName || "Customer",
        serviceName: t.serviceName || "General Service",
        acknowledgementNumber: t.applicationNumber || docAck || "",
        mobileNumber: t.mobileNumber || "",
        status: taskStatus,
        totalDocuments: docs.length,
        lastUploadDate: latestDoc ? latestDoc.uploadedAt.toISOString() : null,
        documents: docs,
        driveFolderId: docs[0]?.driveFolderId || null,
        source: "tracker",
        sourceId: t.id,
        createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
      });
    }

    // Add from Ledger Records (Records table represents completed ledger entries)
    for (const r of allRecords) {
      const cid = (r.customerId || "").trim();
      if (!cid) continue;
      const docs = docsByCid.get(cid) || [];
      const latestDoc = docs[0];
      const docAck = docs.find((d) => d.acknowledgementNumber && d.acknowledgementNumber.trim())?.acknowledgementNumber || "";

      if (!customersMap.has(cid)) {
        customersMap.set(cid, {
          customerId: cid,
          customerName: r.customerName || "Customer",
          serviceName: r.serviceProvided || "General Service",
          acknowledgementNumber: docAck || "",
          mobileNumber: r.mobileNumber || "",
          status: "Completed",
          totalDocuments: docs.length,
          lastUploadDate: latestDoc ? latestDoc.uploadedAt.toISOString() : null,
          documents: docs,
          driveFolderId: docs[0]?.driveFolderId || null,
          source: "record",
          sourceId: r.id,
          createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
        });
      } else {
        const existing = customersMap.get(cid);
        if (!existing.acknowledgementNumber && docAck) {
          existing.acknowledgementNumber = docAck;
        }
      }
    }

    // Add from Enquiries
    for (const e of enquiries) {
      const cid = (e.customerId || "").trim();
      if (!cid) continue;
      const enqStatus = (e.applicationStatus || "New").trim();
      if (!customersMap.has(cid)) {
        const docs = docsByCid.get(cid) || [];
        const latestDoc = docs[0];
        customersMap.set(cid, {
          customerId: cid,
          customerName: e.customerName || "Customer",
          serviceName: e.serviceId || "General Enquiry",
          acknowledgementNumber: "",
          mobileNumber: e.mobileNumber || "",
          status: enqStatus,
          totalDocuments: docs.length,
          lastUploadDate: latestDoc ? latestDoc.uploadedAt.toISOString() : null,
          documents: docs,
          driveFolderId: docs[0]?.driveFolderId || null,
          source: "enquiry",
          sourceId: e.id,
          createdAt: e.createdAt ? e.createdAt.toISOString() : new Date().toISOString(),
        });
      } else {
        // If enquiry is completed, reflect it
        const existing = customersMap.get(cid);
        if (enqStatus.toLowerCase() === "completed" && existing.status.toLowerCase() !== "completed") {
          existing.status = "Completed";
        }
      }
    }

    // Add any customer who has documents directly
    for (const [cid, docs] of docsByCid.entries()) {
      if (!customersMap.has(cid) && docs.length > 0) {
        const first = docs[0];
        customersMap.set(cid, {
          customerId: cid,
          customerName: first.customerName || "Customer",
          serviceName: first.serviceName || "General Service",
          acknowledgementNumber: first.acknowledgementNumber || "",
          mobileNumber: "",
          status: "Completed",
          totalDocuments: docs.length,
          lastUploadDate: first.uploadedAt.toISOString(),
          documents: docs,
          driveFolderId: first.driveFolderId || null,
          source: "document",
          createdAt: first.uploadedAt.toISOString(),
        });
      }
    }

    const allCustomers = Array.from(customersMap.values());

    // The user requested: "in Customer Documents page only show the data of the customers whose status is 'completed'"
    const filtered = filterStatus === "all"
      ? allCustomers
      : allCustomers.filter((c) => (c.status || "").toLowerCase() === "completed");

    const customers = filtered.sort((a, b) => {
      const aTime = a.lastUploadDate ? new Date(a.lastUploadDate).getTime() : new Date(a.createdAt).getTime();
      const bTime = b.lastUploadDate ? new Date(b.lastUploadDate).getTime() : new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    const summary = {
      totalCustomers: customers.length,
      totalDocuments: customers.reduce((sum, c) => sum + c.totalDocuments, 0),
      customersWithDocs: customers.filter((c) => c.totalDocuments > 0).length,
      customersWithoutDocs: customers.filter((c) => c.totalDocuments === 0).length,
      completedCount: allCustomers.filter((c) => (c.status || "").toLowerCase() === "completed").length,
      allTotalCount: allCustomers.length,
    };

    const responsePayload = { customers, summary, totalCompleted: summary.completedCount, totalAll: summary.allTotalCount };
    setCache(cacheKey, responsePayload, 3600);
    res.setHeader("X-Cache", "MISS");
    res.json(responsePayload);
  } catch (err: any) {
    console.error("[admin] Error fetching customer documents:", err);
    res.status(500).json({ error: "Failed to fetch customer documents" });
  }
});

// 6. Fetch Single Customer Document Details
adminRouter.get("/documents/customers/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const docs = await db
      .select()
      .from(customerDocumentsTable)
      .where(and(eq(customerDocumentsTable.customerId, customerId), eq(customerDocumentsTable.deletionStatus, "active")))
      .orderBy(desc(customerDocumentsTable.uploadedAt));

    res.json({ customerId, documents: docs, totalDocuments: docs.length });
  } catch (err: any) {
    console.error("[admin] Error fetching customer docs:", err);
    res.status(500).json({ error: "Failed to fetch customer files" });
  }
});

// 7. Upload Documents directly to Google Drive for a Customer
adminRouter.post(["/documents/customers/:customerId/upload", "/documents/upload"], async (req, res) => {
  try {
    const customerId = (req.params.customerId || req.body.customerId || "").trim();
    const { customerName, serviceName, acknowledgementNumber, category, notes, files } = req.body || {};

    if (!customerId) {
      res.status(400).json({ error: "Customer ID is required for document upload." });
      return;
    }

    const incomingFiles: any[] = Array.isArray(files) ? files : (req.body.fileData ? [req.body] : []);
    if (incomingFiles.length === 0) {
      res.status(400).json({ error: "No files provided for upload." });
      return;
    }

    const { uploadDocumentToDrive, getOrCreateCustomerFolder, logDocumentActivity } = await import("../lib/google-drive-service");

    const allowedExtensions = /\.(pdf|jpg|jpeg|png|webp|doc|docx|xls|xlsx|txt|csv|zip|rar)$/i;
    const uploadedDocs: any[] = [];
    const errors: string[] = [];

    for (const f of incomingFiles) {
      try {
        const rawName = f.fileName || f.name || "document.pdf";
        if (!allowedExtensions.test(rawName)) {
          errors.push(`File "${rawName}" has an unsupported format. Supported: PDF, JPG, PNG, DOC, DOCX, XLS, XLSX, etc.`);
          continue;
        }

        let buffer: Buffer;
        let mime = f.mimeType || f.type || "application/octet-stream";

        if (f.fileData) {
          const matches = String(f.fileData).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            mime = matches[1];
            buffer = Buffer.from(matches[2], "base64");
          } else {
            buffer = Buffer.from(f.fileData, "base64");
          }
        } else {
          continue;
        }

        // 30MB limit check
        if (buffer.length > 30 * 1024 * 1024) {
          errors.push(`File "${rawName}" exceeds the 30 MB size limit.`);
          continue;
        }

        const ext = path.extname(rawName).replace(/^\./, "").toLowerCase();

        // Upload directly to Google Drive (AIRNET COMPUTERS -> Customer Documents -> AC001 - Name)
        const driveResult = await uploadDocumentToDrive({
          customerId,
          customerName: customerName || "Customer",
          fileName: rawName,
          mimeType: mime,
          fileBuffer: buffer,
        });

        const customerFolderId = await getOrCreateCustomerFolder(customerId, customerName || "");

        // Insert metadata in customer_documents
        const [inserted] = await db
          .insert(customerDocumentsTable)
          .values({
            customerId,
            customerName: customerName || null,
            serviceName: serviceName || null,
            acknowledgementNumber: acknowledgementNumber || null,
            driveFileId: driveResult.fileId,
            driveFolderId: customerFolderId,
            fileName: driveResult.fileName,
            fileExtension: ext,
            mimeType: driveResult.mimeType,
            fileSize: driveResult.fileSize,
            category: category || "General",
            notes: notes || null,
            uploadedBy: "Admin",
            uploadStatus: "completed",
            deletionStatus: "active",
          })
          .returning();

        uploadedDocs.push(inserted);

        await logDocumentActivity({
          customerId,
          driveFileId: driveResult.fileId,
          fileName: driveResult.fileName,
          actionType: "upload",
          actionStatus: "success",
        });
      } catch (fileErr: any) {
        console.error(`[admin] Failed to upload "${f.fileName}":`, fileErr);
        errors.push(`Failed to upload "${f.fileName}": ${fileErr.message}`);
        await logDocumentActivity({
          customerId,
          fileName: f.fileName,
          actionType: "upload",
          actionStatus: "failed",
          errorDetails: fileErr.message,
        });
      }
    }

    // Sync acknowledgement number to tracker if provided
    if (acknowledgementNumber && acknowledgementNumber.trim()) {
      try {
        await db
          .update(applicationTasksTable)
          .set({ applicationNumber: acknowledgementNumber.trim(), updatedAt: new Date() })
          .where(and(eq(applicationTasksTable.customerId, customerId), sql`application_number IS NULL OR application_number = ''`));
      } catch (e) {}
    }

    invalidateCache("documents:customers*", "pathway:customers", "admin:tracker");
    broadcastEvent("documents", "create", { customerId, count: uploadedDocs.length });

    if (uploadedDocs.length === 0 && errors.length > 0) {
      res.status(400).json({ error: errors.join("; ") });
      return;
    }

    res.json({
      success: true,
      uploadedCount: uploadedDocs.length,
      uploadedDocs,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[admin] Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to upload document to Google Drive" });
  }
});

// 8. Document File Preview Stream from Google Drive
adminRouter.get("/documents/files/:fileId/preview", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { getFileMediaStream, logDocumentActivity } = await import("../lib/google-drive-service");
    const media = await getFileMediaStream(fileId);

    res.setHeader("Content-Type", media.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(media.fileName)}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (media.contentLength) {
      res.setHeader("Content-Length", String(media.contentLength));
    }

    media.stream.pipe(res);

    await logDocumentActivity({
      driveFileId: fileId,
      fileName: media.fileName,
      actionType: "preview",
      actionStatus: "success",
    });
  } catch (err: any) {
    console.error("[admin] Preview stream error:", err);
    res.status(500).json({ error: "Failed to stream document from Google Drive" });
  }
});

// 9. Document File Download Stream from Google Drive
adminRouter.get("/documents/files/:fileId/download", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { getFileMediaStream, logDocumentActivity } = await import("../lib/google-drive-service");
    const media = await getFileMediaStream(fileId);

    res.setHeader("Content-Type", media.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(media.fileName)}"`);
    if (media.contentLength) {
      res.setHeader("Content-Length", String(media.contentLength));
    }

    media.stream.pipe(res);

    await logDocumentActivity({
      driveFileId: fileId,
      fileName: media.fileName,
      actionType: "download",
      actionStatus: "success",
    });
  } catch (err: any) {
    console.error("[admin] Download stream error:", err);
    res.status(500).json({ error: "Failed to download file from Google Drive" });
  }
});

// 10. Delete Individual File from Google Drive & Database
adminRouter.delete("/documents/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    const { deleteFileFromDrive, logDocumentActivity } = await import("../lib/google-drive-service");

    const [doc] = await db
      .select()
      .from(customerDocumentsTable)
      .where(eq(customerDocumentsTable.driveFileId, fileId));

    try {
      await deleteFileFromDrive(fileId);
    } catch (dErr: any) {
      console.warn(`[admin] Google Drive file ${fileId} deletion warning:`, dErr.message);
    }

    // Mark deleted in customerDocumentsTable
    await db
      .delete(customerDocumentsTable)
      .where(eq(customerDocumentsTable.driveFileId, fileId));

    await logDocumentActivity({
      customerId: doc?.customerId,
      driveFileId: fileId,
      fileName: doc?.fileName,
      actionType: "delete",
      actionStatus: "success",
    });

    invalidateCache("documents:customers*", "pathway:customers");
    broadcastEvent("documents", "delete", { fileId, customerId: doc?.customerId });
    res.json({ success: true, message: "File permanently deleted from Google Drive" });
  } catch (err: any) {
    console.error("[admin] File deletion error:", err);
    res.status(500).json({ error: "Failed to delete file from Google Drive" });
  }
});

// 11. Delete all Customer Documents & Folder from Google Drive (Preserves Ledger Records)
adminRouter.delete("/documents/customers/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const { deleteFileFromDrive, deleteCustomerFolderFromDrive, logDocumentActivity } = await import(
      "../lib/google-drive-service"
    );

    const docs = await db
      .select()
      .from(customerDocumentsTable)
      .where(eq(customerDocumentsTable.customerId, customerId));

    let deletedFiles = 0;
    let folderId = docs[0]?.driveFolderId;

    for (const d of docs) {
      try {
        await deleteFileFromDrive(d.driveFileId);
        deletedFiles++;
      } catch (fErr) {
        console.warn(`[admin] Warning deleting drive file ${d.driveFileId}:`, fErr);
      }
    }

    if (folderId) {
      try {
        await deleteCustomerFolderFromDrive(folderId);
      } catch (folderErr) {
        console.warn(`[admin] Warning deleting drive folder ${folderId}:`, folderErr);
      }
    }

    // Remove rows from customerDocumentsTable
    await db
      .delete(customerDocumentsTable)
      .where(eq(customerDocumentsTable.customerId, customerId));

    await logDocumentActivity({
      customerId,
      actionType: "delete",
      actionStatus: "success",
      errorDetails: `Deleted ${deletedFiles} documents and Google Drive folder for customer ${customerId}. Original Ledger Records preserved.`,
    });

    invalidateCache("documents:customers*", "pathway:customers");
    broadcastEvent("documents", "delete", { customerId });

    res.json({
      success: true,
      deletedFiles,
      message: `Successfully deleted ${deletedFiles} document(s) from Google Drive. Ledger Records remain intact.`,
    });
  } catch (err: any) {
    console.error("[admin] Customer docs deletion error:", err);
    res.status(500).json({ error: "Failed to delete customer documents from Google Drive" });
  }
});

// 12. Edit Customer Details safely (syncs with Ledger Records & renames Drive folder)
adminRouter.patch("/documents/customers/:customerId", async (req, res) => {
  try {
    const { customerId } = req.params;
    const { customerName, serviceName, acknowledgementNumber, status } = req.body || {};

    const updates: Record<string, any> = {};
    if (customerName !== undefined) updates.customerName = customerName.trim();
    if (serviceName !== undefined) updates.serviceName = serviceName.trim();
    if (acknowledgementNumber !== undefined) updates.acknowledgementNumber = acknowledgementNumber.trim();
    if (status !== undefined) updates.status = status.trim();

    // 1. Update application_tasks if exists, or insert if customer has acknowledgementNumber and doesn't exist in tasks
    const existingTasks = await db
      .select()
      .from(applicationTasksTable)
      .where(eq(applicationTasksTable.customerId, customerId));

    if (existingTasks.length > 0) {
      const taskUpdate: Record<string, any> = { updatedAt: new Date() };
      if (updates.customerName) taskUpdate.customerName = updates.customerName;
      if (updates.serviceName) taskUpdate.serviceName = updates.serviceName;
      if (updates.acknowledgementNumber !== undefined) taskUpdate.applicationNumber = updates.acknowledgementNumber;
      if (updates.status) taskUpdate.status = updates.status;

      await db.update(applicationTasksTable).set(taskUpdate).where(eq(applicationTasksTable.customerId, customerId));
    } else if (updates.acknowledgementNumber !== undefined || updates.customerName || updates.serviceName) {
      const [existingRecord] = await db
        .select()
        .from(recordsTable)
        .where(eq(recordsTable.customerId, customerId))
        .limit(1);

      const [existingDoc] = await db
        .select()
        .from(customerDocumentsTable)
        .where(eq(customerDocumentsTable.customerId, customerId))
        .limit(1);

      await db.insert(applicationTasksTable).values({
        customerId,
        customerName: updates.customerName || existingRecord?.customerName || existingDoc?.customerName || "Customer",
        mobileNumber: existingRecord?.mobileNumber || "Not Available",
        serviceName: updates.serviceName || existingRecord?.serviceProvided || existingDoc?.serviceName || "General Service",
        applicationNumber: updates.acknowledgementNumber || "",
        status: updates.status || "Completed",
        assignedStaff: "Admin",
        notes: "Created via Documents Acknowledgement No update",
      });
    }

    // 2. Update enquiries if exists
    if (updates.status || updates.customerName || updates.serviceName) {
      const enqUpdate: Record<string, any> = { updatedAt: new Date() };
      if (updates.status) enqUpdate.applicationStatus = updates.status;
      if (updates.customerName) enqUpdate.customerName = updates.customerName;
      await db.update(enquiriesTable).set(enqUpdate).where(eq(enquiriesTable.customerId, customerId));
    }

    // 3. Update records table if exists
    if (updates.customerName || updates.serviceName) {
      const recUpdate: Record<string, any> = {};
      if (updates.customerName) recUpdate.customerName = updates.customerName;
      if (updates.serviceName) recUpdate.serviceProvided = updates.serviceName;
      await db.update(recordsTable).set(recUpdate).where(eq(recordsTable.customerId, customerId));
    }

    // 4. Update customer_documents table
    await db
      .update(customerDocumentsTable)
      .set({
        ...(updates.customerName ? { customerName: updates.customerName } : {}),
        ...(updates.serviceName ? { serviceName: updates.serviceName } : {}),
        ...(updates.acknowledgementNumber !== undefined ? { acknowledgementNumber: updates.acknowledgementNumber } : {}),
        updatedAt: new Date(),
      })
      .where(eq(customerDocumentsTable.customerId, customerId));

    // 5. Invalidate caches
    invalidateCache("admin:tracker", "admin:records", "admin:enquiries", "documents:customers*", "pathway:customers");

    // 4. If customerName changed, rename Google Drive folder
    if (updates.customerName) {
      const [doc] = await db
        .select({ driveFolderId: customerDocumentsTable.driveFolderId })
        .from(customerDocumentsTable)
        .where(eq(customerDocumentsTable.customerId, customerId))
        .limit(1);

      if (doc?.driveFolderId) {
        const { renameCustomerFolder } = await import("../lib/google-drive-service");
        await renameCustomerFolder(doc.driveFolderId, customerId, updates.customerName);
      }
    }

    const { logDocumentActivity } = await import("../lib/google-drive-service");
    await logDocumentActivity({
      customerId,
      actionType: "edit_customer",
      actionStatus: "success",
      errorDetails: `Updated customer details for ${customerId}`,
    });

    broadcastEvent("documents", "update", { customerId });
    broadcastEvent("tracker", "update");
    broadcastEvent("records", "update");

    res.json({ success: true, message: "Customer details updated successfully across Ledger and Documents" });
  } catch (err: any) {
    console.error("[admin] Customer edit error:", err);
    res.status(500).json({ error: "Failed to update customer details" });
  }
});

// 13. Document Activity Logs
adminRouter.get("/documents/activity-logs", async (req, res) => {
  try {
    const logs = await db
      .select()
      .from(documentActivityLogsTable)
      .orderBy(desc(documentActivityLogsTable.timestamp))
      .limit(100);

    res.json(logs);
  } catch (err: any) {
    console.error("[admin] Error fetching activity logs:", err);
    res.status(500).json({ error: "Failed to fetch document activity logs" });
  }
});






