import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { DailyReportMetrics } from "./daily-report-engine";
import { getAdminMobileNumber } from "./admin-auth-service";

/**
 * Draws the official Indian Rupee (₹) vector glyph cleanly inside PDFKit.
 * This completely eliminates font encoding collisions (such as \u20B9 mapping to \xB9 '¹' in standard PostScript fonts)
 * and ensures that amounts like ₹0 render with a clean, crisp ₹ symbol and a normal digit 0.
 */
function drawRupeeGlyph(doc: PDFKit.PDFDocument, x: number, y: number, fontSize: number, color: string): number {
  doc.save();
  const h = fontSize * 0.72;
  const w = h * 0.65;
  const s = h / 24;
  const pathData =
    "M4 4h16v2.5H12.6c2.8 0.6 4.9 2.6 5.1 5.3H20v2.5h-2.3c-0.7 3.5-3.6 6.1-7.7 6.1H8.5l7.5 7.6h-3.6L4.5 20.4v-2.5h3.9c2.9 0 5.2-1.8 5.6-4.1H4v-2.5h9.4c-0.4-1.7-2.1-2.9-4.9-2.9H4V4z";
  doc.translate(x, y + fontSize * 0.12);
  doc.scale(s);
  doc.path(pathData).fillColor(color).fill();
  doc.restore();
  return w + 2; // return advance width for following text
}

export async function generateDailyReportPDF(metrics: DailyReportMetrics): Promise<Buffer> {
  const helplinePhone = await getAdminMobileNumber();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        bufferPages: true,
        info: {
          Title: `Airnet Daily Report - ${metrics.reportDate}`,
          Author: "Airnet Computers Online Service Center",
          Subject: "Daily Request, Milestone & Payment Audit Summary",
          Keywords: "Airnet, Daily Report, Government Services, Basavakalyan",
          CreationDate: new Date(),
        },
      });

      const buffers: Buffer[] = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 36;
      const contentWidth = pageWidth - margin * 2; // ~523.28 pt
      const footerSpace = 40;
      const maxContentY = pageHeight - footerSpace; // ~801.89 pt

      let currentY = 24;

      /**
       * Dynamic pagination helper:
       * Only adds a new page when actual content will exceed the printable area.
       * Maintains consistent top branding on subsequent pages and prevents orphan elements.
       */
      function ensureSpace(neededHeight: number): boolean {
        if (currentY + neededHeight > maxContentY) {
          doc.addPage();
          doc.rect(0, 0, pageWidth, 8).fill("#032e60");
          doc
            .font("Helvetica-Bold")
            .fontSize(8)
            .fillColor("#032e60")
            .text("AIRNET COMPUTERS — DAILY AUDIT REPORT (CONTINUED)", margin, margin + 4, { lineBreak: false });
          currentY = margin + 22;
          return true;
        }
        return false;
      }

      // ==============================================================
      // 1. HEADER SECTION
      // ==============================================================
      const logoPath = path.resolve(process.cwd(), "attached_assets/LOGO_1787581255968.png");
      const hasLogo = fs.existsSync(logoPath);

      // Top colored banner bar
      doc.rect(0, 0, pageWidth, 8).fill("#032e60");

      let headerY = 24;
      if (hasLogo) {
        try {
          doc.image(logoPath, margin, headerY, { fit: [52, 52] });
        } catch (e) {
          console.error("Failed to render logo into PDF", e);
        }
      }

      const brandTextX = hasLogo ? margin + 62 : margin;

      // Prepare Date, Time Period & Time Zone containers with content-based sizing
      const timeZoneLabel = metrics.timeZone
        ? metrics.timeZone.includes("IST")
          ? metrics.timeZone
          : `${metrics.timeZone} (IST)`
        : "Asia/Kolkata (IST)";

      const metaItems = [
        { label: `Date: ${metrics.reportDate}` },
        { label: "Time Period: 12:00 AM – 11:59 PM" },
        { label: `Time Zone: ${timeZoneLabel}` },
      ];

      doc.font("Helvetica-Bold").fontSize(7.5);
      const measuredBoxes = metaItems.map((item) => {
        const textWidth = doc.widthOfString(item.label);
        const boxWidth = Math.ceil(textWidth + 12);
        const boxHeight = 13;
        const boxX = pageWidth - margin - boxWidth;
        return { ...item, textWidth, boxWidth, boxHeight, boxX };
      });

      const widestBoxWidth = Math.max(...measuredBoxes.map((b) => b.boxWidth));
      const rightMetaStartX = pageWidth - margin - widestBoxWidth;

      // Brand Text (Company Title, Subtitle, Address, Proprietor Details)
      // Constrained to maxBrandWidth so it never overlaps or touches the right metadata containers
      const maxBrandWidth = Math.max(260, rightMetaStartX - brandTextX - 12);

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#032e60")
        .text("AIRNET COMPUTERS", brandTextX, headerY, { width: maxBrandWidth, lineBreak: false });

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#177d70")
        .text("ONLINE SERVICE CENTER & CITIZEN FACILITATION HUB", brandTextX, headerY + 18, { width: maxBrandWidth, lineBreak: false });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#475569")
        .text("Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327", brandTextX, headerY + 30, { width: maxBrandWidth, lineBreak: false })
        .text(`Proprietor: Md Amjad Ali | Helpline: ${helplinePhone} | Email: airnetcomputersbk@gmail.com`, brandTextX, headerY + 41, { width: maxBrandWidth, lineBreak: false });

      // Title above metadata boxes
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#032e60")
        .text("DAILY AUDIT REPORT", pageWidth - margin - 150, headerY + 1, { width: 150, align: "right", lineBreak: false });

      // Render the three bordered information boxes (Date, Time Period, Time Zone)
      let metaBoxY = headerY + 14;
      measuredBoxes.forEach((box) => {
        doc
          .roundedRect(box.boxX, metaBoxY, box.boxWidth, box.boxHeight, 3)
          .lineWidth(0.75)
          .strokeColor("#cbd5e1")
          .fillAndStroke("#f8fafc", "#cbd5e1");

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#334155")
          .text(box.label, box.boxX + 6, metaBoxY + 2.5, { lineBreak: false });

        metaBoxY += box.boxHeight + 3;
      });

      // Horizontal separator rule
      currentY = headerY + 64;
      doc
        .moveTo(margin, currentY)
        .lineTo(pageWidth - margin, currentY)
        .lineWidth(1.5)
        .strokeColor("#032e60");

      currentY += 12;

      // ==============================================================
      // 2. EXECUTIVE SUMMARY CARDS (6-BOX GRID)
      // ==============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#032e60")
        .text("A. EXECUTIVE PERFORMANCE & FINANCIAL SUMMARY", margin, currentY, { lineBreak: false });

      currentY += 16;

      const cardGap = 8;
      const cardWidth = (contentWidth - cardGap * 2) / 3; // ~169 pt
      const cardHeight = 44;

      const summaryCards = [
        {
          label: "Requests Received Today",
          value: String(metrics.requestsReceivedToday),
          isCurrency: false,
          sub: "Inbound requests",
          border: "#bfdbfe",
          bg: "#eff6ff",
          textCol: "#1e40af",
        },
        {
          label: "Requests Completed Today",
          value: String(metrics.requestsCompletedToday),
          isCurrency: false,
          sub: "Finished & verified",
          border: "#bbf7d0",
          bg: "#f0fdf4",
          textCol: "#15803d",
        },
        {
          label: "Payments Collected Today",
          value: metrics.totalPaymentAmountToday.toLocaleString("en-IN"),
          isCurrency: true,
          sub: `${metrics.paymentsReceivedTodayCount} payments`,
          border: "#fed7aa",
          bg: "#fff7ed",
          textCol: "#c2410c",
        },
        {
          label: "Pending Active Requests",
          value: String(metrics.requestsPendingEnd),
          isCurrency: false,
          sub: "Awaiting completion",
          border: "#e2e8f0",
          bg: "#f8fafc",
          textCol: "#0f172a",
        },
        {
          label: "Overdue Attention Requests",
          value: String(metrics.overdueRequestsCount),
          isCurrency: false,
          sub: metrics.overdueRequestsCount > 0 ? "Target date passed" : "All on schedule",
          border: metrics.overdueRequestsCount > 0 ? "#fecaca" : "#e2e8f0",
          bg: metrics.overdueRequestsCount > 0 ? "#fef2f2" : "#f8fafc",
          textCol: metrics.overdueRequestsCount > 0 ? "#b91c1c" : "#475569",
        },
        {
          label: "Total Outstanding Udhar",
          value: metrics.totalOutstandingAmount.toLocaleString("en-IN"),
          isCurrency: true,
          sub: `${metrics.requestsWithOutstandingBalanceCount} unpaid balance(s)`,
          border: metrics.totalOutstandingAmount > 0 ? "#fde68a" : "#e2e8f0",
          bg: metrics.totalOutstandingAmount > 0 ? "#fefce8" : "#f8fafc",
          textCol: metrics.totalOutstandingAmount > 0 ? "#854d0e" : "#475569",
        },
      ];

      // Draw Row 1
      for (let i = 0; i < 3; i++) {
        const c = summaryCards[i];
        const cx = margin + i * (cardWidth + cardGap);
        doc
          .roundedRect(cx, currentY, cardWidth, cardHeight, 5)
          .lineWidth(1)
          .fillAndStroke(c.bg, c.border);

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#475569")
          .text(c.label.toUpperCase(), cx + 8, currentY + 6, { width: cardWidth - 16, lineBreak: false });

        if (c.isCurrency) {
          const adv = drawRupeeGlyph(doc, cx + 8, currentY + 18, 14, c.textCol);
          doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(c.textCol)
            .text(c.value, cx + 8 + adv, currentY + 18, { lineBreak: false });
        } else {
          doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(c.textCol)
            .text(c.value, cx + 8, currentY + 18, { width: cardWidth - 16, lineBreak: false });
        }

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748b")
          .text(c.sub, cx + 8, currentY + 33, { width: cardWidth - 16, lineBreak: false });
      }

      currentY += cardHeight + cardGap;

      // Draw Row 2
      for (let i = 3; i < 6; i++) {
        const c = summaryCards[i];
        const cx = margin + (i - 3) * (cardWidth + cardGap);
        doc
          .roundedRect(cx, currentY, cardWidth, cardHeight, 5)
          .lineWidth(1)
          .fillAndStroke(c.bg, c.border);

        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#475569")
          .text(c.label.toUpperCase(), cx + 8, currentY + 6, { width: cardWidth - 16, lineBreak: false });

        if (c.isCurrency) {
          const adv = drawRupeeGlyph(doc, cx + 8, currentY + 18, 14, c.textCol);
          doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(c.textCol)
            .text(c.value, cx + 8 + adv, currentY + 18, { lineBreak: false });
        } else {
          doc
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(c.textCol)
            .text(c.value, cx + 8, currentY + 18, { width: cardWidth - 16, lineBreak: false });
        }

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748b")
          .text(c.sub, cx + 8, currentY + 33, { width: cardWidth - 16, lineBreak: false });
      }

      currentY += cardHeight + 14;

      // ==============================================================
      // 3. REQUEST STATUS BREAKDOWN TABLE
      // ==============================================================
      const tableX = margin;
      const colWidths = [110, 90, 110, 213.28];
      const tableRowHeight = 17;

      function drawSectionBHeader() {
        doc.rect(tableX, currentY, contentWidth, 18).fill("#032e60");
        doc
          .font("Helvetica-Bold")
          .fontSize(7.5)
          .fillColor("#ffffff")
          .text("REQUEST STATUS", tableX + 8, currentY + 5, { lineBreak: false })
          .text("CURRENT TOTAL", tableX + colWidths[0] + 8, currentY + 5, { lineBreak: false })
          .text("TODAY'S ACTIVITY", tableX + colWidths[0] + colWidths[1] + 8, currentY + 5, { lineBreak: false })
          .text("OPERATIONAL DESCRIPTION / ACTIONS", tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 5, { lineBreak: false });
        currentY += 18;
      }

      ensureSpace(14 + 18 + tableRowHeight);
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#032e60")
        .text("B. REQUEST STATUS BREAKDOWN (CURRENT VS TODAY'S TRANSITIONS)", margin, currentY, { lineBreak: false });

      currentY += 14;
      drawSectionBHeader();

      metrics.statusBreakdown.forEach((row, idx) => {
        const pageAdded = ensureSpace(tableRowHeight);
        if (pageAdded) {
          drawSectionBHeader();
        }

        const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        doc
          .rect(tableX, currentY, contentWidth, tableRowHeight)
          .lineWidth(0.5)
          .fillAndStroke(rowBg, "#e2e8f0");

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#032e60")
          .text(row.status, tableX + 8, currentY + 4, { lineBreak: false });

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#0f172a")
          .text(String(row.currentTotal), tableX + colWidths[0] + 8, currentY + 4, { lineBreak: false });

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(row.todayActivity > 0 ? "#15803d" : "#64748b")
          .text(row.todayActivity > 0 ? `+${row.todayActivity} today` : "—", tableX + colWidths[0] + colWidths[1] + 8, currentY + 4, { lineBreak: false });

        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor("#475569")
          .text(row.description, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 4, {
            width: colWidths[3] - 16,
            ellipsis: true,
            lineBreak: false,
          });

        currentY += tableRowHeight;
      });

      currentY += 12;

      // ==============================================================
      // 4. IMMEDIATE ATTENTION REQUIRED SECTION
      // ==============================================================
      const attColWidths = [70, 95, 75, 110, 85, 88.28];
      const attRowHeight = 17;

      function drawSectionCHeader() {
        doc.rect(tableX, currentY, contentWidth, 18).fill("#b91c1c");
        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#ffffff")
          .text("CUST ID", tableX + 6, currentY + 5, { lineBreak: false })
          .text("APPLICANT NAME", tableX + attColWidths[0] + 6, currentY + 5, { lineBreak: false })
          .text("MOBILE", tableX + attColWidths[0] + attColWidths[1] + 6, currentY + 5, { lineBreak: false })
          .text("SERVICE", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + 6, currentY + 5, { lineBreak: false })
          .text("ISSUE / FLAG", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + 6, currentY + 5, { lineBreak: false })
          .text("DETAILS / DUE", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + attColWidths[4] + 6, currentY + 5, { lineBreak: false });
        currentY += 18;
      }

      ensureSpace(14 + (metrics.immediateAttention.length === 0 ? 32 : 18 + attRowHeight));
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#b91c1c")
        .text("C. IMMEDIATE ATTENTION REQUIRED (OVERDUE, UNHANDLED & PENDING DUES)", margin, currentY, { lineBreak: false });

      currentY += 14;

      if (metrics.immediateAttention.length === 0) {
        doc
          .roundedRect(margin, currentY, contentWidth, 24, 4)
          .lineWidth(1)
          .fillAndStroke("#f0fdf4", "#bbf7d0");

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#15803d")
          .text("✓ ALL APPLICATIONS ON SCHEDULE — NO CRITICAL OVERDUE TASKS OR BLOCKED REQUESTS", margin + 12, currentY + 7, { lineBreak: false });

        currentY += 32;
      } else {
        drawSectionCHeader();

        metrics.immediateAttention.slice(0, 10).forEach((item, idx) => {
          const pageAdded = ensureSpace(attRowHeight);
          if (pageAdded) {
            drawSectionCHeader();
          }

          const rowBg = idx % 2 === 0 ? "#fff1f2" : "#ffffff";
          doc
            .rect(tableX, currentY, contentWidth, attRowHeight)
            .lineWidth(0.5)
            .fillAndStroke(rowBg, "#fecdd3");

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.customerId || "—", tableX + 6, currentY + 5, { lineBreak: false });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#0f172a")
            .text(item.customerName || "—", tableX + attColWidths[0] + 6, currentY + 5, { width: attColWidths[1] - 8, ellipsis: true, lineBreak: false });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#475569")
            .text(item.mobileNumber ? `+91 ${item.mobileNumber}` : "—", tableX + attColWidths[0] + attColWidths[1] + 6, currentY + 5, { lineBreak: false });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.serviceName || "—", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + 6, currentY + 5, { width: attColWidths[3] - 8, ellipsis: true, lineBreak: false });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(item.issueType === "Overdue Task" ? "#b91c1c" : item.issueType === "Pending Udhar / Balance" ? "#854d0e" : "#0369a1")
            .text(item.issueType, tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + 6, currentY + 5, { lineBreak: false });

          const hasPending = typeof item.amountPending === "number" && item.amountPending > 0;
          const dueVal = hasPending ? item.amountPending.toLocaleString("en-IN") : "0";
          const dueColX = tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + attColWidths[4] + 6;
          const dueColor = hasPending ? "#b91c1c" : "#64748b";

          const adv = drawRupeeGlyph(doc, dueColX, currentY + 4, 7, dueColor);
          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(dueColor)
            .text(dueVal, dueColX + adv, currentY + 5, { lineBreak: false });

          currentY += attRowHeight;
        });

        currentY += 12;
      }

      // ==============================================================
      // 5. REQUESTS COMPLETED TODAY OR RECENT ACTIVITY
      // ==============================================================
      const compColWidths = [80, 110, 85, 140, 108.28];
      const compRowHeight = 17;

      function drawSectionDHeader() {
        doc.rect(tableX, currentY, contentWidth, 18).fill("#1e40af");
        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#ffffff")
          .text("CUST ID", tableX + 6, currentY + 5, { lineBreak: false })
          .text("APPLICANT NAME", tableX + compColWidths[0] + 6, currentY + 5, { lineBreak: false })
          .text("MOBILE", tableX + compColWidths[0] + compColWidths[1] + 6, currentY + 5, { lineBreak: false })
          .text("SERVICE COMPLETED", tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + 6, currentY + 5, { lineBreak: false })
          .text("COMPLETION TIME (IST)", tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + compColWidths[3] + 6, currentY + 5, { lineBreak: false });
        currentY += 18;
      }

      const hasCompleted = metrics.completedTodayList.length > 0 || metrics.paymentsTodayList.length > 0;
      ensureSpace(14 + (hasCompleted ? 18 + compRowHeight : 32));

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#032e60")
        .text("D. COMPLETED REQUESTS & PAYMENTS AUDIT LOG TODAY", margin, currentY, { lineBreak: false });

      currentY += 14;

      if (!hasCompleted) {
        doc
          .roundedRect(margin, currentY, contentWidth, 24, 4)
          .lineWidth(0.5)
          .fillAndStroke("#f8fafc", "#e2e8f0");

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#64748b")
          .text("No requests completed or payment transactions finalized during this specific reporting date window.", margin + 12, currentY + 7, { lineBreak: false });

        currentY += 32;
      } else {
        drawSectionDHeader();

        metrics.completedTodayList.forEach((item, idx) => {
          const pageAdded = ensureSpace(compRowHeight);
          if (pageAdded) {
            drawSectionDHeader();
          }

          const rowBg = idx % 2 === 0 ? "#f0fdf4" : "#ffffff";
          doc
            .rect(tableX, currentY, contentWidth, compRowHeight)
            .lineWidth(0.5)
            .fillAndStroke(rowBg, "#bbf7d0");

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.customerId || "—", tableX + 6, currentY + 5, { lineBreak: false });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#0f172a")
            .text(item.customerName || "—", tableX + compColWidths[0] + 6, currentY + 5, { width: compColWidths[1] - 8, ellipsis: true, lineBreak: false });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#475569")
            .text(`+91 ${item.mobileNumber}`, tableX + compColWidths[0] + compColWidths[1] + 6, currentY + 5, { lineBreak: false });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.serviceName, tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + 6, currentY + 5, { width: compColWidths[3] - 8, ellipsis: true, lineBreak: false });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#15803d")
            .text(`✓ ${item.completedAt}`, tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + compColWidths[3] + 6, currentY + 5, { lineBreak: false });

          currentY += compRowHeight;
        });

        currentY += 14;
      }

      // ==============================================================
      // 6. FINANCIAL TOTALS SUMMARY BANNER
      // ==============================================================
      ensureSpace(42);
      doc
        .roundedRect(margin, currentY, contentWidth, 34, 5)
        .lineWidth(1)
        .fillAndStroke("#061f3d", "#032e60");

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#f2b544")
        .text("OVERALL FINANCIAL AUDIT OVERVIEW", margin + 12, currentY + 7, { lineBreak: false });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#ffffff")
        .text(
          `Total Billing: Rs. ${metrics.totalHistoricalBilled.toLocaleString("en-IN")}  |  Collected Today: Rs. ${metrics.totalPaymentAmountToday.toLocaleString("en-IN")}  |  Total Historical Collected: Rs. ${metrics.totalHistoricalCollected.toLocaleString("en-IN")}  |  Active Outstanding Udhar: Rs. ${metrics.totalOutstandingAmount.toLocaleString("en-IN")}`,
          margin + 12,
          currentY + 18,
          { lineBreak: false }
        );

      // ==============================================================
      // 7. FOOTER ON ALL GENERATED PAGES
      // ==============================================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.bottom = 0;

        // Bottom separator
        doc
          .moveTo(margin, pageHeight - 32)
          .lineTo(pageWidth - margin, pageHeight - 32)
          .lineWidth(0.5)
          .strokeColor("#cbd5e1");

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748b")
          .text(
            `AIRNET COMPUTERS • Basavakalyan • Official Daily Report • Generated on ${metrics.generatedAtIST}`,
            margin,
            pageHeight - 24,
            { lineBreak: false }
          );

        const pageText = `Page ${i + 1} of ${range.count}`;
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#032e60");
        const textW = doc.widthOfString(pageText);
        doc.text(pageText, pageWidth - margin - textW, pageHeight - 24, { lineBreak: false });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
