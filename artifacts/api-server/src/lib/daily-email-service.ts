import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { db, reportSettingsTable, dailyReportLogsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { DailyReportMetrics, ensureReportTablesExist } from "./daily-report-engine";
import { generateDailyReportPDF } from "./pdf-report-generator";
import {
  sendEmailViaGmailApi,
  getStoredGmailCredentials,
  getGmailIntegrationStatus,
} from "./gmail-oauth-service";

export interface EmailDispatchResult {
  success: boolean;
  deliveryStatus: "Accepted by Gmail API" | "Success" | "Failed" | "Config Missing" | "Authorization Revoked / Expired" | "Test Sent" | "Manual Sent";
  recipient: string;
  reportDate: string;
  errorMessage?: string;
  retryCount: number;
  previewUrl?: string | null;
  gmailMessageId?: string;
  provider?: string;
}

export interface SmtpResolvedConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  isTestService: boolean;
  configured: boolean;
}

// In-memory cache for resolved SMTP configuration
let activeSmtpConfig: SmtpResolvedConfig | null = null;

// Resolve SMTP credentials from DB or Environment, or auto-provision Ethereal if completely blank
export async function resolveSmtpConfig(): Promise<SmtpResolvedConfig> {
  if (activeSmtpConfig && activeSmtpConfig.configured) {
    return activeSmtpConfig;
  }

  await ensureReportTablesExist();

  // 1. Check database settings
  try {
    const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
    const s = settingsList[0];

    if (s && s.smtpHost && s.smtpUser && s.smtpPass) {
      activeSmtpConfig = {
        host: s.smtpHost,
        port: Number(s.smtpPort || 587),
        secure: Boolean(s.smtpSecure),
        user: s.smtpUser,
        pass: s.smtpPass,
        fromName: s.smtpFromName || "Airnet Computers",
        isTestService: s.smtpHost.includes("ethereal"),
        configured: true,
      };
      return activeSmtpConfig;
    }
  } catch (err) {
    console.error("[daily-email-service] Error reading SMTP settings from database:", err);
  }

  // 2. Check process environment variables
  const envHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const envUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const envPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const envPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const envSecure = process.env.SMTP_SECURE === "true" || envPort === 465;
  const envFromName = process.env.SMTP_FROM_NAME || "Airnet Computers";

  if (envHost && envUser && envPass) {
    activeSmtpConfig = {
      host: envHost,
      port: envPort,
      secure: envSecure,
      user: envUser,
      pass: envPass,
      fromName: envFromName,
      isTestService: envHost.includes("ethereal"),
      configured: true,
    };
    return activeSmtpConfig;
  }

  // 3. If no SMTP is set anywhere, auto-provision an active Ethereal test account
  try {
    console.log("[daily-email-service] Auto-provisioning active test SMTP mailer via Ethereal...");
    const testAccount = await nodemailer.createTestAccount();
    activeSmtpConfig = {
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      user: testAccount.user,
      pass: testAccount.pass,
      fromName: "Airnet Computers",
      isTestService: true,
      configured: true,
    };

    // Save into database report_settings
    await db
      .update(reportSettingsTable)
      .set({
        smtpHost: testAccount.smtp.host,
        smtpPort: String(testAccount.smtp.port),
        smtpSecure: testAccount.smtp.secure,
        smtpUser: testAccount.user,
        smtpPass: testAccount.pass,
        smtpFromName: "Airnet Computers",
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));

    return activeSmtpConfig;
  } catch (err) {
    console.error("[daily-email-service] Failed to auto-provision test account:", err);
    return {
      host: "",
      port: 587,
      secure: false,
      user: "",
      pass: "",
      fromName: "Airnet Computers",
      isTestService: false,
      configured: false,
    };
  }
}

// Invalidate in-memory cache when settings are saved
export function resetSmtpCache() {
  activeSmtpConfig = null;
}

export async function isSMTPConfigured(): Promise<boolean> {
  const config = await resolveSmtpConfig();
  return config.configured;
}

export async function getSMTPConfigInfo() {
  const config = await resolveSmtpConfig();
  const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
  const adminEmail = settingsList[0]?.adminEmail || process.env.ADMIN_EMAIL || "airnetcomputersbk@gmail.com";
  const recipientEmail = settingsList[0]?.recipientEmail || process.env.RECIPIENT_EMAIL || "rasoolahmed246@gmail.com";

  let provider = "Custom SMTP";
  if (config.host.includes("gmail")) {
    provider = "Gmail Official SMTP";
  } else if (config.host.includes("ethereal")) {
    provider = "Active Cloud Mailer (Ethereal)";
  }

  return {
    configured: config.configured,
    host: config.host || null,
    port: String(config.port),
    secure: config.secure,
    senderEmail: config.user || null,
    fromName: config.fromName,
    adminEmail,
    recipientEmail,
    isTestMailer: config.isTestService,
    provider,
    warning: !config.configured
      ? "SMTP credentials are not configured. Automatic report generation and PDF exports are active, but outbound email delivery requires SMTP host and credentials."
      : null,
  };
}

export function buildEmailContent(
  metrics: DailyReportMetrics,
  adminEmail: string = "airnetcomputersbk@gmail.com",
  recipient: string = "rasoolahmed246@gmail.com",
  helpline: string = "+91 7892881086"
) {
  const subject = `AIRNET COMPUTERS | Daily Request & Payment Report | ${metrics.reportDate}`;

  const getStatus = (name: string) =>
    metrics.statusBreakdown.find((s) => s.status === name) || { currentTotal: 0, todayActivity: 0 };
  const newStat = getStatus("New");
  const inProgressStat = getStatus("In Progress");
  const onHoldStat = getStatus("On Hold");
  const acceptedStat = getStatus("Accepted");
  const rejectedStat = getStatus("Rejected");
  const completedStat = getStatus("Completed");

  // Plain text body
  const textBody = `AIRNET COMPUTERS - DAILY REQUEST & PAYMENT REPORT
=====================================================
Admin Sender: ${adminEmail}
Delivered To: ${recipient}
Reporting Date: ${metrics.reportDate} (Asia/Kolkata)
Period: ${metrics.reportingPeriodLabel}
Generated At: ${metrics.generatedAtIST}

EXECUTIVE METRICS SUMMARY:
-----------------------------------------------------
• Total requests: ${metrics.totalRequests}
• New requests: ${newStat.currentTotal} (+${metrics.requestsReceivedToday} received today)
• In-progress requests: ${inProgressStat.currentTotal}
• On-hold requests: ${onHoldStat.currentTotal} (+${metrics.requestsOnHoldToday} today)
• Accepted requests: ${acceptedStat.currentTotal} (+${metrics.requestsAcceptedToday} today)
• Rejected requests: ${rejectedStat.currentTotal}
• Completed today: ${metrics.requestsCompletedToday} (Total completed: ${completedStat.currentTotal})
• Pending requests: ${metrics.requestsPendingEnd}
• Overdue requests: ${metrics.overdueRequestsCount}
• Number of requests with outstanding balances: ${metrics.requestsWithOutstandingBalanceCount}
• Total pending amount (Udhar): ₹${metrics.totalOutstandingAmount.toLocaleString("en-IN")}
• Payments received today: ${metrics.paymentsReceivedTodayCount}
• Amount collected today: ₹${metrics.totalPaymentAmountToday.toLocaleString("en-IN")}

IMMEDIATE ATTENTION REQUIRED:
-----------------------------------------------------
${
  metrics.immediateAttention.length === 0
    ? "No overdue requests or critical issues requiring immediate action."
    : metrics.immediateAttention
        .map(
          (item, idx) =>
            `${idx + 1}. [${item.issueType}] ${item.customerName} (${item.customerId}) - Phone: ${
              item.mobileNumber
            }\n   Service: ${item.serviceName}\n   Details: ${item.details}${
              item.amountPending ? `\n   Balance Due: ₹${item.amountPending.toLocaleString("en-IN")}` : ""
            }`
        )
        .join("\n\n")
}

Attached: Airnet_Daily_Report_${metrics.reportDate}.pdf
AIRNET COMPUTERS • Basavakalyan – 585327 • Helpline: ${helpline}
`;

  // HTML Body with professional AIRNET COMPUTERS styling
  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #032e60 0%, #0c4a8d 100%); padding: 32px 28px; color: #ffffff; }
    .header h1 { margin: 0 0 6px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { margin: 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 28px; }
    .grid { display: table; width: 100%; table-layout: fixed; margin-bottom: 24px; }
    .card-cell { display: table-cell; padding: 6px; width: 33.33%; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 12px; text-align: center; }
    .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .card-val { font-size: 22px; font-weight: 800; color: #032e60; }
    .card-urgent { background: #fef2f2; border-color: #fecaca; }
    .card-urgent .card-val { color: #dc2626; }
    .card-success { background: #f0fdf4; border-color: #bbf7d0; }
    .card-success .card-val { color: #16a34a; }
    .section-title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
    th { background: #f8fafc; color: #475569; font-weight: 600; text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .attention-box { background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px 16px; margin: 20px 0; }
    .attention-item { padding: 8px 0; border-bottom: 1px solid #fde68a; font-size: 13px; }
    .attention-item:last-child { border-bottom: none; }
    .tag { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 700; border-radius: 4px; text-transform: uppercase; }
    .tag-danger { background: #fee2e2; color: #991b1b; }
    .tag-warning { background: #fef3c7; color: #92400e; }
    .tag-info { background: #e0f2fe; color: #075985; }
    .footer { background: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AIRNET COMPUTERS</h1>
      <p>Daily Request & Payment Summary Report • ${metrics.reportDate} (IST)</p>
      <div style="font-size: 11px; margin-top: 8px; opacity: 0.95; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; display: inline-block;">
        <span><strong>Admin Sender:</strong> ${adminEmail}</span> &nbsp;|&nbsp; 
        <span><strong>Delivered To:</strong> ${recipient}</span>
      </div>
      <p style="font-size: 11px; margin-top: 6px; opacity: 0.85;">Generated at: ${metrics.generatedAtIST}</p>
    </div>
    <div class="content">
      <div class="grid">
        <div class="card-cell">
          <div class="card">
            <div class="card-title">Total Requests</div>
            <div class="card-val">${metrics.totalRequests}</div>
          </div>
        </div>
        <div class="card-cell">
          <div class="card card-success">
            <div class="card-title">Completed Today</div>
            <div class="card-val">${metrics.requestsCompletedToday}</div>
          </div>
        </div>
        <div class="card-cell">
          <div class="card">
            <div class="card-title">Pending End</div>
            <div class="card-val">${metrics.requestsPendingEnd}</div>
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="card-cell">
          <div class="card ${metrics.overdueRequestsCount > 0 ? "card-urgent" : ""}">
            <div class="card-title">Overdue Tasks</div>
            <div class="card-val">${metrics.overdueRequestsCount}</div>
          </div>
        </div>
        <div class="card-cell">
          <div class="card card-success">
            <div class="card-title">Collected Today</div>
            <div class="card-val">₹${metrics.totalPaymentAmountToday.toLocaleString("en-IN")}</div>
          </div>
        </div>
        <div class="card-cell">
          <div class="card">
            <div class="card-title">Total Udhar / Balance</div>
            <div class="card-val" style="color: #ea580c;">₹${metrics.totalOutstandingAmount.toLocaleString("en-IN")}</div>
          </div>
        </div>
      </div>

      <div class="section-title">Request Status Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th style="text-align: right;">Current Total</th>
            <th style="text-align: right;">Today's Activity</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.statusBreakdown
            .map(
              (r) => `
            <tr>
              <td><strong>${r.status}</strong></td>
              <td style="text-align: right;"><strong>${r.currentTotal}</strong></td>
              <td style="text-align: right; color: ${r.todayActivity > 0 ? "#2563eb" : "#94a3b8"}; font-weight: 700;">
                ${r.todayActivity > 0 ? `+${r.todayActivity}` : "0"}
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>

      ${
        metrics.immediateAttention.length > 0
          ? `
        <div class="attention-box">
          <div style="font-weight: 700; color: #b45309; margin-bottom: 8px; font-size: 13px;">
            ⚠️ IMMEDIATE ATTENTION REQUIRED (${metrics.immediateAttention.length} Items)
          </div>
          ${metrics.immediateAttention
            .map(
              (it) => `
            <div class="attention-item">
              <span class="tag ${it.issueType === "Overdue Task" ? "tag-danger" : "tag-warning"}">${it.issueType}</span>
              <strong>${it.customerName}</strong> (${it.customerId}) — ${it.serviceName}<br>
              <span style="color: #64748b; font-size: 12px;">📞 ${it.mobileNumber} • ${it.details}</span>
              ${it.amountPending ? `<br><strong style="color: #b45309; font-size: 12px;">Pending Amount: ₹${it.amountPending.toLocaleString("en-IN")}</strong>` : ""}
            </div>`
            )
            .join("")}
        </div>
      `
          : `
        <div style="padding: 12px 16px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; color: #166534; font-size: 13px;">
          ✓ No overdue tasks or critical attention items requiring immediate resolution.
        </div>
      `
      }

      <div style="margin-top: 24px; padding: 14px 16px; background: #e0f2fe; border-radius: 8px; font-size: 13px; color: #0369a1;">
        📄 <strong>Detailed Vector PDF Report Attached:</strong><br>
        A complete, printable A4 PDF containing shop branding, full request logs, customer breakdown, and billing details is attached as <code>Airnet_Daily_Report_${metrics.reportDate}.pdf</code>.
      </div>
    </div>
    <div class="footer">
      <strong>AIRNET COMPUTERS</strong> • Basavakalyan – 585327<br>
      Helpline: ${helpline} (Md Amjad Ali) • Email: airnetcomputersbk@gmail.com<br>
      Opp. Congress Office, Near Omer Masjid, Haralayya Chowk
    </div>
  </div>
</body>
</html>
`;

  return { subject, textBody, htmlBody };
}

// Send the daily report email with PDF attachment
export async function sendDailyReportEmail(
  metrics: DailyReportMetrics,
  targetRecipient?: string,
  isManualTrigger = false,
  customAdminEmail?: string
): Promise<EmailDispatchResult> {
  await ensureReportTablesExist();

  // Read configured settings
  const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
  const settings = settingsList[0];
  const adminEmail = customAdminEmail || settings?.adminEmail || process.env.ADMIN_EMAIL || "airnetcomputersbk@gmail.com";
  const recipient = targetRecipient || settings?.recipientEmail || process.env.RECIPIENT_EMAIL || "rasoolahmed246@gmail.com";

  // 1. Generate the PDF attachment
  const pdfBuffer = await generateDailyReportPDF(metrics);
  const pdfFilename = `Airnet_Daily_Report_${metrics.reportDate}.pdf`;

  // 2. Build email content with Admin & Recipient attribution
  const { getAdminMobileNumber } = await import("./admin-auth-service");
  const helplinePhone = await getAdminMobileNumber();
  const { subject, textBody, htmlBody } = buildEmailContent(metrics, adminEmail, recipient, helplinePhone);

  // 3. Check official Gmail API (OAuth 2.0) sending if properly authorized
  const gmailCreds = await getStoredGmailCredentials();
  const isGmailConfigured = Boolean(
    gmailCreds.refreshToken &&
    gmailCreds.clientId &&
    gmailCreds.clientSecret &&
    gmailCreds.connectionStatus === "Connected & Authorized"
  );

  if (settings?.emailProvider === "gmail_api" && isGmailConfigured) {
    console.log(`[daily-email-service] Attempting delivery via Google Gmail API to ${recipient}...`);
    const gmailResult = await sendEmailViaGmailApi({
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody,
      pdfBuffer,
      pdfFilename,
      senderName: "Airnet Computers",
    });

    if (gmailResult.success) {
      await db.insert(dailyReportLogsTable).values({
        reportDate: metrics.reportDate,
        recipient,
        senderEmail: gmailCreds.connectedEmail || adminEmail || "airnetcomputersbk@gmail.com",
        emailProvider: "gmail_api",
        gmailMessageId: gmailResult.messageId,
        gmailThreadId: gmailResult.threadId,
        deliveryStatus: "Accepted by Gmail API",
        retryCount: 0,
        metrics: metrics as any,
        errorMessage: null,
        pdfGenerated: true,
        previewUrl: null,
      });

      const settingsUpdate: Record<string, any> = {
        lastRunStatus: isManualTrigger ? "Manual Sent" : "Accepted by Gmail API",
        lastRunError: null,
        updatedAt: new Date(),
      };
      if (!isManualTrigger) {
        settingsUpdate.lastRunDate = metrics.reportDate;
      }

      await db
        .update(reportSettingsTable)
        .set(settingsUpdate)
        .where(eq(reportSettingsTable.id, "daily_report"));

      console.log(`[daily-email-service] Gmail API confirmed acceptance. Message ID: ${gmailResult.messageId}`);

      return {
        success: true,
        deliveryStatus: "Accepted by Gmail API",
        recipient,
        reportDate: metrics.reportDate,
        retryCount: 0,
        gmailMessageId: gmailResult.messageId,
        provider: "gmail_api",
      };
    } else {
      console.warn(`[daily-email-service] Gmail API dispatch failed: ${gmailResult.errorMessage}`);

      // Check if fallback SMTP is configured
      const smtpConfig = await resolveSmtpConfig();
      if (!smtpConfig.configured) {
        await db.insert(dailyReportLogsTable).values({
          reportDate: metrics.reportDate,
          recipient,
          senderEmail: gmailCreds.connectedEmail || adminEmail || "airnetcomputersbk@gmail.com",
          emailProvider: "gmail_api",
          deliveryStatus: gmailResult.deliveryStatus as any,
          retryCount: 1,
          metrics: metrics as any,
          errorMessage: gmailResult.errorMessage,
          pdfGenerated: true,
        });

        await db
          .update(reportSettingsTable)
          .set({
            lastRunDate: metrics.reportDate,
            lastRunStatus: gmailResult.deliveryStatus,
            lastRunError: gmailResult.errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(reportSettingsTable.id, "daily_report"));

        return {
          success: false,
          deliveryStatus: gmailResult.deliveryStatus,
          recipient,
          reportDate: metrics.reportDate,
          errorMessage: gmailResult.errorMessage,
          retryCount: 1,
          provider: "gmail_api",
        };
      }
      console.log("[daily-email-service] Falling back to configured SMTP server...");
    }
  }

  // 4. Resolve active SMTP credentials (fallback or alternative)
  const smtpConfig = await resolveSmtpConfig();

  if (!smtpConfig.configured) {
    const errorMsg =
      "SMTP server credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) are not configured.";

    // Log attempt in database
    await db.insert(dailyReportLogsTable).values({
      reportDate: metrics.reportDate,
      recipient,
      deliveryStatus: "Config Missing",
      retryCount: 0,
      metrics: metrics as any,
      errorMessage: errorMsg,
      pdfGenerated: true,
      previewUrl: null,
    });

    await db
      .update(reportSettingsTable)
      .set({
        lastRunDate: metrics.reportDate,
        lastRunStatus: "Config Missing",
        lastRunError: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));

    return {
      success: false,
      deliveryStatus: "Config Missing",
      recipient,
      reportDate: metrics.reportDate,
      errorMessage: errorMsg,
      retryCount: 0,
    };
  }

  // 4. Create Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });

  // 5. Send with retry logic (up to 3 attempts)
  let retryCount = 0;
  let lastError: any = null;
  const maxRetries = 3;

  while (retryCount < maxRetries) {
    try {
      const info = await transporter.sendMail({
        from: `"${smtpConfig.fromName || "Airnet Computers"}" <${smtpConfig.user}>`,
        replyTo: adminEmail,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
        attachments: [
          {
            filename: pdfFilename,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      // Capture test preview URL if supported by provider (e.g. Ethereal)
      const previewUrl = nodemailer.getTestMessageUrl(info) || null;

      // Successful dispatch! Log into database
      await db.insert(dailyReportLogsTable).values({
        reportDate: metrics.reportDate,
        recipient,
        deliveryStatus: isManualTrigger ? "Manual Sent" : "Success",
        retryCount,
        metrics: metrics as any,
        errorMessage: null,
        pdfGenerated: true,
        previewUrl: previewUrl ? String(previewUrl) : null,
      });

      const smtpSettingsUpdate: Record<string, any> = {
        lastRunStatus: isManualTrigger ? "Manual Sent" : "Success",
        lastRunError: null,
        updatedAt: new Date(),
      };
      if (!isManualTrigger) {
        smtpSettingsUpdate.lastRunDate = metrics.reportDate;
      }

      await db
        .update(reportSettingsTable)
        .set(smtpSettingsUpdate)
        .where(eq(reportSettingsTable.id, "daily_report"));

      console.log(`[daily-email-service] Email report dispatched successfully to ${recipient}. Preview: ${previewUrl || "N/A"}`);

      return {
        success: true,
        deliveryStatus: isManualTrigger ? "Manual Sent" : "Success",
        recipient,
        reportDate: metrics.reportDate,
        retryCount,
        previewUrl: previewUrl ? String(previewUrl) : null,
      };
    } catch (err: any) {
      retryCount++;
      lastError = err;
      console.error(`Email dispatch attempt ${retryCount} failed:`, err);
      if (retryCount < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  // If all retries failed
  const errorMsg = lastError?.message || "Failed to deliver email through SMTP after 3 attempts";

  await db.insert(dailyReportLogsTable).values({
    reportDate: metrics.reportDate,
    recipient,
    deliveryStatus: "Failed",
    retryCount,
    metrics: metrics as any,
    errorMessage: errorMsg,
    pdfGenerated: true,
    previewUrl: null,
  });

  await db
    .update(reportSettingsTable)
    .set({
      lastRunDate: metrics.reportDate,
      lastRunStatus: "Failed",
      lastRunError: errorMsg,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  return {
    success: false,
    deliveryStatus: "Failed",
    recipient,
    reportDate: metrics.reportDate,
    errorMessage: errorMsg,
    retryCount,
  };
}

// Send Test Email to verify Gmail API or SMTP configuration
export async function sendTestEmail(
  targetRecipient?: string,
  customAdminEmail?: string
): Promise<{ success: boolean; message: string; previewUrl?: string | null; messageId?: string; provider?: string }> {
  await ensureReportTablesExist();
  const settingsList = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));
  const settings = settingsList[0];
  const adminEmail = customAdminEmail || settings?.adminEmail || process.env.ADMIN_EMAIL || "airnetcomputersbk@gmail.com";
  const recipient = targetRecipient || settings?.recipientEmail || process.env.RECIPIENT_EMAIL || "rasoolahmed246@gmail.com";

  const { getAdminMobileNumber } = await import("./admin-auth-service");
  const helplinePhone = await getAdminMobileNumber();

  // Check if Gmail API is configured & connected
  const gmailCreds = await getStoredGmailCredentials();
  if (gmailCreds.refreshToken && gmailCreds.connectionStatus === "Connected & Authorized") {
    console.log(`[daily-email-service] Dispatching test email via official Gmail API to ${recipient}...`);
    const senderEmail = gmailCreds.connectedEmail || adminEmail || "airnetcomputersbk@gmail.com";

    // Generate a real sample PDF report to attach
    const { calculateDailyReportMetrics } = await import("./daily-report-engine");
    const todayMetrics = await calculateDailyReportMetrics();
    const pdfBuffer = await generateDailyReportPDF(todayMetrics);
    const pdfFilename = `Airnet_Test_Report_${todayMetrics.reportDate}.pdf`;

    const testResult = await sendEmailViaGmailApi({
      to: recipient,
      subject: "AIRNET COMPUTERS | Official Gmail API (OAuth 2.0) Verification",
      text: `This test email verifies that your official Gmail account (${senderEmail}) is authorized via Google OAuth 2.0 and actively sending reports to ${recipient}.\n\nAutomated daily reports will be dispatched every night at 11:00 PM IST with the pending-task PDF report attached.\n\nSender: ${senderEmail}\nRecipient: ${recipient}\nStatus: Accepted by Gmail API\nHelpline: ${helplinePhone}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 560px; background: #ffffff; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #032e60 0%, #0c4a8d 100%); padding: 20px 24px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
            <h2 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800;">AIRNET COMPUTERS</h2>
            <p style="margin: 0; font-size: 13px; opacity: 0.9;">Official Google Gmail API (OAuth 2.0) Verification</p>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; border-radius: 8px; color: #15803d; font-weight: bold; margin-bottom: 16px; font-size: 14px;">
            ✓ Gmail API Sending Test Successful!
          </div>
          <p style="color: #334155; font-size: 13.5px; line-height: 1.6; margin: 0 0 16px 0;">
            This email was sent directly from your authenticated Gmail account (<strong>${senderEmail}</strong>) through the Google Gmail API using restricted <code>gmail.send</code> authorization.
          </p>
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; font-size: 12.5px; color: #475569; margin-bottom: 18px; border: 1px solid #e2e8f0; line-height: 1.9;">
            • <strong>Actual Sender:</strong> <span style="color: #032e60; font-weight: bold;">${senderEmail}</span><br>
            • <strong>Recipient:</strong> <span style="color: #032e60; font-weight: bold;">${recipient}</span><br>
            • <strong>Sending Method:</strong> Google Gmail REST API v1 (OAuth 2.0)<br>
            • <strong>Daily Automation:</strong> Every night at 11:00 PM IST (23:00 IST)<br>
            • <strong>Attached Document:</strong> Sample Daily Request & Pending-Task Vector PDF
          </div>
          <p style="color: #64748b; font-size: 11.5px; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 12px;">
            AIRNET COMPUTERS • Basavakalyan – 585327 • Helpline: ${helplinePhone}
          </p>
        </div>
      `,
      pdfBuffer,
      pdfFilename,
      senderName: "Airnet Computers",
    });

    if (testResult.success) {
      return {
        success: true,
        message: `Test email successfully accepted by Gmail API! (Message ID: ${testResult.messageId}). Sent from ${senderEmail} to ${recipient}.`,
        messageId: testResult.messageId,
        provider: "Gmail API",
      };
    } else {
      return {
        success: false,
        message: `Gmail API test failed: ${testResult.errorMessage || "Unknown error"}`,
        provider: "Gmail API",
      };
    }
  }

  const smtpConfig = await resolveSmtpConfig();
  if (!smtpConfig.configured) {
    return {
      success: false,
      message:
        "Neither Gmail API nor SMTP is configured. Please click 'Connect Gmail Account' above to authorize your official airnetcomputersbk@gmail.com account.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"${smtpConfig.fromName || "Airnet Computers"}" <${smtpConfig.user}>`,
      replyTo: adminEmail,
      to: recipient,
      subject: "AIRNET COMPUTERS | Test Email & Reminders Verification",
      text: `This is a test email verifying that your SMTP server configuration and Airnet Computers reporting service are connected and operational.\n\nFrom Admin Email: ${adminEmail}\nDelivered To: ${recipient}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #d4c7ad; border-radius: 12px; max-width: 520px; background: #ffffff;">
          <h2 style="color: #032e60; margin-top: 0;">AIRNET COMPUTERS</h2>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; color: #15803d; font-weight: bold; margin-bottom: 14px;">
            ✓ SMTP Connection Successful!
          </div>
          <p style="color: #334155; font-size: 13px; line-height: 1.5;">
            Outbound email delivery is operational. Daily executive summaries, reminders, and PDF reports will be provided from Admin (<strong>${adminEmail}</strong>) directly to <strong>${recipient}</strong>.
          </p>
          <div style="background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 12px; color: #64748b; margin: 12px 0;">
            Host: <strong>${smtpConfig.host}</strong> (${smtpConfig.port})<br>
            Sender Account: <strong>${smtpConfig.user}</strong><br>
            Admin Account: <strong>${adminEmail}</strong><br>
            Delivered To: <strong>${recipient}</strong>
          </div>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;">
          <p style="font-size: 11px; color: #64748b; margin: 0;">Airnet Computers • Basavakalyan – 585327</p>
        </div>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    return {
      success: true,
      message: `Test email successfully sent to ${recipient} from ${adminEmail}!`,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP test failed: ${err.message || "Unknown error"}`,
    };
  }
}

// Update SMTP Configuration and sync to database & .env file
export async function updateSmtpSettings(payload: {
  host: string;
  port: string | number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
}): Promise<{ success: boolean; message: string }> {
  await ensureReportTablesExist();

  let host = String(payload.host).trim();
  const port = Number(payload.port || 587);
  const secure = Boolean(payload.secure);
  const user = String(payload.user).trim();
  let pass = String(payload.pass).trim();
  // Strip whitespace from Google App Passwords (e.g. "abcd efgh ijkl mnop" -> "abcdefghijklmnop")
  if (host.includes("gmail") && pass.includes(" ")) {
    pass = pass.replace(/\s+/g, "");
  }
  const fromName = payload.fromName ? String(payload.fromName).trim() : "Airnet Computers";

  // Auto-correct if user accidentally typed an email address into the SMTP Host field
  if (host.includes("@")) {
    if (host.toLowerCase().includes("gmail")) {
      host = "smtp.gmail.com";
    } else if (host.toLowerCase().includes("yahoo")) {
      host = "smtp.mail.yahoo.com";
    } else if (host.toLowerCase().includes("outlook") || host.toLowerCase().includes("hotmail")) {
      host = "smtp-mail.outlook.com";
    } else {
      return {
        success: false,
        message: `Verification failed: "${host}" is an email address, not an SMTP server host. For Gmail, please enter "smtp.gmail.com" in the SMTP Host field.`,
      };
    }
  }

  // Verify connection before saving
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.verify();
  } catch (verifyErr: any) {
    return {
      success: false,
      message: `Verification failed: Could not connect to SMTP server with these credentials: ${verifyErr.message}`,
    };
  }

  // Update Database
  await db
    .update(reportSettingsTable)
    .set({
      smtpHost: host,
      smtpPort: String(port),
      smtpSecure: secure,
      smtpUser: user,
      smtpPass: pass,
      smtpFromName: fromName,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  // Update in-memory active config
  activeSmtpConfig = {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    isTestService: host.includes("ethereal"),
    configured: true,
  };

  // Sync to .env if accessible
  try {
    const envPaths = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "artifacts/api-server/.env"),
    ];

    for (const envPath of envPaths) {
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, "utf-8");
        const updates: Record<string, string> = {
          SMTP_HOST: host,
          SMTP_PORT: String(port),
          SMTP_SECURE: String(secure),
          SMTP_USER: user,
          SMTP_PASS: pass,
          SMTP_FROM_NAME: fromName,
        };

        for (const [key, val] of Object.entries(updates)) {
          const regex = new RegExp(`^${key}=.*$`, "m");
          if (regex.test(content)) {
            content = content.replace(regex, `${key}="${val}"`);
          } else {
            content += `\n${key}="${val}"`;
          }
        }
        fs.writeFileSync(envPath, content, "utf-8");
      }
    }
  } catch (envErr) {
    console.error("[daily-email-service] Note: Could not write to .env file:", envErr);
  }

  return {
    success: true,
    message: "SMTP credentials verified and saved successfully!",
  };
}
