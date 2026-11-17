import { db, governmentServicesTable, type GovernmentService } from "@workspace/db";
import { asc } from "drizzle-orm";
import { getCache, setCache } from "./cache";

export const DEFAULT_FALLBACK_URL = "https://www.google.com";

/**
 * Fetches all government services directly from the centralized database (with RAM caching).
 */
export async function getAllGovernmentServices(): Promise<GovernmentService[]> {
  const cacheKey = "government_services:all";
  const cached = getCache<GovernmentService[]>(cacheKey);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    return cached;
  }

  const services = await db
    .select()
    .from(governmentServicesTable)
    .orderBy(asc(governmentServicesTable.position));

  setCache(cacheKey, services, 3600);
  return services;
}

/**
 * Resolves the application portal URL from the centralized Government Services database.
 * If not found or empty, returns "https://www.google.com".
 */
export async function resolveGovernmentServiceUrl(serviceQuery?: string | null): Promise<string> {
  if (!serviceQuery || typeof serviceQuery !== "string" || !serviceQuery.trim()) {
    return DEFAULT_FALLBACK_URL;
  }

  const rawQuery = serviceQuery.trim().toLowerCase();
  const cleanQuery = rawQuery
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  try {
    const govServices = await getAllGovernmentServices();
    if (!govServices || govServices.length === 0) {
      return DEFAULT_FALLBACK_URL;
    }

    // 1. Exact Name match (case-insensitive)
    for (const s of govServices) {
      if (s.name.toLowerCase() === rawQuery || s.name.toLowerCase() === cleanQuery) {
        return s.url;
      }
    }

    // 2. Direct containment match (Query contains Service Name or Service Name contains Query)
    for (const s of govServices) {
      const sLower = s.name.toLowerCase();
      if (cleanQuery.includes(sLower) || sLower.includes(cleanQuery)) {
        return s.url;
      }
    }

    // 3. Keyword / Token match against standard portals
    const KEYWORD_MAP: Array<{ keywords: string[]; targetName: string }> = [
      { keywords: ["aadhaar", "aadhar", "uidai"], targetName: "Aadhaar" },
      { keywords: ["pan", "utiitsl", "uti"], targetName: "PAN (UTIITSL)" },
      { keywords: ["nsdl", "protean"], targetName: "PAN (NSDL)" },
      { keywords: ["passport", "psk", "popsk"], targetName: "Passport" },
      { keywords: ["voter", "election", "epic", "eci"], targetName: "Voter ID" },
      { keywords: ["ration", "ahara", "rashan", "bpl"], targetName: "Ration Card" },
      { keywords: ["nadakacheri", "caste", "income", "resident"], targetName: "Nadakacheri" },
      { keywords: ["birth", "death", "ejanma", "janma"], targetName: "Birth/Death" },
      { keywords: ["udyam", "msme", "udyog"], targetName: "Udyam" },
      { keywords: ["ayushman", "pmjay", "health card", "aarogya"], targetName: "Ayushman" },
      { keywords: ["eshram", "shram", "shramik", "labour"], targetName: "eShram" },
      { keywords: ["udid", "swavlamban", "disability", "pwd"], targetName: "UDID" },
      { keywords: ["education", "kseab", "sslc", "puc", "exam"], targetName: "Karnataka Education" },
      { keywords: ["ksrtc", "bus pass", "buspass", "transport"], targetName: "KSRTC Pass" },
      { keywords: ["ssp", "scholarship", "postmatric", "prematric"], targetName: "SSP" },
      { keywords: ["bhoomi", "rtc"], targetName: "Bhoomi" },
      { keywords: ["parivahan", "driving", "license", "dl", "rc", "vahan", "sarathi"], targetName: "Parivahan" },
      { keywords: ["pahani", "land record", "mutation"], targetName: "Pahani" },
      { keywords: ["seva sindhu", "sevasindhu", "gruha", "shakti"], targetName: "Seva Sindhu" },
    ];

    for (const km of KEYWORD_MAP) {
      if (km.keywords.some((kw) => cleanQuery.includes(kw))) {
        const found = govServices.find((s) => s.name.toLowerCase() === km.targetName.toLowerCase());
        if (found) return found.url;
      }
    }

    // 4. Token overlap matching
    const queryTokens = cleanQuery.split(" ").filter((t) => t.length > 2);
    for (const s of govServices) {
      const sTokens = s.name.toLowerCase().split(/[^\w]+/);
      const hasCommon = queryTokens.some((qt) => sTokens.includes(qt));
      if (hasCommon) {
        return s.url;
      }
    }
  } catch (err) {
    console.error("[GovResolver] Error resolving government service URL:", err);
  }

  // Fallback to Google if not available
  return DEFAULT_FALLBACK_URL;
}
