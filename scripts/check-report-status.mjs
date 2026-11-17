import { createRequire } from "module";
const require = createRequire(import.meta.resolve("../artifacts/api-server/src/index.ts"));

async function run() {
  const { db, reportSettingsTable, dailyReportLogsTable } = await import(
    "file:///F:/1-Scanner/site/packages/db/src/index.ts"
  );
  const { desc } = await import("drizzle-orm");

  const settings = await db.select().from(reportSettingsTable).limit(5);
  console.log("=== REPORT SETTINGS ===");
  console.log(JSON.stringify(settings, null, 2));

  const logs = await db.select().from(dailyReportLogsTable).orderBy(desc(dailyReportLogsTable.createdAt)).limit(10);
  console.log("\n=== RECENT DAILY REPORT LOGS ===");
  console.log(JSON.stringify(logs, null, 2));
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
