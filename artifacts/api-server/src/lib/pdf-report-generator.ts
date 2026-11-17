import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { DailyReportMetrics } from "./daily-report-engine";
import { getAdminMobileNumber } from "./admin-auth-service";

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

      // Brand Title
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#032e60")
        .text("AIRNET COMPUTERS", brandTextX, headerY);

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#177d70")
        .text("ONLINE SERVICE CENTER & CITIZEN FACILITATION HUB", brandTextX, headerY + 18);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#475569")
        .text("Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327", brandTextX, headerY + 30)
        .text(`Proprietor: Md Amjad Ali | Helpline: ${helplinePhone} | Email: airnetcomputersbk@gmail.com`, brandTextX, headerY + 41);

      // Right metadata box
      const metaBoxWidth = 180;
      const metaBoxX = pageWidth - margin - metaBoxWidth;
      doc
        .roundedRect(metaBoxX, headerY - 2, metaBoxWidth, 54, 6)
        .lineWidth(1)
        .strokeColor("#cbd5e1")
        .fillAndStroke("#f8fafc", "#cbd5e1");

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#032e60")
        .text("DAILY AUDIT REPORT", metaBoxX + 10, headerY + 5, { width: metaBoxWidth - 20, align: "right" });

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#334155")
        .text(`Date: ${metrics.reportDate}`, metaBoxX + 10, headerY + 18, { width: metaBoxWidth - 20, align: "right" })
        .text(`Period: 12:00 AM – 11:59 PM`, metaBoxX + 10, headerY + 28, { width: metaBoxWidth - 20, align: "right" })
        .text(`Timezone: Asia/Kolkata (IST)`, metaBoxX + 10, headerY + 38, { width: metaBoxWidth - 20, align: "right" });

      // Horizontal separator rule
      let currentY = headerY + 62;
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
        .text("A. EXECUTIVE PERFORMANCE & FINANCIAL SUMMARY", margin, currentY);

      currentY += 16;

      const cardGap = 8;
      const cardWidth = (contentWidth - cardGap * 2) / 3; // ~169 pt
      const cardHeight = 44;

      const summaryCards = [
        {
          label: "Requests Received Today",
          value: String(metrics.requestsReceivedToday),
          sub: "Inbound requests",
          border: "#bfdbfe",
          bg: "#eff6ff",
          textCol: "#1e40af",
        },
        {
          label: "Requests Completed Today",
          value: String(metrics.requestsCompletedToday),
          sub: "Finished & verified",
          border: "#bbf7d0",
          bg: "#f0fdf4",
          textCol: "#15803d",
        },
        {
          label: "Payments Collected Today",
          value: `₹${metrics.totalPaymentAmountToday.toLocaleString("en-IN")}`,
          sub: `${metrics.paymentsReceivedTodayCount} payments`,
          border: "#fed7aa",
          bg: "#fff7ed",
          textCol: "#c2410c",
        },
        {
          label: "Pending Active Requests",
          value: String(metrics.requestsPendingEnd),
          sub: "Awaiting completion",
          border: "#e2e8f0",
          bg: "#f8fafc",
          textCol: "#0f172a",
        },
        {
          label: "Overdue Attention Requests",
          value: String(metrics.overdueRequestsCount),
          sub: metrics.overdueRequestsCount > 0 ? "Target date passed" : "All on schedule",
          border: metrics.overdueRequestsCount > 0 ? "#fecaca" : "#e2e8f0",
          bg: metrics.overdueRequestsCount > 0 ? "#fef2f2" : "#f8fafc",
          textCol: metrics.overdueRequestsCount > 0 ? "#b91c1c" : "#475569",
        },
        {
          label: "Total Outstanding Udhar",
          value: `₹${metrics.totalOutstandingAmount.toLocaleString("en-IN")}`,
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
          .text(c.label.toUpperCase(), cx + 8, currentY + 6, { width: cardWidth - 16 });

        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor(c.textCol)
          .text(c.value, cx + 8, currentY + 18, { width: cardWidth - 16 });

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748b")
          .text(c.sub, cx + 8, currentY + 33, { width: cardWidth - 16 });
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
          .text(c.label.toUpperCase(), cx + 8, currentY + 6, { width: cardWidth - 16 });

        doc
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor(c.textCol)
          .text(c.value, cx + 8, currentY + 18, { width: cardWidth - 16 });

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748b")
          .text(c.sub, cx + 8, currentY + 33, { width: cardWidth - 16 });
      }

      currentY += cardHeight + 14;

      // ==============================================================
      // 3. REQUEST STATUS BREAKDOWN TABLE
      // ==============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#032e60")
        .text("B. REQUEST STATUS BREAKDOWN (CURRENT VS TODAY'S TRANSITIONS)", margin, currentY);

      currentY += 14;

      // Table Header
      const tableX = margin;
      const colWidths = [110, 90, 110, 213.28];
      const tableRowHeight = 17;

      doc
        .rect(tableX, currentY, contentWidth, 18)
        .fill("#032e60");

      doc
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .fillColor("#ffffff")
        .text("REQUEST STATUS", tableX + 8, currentY + 5)
        .text("CURRENT TOTAL", tableX + colWidths[0] + 8, currentY + 5)
        .text("TODAY'S ACTIVITY", tableX + colWidths[0] + colWidths[1] + 8, currentY + 5)
        .text("OPERATIONAL DESCRIPTION / ACTIONS", tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 5);

      currentY += 18;

      // Table Rows
      metrics.statusBreakdown.forEach((row, idx) => {
        const rowBg = idx % 2 === 0 ? "#f8fafc" : "#ffffff";
        doc
          .rect(tableX, currentY, contentWidth, tableRowHeight)
          .lineWidth(0.5)
          .fillAndStroke(rowBg, "#e2e8f0");

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#032e60")
          .text(row.status, tableX + 8, currentY + 4);

        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .fillColor("#0f172a")
          .text(String(row.currentTotal), tableX + colWidths[0] + 8, currentY + 4);

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(row.todayActivity > 0 ? "#15803d" : "#64748b")
          .text(row.todayActivity > 0 ? `+${row.todayActivity} today` : "—", tableX + colWidths[0] + colWidths[1] + 8, currentY + 4);

        doc
          .font("Helvetica")
          .fontSize(7.5)
          .fillColor("#475569")
          .text(row.description, tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, currentY + 4, {
            width: colWidths[3] - 16,
            ellipsis: true,
          });

        currentY += tableRowHeight;
      });

      currentY += 12;

      // ==============================================================
      // 4. IMMEDIATE ATTENTION REQUIRED SECTION
      // ==============================================================
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#b91c1c")
        .text("C. IMMEDIATE ATTENTION REQUIRED (OVERDUE, UNHANDLED & PENDING DUES)", margin, currentY);

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
          .text("✓ ALL APPLICATIONS ON SCHEDULE — NO CRITICAL OVERDUE TASKS OR BLOCKED REQUESTS", margin + 12, currentY + 7);

        currentY += 32;
      } else {
        const attColWidths = [70, 95, 75, 110, 85, 88.28];
        const attRowHeight = 17;

        // Header
        doc.rect(tableX, currentY, contentWidth, 18).fill("#b91c1c");

        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#ffffff")
          .text("CUST ID", tableX + 6, currentY + 5)
          .text("APPLICANT NAME", tableX + attColWidths[0] + 6, currentY + 5)
          .text("MOBILE", tableX + attColWidths[0] + attColWidths[1] + 6, currentY + 5)
          .text("SERVICE", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + 6, currentY + 5)
          .text("ISSUE / FLAG", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + 6, currentY + 5)
          .text("DETAILS / DUE", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + attColWidths[4] + 6, currentY + 5);

        currentY += 18;

        metrics.immediateAttention.slice(0, 6).forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? "#fff1f2" : "#ffffff";
          doc
            .rect(tableX, currentY, contentWidth, attRowHeight)
            .lineWidth(0.5)
            .fillAndStroke(rowBg, "#fecdd3");

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.customerId || "—", tableX + 6, currentY + 5);

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#0f172a")
            .text(item.customerName || "—", tableX + attColWidths[0] + 6, currentY + 5, { width: attColWidths[1] - 8, ellipsis: true });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#475569")
            .text(item.mobileNumber ? `+91 ${item.mobileNumber}` : "—", tableX + attColWidths[0] + attColWidths[1] + 6, currentY + 5);

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.serviceName || "—", tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + 6, currentY + 5, { width: attColWidths[3] - 8, ellipsis: true });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(item.issueType === "Overdue Task" ? "#b91c1c" : item.issueType === "Pending Udhar / Balance" ? "#854d0e" : "#0369a1")
            .text(item.issueType, tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + 6, currentY + 5);

          const dueAmountText =
            typeof item.amountPending === "number" && item.amountPending > 0
              ? `₹${item.amountPending.toLocaleString("en-IN")}`
              : "₹0";

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor(item.amountPending && item.amountPending > 0 ? "#b91c1c" : "#64748b")
            .text(
              dueAmountText,
              tableX + attColWidths[0] + attColWidths[1] + attColWidths[2] + attColWidths[3] + attColWidths[4] + 6,
              currentY + 5,
              { width: attColWidths[5] - 8, ellipsis: true }
            );

          currentY += attRowHeight;
        });

        currentY += 12;
      }

      // ==============================================================
      // 5. REQUESTS COMPLETED TODAY OR RECENT ACTIVITY
      // ==============================================================
      if (currentY > 680) {
        doc.addPage();
        currentY = margin;
      }

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#032e60")
        .text("D. COMPLETED REQUESTS & PAYMENTS AUDIT LOG TODAY", margin, currentY);

      currentY += 14;

      if (metrics.completedTodayList.length === 0 && metrics.paymentsTodayList.length === 0) {
        doc
          .roundedRect(margin, currentY, contentWidth, 24, 4)
          .lineWidth(0.5)
          .fillAndStroke("#f8fafc", "#e2e8f0");

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#64748b")
          .text("No requests completed or payment transactions finalized during this specific reporting date window.", margin + 12, currentY + 7);

        currentY += 32;
      } else {
        const compColWidths = [80, 110, 85, 140, 108.28];
        const compRowHeight = 17;

        doc.rect(tableX, currentY, contentWidth, 18).fill("#1e40af");

        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#ffffff")
          .text("CUST ID", tableX + 6, currentY + 5)
          .text("APPLICANT NAME", tableX + compColWidths[0] + 6, currentY + 5)
          .text("MOBILE", tableX + compColWidths[0] + compColWidths[1] + 6, currentY + 5)
          .text("SERVICE COMPLETED", tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + 6, currentY + 5)
          .text("COMPLETION TIME (IST)", tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + compColWidths[3] + 6, currentY + 5);

        currentY += 18;

        metrics.completedTodayList.slice(0, 8).forEach((item, idx) => {
          const rowBg = idx % 2 === 0 ? "#f0fdf4" : "#ffffff";
          doc
            .rect(tableX, currentY, contentWidth, compRowHeight)
            .lineWidth(0.5)
            .fillAndStroke(rowBg, "#bbf7d0");

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.customerId || "—", tableX + 6, currentY + 5);

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#0f172a")
            .text(item.customerName || "—", tableX + compColWidths[0] + 6, currentY + 5, { width: compColWidths[1] - 8, ellipsis: true });

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#475569")
            .text(`+91 ${item.mobileNumber}`, tableX + compColWidths[0] + compColWidths[1] + 6, currentY + 5);

          doc
            .font("Helvetica")
            .fontSize(7)
            .fillColor("#032e60")
            .text(item.serviceName, tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + 6, currentY + 5, { width: compColWidths[3] - 8, ellipsis: true });

          doc
            .font("Helvetica-Bold")
            .fontSize(7)
            .fillColor("#15803d")
            .text(`✓ ${item.completedAt}`, tableX + compColWidths[0] + compColWidths[1] + compColWidths[2] + compColWidths[3] + 6, currentY + 5);

          currentY += compRowHeight;
        });

        currentY += 14;
      }

      // Financial totals summary banner at bottom
      if (currentY > 720) {
        doc.addPage();
        currentY = margin;
      }

      doc
        .roundedRect(margin, currentY, contentWidth, 34, 5)
        .lineWidth(1)
        .fillAndStroke("#061f3d", "#032e60");

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#f2b544")
        .text("OVERALL FINANCIAL AUDIT OVERVIEW", margin + 12, currentY + 7);

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#ffffff")
        .text(
          `Total Billing: ₹${metrics.totalHistoricalBilled.toLocaleString("en-IN")}  |  Collected Today: ₹${metrics.totalPaymentAmountToday.toLocaleString("en-IN")}  |  Total Historical Collected: ₹${metrics.totalHistoricalCollected.toLocaleString("en-IN")}  |  Active Outstanding Udhar: ₹${metrics.totalOutstandingAmount.toLocaleString("en-IN")}`,
          margin + 12,
          currentY + 18
        );

      // ==============================================================
      // FOOTER ON ALL PAGES
      // ==============================================================
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);

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
            pageHeight - 24
          );

        doc
          .font("Helvetica-Bold")
          .fontSize(7)
          .fillColor("#032e60")
          .text(`Page ${i + 1} of ${range.count}`, pageWidth - margin - 80, pageHeight - 24, {
            width: 80,
            align: "right",
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
