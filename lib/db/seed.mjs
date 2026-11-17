import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { servicesTable } from "@workspace/db";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const defaultServices = [
  {
    id: "pan-card-registration",
    category: "Identity",
    title: "PAN Card Registration",
    copy: "Apply for a new PAN card or update your existing details. We handle the online form and document upload.",
    timing: "15-20 days",
    price: "₹150",
    documents: "Aadhaar Card, 2 Passport Photos",
    icon: "IdCard",
    accent: "bg-[#e5f0ea]",
    orderIndex: 0
  },
  {
    id: "voter-id-application",
    category: "Identity",
    title: "Voter ID Application",
    copy: "Register as a new voter, update address, or replace a lost Voter ID card through the NVSP portal.",
    timing: "1-2 months",
    price: "₹100",
    documents: "Aadhaar Card, Passport Photo, Address Proof",
    icon: "BadgeCheck",
    accent: "bg-[#f4efe4]",
    orderIndex: 1
  },
  {
    id: "income-certificate",
    category: "Certificates",
    title: "Income Certificate",
    copy: "Apply for a government-issued income certificate for scholarships, fee concessions, or subsidies.",
    timing: "7-10 days",
    price: "₹120",
    documents: "Aadhaar Card, Ration Card, Salary Slip / Affidavit",
    icon: "FileText",
    accent: "bg-[#e6eaf0]",
    orderIndex: 2
  },
  {
    id: "caste-certificate",
    category: "Certificates",
    title: "Caste Certificate",
    copy: "Apply for SC/ST/OBC certificates required for education and employment reservations.",
    timing: "15-21 days",
    price: "₹150",
    documents: "Aadhaar Card, School TC, Father's Caste Certificate",
    icon: "FileCheck2",
    accent: "bg-[#f5e6e6]",
    orderIndex: 3
  }
];

async function seed() {
  console.log("Seeding default services...");
  try {
    for (const service of defaultServices) {
      await db.insert(servicesTable).values(service).onConflictDoNothing();
    }
    console.log("Successfully seeded default services!");
  } catch (error) {
    console.error("Error seeding:", error);
  } finally {
    process.exit(0);
  }
}

seed();
