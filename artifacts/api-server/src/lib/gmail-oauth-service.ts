import nodemailer from "nodemailer";
import { db, reportSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import { ensureReportTablesExist } from "./daily-report-engine";

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  deliveryStatus: "Accepted by Gmail API" | "Failed" | "Config Missing" | "Authorization Revoked / Expired";
  recipient: string;
  errorMessage?: string;
  previewUrl?: string | null;
}

export interface GmailStatusInfo {
  configured: boolean;
  connected: boolean;
  connectedEmail: string | null;
  connectionStatus: string;
  tokenExpiry: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  clientId: string | null;
  emailProvider: string;
  lastError: string | null;
  recipientEmail: string;
  adminEmail: string;
  scheduledTime: string;
  autoEnabled: boolean;
}

/**
 * Get OAuth Credentials from database (encrypted) or environment variables
 */
export async function getStoredGmailCredentials() {
  await ensureReportTablesExist();
  const [settings] = await db.select().from(reportSettingsTable).where(eq(reportSettingsTable.id, "daily_report"));

  const DEFAULT_GMAIL_CLIENT_ID = "438450701267-huqvap7ji7qtg64ijgu2no0amca4n47g.apps.googleusercontent.com";
  const DEFAULT_GMAIL_CLIENT_SECRET = "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";

  const clientId = settings?.gmailClientId || process.env.GMAIL_CLIENT_ID || DEFAULT_GMAIL_CLIENT_ID;
  let clientSecret = "";
  if (settings?.gmailClientSecretEncrypted) {
    clientSecret = decrypt(settings.gmailClientSecretEncrypted);
  }
  if (!clientSecret && process.env.GMAIL_CLIENT_SECRET) {
    clientSecret = process.env.GMAIL_CLIENT_SECRET;
  }
  if (!clientSecret) {
    clientSecret = DEFAULT_GMAIL_CLIENT_SECRET;
  }

  const refreshToken = settings?.gmailRefreshTokenEncrypted
    ? decrypt(settings.gmailRefreshTokenEncrypted)
    : process.env.GMAIL_REFRESH_TOKEN || "";

  const accessToken = settings?.gmailAccessTokenEncrypted
    ? decrypt(settings.gmailAccessTokenEncrypted)
    : "";

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: refreshToken.trim(),
    accessToken: accessToken.trim(),
    tokenExpiry: settings?.gmailTokenExpiry || null,
    connectedEmail: settings?.gmailConnectedEmail || null,
    connectionStatus: settings?.gmailConnectionStatus || "Disconnected",
    lastError: settings?.gmailLastError || null,
    settings,
  };
}

/**
 * Determine the exact OAuth redirect URI
 */
export function getRedirectUri(customOrigin?: string): string {
  if (process.env.GMAIL_REDIRECT_URI && !process.env.GMAIL_REDIRECT_URI.includes("your-app-name")) {
    return process.env.GMAIL_REDIRECT_URI.trim();
  }
  let origin = customOrigin || process.env.AIRNET_COMPUTERS_URL || process.env.BASE_URL || "https://airnet-tp3z.vercel.app";
  if (origin.includes("your-app-name") || origin.includes("google.com") || origin.includes("undefined")) {
    origin = "https://airnet-tp3z.vercel.app";
  }
  if (!origin.startsWith("http://localhost") && !origin.startsWith("https://")) {
    origin = origin.replace(/^http:\/\//, "https://");
  }
  return `${origin.replace(/\/$/, "")}/api/admin/gmail/callback`;
}

/**
 * Generate Google OAuth 2.0 Consent URL
 * Scopes: gmail.send (send emails) & userinfo.email (display authorized email)
 */
export async function generateGoogleAuthUrl(origin?: string): Promise<{ url: string; redirectUri: string; hasCredentials: boolean }> {
  const creds = await getStoredGmailCredentials();

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error(
      "Google OAuth Client ID & Client Secret are not configured. Please enter your Google Cloud OAuth credentials first."
    );
  }

  const redirectUri = getRedirectUri(origin);
  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", creds.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  return {
    url: authUrl.toString(),
    redirectUri,
    hasCredentials: true,
  };
}

/**
 * Handle Google OAuth Callback, exchange authorization code for tokens
 */
export async function handleOAuthCallback(code: string, origin?: string): Promise<{ email: string; success: boolean }> {
  const creds = await getStoredGmailCredentials();
  const redirectUri = getRedirectUri(origin);

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error("Missing Google OAuth Client ID or Client Secret");
  }

  // 1. Exchange code for access & refresh tokens
  const tokenParams = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errData: any = await tokenRes.json().catch(() => ({}));
    const errorMsg = errData.error_description || errData.error || `HTTP ${tokenRes.status}`;
    console.error("[gmail-oauth] Token exchange failed:", errData);
    if (errorMsg.toLowerCase().includes("client secret") || errData.error === "invalid_client") {
      throw new Error(`Google token exchange failed: The provided client secret is invalid. Please copy the active Client Secret from Google Cloud Console (APIs & Services > Credentials > OAuth 2.0 Web Client) and save it in Settings.`);
    }
    throw new Error(`Google token exchange failed: ${errorMsg}`);
  }

  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || creds.refreshToken;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiryDate = new Date(Date.now() + expiresIn * 1000);

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Please re-authorize with consent prompt.");
  }

  // 2. Fetch authenticated Gmail profile to get exact email address
  let connectedEmail = "airnetcomputersbk@gmail.com";
  try {
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (profileRes.ok) {
      const profile: any = await profileRes.json();
      if (profile.emailAddress) {
        connectedEmail = profile.emailAddress;
      }
    }
  } catch (profErr) {
    console.warn("[gmail-oauth] Could not query user profile:", profErr);
  }

  // 3. Encrypt and store tokens securely in DB
  await db
    .update(reportSettingsTable)
    .set({
      emailProvider: "gmail_api",
      gmailConnectedEmail: connectedEmail,
      gmailConnectionStatus: "Connected & Authorized",
      gmailRefreshTokenEncrypted: encrypt(refreshToken),
      gmailAccessTokenEncrypted: encrypt(accessToken),
      gmailTokenExpiry: expiryDate,
      gmailLastError: null,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  console.log(`[gmail-oauth] Successfully authorized Gmail account: ${connectedEmail}`);
  return { email: connectedEmail, success: true };
}

/**
 * Get a valid access token, automatically refreshing if expired or expiring soon
 */
export async function getValidAccessToken(): Promise<string> {
  const creds = await getStoredGmailCredentials();

  if (!creds.refreshToken) {
    throw new Error("Gmail account is not connected. Please authorize your Gmail account in Admin Settings.");
  }

  // If access token exists and has > 5 minutes of validity remaining, reuse it
  if (creds.accessToken && creds.tokenExpiry) {
    const expiryMs = new Date(creds.tokenExpiry).getTime();
    const nowMs = Date.now();
    if (expiryMs - nowMs > 5 * 60 * 1000) {
      return creds.accessToken;
    }
  }

  // Refresh the access token using refresh_token
  console.log("[gmail-oauth] Access token expired or expiring soon. Refreshing with Google OAuth...");

  const refreshParams = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: refreshParams.toString(),
  });

  if (!res.ok) {
    const errData: any = await res.json().catch(() => ({}));
    const isRevoked = errData.error === "invalid_grant";
    const statusMsg = isRevoked
      ? "Authorization Revoked / Expired"
      : "Refresh Failed";
    const errMsg = isRevoked
      ? "Google account authorization was revoked or expired. Please click 'Reconnect Gmail Account' to restore automated sending."
      : errData.error_description || errData.error || `HTTP ${res.status}`;

    await db
      .update(reportSettingsTable)
      .set({
        gmailConnectionStatus: statusMsg,
        gmailLastError: errMsg,
        updatedAt: new Date(),
      })
      .where(eq(reportSettingsTable.id, "daily_report"));

    throw new Error(`Gmail authorization error: ${errMsg}`);
  }

  const data: any = await res.json();
  const newAccessToken = data.access_token;
  const expiresIn = Number(data.expires_in) || 3600;
  const newExpiry = new Date(Date.now() + expiresIn * 1000);

  // Store refreshed access token
  await db
    .update(reportSettingsTable)
    .set({
      gmailAccessTokenEncrypted: encrypt(newAccessToken),
      gmailTokenExpiry: newExpiry,
      gmailConnectionStatus: "Connected & Authorized",
      gmailLastError: null,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  return newAccessToken;
}

/**
 * Send Email directly via Google Gmail API (REST messages.send)
 * Attaches generated vector PDF and formats HTML body.
 * Confirms acceptance by Gmail before marking successful.
 */
export async function sendEmailViaGmailApi({
  to,
  subject,
  text,
  html,
  pdfBuffer,
  pdfFilename,
  senderName = "Airnet Computers",
}: {
  to: string;
  subject: string;
  text: string;
  html: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  senderName?: string;
}): Promise<GmailSendResult> {
  const creds = await getStoredGmailCredentials();
  const senderEmail = creds.connectedEmail || "airnetcomputersbk@gmail.com";

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (authErr: any) {
    return {
      success: false,
      deliveryStatus: "Authorization Revoked / Expired",
      recipient: to,
      errorMessage: authErr.message || "Failed to obtain valid Gmail access token",
    };
  }

  // 1. Build RFC 2822 MIME message with Nodemailer Stream Transport
  const attachments: any[] = [];
  if (pdfBuffer && pdfFilename) {
    attachments.push({
      filename: pdfFilename,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "windows",
    buffer: true,
  });

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    replyTo: senderEmail,
    to,
    subject,
    text,
    html,
    attachments,
  };

  const mailInfo: any = await transporter.sendMail(mailOptions);
  const rawMimeBuffer = mailInfo.message as Buffer;
  const rawBase64Url = rawMimeBuffer.toString("base64url");

  // 2. Call Gmail API messages.send
  console.log(`[gmail-oauth] Dispatching email via Gmail API to ${to} from ${senderEmail}...`);

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: rawBase64Url }),
  });

  if (!response.ok) {
    const errorJson: any = await response.json().catch(() => ({}));
    const message = errorJson.error?.message || `Gmail API returned HTTP ${response.status}`;
    console.error("[gmail-oauth] Gmail API rejected sending request:", errorJson);

    return {
      success: false,
      deliveryStatus: "Failed",
      recipient: to,
      errorMessage: `Gmail API error: ${message}`,
    };
  }

  const sendData: any = await response.json();
  console.log(`[gmail-oauth] Gmail accepted message. Message ID: ${sendData.id}`);

  return {
    success: true,
    messageId: sendData.id,
    threadId: sendData.threadId,
    deliveryStatus: "Accepted by Gmail API",
    recipient: to,
  };
}

/**
 * Disconnect Gmail Account (revokes tokens and removes from DB)
 */
export async function disconnectGmailAccount(): Promise<{ success: boolean; message: string }> {
  const creds = await getStoredGmailCredentials();

  if (creds.refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(creds.refreshToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch (err) {
      console.warn("[gmail-oauth] Could not revoke token on Google servers:", err);
    }
  }

  await db
    .update(reportSettingsTable)
    .set({
      gmailRefreshTokenEncrypted: null,
      gmailAccessTokenEncrypted: null,
      gmailTokenExpiry: null,
      gmailConnectedEmail: null,
      gmailConnectionStatus: "Disconnected",
      gmailLastError: null,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  return { success: true, message: "Gmail account disconnected successfully" };
}

/**
 * Save Google Cloud OAuth 2.0 Client ID and Secret (encrypted)
 */
export async function saveGmailAppCredentials(
  clientId: string,
  clientSecret: string
): Promise<{ success: boolean; message: string }> {
  await ensureReportTablesExist();

  const cId = clientId.trim();
  const cSec = clientSecret.trim();

  if (!cId || !cSec) {
    throw new Error("Both Client ID and Client Secret are required");
  }

  const encrypted = encrypt(cSec);
  await db
    .update(reportSettingsTable)
    .set({
      gmailClientId: cId,
      gmailClientSecretEncrypted: encrypted,
      updatedAt: new Date(),
    })
    .where(eq(reportSettingsTable.id, "daily_report"));

  try {
    const { googleDriveSettingsTable } = await import("@workspace/db");
    await db
      .update(googleDriveSettingsTable)
      .set({
        googleClientId: cId,
        googleClientSecretEncrypted: encrypted,
        updatedAt: new Date(),
      });
  } catch (err: any) {
    console.warn("[gmail-oauth] Syncing client secret to google_drive_settings skipped:", err.message);
  }

  return { success: true, message: "Google OAuth credentials saved securely" };
}

/**
 * Get Gmail Integration Status for Frontend Admin UI
 * Never exposes Client Secret, Refresh Token, or Access Token!
 */
export async function getGmailIntegrationStatus(): Promise<GmailStatusInfo> {
  const creds = await getStoredGmailCredentials();
  const settings = creds.settings;

  const connected = Boolean(creds.refreshToken && creds.connectionStatus === "Connected & Authorized");
  const configured = Boolean(creds.clientId && creds.clientSecret);

  return {
    configured,
    connected,
    connectedEmail: creds.connectedEmail,
    connectionStatus: creds.connectionStatus,
    tokenExpiry: creds.tokenExpiry ? creds.tokenExpiry.toISOString() : null,
    hasClientId: Boolean(creds.clientId),
    hasClientSecret: Boolean(creds.clientSecret),
    clientId: creds.clientId ? `${creds.clientId.slice(0, 15)}...${creds.clientId.slice(-10)}` : null,
    emailProvider: settings?.emailProvider || "gmail_api",
    lastError: creds.lastError,
    recipientEmail: settings?.recipientEmail || "rasoolahmed246@gmail.com",
    adminEmail: creds.connectedEmail || settings?.adminEmail || "airnetcomputersbk@gmail.com",
    scheduledTime: settings?.scheduledTime || "23:00",
    autoEnabled: settings ? settings.autoEnabled : true,
  };
}
