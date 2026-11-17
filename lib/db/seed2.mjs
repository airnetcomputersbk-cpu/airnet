import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { servicesTable } from "@workspace/db";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const defaultServices = [
  {
    id: "aadhaar-print",
    category: "Identity",
    title: "Aadhaar Print",
    copy: "Download and print your Aadhaar card securely.",
    timing: "Immediate",
    price: "₹50",
    documents: "Aadhaar Number and Mobile Number (Note: Mobile number does not need to be linked to Aadhaar).",
    icon: "IdCard",
    accent: "bg-[#e5f0ea]",
    orderIndex: 1
  },
  {
    id: "pan-card",
    category: "Identity",
    title: "PAN Card (New Application / Correction)",
    copy: "Apply for a new PAN card or update existing details.",
    timing: "15-20 days",
    price: "₹200",
    documents: "Aadhaar Card, recent photo, signature, and one DoB proof (Birth Certificate / Matriculation Certificate / Voter ID / Indian Passport / Driving Licence / Marriage Certificate).",
    icon: "CreditCard",
    accent: "bg-[#e6eaf0]",
    orderIndex: 2
  },
  {
    id: "voter-id",
    category: "Identity",
    title: "Voter ID Card (New Application / Correction)",
    copy: "Register as a voter or update your Voter ID.",
    timing: "Varies",
    price: "₹100",
    documents: "Aadhaar Card, recent photo, one family member’s Voter ID, and 2002 SIR List (containing the name of parents or grandparents).",
    icon: "BadgeCheck",
    accent: "bg-[#f4efe4]",
    orderIndex: 3
  },
  {
    id: "passport",
    category: "Document Services",
    title: "Passport (New Application / Renewal / Correction)",
    copy: "Apply for a new passport, renew, or correct details.",
    timing: "Varies",
    price: "₹2,500 (Govt Fee) + ₹300 (Service Fee) = ₹2,800 total",
    documents: "Aadhaar Card, PAN Card, and Matriculation (Class 10) Certificate.",
    icon: "BookOpen",
    accent: "bg-[#e6f0fa]",
    orderIndex: 4
  },
  {
    id: "govt-jobs",
    category: "Online Applications",
    title: "Government Job Online Applications",
    copy: "We assist you in filling and submitting government job applications.",
    timing: "Immediate",
    price: "₹100",
    documents: "Aadhaar Card, Mobile Number, Educational Marks Cards (10th, 12th, UG/PG Degree), recent photo, and signature.",
    icon: "Briefcase",
    accent: "bg-[#f5e6e6]",
    orderIndex: 5
  },
  {
    id: "scholarships",
    category: "Online Applications",
    title: "Scholarships (New Application / Renewal)",
    copy: "Apply for student scholarships securely.",
    timing: "Immediate",
    price: "₹100",
    documents: "Aadhaar Card, Educational Marks Cards (10th, 12th, UG/PG Degree), STS Number, and valid Income & Caste Certificates.",
    icon: "GraduationCap",
    accent: "bg-[#f0e6fa]",
    orderIndex: 6
  },
  {
    id: "income-certificate",
    category: "Certificates",
    title: "Income Certificate",
    copy: "Get your official Income Certificate for subsidies and education.",
    timing: "Varies",
    price: "₹150 - 300",
    documents: "Aadhaar Card, Ration Card, old Income Certificate, and one age/school proof (Applicant's 10th T.C. / Shala Dakhila OR a family member's 10th T.C.).",
    icon: "FileText",
    accent: "bg-[#e6faee]",
    orderIndex: 7
  },
  {
    id: "caste-certificate",
    category: "Certificates",
    title: "Caste Certificate",
    copy: "Get your official Caste Certificate for reservations and benefits.",
    timing: "Varies",
    price: "₹150 - 300",
    documents: "Aadhaar Card, Ration Card, old Income Certificate, and one age/school proof (Applicant's 10th T.C. / Shala Dakhila OR a family member's 10th T.C.).",
    icon: "FileCheck2",
    accent: "bg-[#fae6eb]",
    orderIndex: 8
  },
  {
    id: "domicile-certificate",
    category: "Certificates",
    title: "Domicile / Residence Certificate",
    copy: "Proof of your permanent residence in the state.",
    timing: "Varies",
    price: "₹150 - 300",
    documents: "Aadhaar Card, Ration Card, Voter ID, old Income Certificate, and one school proof (Applicant's 10th T.C. / Shala Dakhila OR a family member's 10th T.C.).",
    icon: "Home",
    accent: "bg-[#e6f4fa]",
    orderIndex: 9
  },
  {
    id: "prc",
    category: "Certificates",
    title: "Permanent Residence Certificate (PRC)",
    copy: "Apply for PRC for official purposes.",
    timing: "Varies",
    price: "₹150 - 300",
    documents: "Aadhaar Card, Ration Card, Voter ID, Matriculation Certificate, Birth Certificate, Property Tax Paid Receipts, and Self-Declaration / Affidavit.",
    icon: "MapPin",
    accent: "bg-[#faf8e6]",
    orderIndex: 10
  },
  {
    id: "birth-death-cert",
    category: "Certificates",
    title: "Birth & Death Certificate",
    copy: "Registration and printing of Birth and Death certificates.",
    timing: "Varies",
    price: "To be announced",
    documents: "Birth Summary / Discharge Slip, parents' Aadhaar Cards, Ration Card, and Voter ID.",
    icon: "FileSignature",
    accent: "bg-[#ebe6fa]",
    orderIndex: 11
  },
  {
    id: "aeps",
    category: "Financial Services",
    title: "Money Transaction via AePS",
    copy: "Cash withdrawal and money transfers using Aadhaar Enabled Payment System.",
    timing: "Immediate",
    price: "₹10 charge per ₹1,000 transaction",
    documents: "Bank account seeded with Aadhaar, registered mobile number, and physical presence of the account holder for biometrics.",
    icon: "Banknote",
    accent: "bg-[#e6faf6]",
    orderIndex: 12
  },
  {
    id: "udyam-certificate",
    category: "Certificates",
    title: "Udyam Certificate (MSME)",
    copy: "Register your business and get your MSME Udyam Certificate.",
    timing: "Immediate",
    price: "₹150",
    documents: "Aadhaar Card, active Mobile Number, PAN Card, and Bank Account details.",
    icon: "Building2",
    accent: "bg-[#faeee6]",
    orderIndex: 13
  }
];

async function seed() {
  console.log("Clearing old services and seeding new comprehensive list...");
  try {
    await db.delete(servicesTable); // Clear the table completely
    for (const service of defaultServices) {
      await db.insert(servicesTable).values(service);
    }
    console.log("Successfully seeded completely new default services!");
  } catch (error) {
    console.error("Error seeding:", error);
  } finally {
    process.exit(0);
  }
}

seed();
