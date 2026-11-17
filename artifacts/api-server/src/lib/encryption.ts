import crypto from "crypto";

// Derive 32-byte key using SHA-256 from backend secret
const secretSeed =
  process.env.ENCRYPTION_SECRET ||
  process.env.ADMIN_MASTER_PASSWORD ||
  process.env.SESSION_SECRET ||
  "airnet-computers-gmail-oauth-master-encryption-key-2026";

const key = crypto.createHash("sha256").update(secretSeed).digest();

/**
 * Encrypt plain text using authenticated AES-256-GCM.
 * Never stores or transmits plaintext refresh tokens or secrets.
 */
export function encrypt(text: string): string {
  if (!text) return "";
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
  } catch (err) {
    console.error("[encryption] Failed to encrypt:", err);
    throw new Error("Encryption failed");
  }
}

/**
 * Decrypt ciphertext using authenticated AES-256-GCM.
 * Validates integrity via GCM auth tag.
 */
export function decrypt(ciphertext?: string | null): string {
  if (!ciphertext) return "";
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) {
      // If plaintext was stored previously, return as-is
      return ciphertext;
    }
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = Buffer.from(parts[2], "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (err) {
    console.error("[encryption] Failed to decrypt:", err);
    return "";
  }
}
