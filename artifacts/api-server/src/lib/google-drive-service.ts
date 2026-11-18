import { db, googleDriveSettingsTable, documentActivityLogsTable, customerDocumentsTable, reportSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";
import stream from "node:stream";

export interface GoogleDriveStatus {
  configured: boolean;
  connected: boolean;
  connectedEmail: string | null;
  connectionStatus: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  clientId: string | null;
  rootFolderId: string | null;
  customerDocumentsFolderId: string | null;
  tokenExpiry: string | null;
  lastError: string | null;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  webViewLink?: string;
  thumbnailLink?: string;
}

/**
 * Ensures google_drive_settings table exists and initializes default row
 */
export async function ensureDriveTables(): Promise<void> {
  try {
    const { pool } = await import("@workspace/db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS google_drive_settings (
        id TEXT PRIMARY KEY DEFAULT 'drive_config',
        google_account_email TEXT,
        google_client_id TEXT,
        google_client_secret_encrypted TEXT,
        encrypted_refresh_token TEXT,
        encrypted_access_token TEXT,
        token_expiry TIMESTAMP,
        root_folder_id TEXT,
        customer_documents_folder_id TEXT,
        connection_status TEXT DEFAULT 'Disconnected' NOT NULL,
        last_error TEXT,
        connected_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS customer_documents (
        id SERIAL PRIMARY KEY,
        customer_id TEXT NOT NULL,
        customer_name TEXT,
        service_name TEXT,
        acknowledgement_number TEXT,
        drive_file_id TEXT NOT NULL,
        drive_folder_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_extension TEXT,
        file_size INTEGER NOT NULL,
        category TEXT DEFAULT 'General',
        notes TEXT,
        uploaded_by TEXT DEFAULT 'Admin' NOT NULL,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        upload_status TEXT DEFAULT 'completed' NOT NULL,
        deletion_status TEXT DEFAULT 'active' NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT DEFAULT 'Admin',
        customer_id TEXT,
        drive_file_id TEXT,
        file_name TEXT,
        action_type TEXT NOT NULL,
        action_status TEXT NOT NULL,
        error_details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cust_docs_cid ON customer_documents(customer_id);
      CREATE INDEX IF NOT EXISTS idx_cust_docs_drive_file_id ON customer_documents(drive_file_id);
      CREATE INDEX IF NOT EXISTS idx_cust_docs_uploaded_at ON customer_documents(uploaded_at);
      CREATE INDEX IF NOT EXISTS idx_doc_logs_customer_id ON document_activity_logs(customer_id);
      CREATE INDEX IF NOT EXISTS idx_doc_logs_timestamp ON document_activity_logs(timestamp);
    `);

    // Ensure default settings row exists
    const [existing] = await db
      .select()
      .from(googleDriveSettingsTable)
      .where(eq(googleDriveSettingsTable.id, "drive_config"));

    if (!existing) {
      await db.insert(googleDriveSettingsTable).values({
        id: "drive_config",
        connectionStatus: "Disconnected",
      });
    }
  } catch (err: any) {
    console.error("[google-drive-service] Failed to ensure tables:", err.message);
  }
}

// Auto-run table check
ensureDriveTables();

/**
 * Log activity for document actions (Audit log)
 */
export async function logDocumentActivity(params: {
  userId?: string;
  customerId?: string;
  driveFileId?: string;
  fileName?: string;
  actionType: "upload" | "download" | "preview" | "delete" | "edit_customer" | "connect_drive" | "disconnect_drive";
  actionStatus: "success" | "failed";
  errorDetails?: string;
}): Promise<void> {
  try {
    await db.insert(documentActivityLogsTable).values({
      userId: params.userId || "Admin",
      customerId: params.customerId || null,
      driveFileId: params.driveFileId || null,
      fileName: params.fileName || null,
      actionType: params.actionType,
      actionStatus: params.actionStatus,
      errorDetails: params.errorDetails || null,
    });
  } catch (e: any) {
    console.error("[google-drive-service] Activity log error:", e.message);
  }
}

/**
 * Get stored Google Drive credentials, checking google_drive_settings, report_settings, or env
 */
export async function getStoredDriveCredentials() {
  await ensureDriveTables();
  const [driveSettings] = await db
    .select()
    .from(googleDriveSettingsTable)
    .where(eq(googleDriveSettingsTable.id, "drive_config"));

  const [mailSettings] = await db
    .select()
    .from(reportSettingsTable)
    .where(eq(reportSettingsTable.id, "daily_report"));

  const DEFAULT_DRIVE_CLIENT_ID = "438450701267-huqvap7ji7qtg64ijgu2no0amca4n47g.apps.googleusercontent.com";
  const DEFAULT_DRIVE_CLIENT_SECRET = "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";

  const clientId =
    driveSettings?.googleClientId ||
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    mailSettings?.gmailClientId ||
    process.env.GMAIL_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    DEFAULT_DRIVE_CLIENT_ID;

  let clientSecret = "";
  if (driveSettings?.googleClientSecretEncrypted) {
    clientSecret = decrypt(driveSettings.googleClientSecretEncrypted);
  }
  if (!clientSecret && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
    clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  }
  if (!clientSecret && mailSettings?.gmailClientSecretEncrypted) {
    clientSecret = decrypt(mailSettings.gmailClientSecretEncrypted);
  }
  if (!clientSecret && process.env.GMAIL_CLIENT_SECRET) {
    clientSecret = process.env.GMAIL_CLIENT_SECRET;
  }
  if (!clientSecret && process.env.GOOGLE_CLIENT_SECRET) {
    clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  }
  if (!clientSecret) {
    clientSecret = DEFAULT_DRIVE_CLIENT_SECRET;
  }

  const refreshToken = driveSettings?.encryptedRefreshToken
    ? decrypt(driveSettings.encryptedRefreshToken)
    : process.env.GOOGLE_DRIVE_REFRESH_TOKEN || "";

  const accessToken = driveSettings?.encryptedAccessToken
    ? decrypt(driveSettings.encryptedAccessToken)
    : "";

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    refreshToken: refreshToken.trim(),
    accessToken: accessToken.trim(),
    tokenExpiry: driveSettings?.tokenExpiry || null,
    connectedEmail: driveSettings?.googleAccountEmail || null,
    connectionStatus: driveSettings?.connectionStatus || "Disconnected",
    rootFolderId: driveSettings?.rootFolderId || null,
    customerDocumentsFolderId: driveSettings?.customerDocumentsFolderId || null,
    lastError: driveSettings?.lastError || null,
    driveSettings,
  };
}

/**
 * Update Google Client ID and Secret in settings
 */
export async function updateDriveClientCredentials(clientId: string, clientSecret: string) {
  await ensureDriveTables();
  await db
    .update(googleDriveSettingsTable)
    .set({
      googleClientId: clientId.trim(),
      googleClientSecretEncrypted: encrypt(clientSecret.trim()),
      updatedAt: new Date(),
    })
    .where(eq(googleDriveSettingsTable.id, "drive_config"));
}

/**
 * Determine OAuth redirect URI for Google Drive
 */
export function getDriveRedirectUri(customOrigin?: string): string {
  if (process.env.GOOGLE_DRIVE_REDIRECT_URI && !process.env.GOOGLE_DRIVE_REDIRECT_URI.includes("your-app-name")) {
    return process.env.GOOGLE_DRIVE_REDIRECT_URI.trim();
  }
  let origin = customOrigin || process.env.AIRNET_COMPUTERS_URL || process.env.BASE_URL || "https://airnet-tp3z.vercel.app";
  if (origin.includes("your-app-name") || origin.includes("undefined")) {
    origin = "https://airnet-tp3z.vercel.app";
  }
  if (!origin.startsWith("http://localhost") && !origin.startsWith("https://")) {
    origin = origin.replace(/^http:\/\//, "https://");
  }
  return `${origin.replace(/\/$/, "")}/api/admin/google-drive/callback`;
}

/**
 * Generate Google OAuth 2.0 Auth URL for Google Drive
 */
export async function generateDriveAuthUrl(origin?: string): Promise<{ url: string; redirectUri: string }> {
  const creds = await getStoredDriveCredentials();

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error(
      "Google Cloud OAuth Client ID & Client Secret are not configured. Please configure them in Google Drive Settings."
    );
  }

  const redirectUri = getDriveRedirectUri(origin);
  // Request full drive or drive.file + userinfo.email
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  const state = `drive_${Math.random().toString(36).substring(2, 15)}`;

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
  };
}

/**
 * Handle Google Drive OAuth callback: code exchange, email extraction, folder hierarchy setup
 */
export async function handleDriveOAuthCallback(
  code: string,
  origin?: string
): Promise<{ email: string; success: boolean }> {
  const creds = await getStoredDriveCredentials();
  const redirectUri = getDriveRedirectUri(origin);

  if (!creds.clientId || !creds.clientSecret) {
    throw new Error("Missing Google OAuth Client ID or Client Secret");
  }

  const tokenParams = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  let tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  // If redirect_uri_mismatch occurred on localhost, retry with alternate port (5000 <-> 5001)
  if (!tokenRes.ok && redirectUri.includes("localhost")) {
    const altRedirectUri = redirectUri.includes("5000")
      ? redirectUri.replace("5000", "5001")
      : redirectUri.replace("5001", "5000");

    const altParams = new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: altRedirectUri,
      grant_type: "authorization_code",
    });

    const altRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: altParams.toString(),
    });

    if (altRes.ok) {
      tokenRes = altRes;
    }
  }

  if (!tokenRes.ok) {
    const errData: any = await tokenRes.json().catch(() => ({}));
    const errorMsg = errData.error_description || errData.error || `HTTP ${tokenRes.status}`;
    console.error("[google-drive-service] Token exchange failed:", errData);
    throw new Error(`Google Drive token exchange failed: ${errorMsg}`);
  }

  const tokenData: any = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token || creds.refreshToken;
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiryDate = new Date(Date.now() + expiresIn * 1000);

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Please re-authorize with consent prompt.");
  }

  // Get user's Google account email
  let connectedEmail = "airnetcomputersbk@gmail.com";
  try {
    const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userinfoRes.ok) {
      const info: any = await userinfoRes.json();
      if (info.email) {
        connectedEmail = info.email;
      }
    }
  } catch (err) {
    console.warn("[google-drive-service] Failed to fetch email from userinfo:", err);
  }

  // Save tokens to database
  await db
    .update(googleDriveSettingsTable)
    .set({
      googleAccountEmail: connectedEmail,
      connectionStatus: "Connected & Authorized",
      encryptedRefreshToken: encrypt(refreshToken),
      encryptedAccessToken: encrypt(accessToken),
      tokenExpiry: expiryDate,
      lastError: null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(googleDriveSettingsTable.id, "drive_config"));

  // Automatically initialize AIRNET COMPUTERS -> Customer Documents folder structure
  try {
    await ensureDriveFolderHierarchy(accessToken);
  } catch (fErr: any) {
    console.error("[google-drive-service] Failed to initialize folder hierarchy:", fErr.message);
  }

  await logDocumentActivity({
    actionType: "connect_drive",
    actionStatus: "success",
    errorDetails: `Connected Google Drive account: ${connectedEmail}`,
  });

  return { email: connectedEmail, success: true };
}

/**
 * Disconnect Google Drive account
 */
export async function disconnectGoogleDrive(): Promise<void> {
  await ensureDriveTables();
  await db
    .update(googleDriveSettingsTable)
    .set({
      connectionStatus: "Disconnected",
      encryptedRefreshToken: null,
      encryptedAccessToken: null,
      tokenExpiry: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveSettingsTable.id, "drive_config"));

  await logDocumentActivity({
    actionType: "disconnect_drive",
    actionStatus: "success",
    errorDetails: "Disconnected Google Drive account",
  });
}

/**
 * Get valid Google Drive access token, automatically refreshing if expired
 */
export async function getValidDriveAccessToken(): Promise<string> {
  const creds = await getStoredDriveCredentials();

  if (!creds.refreshToken) {
    throw new Error("Google Drive is not connected. Please connect your Google account in Documents.");
  }

  // If access token is valid for more than 5 minutes, reuse it
  if (creds.accessToken && creds.tokenExpiry) {
    const expiryMs = new Date(creds.tokenExpiry).getTime();
    if (expiryMs - Date.now() > 5 * 60 * 1000) {
      return creds.accessToken;
    }
  }

  // Refresh access token
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
    const errorMsg = errData.error_description || errData.error || `HTTP ${res.status}`;
    await db
      .update(googleDriveSettingsTable)
      .set({
        connectionStatus: "Error / Re-auth Required",
        lastError: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(googleDriveSettingsTable.id, "drive_config"));

    throw new Error(`Google Drive token refresh failed: ${errorMsg}`);
  }

  const data: any = await res.json();
  const newAccessToken = data.access_token;
  const expiresIn = Number(data.expires_in) || 3600;
  const expiryDate = new Date(Date.now() + expiresIn * 1000);

  await db
    .update(googleDriveSettingsTable)
    .set({
      encryptedAccessToken: encrypt(newAccessToken),
      tokenExpiry: expiryDate,
      connectionStatus: "Connected & Authorized",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveSettingsTable.id, "drive_config"));

  return newAccessToken;
}

/**
 * Helper to query Drive API with exponential retry
 */
async function driveFetch(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  const res = await fetch(url, options);
  if (!res.ok && (res.status === 429 || res.status >= 500) && retryCount < 3) {
    const delay = Math.pow(2, retryCount) * 1000;
    console.warn(`[google-drive] Rate limited or server error (${res.status}). Retrying in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return driveFetch(url, options, retryCount + 1);
  }
  return res;
}

/**
 * Automatically creates the Google Drive hierarchy:
 * AIRNET COMPUTERS
 *   └── Customer Documents
 */
export async function ensureDriveFolderHierarchy(passedAccessToken?: string): Promise<{
  rootFolderId: string;
  customerDocumentsFolderId: string;
}> {
  const accessToken = passedAccessToken || (await getValidDriveAccessToken());
  const creds = await getStoredDriveCredentials();

  let rootFolderId = creds.rootFolderId;
  let customerDocumentsFolderId = creds.customerDocumentsFolderId;

  // 1. Verify or create "AIRNET COMPUTERS" root folder
  if (rootFolderId) {
    const checkRes = await driveFetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=id,name,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!checkRes.ok || (await checkRes.json() as any).trashed) {
      rootFolderId = null;
    }
  }

  if (!rootFolderId) {
    // Search if "AIRNET COMPUTERS" folder already exists
    const searchRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        "mimeType = 'application/vnd.google-apps.folder' and name = 'AIRNET COMPUTERS' and trashed = false"
      )}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.ok) {
      const data: any = await searchRes.json();
      if (data.files && data.files.length > 0) {
        rootFolderId = data.files[0].id;
      }
    }
  }

  if (!rootFolderId) {
    // Create "AIRNET COMPUTERS" folder
    const createRes = await driveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "AIRNET COMPUTERS",
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create 'AIRNET COMPUTERS' root folder: ${createRes.statusText}`);
    }
    const created: any = await createRes.json();
    rootFolderId = created.id;
  }

  // 2. Verify or create "Customer Documents" folder inside "AIRNET COMPUTERS"
  if (customerDocumentsFolderId) {
    const checkRes = await driveFetch(`https://www.googleapis.com/drive/v3/files/${customerDocumentsFolderId}?fields=id,name,trashed`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!checkRes.ok || (await checkRes.json() as any).trashed) {
      customerDocumentsFolderId = null;
    }
  }

  if (!customerDocumentsFolderId) {
    const searchRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `mimeType = 'application/vnd.google-apps.folder' and name = 'Customer Documents' and '${rootFolderId}' in parents and trashed = false`
      )}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.ok) {
      const data: any = await searchRes.json();
      if (data.files && data.files.length > 0) {
        customerDocumentsFolderId = data.files[0].id;
      }
    }
  }

  if (!customerDocumentsFolderId) {
    const createRes = await driveFetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Customer Documents",
        mimeType: "application/vnd.google-apps.folder",
        parents: [rootFolderId],
      }),
    });
    if (!createRes.ok) {
      throw new Error(`Failed to create 'Customer Documents' folder: ${createRes.statusText}`);
    }
    const created: any = await createRes.json();
    customerDocumentsFolderId = created.id;
  }

  // Save to DB
  await db
    .update(googleDriveSettingsTable)
    .set({
      rootFolderId,
      customerDocumentsFolderId,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveSettingsTable.id, "drive_config"));

  return {
    rootFolderId: rootFolderId || "",
    customerDocumentsFolderId: customerDocumentsFolderId || "",
  };
}

/**
 * Creates or retrieves a customer's subfolder inside "Customer Documents":
 * e.g. "AC001 - Mohamed Rasool"
 */
export async function getOrCreateCustomerFolder(
  customerId: string,
  customerName: string
): Promise<string> {
  const accessToken = await getValidDriveAccessToken();
  const { customerDocumentsFolderId } = await ensureDriveFolderHierarchy(accessToken);

  // 1. Check if we already have a document with drive_folder_id for this customer
  const [existingDoc] = await db
    .select({ driveFolderId: customerDocumentsTable.driveFolderId })
    .from(customerDocumentsTable)
    .where(eq(customerDocumentsTable.customerId, customerId))
    .limit(1);

  if (existingDoc?.driveFolderId) {
    // Verify folder still exists on Drive
    const checkRes = await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${existingDoc.driveFolderId}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkRes.ok) {
      const data: any = await checkRes.json();
      if (!data.trashed) {
        return existingDoc.driveFolderId;
      }
    }
  }

  // 2. Query Google Drive by name prefix `${customerId}` in Customer Documents
  const escapedCid = customerId.replace(/'/g, "\\'");
  const q = `mimeType = 'application/vnd.google-apps.folder' and name contains '${escapedCid}' and '${customerDocumentsFolderId}' in parents and trashed = false`;
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (searchRes.ok) {
    const data: any = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // 3. Create customer folder: e.g. "AN-1002 - Ramesh Kumar"
  const folderName = `${customerId} - ${customerName.trim() || "Customer"}`;
  const createRes = await driveFetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [customerDocumentsFolderId],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create Google Drive customer folder: ${errText}`);
  }

  const created: any = await createRes.json();
  return created.id;
}

/**
 * Renames a customer folder if Customer Name changes
 */
export async function renameCustomerFolder(
  folderId: string,
  customerId: string,
  newCustomerName: string
): Promise<void> {
  try {
    const accessToken = await getValidDriveAccessToken();
    const folderName = `${customerId} - ${newCustomerName.trim() || "Customer"}`;
    await driveFetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: folderName }),
    });
  } catch (err: any) {
    console.warn(`[google-drive] Could not rename folder ${folderId}:`, err.message);
  }
}

/**
 * Upload a document directly to Google Drive (resumable for large files, multipart for smaller files)
 */
export async function uploadDocumentToDrive(params: {
  customerId: string;
  customerName: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
}): Promise<DriveUploadResult> {
  const { customerId, customerName, fileName, mimeType, fileBuffer } = params;
  const accessToken = await getValidDriveAccessToken();

  // Get or create customer's designated folder
  const folderId = await getOrCreateCustomerFolder(customerId, customerName);

  // Check if a file with exact same name already exists in this folder to prevent accidental duplicate overwrites
  const q = `name = '${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`;
  const searchRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let finalFileName = fileName;
  if (searchRes.ok) {
    const data: any = await searchRes.json();
    if (data.files && data.files.length > 0) {
      // Append timestamp suffix e.g. "Aadhaar (1).pdf"
      const dotIndex = fileName.lastIndexOf(".");
      if (dotIndex !== -1) {
        finalFileName = `${fileName.slice(0, dotIndex)} (${Date.now().toString().slice(-4)})${fileName.slice(dotIndex)}`;
      } else {
        finalFileName = `${fileName} (${Date.now().toString().slice(-4)})`;
      }
    }
  }

  let fileId = "";
  let webViewLink = "";
  let thumbnailLink = "";

  if (fileBuffer.length > 5 * 1024 * 1024) {
    // Resumable upload session for large files (> 5MB)
    const initRes = await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Upload-Content-Type": mimeType,
          "X-Upload-Content-Length": String(fileBuffer.length),
        },
        body: JSON.stringify({
          name: finalFileName,
          parents: [folderId],
        }),
      }
    );

    if (!initRes.ok) {
      throw new Error(`Failed to initialize resumable Drive upload: ${initRes.statusText}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
      throw new Error("Missing upload session location from Google Drive");
    }

    const uploadRes = await driveFetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(fileBuffer.length),
        "Content-Type": mimeType,
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      throw new Error(`Failed to upload chunks to Google Drive: ${uploadRes.statusText}`);
    }

    const uploadedData: any = await uploadRes.json();
    fileId = uploadedData.id;
    webViewLink = uploadedData.webViewLink;
  } else {
    // Standard Multipart Upload
    const boundary = `-------AIRNET_DRIVE_${Date.now()}`;
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = JSON.stringify({
      name: finalFileName,
      parents: [folderId],
    });

    const multipartRequestBody = Buffer.concat([
      Buffer.from(
        delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          metadata +
          delimiter +
          `Content-Type: ${mimeType}\r\n\r\n`
      ),
      fileBuffer,
      Buffer.from(closeDelimiter),
    ]);

    const uploadRes = await driveFetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,thumbnailLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(multipartRequestBody.length),
        },
        body: multipartRequestBody,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Google Drive multipart upload failed: ${errText}`);
    }

    const uploadedData: any = await uploadRes.json();
    fileId = uploadedData.id;
    webViewLink = uploadedData.webViewLink;
    thumbnailLink = uploadedData.thumbnailLink;
  }

  return {
    fileId,
    fileName: finalFileName,
    mimeType,
    fileSize: fileBuffer.length,
    webViewLink,
    thumbnailLink,
  };
}

/**
 * Stream file content from Google Drive for preview or download
 */
export async function getFileMediaStream(driveFileId: string): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
  fileName: string;
}> {
  const accessToken = await getValidDriveAccessToken();

  // 1. Fetch metadata first to get proper filename & mimeType
  const metaRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let fileName = "document";
  let contentType = "application/octet-stream";
  let contentLength: number | undefined;

  if (metaRes.ok) {
    const meta: any = await metaRes.json();
    fileName = meta.name || fileName;
    contentType = meta.mimeType || contentType;
    if (meta.size) contentLength = Number(meta.size);
  }

  // 2. Fetch actual binary stream
  const mediaRes = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!mediaRes.ok) {
    throw new Error(`Failed to download file from Google Drive: HTTP ${mediaRes.status}`);
  }

  // Convert Web ReadableStream to Node ReadableStream
  if (mediaRes.body) {
    const nodeStream = stream.Readable.fromWeb(mediaRes.body as any);
    return {
      stream: nodeStream,
      contentType,
      contentLength,
      fileName,
    };
  }

  throw new Error("No media stream body returned by Google Drive API");
}

/**
 * Permanently delete a file from Google Drive
 */
export async function deleteFileFromDrive(driveFileId: string): Promise<boolean> {
  try {
    const accessToken = await getValidDriveAccessToken();
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 204 || res.status === 404) {
      return true;
    }
    return false;
  } catch (err: any) {
    console.error(`[google-drive] Error deleting file ${driveFileId}:`, err.message);
    throw err;
  }
}

/**
 * Delete a customer folder from Google Drive (e.g. when removing customer documents)
 */
export async function deleteCustomerFolderFromDrive(folderId: string): Promise<boolean> {
  try {
    const accessToken = await getValidDriveAccessToken();
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.status === 204 || res.status === 404;
  } catch (err: any) {
    console.warn(`[google-drive] Could not delete folder ${folderId}:`, err.message);
    return false;
  }
}
