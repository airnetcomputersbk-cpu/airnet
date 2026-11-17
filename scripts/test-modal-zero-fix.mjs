// Verification test: Ensure no rogue "0" is rendered by ModalContext
import fs from "fs";

console.log("==================================================================");
console.log("VERIFYING MODAL CONTEXT ROGUE '0' FIX");
console.log("==================================================================");

const fileContent = fs.readFileSync("artifacts/airnet-computers/src/context/ModalContext.tsx", "utf-8");

// Check line with duration
const hasUnsafeDuration = fileContent.includes("{modal.duration && modal.duration > 0 &&");
const hasSafeDuration = fileContent.includes("{Boolean(modal.duration && modal.duration > 0) &&");

if (hasUnsafeDuration) {
  console.error("[FAIL] Found unsafe '{modal.duration && modal.duration > 0 &&' which renders '0' in React JSX when duration === 0!");
  process.exit(1);
}

if (!hasSafeDuration) {
  console.error("[FAIL] Safe Boolean conversion '{Boolean(modal.duration && modal.duration > 0) &&' not found!");
  process.exit(1);
}

console.log("[PASS] Unsafe numeric short-circuit evaluation has been removed.");
console.log("[PASS] Safe boolean conversion '{Boolean(modal.duration && modal.duration > 0) &&' is active.");
console.log("\n>>> MODAL '0' REMOVAL VERIFIED 100% <<<");
