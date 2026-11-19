import crypto from "crypto";

// Stable canonical encryption seed across all environments (local, Vercel, VM)
const PRIMARY_SEED =
  process.env.ENCRYPTION_SECRET ||
  "airnet-computers-gmail-oauth-master-encryption-key-2026";

const key = crypto.createHash("sha256").update(PRIMARY_SEED).digest();

// Candidate seeds for backward compatibility with previously encrypted database values
const CANDIDATE_SEEDS = [
  PRIMARY_SEED,
  process.env.ADMIN_MASTER_PASSWORD,
  process.env.SESSION_SECRET,
  "airnet",
  "rasool",
  "8792900246",
].filter((s): s is string => Boolean(s && s.trim()));

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
 * Validates integrity via GCM auth tag, trying candidate keys for resilience.
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

    for (const seed of CANDIDATE_SEEDS) {
      try {
        const candidateKey = crypto.createHash("sha256").update(seed).digest();
        const decipher = crypto.createDecipheriv("aes-256-gcm", candidateKey, iv);
        decipher.setAuthTag(tag);
        const decrypted = decipher.update(encrypted) + decipher.final("utf8");
        return decrypted;
      } catch {
        // Try next candidate seed
      }
    }

    console.error("[encryption] Failed to decrypt ciphertext with any known key");
    return "";
  } catch (err) {
    console.error("[encryption] Failed to decrypt:", err);
    return "";
  }
}
