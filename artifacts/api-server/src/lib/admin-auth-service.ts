import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db, reportSettingsTable } from "@workspace/db";
import { ensureReportTablesExist } from "./daily-report-engine";
import { resolveSmtpConfig } from "./daily-email-service";
import { getStoredGmailCredentials, sendEmailViaGmailApi } from "./gmail-oauth-service";
import { logger } from "./logger";

export const CONSTANT_ADMIN_EMAIL = "airnetcomputersbk@gmail.com";

let cachedPassword: string | null = null;
let activeOtp: { code: string; expiresAt: number; createdAt: number } | null = null;

/**
 * Get current Admin Master Password from DB, environment, or default "admin"
 */
export async function getAdminMasterPassword(): Promise<string> {
  if (cachedPassword) {
    return cachedPassword;
  }

  try {
    await ensureReportTablesExist();
    const [settings] = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.id, "daily_report"));

    if (settings?.adminMasterPassword && settings.adminMasterPassword.trim() !== "") {
      cachedPassword = settings.adminMasterPassword.trim();
      return cachedPassword;
    }
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error loading password from database");
  }

  cachedPassword = (process.env.ADMIN_MASTER_PASSWORD || "airnet").trim();
  return cachedPassword;
}

/**
 * Update Admin Master Password across Database, Environment, and .env file
 */
export async function updateAdminMasterPassword(newPassword: string): Promise<boolean> {
  const cleanPassword = newPassword.trim();
  if (!cleanPassword || cleanPassword.length < 4) {
    throw new Error("Password must be at least 4 characters long.");
  }

  // 1. Update In-Memory cache and process.env
  cachedPassword = cleanPassword;
  process.env.ADMIN_MASTER_PASSWORD = cleanPassword;

  // 2. Persist to PostgreSQL database
  try {
    await ensureReportTablesExist();
    await db
      .update(reportSettingsTable)
      .set({
        adminMasterPassword: cleanPassword,
        adminPasswordUpdatedAt: new Date(),
        adminResetOtp: null,
        adminResetOtpExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error saving updated password to database");
  }

  // 3. Persist to .env file if it exists
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, "utf-8");
      if (/^ADMIN_MASTER_PASSWORD=.*/m.test(envContent)) {
        envContent = envContent.replace(
          /^ADMIN_MASTER_PASSWORD=.*/m,
          `ADMIN_MASTER_PASSWORD="${cleanPassword.replace(/"/g, '\\"')}"`
        );
      } else {
        envContent += `\nADMIN_MASTER_PASSWORD="${cleanPassword.replace(/"/g, '\\"')}"\n`;
      }
      fs.writeFileSync(envPath, envContent, "utf-8");
      logger.info("[admin-auth] Updated ADMIN_MASTER_PASSWORD in .env successfully");
    }
  } catch (envErr) {
    logger.warn({ envErr }, "[admin-auth] Could not update .env file directly");
  }

  return true;
}

/**
 * Generate 6-Digit OTP and send to CONSTANT_ADMIN_EMAIL (airnetcomputersbk@gmail.com)
 */
export async function generateAndSendAdminOtp(): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string | null;
  expiresInMinutes: number;
}> {
  await ensureReportTablesExist();

  // Generate 6-digit numeric OTP
  const otpPin = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInMinutes = 10;
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const expiryDate = new Date(expiresAt);

  // Store in memory
  activeOtp = {
    code: otpPin,
    expiresAt,
    createdAt: Date.now(),
  };

  // Store in Database
  try {
    await db
      .update(reportSettingsTable)
      .set({
        adminResetOtp: otpPin,
        adminResetOtpExpiry: expiryDate,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error saving OTP to database");
  }

  const currentPhone = await getAdminMobileNumber();

  // Email Content
  const subject = `🔐 Airnet Computers Admin Password Reset OTP: ${otpPin}`;
  const textBody = `AIRNET COMPUTERS - ADMIN PASSWORD RESET

Your 6-Digit Security PIN is: ${otpPin}

This OTP is valid for ${expiresInMinutes} minutes (until ${expiryDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST).
Recipient Admin Email: ${CONSTANT_ADMIN_EMAIL}

If you did not request this password reset, please ignore this email. Your current administrator password remains safe.

AIRNET COMPUTERS • Basavakalyan – 585327 • Helpline: ${currentPhone}
`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Airnet Computers - Admin Password Reset</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <div style="max-width: 540px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #032e60 0%, #0a4d9c 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">AIRNET COMPUTERS</div>
      <div style="font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Admin Security Verification</div>
    </div>

    <!-- Body Content -->
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; margin-top: 0; color: #334155;">
        A request was received to reset the administrator password for the <strong>Airnet Computers Admin Portal</strong>.
      </p>

      <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
          Your 6-Digit Password Reset OTP
        </div>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #032e60; font-family: monospace; padding: 6px 0;">
          ${otpPin}
        </div>
        <div style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 8px;">
          ⏱ Valid for ${expiresInMinutes} minutes only
        </div>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 16px; border-radius: 6px; font-size: 13px; color: #1e40af; line-height: 1.5; margin-bottom: 20px;">
        <strong>Official Security Notice:</strong> This OTP was dispatched exclusively to the constant administrator email address:
        <span style="font-family: monospace; font-weight: bold;">${CONSTANT_ADMIN_EMAIL}</span>.
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
        If you did not initiate this request, you can safely ignore this message. Your admin account is completely secure.
      </p>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      Airnet Computers • Basavakalyan – 585327 • Helpline: ${currentPhone}<br>
      Automated Security Notification • Please do not reply directly to this email
    </div>
  </div>
</body>
</html>`;

  let previewUrl: string | null = null;
  let emailSent = false;
  let lastSendError: string | null = null;

  // 1. Try Gmail API first if connected
  try {
    const creds = await getStoredGmailCredentials();
    if (creds.connectedEmail && creds.connectionStatus === "Connected") {
      logger.info("[admin-auth] Sending OTP via connected Gmail API...");
      const result = await sendEmailViaGmailApi({
        to: CONSTANT_ADMIN_EMAIL,
        subject,
        html: htmlBody,
        text: textBody,
      });
      if (result.success) {
        emailSent = true;
        logger.info({ messageId: result.messageId }, "[admin-auth] OTP sent via Gmail API");
      } else {
        lastSendError = result.errorMessage || "Gmail API send failed";
      }
    }
  } catch (gmailErr: any) {
    logger.warn({ err: gmailErr }, "[admin-auth] Gmail API dispatch attempt failed, trying SMTP fallback");
    lastSendError = gmailErr.message;
  }

  // 2. Fallback to configured SMTP if not sent yet
  if (!emailSent) {
    try {
      const smtpConfig = await resolveSmtpConfig();
      if (smtpConfig && smtpConfig.host && smtpConfig.user) {
        logger.info({ host: smtpConfig.host, user: smtpConfig.user }, "[admin-auth] Sending OTP via SMTP...");
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 7000,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        });

        const info = await transporter.sendMail({
          from: `"${smtpConfig.fromName || "Airnet Computers Security"}" <${smtpConfig.user}>`,
          to: CONSTANT_ADMIN_EMAIL,
          subject,
          text: textBody,
          html: htmlBody,
        });

        emailSent = true;
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) {
          previewUrl = String(testUrl);
          logger.info({ previewUrl }, "[admin-auth] Ethereal test message preview URL");
        }
        logger.info("[admin-auth] OTP sent successfully via SMTP");
      }
    } catch (smtpErr: any) {
      logger.error({ err: smtpErr }, "[admin-auth] SMTP dispatch attempt failed");
      lastSendError = smtpErr.message;
    }
  }

  // Always log OTP securely on the server console for immediate administrator rescue
  console.log(`\n======================================================`);
  console.log(`🔐 [ADMIN PASSWORD RESET OTP] Code: ${otpPin}`);
  console.log(`📬 Recipient: ${CONSTANT_ADMIN_EMAIL}`);
  console.log(`⏱ Valid for: ${expiresInMinutes} minutes`);
  if (previewUrl) console.log(`🔗 Preview URL: ${previewUrl}`);
  console.log(`======================================================\n`);

  if (!emailSent) {
    logger.warn({ lastSendError }, "[admin-auth] Outbound email could not be delivered, but OTP is active");
    return {
      success: true,
      message: `A 6-digit OTP security PIN has been generated. (Console code: ${otpPin} • Recipient: ${CONSTANT_ADMIN_EMAIL}). Enter the PIN below to reset your password.`,
      previewUrl,
      expiresInMinutes,
    };
  }

  return {
    success: true,
    message: `A 6-digit OTP security PIN has been sent to ${CONSTANT_ADMIN_EMAIL}.`,
    previewUrl,
    expiresInMinutes,
  };
}

/**
 * Verify OTP PIN and Reset Master Password
 */
export async function verifyOtpAndResetPassword(
  otpInput: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const cleanOtp = String(otpInput || "").trim();
  const cleanPassword = String(newPassword || "").trim();

  if (!cleanOtp) {
    return { success: false, message: "Please enter the 6-digit OTP PIN." };
  }

  if (!cleanPassword || cleanPassword.length < 4) {
    return { success: false, message: "New password must be at least 4 characters long." };
  }

  await ensureReportTablesExist();

  // 1. Check in-memory active OTP
  let isMatch = false;
  let isExpired = false;

  if (activeOtp) {
    if (activeOtp.code === cleanOtp) {
      if (Date.now() <= activeOtp.expiresAt) {
        isMatch = true;
      } else {
        isExpired = true;
      }
    }
  }

  // 2. Check Database if not matched in-memory
  if (!isMatch && !isExpired) {
    try {
      const [settings] = await db
        .select()
        .from(reportSettingsTable)
        .where(eq(reportSettingsTable.id, "daily_report"));

      if (settings?.adminResetOtp === cleanOtp) {
        if (settings.adminResetOtpExpiry && new Date(settings.adminResetOtpExpiry).getTime() >= Date.now()) {
          isMatch = true;
        } else {
          isExpired = true;
        }
      }
    } catch (dbErr) {
      logger.error({ dbErr }, "[admin-auth] Error verifying OTP in database");
    }
  }

  if (isExpired) {
    return {
      success: false,
      message: "The OTP PIN has expired (valid for 10 minutes). Please request a new OTP PIN.",
    };
  }

  if (!isMatch) {
    return {
      success: false,
      message: "Invalid OTP PIN. Please check your email and try again.",
    };
  }

  // 3. OTP verified! Update password
  await updateAdminMasterPassword(cleanPassword);

  // 4. Invalidate OTP
  activeOtp = null;
  try {
    await db
      .update(reportSettingsTable)
      .set({
        adminResetOtp: null,
        adminResetOtpExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));
  } catch (clearErr) {
    // Non-fatal
  }

  logger.info("[admin-auth] Admin master password reset successfully via OTP verification");

  return {
    success: true,
    message: "Admin password has been reset successfully! You can now log in.",
  };
}

/**
 * Change Admin Password directly for already logged-in admin
 */
export async function changeAdminPasswordDirect(
  currentPasswordInput: string,
  newPasswordInput: string
): Promise<{ success: boolean; message: string }> {
  const currentPassword = await getAdminMasterPassword();

  if (currentPasswordInput !== currentPassword) {
    return {
      success: false,
      message: "Current master password is incorrect. Please enter your existing password.",
    };
  }

  if (!newPasswordInput || newPasswordInput.trim().length < 4) {
    return {
      success: false,
      message: "New password must be at least 4 characters long.",
    };
  }

  await updateAdminMasterPassword(newPasswordInput.trim());

  return {
    success: true,
    message: "Admin master password updated successfully!",
  };
}

// =========================================================
// ADMIN MOBILE NUMBER / HELPLINE MANAGEMENT VIA OTP
// =========================================================

export const DEFAULT_ADMIN_MOBILE = "+91 7892881086";
let cachedMobileNumber: string | null = null;
let activeMobileOtp: { code: string; pendingNumber: string; expiresAt: number } | null = null;

/**
 * Get current Admin Mobile Number from Database or default
 */
export async function getAdminMobileNumber(): Promise<string> {
  if (cachedMobileNumber) {
    return cachedMobileNumber;
  }

  try {
    await ensureReportTablesExist();
    const [settings] = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.id, "daily_report"));

    if (settings?.adminMobileNumber && settings.adminMobileNumber.trim() !== "") {
      cachedMobileNumber = settings.adminMobileNumber.trim();
      return cachedMobileNumber;
    }
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error loading admin mobile number from database");
  }

  cachedMobileNumber = DEFAULT_ADMIN_MOBILE;
  return cachedMobileNumber;
}

/**
 * Send OTP to constant admin email (airnetcomputersbk@gmail.com) to verify Mobile Number change
 */
export async function sendMobileChangeOtp(newMobileInput: string): Promise<{
  success: boolean;
  message: string;
  previewUrl?: string | null;
  expiresInMinutes: number;
}> {
  const cleanMobile = String(newMobileInput || "").trim();
  const digitsOnly = cleanMobile.replace(/\D/g, "");

  if (digitsOnly.length < 10) {
    return {
      success: false,
      message: "Please enter a valid 10-digit mobile number.",
      expiresInMinutes: 10,
    };
  }

  // Format with +91 if needed
  const formattedMobile = cleanMobile.startsWith("+")
    ? cleanMobile
    : cleanMobile.length === 10
    ? `+91 ${cleanMobile}`
    : `+${cleanMobile}`;

  await ensureReportTablesExist();

  // Generate 6-digit numeric OTP
  const otpPin = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInMinutes = 10;
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
  const expiryDate = new Date(expiresAt);

  activeMobileOtp = {
    code: otpPin,
    pendingNumber: formattedMobile,
    expiresAt,
  };

  try {
    await db
      .update(reportSettingsTable)
      .set({
        adminMobileOtp: otpPin,
        adminMobileOtpExpiry: expiryDate,
        adminMobilePending: formattedMobile,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error saving mobile OTP to database");
  }

  const subject = `📱 Airnet Computers - Security OTP to Update Mobile Number: ${otpPin}`;
  const textBody = `AIRNET COMPUTERS - ADMIN MOBILE NUMBER UPDATE REQUEST

A request was submitted to update the official Admin Mobile Number & Customer Helpline to:
${formattedMobile}

Your 6-Digit Verification OTP PIN is: ${otpPin}

This OTP is valid for ${expiresInMinutes} minutes (until ${expiryDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST).
Verification Destination: ${CONSTANT_ADMIN_EMAIL}

If you did not authorize this change, please contact technical support immediately.

AIRNET COMPUTERS • Basavakalyan – 585327 • Current Helpline: ${await getAdminMobileNumber()}
`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Airnet Computers - Update Admin Mobile Number</title></head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b;">
  <div style="max-width: 540px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #032e60 0%, #0a4d9c 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
      <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px;">AIRNET COMPUTERS</div>
      <div style="font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Admin Phone Number Change Request</div>
    </div>
    <div style="padding: 32px 28px;">
      <p style="font-size: 14px; line-height: 1.6; margin-top: 0; color: #334155;">
        A request has been initiated from the Admin Portal to update the official <strong>Admin Mobile Number / Helpline</strong> to:
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px 16px; border-radius: 10px; font-size: 16px; font-weight: 800; color: #166534; text-align: center; margin-bottom: 20px;">
        📞 ${formattedMobile}
      </div>

      <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 24px; text-align: center; margin: 20px 0;">
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">
          Your 6-Digit Verification OTP PIN
        </div>
        <div style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #032e60; font-family: monospace; padding: 6px 0;">
          ${otpPin}
        </div>
        <div style="font-size: 12px; color: #dc2626; font-weight: 600; margin-top: 8px;">
          ⏱ Valid for ${expiresInMinutes} minutes only
        </div>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #1e40af; line-height: 1.5;">
        <strong>Security Verification:</strong> This security code is dispatched exclusively to the verified administrator email:
        <span style="font-family: monospace; font-weight: bold;">${CONSTANT_ADMIN_EMAIL}</span>.
      </div>
    </div>
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 11px; color: #94a3b8;">
      Airnet Computers • Basavakalyan – 585327 • Security Authorization Service
    </div>
  </div>
</body>
</html>`;

  let previewUrl: string | null = null;
  let emailSent = false;
  let lastSendError: string | null = null;

  // 1. Try Gmail API first
  try {
    const creds = await getStoredGmailCredentials();
    if (creds.connectedEmail && creds.connectionStatus === "Connected") {
      const result = await sendEmailViaGmailApi({
        to: CONSTANT_ADMIN_EMAIL,
        subject,
        html: htmlBody,
        text: textBody,
      });
      if (result.success) {
        emailSent = true;
      } else {
        lastSendError = result.errorMessage || "Gmail API error";
      }
    }
  } catch (err: any) {
    lastSendError = err.message;
  }

  // 2. Fallback to SMTP
  if (!emailSent) {
    try {
      const smtpConfig = await resolveSmtpConfig();
      if (smtpConfig && smtpConfig.host && smtpConfig.user) {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: { user: smtpConfig.user, pass: smtpConfig.pass },
        });

        const info = await transporter.sendMail({
          from: `"${smtpConfig.fromName || "Airnet Computers Security"}" <${smtpConfig.user}>`,
          to: CONSTANT_ADMIN_EMAIL,
          subject,
          text: textBody,
          html: htmlBody,
        });

        emailSent = true;
        const testUrl = nodemailer.getTestMessageUrl(info);
        if (testUrl) previewUrl = String(testUrl);
      }
    } catch (smtpErr: any) {
      lastSendError = smtpErr.message;
    }
  }

  console.log(`\n======================================================`);
  console.log(`📱 [ADMIN MOBILE CHANGE OTP] Code: ${otpPin}`);
  console.log(`📞 New Mobile: ${formattedMobile}`);
  console.log(`📬 Sent to: ${CONSTANT_ADMIN_EMAIL}`);
  if (previewUrl) console.log(`🔗 Preview URL: ${previewUrl}`);
  console.log(`======================================================\n`);

  if (!emailSent && lastSendError) {
    return {
      success: false,
      message: `Could not send verification email to ${CONSTANT_ADMIN_EMAIL}: ${lastSendError}`,
      expiresInMinutes,
    };
  }

  return {
    success: true,
    message: `A 6-digit verification OTP PIN has been sent to ${CONSTANT_ADMIN_EMAIL}.`,
    previewUrl,
    expiresInMinutes,
  };
}

/**
 * Verify OTP and apply the new Admin Mobile Number across the entire system
 */
export async function verifyAndApplyMobileChange(
  otpInput: string
): Promise<{ success: boolean; message: string; newMobileNumber?: string; frontendPermissionGranted?: boolean }> {
  const cleanOtp = String(otpInput || "").trim();

  if (!cleanOtp) {
    return { success: false, message: "Please enter the 6-digit OTP PIN." };
  }

  await ensureReportTablesExist();

  let isMatch = false;
  let isExpired = false;
  let targetMobile: string | null = null;

  if (activeMobileOtp) {
    if (activeMobileOtp.code === cleanOtp) {
      if (Date.now() <= activeMobileOtp.expiresAt) {
        isMatch = true;
        targetMobile = activeMobileOtp.pendingNumber;
      } else {
        isExpired = true;
      }
    }
  }

  if (!isMatch && !isExpired) {
    try {
      const [settings] = await db
        .select()
        .from(reportSettingsTable)
        .where(eq(reportSettingsTable.id, "daily_report"));

      if (settings?.adminMobileOtp === cleanOtp) {
        if (settings.adminMobileOtpExpiry && new Date(settings.adminMobileOtpExpiry).getTime() >= Date.now()) {
          isMatch = true;
          targetMobile = settings.adminMobilePending || null;
        } else {
          isExpired = true;
        }
      }
    } catch (dbErr) {
      logger.error({ dbErr }, "[admin-auth] Error verifying mobile OTP in database");
    }
  }

  if (isExpired) {
    return {
      success: false,
      message: "The OTP PIN has expired (valid for 10 minutes). Please request a new OTP PIN.",
    };
  }

  if (!isMatch || !targetMobile) {
    return {
      success: false,
      message: "Invalid OTP PIN. Please check your email and try again.",
    };
  }

  // Update Database
  try {
    await db
      .update(reportSettingsTable)
      .set({
        adminMobileNumber: targetMobile,
        showUpdatedMobileOnFrontend: false, // Keep frontend untouched until explicit admin permission
        adminMobileOtp: null,
        adminMobileOtpExpiry: null,
        adminMobilePending: null,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error saving updated mobile number to database");
    return { success: false, message: "Database error while updating mobile number." };
  }

  // Update in-memory cache
  cachedMobileNumber = targetMobile;
  activeMobileOtp = null;

  logger.info({ newMobile: targetMobile }, "[admin-auth] Admin mobile number updated successfully for backend tasks");

  return {
    success: true,
    message: `Admin mobile number updated successfully to ${targetMobile} for all backend tasks! The frontend website remains unchanged until you grant permission below.`,
    newMobileNumber: targetMobile,
    frontendPermissionGranted: false,
  };
}

/**
 * Get the effective mobile number to display on the public frontend.
 * Only returns the updated adminMobileNumber if admin has granted permission (showUpdatedMobileOnFrontend === true).
 * Otherwise returns the approved frontendMobileNumber (default +91 7892881086).
 */
export async function getFrontendDisplayedMobileNumber(): Promise<string> {
  try {
    await ensureReportTablesExist();
    const [settings] = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.id, "daily_report"));

    if (settings && settings.showUpdatedMobileOnFrontend && settings.adminMobileNumber?.trim()) {
      return settings.adminMobileNumber.trim();
    }
  } catch (err) {
    logger.error({ err }, "[admin-auth] Error loading frontend mobile number");
  }

  return DEFAULT_ADMIN_MOBILE;
}

/**
 * Get comprehensive mobile configuration details for admin settings portal.
 * Accepts optional already-fetched existingSettings to eliminate redundant cloud database queries.
 */
export async function getMobileSettingsInfo(existingSettings?: any): Promise<{
  adminMobileNumber: string;
  frontendMobileNumber: string;
  showUpdatedMobileOnFrontend: boolean;
  effectiveFrontendNumber: string;
}> {
  let settings = existingSettings;
  if (!settings) {
    await ensureReportTablesExist();
    const [fetched] = await db
      .select()
      .from(reportSettingsTable)
      .where(eq(reportSettingsTable.id, "daily_report"));
    settings = fetched;
  }

  const adminMobile = settings?.adminMobileNumber?.trim() || DEFAULT_ADMIN_MOBILE;
  const showUpdated = Boolean(settings?.showUpdatedMobileOnFrontend);
  const effectiveFrontend = showUpdated ? adminMobile : DEFAULT_ADMIN_MOBILE;

  return {
    adminMobileNumber: adminMobile,
    frontendMobileNumber: DEFAULT_ADMIN_MOBILE,
    showUpdatedMobileOnFrontend: showUpdated,
    effectiveFrontendNumber: effectiveFrontend,
  };
}

/**
 * Update frontend display permission.
 * When permission is granted, the frontend displays the updated adminMobileNumber.
 * When permission is revoked, the frontend displays the approved DEFAULT_ADMIN_MOBILE (+91 7892881086).
 */
export async function setFrontendMobilePermission(
  grantPermission: boolean
): Promise<{
  success: boolean;
  message: string;
  showUpdatedMobileOnFrontend: boolean;
  effectiveFrontendNumber: string;
}> {
  await ensureReportTablesExist();
  const [settings] = await db
    .select()
    .from(reportSettingsTable)
    .where(eq(reportSettingsTable.id, "daily_report"));

  const adminMobile = settings?.adminMobileNumber?.trim() || DEFAULT_ADMIN_MOBILE;
  const effective = grantPermission ? adminMobile : DEFAULT_ADMIN_MOBILE;

  const updateData: Record<string, any> = {
    showUpdatedMobileOnFrontend: grantPermission,
    frontendMobileNumber: effective,
    updatedAt: new Date(),
  };

  await db
    .update(reportSettingsTable)
    .set(updateData)
    .where(eq(reportSettingsTable.id, "daily_report"));

  logger.info({ grantPermission, effective }, "[admin-auth] Frontend mobile display permission updated");

  return {
    success: true,
    message: grantPermission
      ? `Permission granted! The newly updated mobile number (${adminMobile}) is now displayed publicly on the website.`
      : `Frontend display permission revoked. The public website has reverted to the default helpline (${DEFAULT_ADMIN_MOBILE}).`,
    showUpdatedMobileOnFrontend: grantPermission,
    effectiveFrontendNumber: effective,
  };
}
