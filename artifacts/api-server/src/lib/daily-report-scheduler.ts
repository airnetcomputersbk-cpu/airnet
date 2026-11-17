import { db, reportSettingsTable, dailyReportLogsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  toISTDateString,
  ensureReportTablesExist,
  calculateDailyReportMetrics,
  DailyReportMetrics,
} from "./daily-report-engine";
import { sendDailyReportEmail, EmailDispatchResult, getSMTPConfigInfo } from "./daily-email-service";

let schedulerInterval: NodeJS.Timeout | null = null;
let lastProcessedDate: string | null = null;
let isJobRunning = false;

// Format current IST time as HH:mm (24-hour)
export function getISTCurrentTime24(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

// Compute next scheduled delivery timestamp in IST (default: 23:00 IST / 11:00 PM)
export function computeNextScheduledTime(scheduledTime: string = "23:00"): {
  nextRunISTDate: string;
  nextRunFormatted: string;
  isToday: boolean;
} {
  const todayIST = toISTDateString();
  const currentISTTime = getISTCurrentTime24();

  // If current IST time is earlier than scheduled time, it runs today; else tomorrow
  const runsToday = currentISTTime < scheduledTime;

  let targetDate = todayIST;
  if (!runsToday) {
    const d = new Date();
    // Add 24 hours to get tomorrow
    d.setHours(d.getHours() + 24);
    targetDate = toISTDateString(d);
  }

  const [hours, mins] = scheduledTime.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const timeFormatted = `${displayHours}:${mins.toString().padStart(2, "0")} ${period} IST`;

  return {
    nextRunISTDate: targetDate,
    nextRunFormatted: runsToday ? `Today at ${timeFormatted}` : `Tomorrow at ${timeFormatted}`,
    isToday: runsToday,
  };
}

// Check and trigger scheduled daily report
export async function checkAndRunScheduledReport(): Promise<void> {
  if (isJobRunning) return;

  try {
    await ensureReportTablesExist();

    const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
    const settings = settingsList[0];

    if (!settings || !settings.autoEnabled) {
      return; // Automated reports disabled by admin
    }

    const todayIST = toISTDateString();
    const currentISTTime = getISTCurrentTime24();
    const targetScheduledTime = settings.scheduledTime || "23:00";

    // Trigger at or past scheduled time (e.g. >= 23:00 / 11:00 PM IST) to prevent missing the run if the server starts or ticks slightly late
    const [targetHour, targetMin] = targetScheduledTime.split(":").map(Number);
    const [currHour, currMin] = currentISTTime.split(":").map(Number);
    const isPastOrAtSchedule =
      currHour > targetHour || (currHour === targetHour && currMin >= targetMin);

    if (isPastOrAtSchedule) {
      // Prevent duplicate run on the same day
      if (lastProcessedDate === todayIST || settings.lastRunDate === todayIST) {
        return;
      }

      isJobRunning = true;
      lastProcessedDate = todayIST;
      console.log(`[DailyReportScheduler] Triggering scheduled daily report for ${todayIST} at ${currentISTTime} IST...`);

      const targetRecipient = settings.recipientEmail || "rasoolahmed246@gmail.com";
      const sourceAdmin = settings.adminEmail || "airnetcomputersbk@gmail.com";
      const metrics = await calculateDailyReportMetrics(todayIST);
      const result = await sendDailyReportEmail(metrics, targetRecipient, false, sourceAdmin);

      console.log(`[DailyReportScheduler] Report dispatch finished to ${targetRecipient} from ${sourceAdmin} with status: ${result.deliveryStatus}`);
    }
  } catch (error) {
    console.error("[DailyReportScheduler] Error running scheduled report check:", error);
  } finally {
    isJobRunning = false;
  }
}

// Start background scheduler on server startup
export function startDailyReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log("[DailyReportScheduler] Initializing automated daily report scheduler (Asia/Kolkata, scheduled at 23:00 IST / 11:00 PM)...");

  // Run initial check after 5 seconds to catch up if restarted at exact time
  setTimeout(() => {
    checkAndRunScheduledReport().catch((err) => {
      console.error("[DailyReportScheduler] Initial check error:", err);
    });
  }, 5000);

  // Check every 45 seconds to guarantee matching the minute window reliably
  schedulerInterval = setInterval(() => {
    checkAndRunScheduledReport().catch((err) => {
      console.error("[DailyReportScheduler] Periodic interval error:", err);
    });
  }, 45 * 1000);
}

// Stop scheduler if needed
export function stopDailyReportScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

// Manual trigger helper
export async function triggerDailyReportNow(
  targetDate?: string,
  recipient?: string,
  adminEmail?: string
): Promise<EmailDispatchResult> {
  await ensureReportTablesExist();
  const date = targetDate || toISTDateString();

  const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
  const settings = settingsList[0];
  const targetRecipient = recipient || settings?.recipientEmail || "rasoolahmed246@gmail.com";
  const sourceAdmin = adminEmail || settings?.adminEmail || "airnetcomputersbk@gmail.com";

  console.log(`[DailyReportScheduler] Manual trigger requested for date ${date} to ${targetRecipient} from ${sourceAdmin}...`);
  const metrics = await calculateDailyReportMetrics(date);
  return await sendDailyReportEmail(metrics, targetRecipient, true, sourceAdmin);
}
