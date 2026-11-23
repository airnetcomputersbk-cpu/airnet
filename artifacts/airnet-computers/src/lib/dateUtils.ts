/**
 * Standard Day-Month-Year ("DD-MM-YYYY") Date Formatting Utility
 * Used across all Admin Panel tables, ledgers, records, logs, and dialogs.
 */

/**
 * Formats any date input (ISO string, YYYY-MM-DD, timestamp number, Date object)
 * into standard Day-Month-Year format: "DD-MM-YYYY" (e.g. 23-11-2026).
 */
export function formatDateDMY(val?: string | number | Date | null, fallback: string = "-"): string {
  if (val === undefined || val === null || val === "") return fallback;

  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return fallback;

    // Already in DD-MM-YYYY
    if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

    // Matches YYYY-MM-DD or YYYY/MM/DD anywhere at start (ISO timestamps, date strings, SQL datetime)
    const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
      const day = ymd[3].padStart(2, "0");
      const month = ymd[2].padStart(2, "0");
      const year = ymd[1];
      return `${day}-${month}-${year}`;
    }

    // Matches DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (dmy) {
      let day = dmy[1].padStart(2, "0");
      let month = dmy[2].padStart(2, "0");
      const year = dmy[3];
      // If month > 12 and day <= 12, it was MM-DD-YYYY
      if (Number(month) > 12 && Number(day) <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }
      return `${day}-${month}-${year}`;
    }
  }

  const d = new Date(val);
  if (isNaN(d.getTime())) return typeof val === "string" ? val : fallback;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats date and time into Day-Month-Year with time:
 * "DD-MM-YYYY, hh:mm A" (e.g. 23-11-2026, 05:30 PM).
 */
export function formatDateTimeDMY(val?: string | number | Date | null, fallback: string = "-"): string {
  if (val === undefined || val === null || val === "") return fallback;
  const d = new Date(val);
  if (isNaN(d.getTime())) return typeof val === "string" ? val : fallback;

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // hour 0 is 12
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}-${month}-${year}, ${formattedHours}:${minutes} ${ampm}`;
}

/**
 * Parses date string in DD-MM-YYYY, YYYY-MM-DD, or ISO into a Date object.
 */
export function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Returns today's date in "DD-MM-YYYY" format.
 */
export function getTodayDMY(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
