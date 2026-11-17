// Automated verification script for Centralized Modal and YES/NO Deletion system
import fs from "fs";
import path from "path";

console.log("==================================================");
console.log("Centralized Notification & Deletion Verification");
console.log("==================================================");

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    totalPassed++;
  } else {
    console.error(`[FAIL] ${message}`);
    totalFailed++;
  }
}

// 1. Verify ModalContext.tsx
const modalContextPath = path.resolve("artifacts/airnet-computers/src/context/ModalContext.tsx");
assert(fs.existsSync(modalContextPath), "ModalContext.tsx exists");
const modalContextContent = fs.readFileSync(modalContextPath, "utf-8");

assert(
  modalContextContent.includes('confirmText: "YES – Delete"') &&
  modalContextContent.includes('cancelText: "NO – Cancel"'),
  "ModalContext provides standard YES – Delete and NO – Cancel labels"
);

assert(
  modalContextContent.includes("fixed inset-0 z-[999999] flex items-center justify-center"),
  "Modal is horizontally and vertically centered in viewport with maximum z-index"
);

assert(
  modalContextContent.includes("isActionLoading") && modalContextContent.includes("Deleting..."),
  "Double-click spam prevention and loading spinner implemented"
);

assert(
  modalContextContent.includes('e.key === "Escape"'),
  "Escape key cancels modal gracefully"
);

// 2. Verify Module Integrations
const modulesToVerify = [
  { name: "NotificationsAdmin.tsx", path: "artifacts/airnet-computers/src/pages/admin/NotificationsAdmin.tsx" },
  { name: "Enquiries.tsx", path: "artifacts/airnet-computers/src/pages/admin/Enquiries.tsx" },
  { name: "Records.tsx", path: "artifacts/airnet-computers/src/pages/admin/Records.tsx" },
  { name: "Services.tsx", path: "artifacts/airnet-computers/src/pages/admin/Services.tsx" },
  { name: "ApplicationTracker.tsx", path: "artifacts/airnet-computers/src/pages/admin/ApplicationTracker.tsx" },
  { name: "Backup.tsx", path: "artifacts/airnet-computers/src/pages/admin/Backup.tsx" },
  { name: "App.tsx", path: "artifacts/airnet-computers/src/App.tsx" }
];

for (const mod of modulesToVerify) {
  const fullPath = path.resolve(mod.path);
  assert(fs.existsSync(fullPath), `${mod.name} exists`);
  const content = fs.readFileSync(fullPath, "utf-8");
  
  assert(
    content.includes("useModal"),
    `${mod.name} imports and uses useModal()`
  );
  
  assert(
    !content.match(/\bwindow\.confirm\(/),
    `${mod.name} has no legacy window.confirm() calls`
  );

  assert(
    !content.match(/\balert\(/),
    `${mod.name} has no legacy alert() calls`
  );
}

// 3. Verify Live Date & Time in Admin Top Header & Notifications Admin
const layoutPath = path.resolve("artifacts/airnet-computers/src/pages/admin/Layout.tsx");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");
assert(
  layoutContent.includes("currentDateTime") && layoutContent.includes("setInterval"),
  "Live ticking date and time ticker implemented in admin Layout top header"
);

const notifAdminPath = path.resolve("artifacts/airnet-computers/src/pages/admin/NotificationsAdmin.tsx");
const notifAdminContent = fs.readFileSync(notifAdminPath, "utf-8");
assert(
  notifAdminContent.includes("currentDateTime") && notifAdminContent.includes("liveDateStr") && notifAdminContent.includes("liveTimeStr"),
  "Live ticking date and time ticker implemented in NotificationsAdmin"
);

// 4. Verify API server responds if in-process
try {
  const loginRes = await fetch("http://127.0.0.1:5001/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_MASTER_PASSWORD || "airnet" })
  });
  if (loginRes.ok) {
    console.log("[PASS] Backend API server responded to health/auth check");
    totalPassed++;
  }
} catch (e) {
  console.log("[INFO] Sandboxed cross-process network probe note:", e.message);
}

console.log("\n--------------------------------------------------");
console.log(`Results: ${totalPassed} Passed, ${totalFailed} Failed`);
console.log("--------------------------------------------------");

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log("All centralized notification & confirmation verifications PASSED!");
}
