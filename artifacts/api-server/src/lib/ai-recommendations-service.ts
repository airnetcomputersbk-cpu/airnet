import fs from "fs";
import path from "path";
import { AIRecommendation, INITIAL_AI_RECOMMENDATIONS } from "./ai-recommendations-data";

const DATA_DIR = path.resolve(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "ai-recommendations-state.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getStoredRecommendations(): AIRecommendation[] {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    saveRecommendations(INITIAL_AI_RECOMMENDATIONS);
    return INITIAL_AI_RECOMMENDATIONS;
  }

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const stored = JSON.parse(raw) as AIRecommendation[];

    // Merge any new recommendations from INITIAL_AI_RECOMMENDATIONS that might not exist in stored
    const storedMap = new Map(stored.map((item) => [item.id, item]));
    const merged: AIRecommendation[] = [];

    for (const initItem of INITIAL_AI_RECOMMENDATIONS) {
      if (storedMap.has(initItem.id)) {
        const existing = storedMap.get(initItem.id)!;
        merged.push({
          ...initItem,
          status: existing.status,
          updatedAt: existing.updatedAt,
        });
      } else {
        merged.push(initItem);
      }
    }

    return merged;
  } catch (err) {
    console.error("Error reading AI recommendations state, resetting to initial:", err);
    saveRecommendations(INITIAL_AI_RECOMMENDATIONS);
    return INITIAL_AI_RECOMMENDATIONS;
  }
}

export function saveRecommendations(recommendations: AIRecommendation[]): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(recommendations, null, 2), "utf-8");
}

export function updateRecommendationStatus(
  id: string,
  action: "approve" | "reject" | "reset"
): { success: boolean; recommendation?: AIRecommendation; message: string } {
  const list = getStoredRecommendations();
  const target = list.find((item) => item.id === id);

  if (!target) {
    return { success: false, message: `Recommendation ${id} not found.` };
  }

  if (action === "approve") {
    target.status = "approved";
  } else if (action === "reject") {
    target.status = "rejected";
  } else {
    target.status = "pending";
  }
  target.updatedAt = new Date().toISOString();

  saveRecommendations(list);
  return {
    success: true,
    recommendation: target,
    message: `Recommendation ${id} updated to ${target.status}.`,
  };
}

export function reanalyzeSystem(): {
  timestamp: string;
  totalRecommendations: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  criticalCount: number;
  highCount: number;
  recommendations: AIRecommendation[];
} {
  const list = getStoredRecommendations();

  const approvedCount = list.filter((r) => r.status === "approved").length;
  const rejectedCount = list.filter((r) => r.status === "rejected").length;
  const pendingCount = list.filter((r) => r.status === "pending").length;
  const criticalCount = list.filter((r) => r.priority === "Critical").length;
  const highCount = list.filter((r) => r.priority === "High").length;

  return {
    timestamp: new Date().toISOString(),
    totalRecommendations: list.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    criticalCount,
    highCount,
    recommendations: list,
  };
}
