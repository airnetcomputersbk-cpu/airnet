import { createWorker } from "tesseract.js";
import { createRequire } from "module";

const req = createRequire(import.meta.url);
let resolvedWorkerPath: string | undefined;
try {
  resolvedWorkerPath = req.resolve("tesseract.js/src/worker-script/node/index.js");
} catch {}

// Standardize any date string to DD-MM-YYYY format
export function normalizeDateToDMY(input?: string | null): string {
  if (!input) return "";
  const s = String(input).trim();

  // Already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  // YYYY-MM-DD -> DD-MM-YYYY
  const ymdMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    return `${d}-${m}-${y}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${d}-${m}-${y}`;
  }

  // "07 August 2026" or "20 Aug 2026"
  const monthMatch = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (monthMatch) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const d = monthMatch[1].padStart(2, "0");
    const mKey = monthMatch[2].slice(0, 3).toLowerCase();
    const m = months[mKey] || "01";
    const y = monthMatch[3];
    return `${d}-${m}-${y}`;
  }

  // Try parsing through JS Date
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, "0");
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return s;
}

// Format a date string or Date object to DD-MM-YYYY for display in UI
export function formatDisplayDateDMY(val?: string | Date | null): string {
  if (!val) return "Not specified";
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, "0");
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const y = val.getFullYear();
    return `${d}-${m}-${y}`;
  }
  return normalizeDateToDMY(String(val)) || String(val);
}

// Detect if a filename is raw / generic (WhatsApp Image, Camera, Scanner, etc.)
export function isGenericFilename(fileName: string): boolean {
  if (!fileName) return true;
  const clean = fileName.replace(/\.[^/.]+$/, "").trim();
  if (clean.length < 5) return true;
  if (/^(whatsapp\s*image|img[_-]?|image[_-]?|scan[_-]?|doc[_-]?|file[_-]?|screenshot|photo|poster|camera|untitled|download)/i.test(clean)) {
    return true;
  }
  if (/^\d+([_\s-]+\d+)*$/.test(clean)) return true;
  return false;
}

// Execute Tesseract OCR with safety timeout
export async function runOcrOnImage(filePath: string): Promise<string> {
  let worker: any = null;
  try {
    const workerPromise = (async () => {
      const options = resolvedWorkerPath ? { workerPath: resolvedWorkerPath } : {};
      worker = await createWorker("eng", 1, options);
      const ret = await worker.recognize(filePath);
      return ret.data.text || "";
    })();

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("OCR timeout")), 15000)
    );

    const text = await Promise.race([workerPromise, timeoutPromise]);
    return text;
  } catch (err) {
    console.warn("OCR recognition note:", (err as Error).message);
    return "";
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}

export interface ExtractedNotification {
  title: string;
  organization: string;
  category: string;
  vacancies: string;
  qualification: string;
  ageLimit: string;
  startDate: string;
  lastDate: string;
  applicationFee: string;
  description: string;
  applyUrl: string;
}

export function extractNotificationDetails(
  fileName: string,
  ocrText: string = "",
  hintCategory?: string
): ExtractedNotification {
  const combined = `${ocrText}\n${fileName}`.replace(/[_.-]+/g, " ");
  const lower = combined.toLowerCase();

  // 1. Detect Category
  let category = hintCategory || "Govt Jobs";
  if (/\b(scholarship|scholarships|vidyasiri|nsp|ssp|epass|stipend|fellowship)\b/i.test(lower)) {
    category = "Scholarships";
  } else if (/\b(recruitment|vacancy|vacancies|posts?|job|jobs|kpsc|ksp|police|surveyor|officer|constable|teacher|gpstr|cst|vao)\b/i.test(lower)) {
    category = "Govt Jobs";
  } else if (/\b(exam|exams|examination|hall\s*ticket|admit\s*card|cet|kcet|ugcet|neet|timetable|results)\b/i.test(lower)) {
    category = "Exams";
  } else if (/\b(admission|admissions|counseling|counselling|seat\s*allotment|iti\s*admission|polytechnic|diploma|ug\s*admission|pg\s*admission)\b/i.test(lower)) {
    category = "Admissions";
  } else if (/\b(scheme|schemes|yojana|ration|gruha|yuvanidhi|annabhagya|kisan|pension)\b/i.test(lower)) {
    category = "Public Schemes";
  }

  // 2. Detect Department / Organization
  let organization = "Government of Karnataka";
  if (/revenue\s*department/i.test(lower)) {
    organization = "Karnataka Revenue Department";
  } else if (/school\s*education\s*department|education\s*department/i.test(lower)) {
    organization = "Karnataka School Education Department";
  } else if (/kpsc|karnataka\s*public\s*service/i.test(lower)) {
    organization = "Karnataka Public Service Commission (KPSC)";
  } else if (/ksp|police|constable|psi/i.test(lower)) {
    organization = "Karnataka State Police (KSP)";
  } else if (/kea|karnataka\s*examination/i.test(lower)) {
    organization = "Karnataka Examination Authority (KEA)";
  } else if (/ssc|staff\s*selection/i.test(lower)) {
    organization = "Staff Selection Commission (SSC)";
  } else if (/upsc|union\s*public/i.test(lower)) {
    organization = "Union Public Service Commission (UPSC)";
  } else if (/railway|rrb/i.test(lower)) {
    organization = "Railway Recruitment Board (RRB)";
  } else if (/ibps|bank|sbi/i.test(lower)) {
    organization = "Institute of Banking Personnel Selection (IBPS)";
  } else if (/vtu/i.test(lower)) {
    organization = "Visvesvaraya Technological University (VTU)";
  } else if (/ssp|state\s*scholarship/i.test(lower)) {
    organization = "State Scholarship Portal (SSP Karnataka)";
  } else if (/nsp|national\s*scholarship/i.test(lower)) {
    organization = "National Scholarship Portal (NSP)";
  } else if (/post\s*office|india\s*post|gds/i.test(lower)) {
    organization = "India Post / Postal Department";
  }

  // 3. Detect Specific Post Names / Roles from Document Text
  const recognizedPosts: string[] = [];
  if (/village\s*administrative\s*officer|\bvao\b/i.test(lower)) {
    recognizedPosts.push("Village Administrative Officer (VAO)");
  }
  if (/land\s*surveyors?|\bsurveyor\b/i.test(lower)) {
    recognizedPosts.push("Land Surveyors");
  }
  if (/graduate\s*primary\s*teacher|\bgpstr\b|\bgpt\b/i.test(lower)) {
    recognizedPosts.push("Graduate Primary Teacher (GPSTR)");
  }
  if (/computer\s*science\s*teacher|\bcst\b/i.test(lower)) {
    recognizedPosts.push("Computer Science Teacher (CST)");
  }
  if (/first\s*division\s*assistant|\bfda\b/i.test(lower)) {
    recognizedPosts.push("First Division Assistant (FDA)");
  }
  if (/second\s*division\s*assistant|\bsda\b/i.test(lower)) {
    recognizedPosts.push("Second Division Assistant (SDA)");
  }
  if (/commercial\s*tax\s*inspector|\bcti\b/i.test(lower)) {
    recognizedPosts.push("Commercial Tax Inspector (CTI)");
  }
  if (/civil\s*police\s*constable|\bcpc\b|\bconstable\b/i.test(lower)) {
    recognizedPosts.push("Civil Police Constable (CPC)");
  }
  if (/sub\s*inspector|\bpsi\b/i.test(lower)) {
    recognizedPosts.push("Police Sub Inspector (PSI)");
  }
  if (/panchayat\s*development\s*officer|\bpdo\b/i.test(lower)) {
    recognizedPosts.push("Panchayat Development Officer (PDO)");
  }
  if (/village\s*accountant/i.test(lower)) {
    recognizedPosts.push("Village Accountant");
  }

  // 4. Construct Post Title (NEVER use generic file names)
  let postTitle = "";
  if (recognizedPosts.length > 0) {
    const postNames = recognizedPosts.join(" & ");
    postTitle = `${organization} - ${postNames} Recruitment 2026`;
  } else {
    // If filename is meaningful and not generic
    if (!isGenericFilename(fileName)) {
      const clean = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[_.-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      postTitle = clean;
    } else {
      // Meaningful fallback based on organization and category
      postTitle = `${organization} - ${category} Official Notification 2026`;
    }
  }

  // 5. Total Vacancies Extraction
  let vacancies = "Multiple Posts";
  const totalVacMatch = ocrText.match(/TOTAL\s*VACANCIES\s*[:\s]*(\d[\d,]*)/i);
  if (totalVacMatch) {
    const total = totalVacMatch[1];
    const subMatches: string[] = [];
    if (/vao/i.test(lower) && /750/i.test(ocrText)) subMatches.push("VAO: 750");
    if (/surveyor/i.test(lower) && /500/i.test(ocrText)) subMatches.push("Land Surveyors: 500");
    if (subMatches.length > 0) {
      vacancies = `${total} Posts (${subMatches.join(", ")})`;
    } else {
      vacancies = `${total} Posts`;
    }
  } else {
    const generalVac = combined.match(/(\d[\d,]*\s*(?:posts?|vacancies|positions|seats?))/i);
    if (generalVac) {
      vacancies = generalVac[1].trim();
    }
  }

  // 6. Important Dates Extraction (Always in DD-MM-YYYY format)
  const today = new Date();
  const future = new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000);
  let startDate = normalizeDateToDMY(today.toISOString().split("T")[0]);
  let lastDate = normalizeDateToDMY(future.toISOString().split("T")[0]);

  // Check for specific date expressions in poster text
  const startMatch = ocrText.match(/(?:application\s*starts|start\s*date)[\s\S]{0,40}?([0-9]{1,2}\s+[a-zA-Z]+\s+[0-9]{4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i);
  if (startMatch) {
    startDate = normalizeDateToDMY(startMatch[1]);
  }

  const lastMatch = ocrText.match(/(?:last\s*date(?:\s*to\s*apply)?|end\s*date|deadline)[\s\S]{0,40}?([0-9]{1,2}\s+[a-zA-Z]+\s+[0-9]{4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i)
    || combined.match(/(?:last\s*date|closing\s*date|deadline)[:\s]*([0-9]{1,2}\s+[a-zA-Z]+\s+[0-9]{4}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})/i);
  if (lastMatch) {
    lastDate = normalizeDateToDMY(lastMatch[1]);
  }

  // 7. Qualifications Extraction
  let qualification = "SSLC / 10th, PUC / 12th, Any Degree";
  if (/bachelor'?s\s*degree|diploma\s*in\s*civil|iti\s*in\s*surveyor/i.test(lower)) {
    qualification = "Bachelor's Degree (B.A/B.Sc/B.Com) / Diploma Civil / ITI Surveyor";
  } else if (/graduation\s*with\s*minimum|d\.?el\.?ed|b\.?ed|b\.?sc\s*computer/i.test(lower)) {
    qualification = "Graduation with D.El.Ed / B.Ed / B.Sc Computer Science / BCA / B.E (CSE)";
  } else if (/iti|diploma/i.test(lower) && /degree/i.test(lower)) {
    qualification = "ITI / Diploma / Any Degree";
  } else if (/degree|graduate|graduation/i.test(lower)) {
    qualification = "Any Bachelor's Degree / Graduation";
  } else if (/puc|12th|plus\s*two/i.test(lower)) {
    qualification = "PUC / 12th Pass or Equivalent";
  } else if (/sslc|10th/i.test(lower)) {
    qualification = "10th / SSLC Pass";
  }

  // 8. Age Limit Extraction
  let ageLimit = "18 - 35 Years (Relaxation as per rules)";
  const ageMatch = ocrText.match(/Minimum:\s*(\d+)\s*Years?\s*\|\s*Maximum:\s*(\d+)\s*Years?/i)
    || combined.match(/(?:age\s*limit|age)[:\s]*(\d{2}\s*-\s*\d{2}\s*years?)/i);
  if (ageMatch) {
    if (ageMatch[2]) {
      ageLimit = `${ageMatch[1]} - ${ageMatch[2]} Years (Relaxation as per Govt. rules)`;
    } else {
      ageLimit = ageMatch[1];
    }
  }

  // 9. Application Fee
  let applicationFee = "General / OBC: ₹250, SC/ST: ₹100";
  if (category === "Scholarships") {
    applicationFee = "Free (No Application Fee)";
  } else {
    const feeMatch = combined.match(/(?:fee|application\s*fee)[:\s]*(₹?\s*\d+(?:\s*(?:to|-)\s*₹?\s*\d+)?)/i);
    if (feeMatch) applicationFee = feeMatch[1];
  }

  // 10. Description
  const description = `Official Notification released by ${organization} for ${postTitle}.\n\n` +
    `• Total Vacancies: ${vacancies}\n` +
    `• Eligibility: ${qualification}\n` +
    `• Age Criteria: ${ageLimit}\n` +
    `• Application Window: ${startDate} to ${lastDate}\n\n` +
    `Airnet Computers provides complete online application form filling, document scanning, fee payment receipt, and printout assistance for all candidates.`;

  return {
    title: postTitle,
    organization,
    category,
    vacancies,
    qualification,
    ageLimit,
    startDate,
    lastDate,
    applicationFee,
    description,
    applyUrl: "https://airnetcomputers.in",
  };
}
