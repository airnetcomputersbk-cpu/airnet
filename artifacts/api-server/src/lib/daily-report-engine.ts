import { db, pool, enquiriesTable, applicationTasksTable, reportSettingsTable, dailyReportLogsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { normalizeDateToDMY } from "./extractor";

export interface StatusBreakdownItem {
  status: string;
  currentTotal: number;
  todayActivity: number;
  description: string;
}

export interface ImmediateAttentionItem {
  id: string | number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  issueType: "Overdue Task" | "New Unhandled Enquiry" | "Pending Udhar / Balance";
  details: string;
  urgency: "High" | "Medium";
  amountPending?: number;
}

export interface CompletedTodayItem {
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  completedAt: string;
  amountCharged: number;
  amountPaid: number;
}

export interface PaymentTodayItem {
  customerId: string;
  customerName: string;
  serviceName: string;
  amount: number;
  paymentMethod: string;
  time: string;
}

export interface DailyReportMetrics {
  reportDate: string; // YYYY-MM-DD (Asia/Kolkata)
  reportingPeriodLabel: string;
  generatedAtIST: string;
  timeZone: string;
  
  // Executive Summary Figures
  totalRequests: number;
  requestsReceivedToday: number;
  requestsAcceptedToday: number;
  requestsOnHoldToday: number;
  requestsCompletedToday: number;
  requestsPendingEnd: number;
  overdueRequestsCount: number;
  
  // Financial Figures
  paymentsReceivedTodayCount: number;
  totalPaymentAmountToday: number;
  requestsWithOutstandingBalanceCount: number;
  totalOutstandingAmount: number;
  totalHistoricalBilled: number;
  totalHistoricalCollected: number;
  
  // Tables & Details
  statusBreakdown: StatusBreakdownItem[];
  immediateAttention: ImmediateAttentionItem[];
  completedTodayList: CompletedTodayItem[];
  paymentsTodayList: PaymentTodayItem[];
}

// Convert any date to YYYY-MM-DD in Asia/Kolkata
export function toISTDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

// Format date into human-readable IST format e.g. "29 October 2026"
export function formatISTDateReadable(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Current IST Time string e.g. "10:00 PM IST"
export function getISTTimeString(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }) + " IST";
}

// Ensure database tables exist
let tablesInitialized = false;
export async function ensureReportTablesExist(): Promise<void> {
  if (tablesInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_settings (
        id TEXT PRIMARY KEY DEFAULT 'daily_report',
        admin_email TEXT NOT NULL DEFAULT 'airnetcomputersbk@gmail.com',
        auto_enabled BOOLEAN NOT NULL DEFAULT true,
        scheduled_time TEXT NOT NULL DEFAULT '22:00',
        time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        last_run_date TEXT,
        last_run_status TEXT,
        last_run_error TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS daily_report_logs (
        id SERIAL PRIMARY KEY,
        report_date TEXT NOT NULL,
        recipient TEXT NOT NULL,
        delivery_status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        metrics JSONB,
        error_message TEXT,
        pdf_generated BOOLEAN NOT NULL DEFAULT true,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Insert default settings row if missing
    await pool.query(`
      INSERT INTO report_settings (id, admin_email, auto_enabled, scheduled_time, time_zone)
      VALUES ('daily_report', 'airnetcomputersbk@gmail.com', true, '23:00', 'Asia/Kolkata')
      ON CONFLICT (id) DO NOTHING;

      -- Add recipient_email and dynamic SMTP columns if they do not exist
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS recipient_email TEXT DEFAULT 'rasoolahmed246@gmail.com';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'gmail_api';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_client_id TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_client_secret_encrypted TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_refresh_token_encrypted TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_access_token_encrypted TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_token_expiry TIMESTAMP;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_connected_email TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_connection_status TEXT DEFAULT 'Disconnected';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS gmail_last_error TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_host TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_port TEXT DEFAULT '587';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT false;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_user TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_pass TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS smtp_from_name TEXT DEFAULT 'Airnet Computers';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_master_password TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_reset_otp TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_reset_otp_expiry TIMESTAMP;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_password_updated_at TIMESTAMP;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_mobile_number TEXT DEFAULT '+91 7892881086';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS frontend_mobile_number TEXT DEFAULT '+91 7892881086';
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS show_updated_mobile_on_frontend BOOLEAN DEFAULT false;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_mobile_otp TEXT;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_mobile_otp_expiry TIMESTAMP;
      ALTER TABLE report_settings ADD COLUMN IF NOT EXISTS admin_mobile_pending TEXT;

      -- Add Gmail & Sender metadata columns to daily_report_logs
      ALTER TABLE daily_report_logs ADD COLUMN IF NOT EXISTS preview_url TEXT;
      ALTER TABLE daily_report_logs ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'gmail_api';
      ALTER TABLE daily_report_logs ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
      ALTER TABLE daily_report_logs ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
      ALTER TABLE daily_report_logs ADD COLUMN IF NOT EXISTS sender_email TEXT;

      -- Ensure correct defaults for Airnet Computers admin & destination recipient & 23:00 IST schedule
      UPDATE report_settings
      SET admin_email = 'airnetcomputersbk@gmail.com',
          recipient_email = COALESCE(recipient_email, 'rasoolahmed246@gmail.com'),
          scheduled_time = CASE WHEN scheduled_time = '22:00' THEN '23:00' ELSE COALESCE(scheduled_time, '23:00') END
      WHERE id = 'daily_report';
    `);

    tablesInitialized = true;
  } catch (err) {
    console.error("Error creating report tables:", err);
  }
}

// Calculate the complete, accurate daily report metrics
export async function calculateDailyReportMetrics(targetReportDate?: string): Promise<DailyReportMetrics> {
  await ensureReportTablesExist();
  const reportDate = targetReportDate || toISTDateString();
  const readableDate = formatISTDateReadable(reportDate);
  const reportingPeriodLabel = `${readableDate} (12:00 AM – 11:59 PM IST)`;
  const generatedAtIST = getISTTimeString();

  // Load actual requests from database
  const [tasks, enquiries] = await Promise.all([
    db.select().from(applicationTasksTable),
    db.select().from(enquiriesTable),
  ]);

  const seenCustomerIds = new Set<string>();

  // Activity counters for today
  let requestsReceivedToday = 0;
  let requestsAcceptedToday = 0;
  let requestsOnHoldToday = 0;
  let requestsCompletedToday = 0;
  let paymentsReceivedTodayCount = 0;
  let totalPaymentAmountToday = 0;

  // Status counters (current totals)
  let countNew = 0;
  let countInProgress = 0;
  let countOnHold = 0;
  let countAccepted = 0;
  let countRejected = 0;
  let countCompleted = 0;

  // Overdue & outstanding
  let overdueRequestsCount = 0;
  let totalOutstandingAmount = 0;
  let requestsWithOutstandingBalanceCount = 0;

  let totalHistoricalBilled = 0;
  let totalHistoricalCollected = 0;

  const immediateAttention: ImmediateAttentionItem[] = [];
  const completedTodayList: CompletedTodayItem[] = [];
  const paymentsTodayList: PaymentTodayItem[] = [];

  // Parse tasks
  tasks.forEach((t) => {
    seenCustomerIds.add(t.customerId);
    const taskCreatedIST = toISTDateString(new Date(t.createdAt));
    const taskUpdatedIST = toISTDateString(new Date(t.updatedAt || t.createdAt));

    const isCreatedToday = taskCreatedIST === reportDate;
    const isUpdatedToday = taskUpdatedIST === reportDate;

    const paid = Number(t.amountPaid) || 0;
    const pending = Number(t.amountPending) || 0;
    const charged = paid + pending;

    totalHistoricalBilled += charged;
    totalHistoricalCollected += paid;

    if (pending > 0) {
      totalOutstandingAmount += pending;
      requestsWithOutstandingBalanceCount += 1;
    }

    // Status aggregation
    const status = t.status || "In Progress";
    if (status === "Completed") {
      countCompleted += 1;
    } else if (status === "In Progress") {
      countInProgress += 1;
    } else if (status === "On Hold") {
      countOnHold += 1;
    } else if (status === "Pending") {
      countNew += 1;
    } else if (status === "Rejected") {
      countRejected += 1;
    }

    // Check completion today based on actual completion timestamp
    const hasCompletedStepToday = (t.steps || []).some(
      (s: any) => s.status === "completed" && s.completedAt && toISTDateString(new Date(s.completedAt)) === reportDate
    );
    const isCompletedToday = status === "Completed" && (isUpdatedToday || hasCompletedStepToday);

    if (isCompletedToday) {
      requestsCompletedToday += 1;
      completedTodayList.push({
        customerId: t.customerId,
        customerName: t.customerName,
        mobileNumber: t.mobileNumber,
        serviceName: t.serviceName,
        completedAt: getISTTimeString(new Date(t.updatedAt || t.createdAt)),
        amountCharged: charged,
        amountPaid: paid,
      });
    }

    // On-hold today
    if (status === "On Hold" && (isUpdatedToday || isCreatedToday)) {
      requestsOnHoldToday += 1;
    }

    // Check payment today
    if (isCreatedToday || isUpdatedToday) {
      if (paid > 0 && isCreatedToday) {
        paymentsReceivedTodayCount += 1;
        totalPaymentAmountToday += paid;
        paymentsTodayList.push({
          customerId: t.customerId,
          customerName: t.customerName,
          serviceName: t.serviceName,
          amount: paid,
          paymentMethod: t.paymentType || "Cash",
          time: getISTTimeString(new Date(t.updatedAt || t.createdAt)),
        });
      }
    }

    // Overdue detection: Target date passed or active > 7 days
    const isFinished = status === "Completed" || status === "Rejected";
    let isOverdue = false;
    if (!isFinished && t.targetDate) {
      // Check target date format
      const tDate = t.targetDate.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(tDate) && tDate < reportDate) {
        isOverdue = true;
      }
    }
    if (!isFinished) {
      const daysOld = Math.floor((new Date().getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysOld >= 5 && status !== "On Hold") {
        isOverdue = true;
      }
    }

    if (isOverdue) {
      overdueRequestsCount += 1;
      immediateAttention.push({
        id: t.id,
        customerId: t.customerId,
        customerName: t.customerName,
        mobileNumber: t.mobileNumber,
        serviceName: t.serviceName,
        issueType: "Overdue Task",
        details: `Stage: ${t.currentStep || status}. Target date: ${normalizeDateToDMY(t.targetDate) || "Not set"}. Priority: ${t.priority}`,
        urgency: "High",
        amountPending: pending,
      });
    } else if (pending >= 100 && !isFinished) {
      // High pending balance requiring collection
      immediateAttention.push({
        id: t.id,
        customerId: t.customerId,
        customerName: t.customerName,
        mobileNumber: t.mobileNumber,
        serviceName: t.serviceName,
        issueType: "Pending Udhar / Balance",
        details: `Unpaid balance due: ₹${pending}. Paid: ₹${paid}. Payment type: ${t.paymentType || "Pending"}.`,
        urgency: pending >= 300 ? "High" : "Medium",
        amountPending: pending,
      });
    }
  });

  // Parse enquiries
  enquiries.forEach((e) => {
    const isLinkedToTracker = seenCustomerIds.has(e.customerId);
    const createdIST = toISTDateString(new Date(e.createdAt));
    const updatedIST = toISTDateString(new Date(e.updatedAt || e.createdAt));

    const isCreatedToday = createdIST === reportDate;
    const isUpdatedToday = updatedIST === reportDate;

    if (isCreatedToday) {
      requestsReceivedToday += 1;
    }

    const appStatus = e.applicationStatus || "New";

    if (appStatus === "Accepted" && (isUpdatedToday || isCreatedToday)) {
      requestsAcceptedToday += 1;
    }

    // Only count towards standalone current totals if not already counted via tracker task
    if (!isLinkedToTracker) {
      const charged = Number(e.amountCharged) || 0;
      const isPending = e.paymentMethod === "Pending" || e.paymentMethod === "Pending / Udhar";
      const paid = e.amountPaid !== undefined && e.amountPaid !== null ? Number(e.amountPaid) || 0 : (isPending ? 0 : charged);
      const pending = e.amountPending !== undefined && e.amountPending !== null ? Number(e.amountPending) || 0 : Math.max(0, charged - paid);

      totalHistoricalBilled += charged;
      totalHistoricalCollected += paid;

      if (pending > 0) {
        totalOutstandingAmount += pending;
        requestsWithOutstandingBalanceCount += 1;
      }

      if (appStatus === "New") {
        countNew += 1;
      } else if (appStatus === "In Progress") {
        countInProgress += 1;
      } else if (appStatus === "Accepted") {
        countAccepted += 1;
      } else if (appStatus === "Rejected") {
        countRejected += 1;
      } else if (appStatus === "Completed") {
        countCompleted += 1;
      }

      if (appStatus === "New") {
        immediateAttention.push({
          id: e.id,
          customerId: e.customerId,
          customerName: e.customerName,
          mobileNumber: e.mobileNumber,
          serviceName: e.serviceId || "General Enquiry",
          issueType: "New Unhandled Enquiry",
          details: `Received on website/portal. Notes: ${e.notes || "No extra notes"}. Awaiting review.`,
          urgency: "High",
          amountPending: pending,
        });
      }
    }
  });

  const totalRequests = tasks.length + enquiries.filter((e) => !seenCustomerIds.has(e.customerId)).length;
  const requestsPendingEnd = countNew + countInProgress + countOnHold + countAccepted;

  // Status breakdown table
  const statusBreakdown: StatusBreakdownItem[] = [
    {
      status: "New",
      currentTotal: countNew,
      todayActivity: requestsReceivedToday,
      description: "Incoming citizen requests awaiting review",
    },
    {
      status: "In Progress",
      currentTotal: countInProgress,
      todayActivity: requestsAcceptedToday,
      description: "Official form filling, portal submission & verification",
    },
    {
      status: "On Hold",
      currentTotal: countOnHold,
      todayActivity: requestsOnHoldToday,
      description: "Awaiting customer OTP, missing documents or clarification",
    },
    {
      status: "Accepted",
      currentTotal: countAccepted,
      todayActivity: requestsAcceptedToday,
      description: "Reviewed and scheduled for processing",
    },
    {
      status: "Rejected",
      currentTotal: countRejected,
      todayActivity: 0,
      description: "Ineligible or customer-cancelled requests",
    },
    {
      status: "Completed",
      currentTotal: countCompleted,
      todayActivity: requestsCompletedToday,
      description: "Delivered to citizen or ready for collection at shop",
    },
  ];

  return {
    reportDate,
    reportingPeriodLabel,
    generatedAtIST,
    timeZone: "Asia/Kolkata",
    totalRequests,
    requestsReceivedToday,
    requestsAcceptedToday,
    requestsOnHoldToday,
    requestsCompletedToday,
    requestsPendingEnd,
    overdueRequestsCount,
    paymentsReceivedTodayCount,
    totalPaymentAmountToday,
    requestsWithOutstandingBalanceCount,
    totalOutstandingAmount,
    totalHistoricalBilled,
    totalHistoricalCollected,
    statusBreakdown,
    immediateAttention: immediateAttention.slice(0, 10), // Top 10 immediate attention items
    completedTodayList,
    paymentsTodayList,
  };
}
