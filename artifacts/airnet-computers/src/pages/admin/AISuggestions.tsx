import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  SlidersHorizontal,
  Layers,
  Zap,
  TrendingUp,
  Cpu,
  Lock,
  Database,
  BarChart3,
  Rocket,
  Check,
  X,
  Clock,
  Info,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export type AIRecommendationItem = {
  id: string;
  category:
    | "New Features"
    | "Existing Feature Enhancements"
    | "UI/UX Improvements"
    | "Performance Optimization"
    | "Workflow Automation"
    | "Security Improvements"
    | "Database & Backend Optimization"
    | "Reporting & Analytics"
    | "Future Development Opportunities";
  name: string;
  explanation: string;
  whyNeeded: string;
  benefits: string;
  improvement: string;
  requirements: string;
  impact: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  complexity: "Easy" | "Moderate" | "Advanced";
  status: "pending" | "approved" | "rejected";
  updatedAt?: string;
};

const CATEGORIES = [
  "All",
  "New Features",
  "Existing Feature Enhancements",
  "UI/UX Improvements",
  "Performance Optimization",
  "Workflow Automation",
  "Security Improvements",
  "Database & Backend Optimization",
  "Reporting & Analytics",
  "Future Development Opportunities",
] as const;

export default function AISuggestions() {
  const [recommendations, setRecommendations] = useState<AIRecommendationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailModalItem, setDetailModalItem] = useState<AIRecommendationItem | null>(null);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/admin/ai-suggestions");
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        if (data.timestamp) {
          setLastAnalyzedAt(new Date(data.timestamp).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
        }
      }
    } catch (err) {
      console.error("Failed to load AI suggestions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleAction = async (id: string, action: "approve" | "reject" | "reset") => {
    try {
      setActionLoadingId(id);
      const res = await fetch("/api/admin/ai-suggestions/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: data.recommendation.status } : item))
        );
        if (detailModalItem && detailModalItem.id === id) {
          setDetailModalItem((prev) => (prev ? { ...prev, status: data.recommendation.status } : null));
        }
        showToast(
          action === "approve"
            ? `Approved: Recommendation ${id} authorized for future implementation.`
            : action === "reject"
            ? `Dismissed: Recommendation ${id} marked as rejected.`
            : `Reset: Recommendation ${id} reverted to pending.`
        );
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReanalyze = async () => {
    try {
      setIsAnalyzing(true);
      const res = await fetch("/api/admin/ai-suggestions/reanalyze", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
        setLastAnalyzedAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
        showToast("AI system scan complete: 18 intelligent recommendations evaluated across all modules.");
      }
    } catch (err) {
      console.error("Re-analysis error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = recommendations.length;
    const approved = recommendations.filter((r) => r.status === "approved").length;
    const rejected = recommendations.filter((r) => r.status === "rejected").length;
    const pending = recommendations.filter((r) => r.status === "pending").length;
    const critical = recommendations.filter((r) => r.priority === "Critical").length;
    const high = recommendations.filter((r) => r.priority === "High").length;
    return { total, approved, rejected, pending, critical, high };
  }, [recommendations]);

  // Filtered List
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      // Category
      if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
      // Status
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      // Priority
      if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.explanation.toLowerCase().includes(q) ||
          item.whyNeeded.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [recommendations, selectedCategory, statusFilter, priorityFilter, searchQuery]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "New Features":
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case "Existing Feature Enhancements":
        return <Zap className="w-4 h-4 text-blue-500" />;
      case "UI/UX Improvements":
        return <SlidersHorizontal className="w-4 h-4 text-emerald-500" />;
      case "Performance Optimization":
        return <TrendingUp className="w-4 h-4 text-cyan-500" />;
      case "Workflow Automation":
        return <Cpu className="w-4 h-4 text-purple-500" />;
      case "Security Improvements":
        return <Lock className="w-4 h-4 text-red-500" />;
      case "Database & Backend Optimization":
        return <Database className="w-4 h-4 text-indigo-500" />;
      case "Reporting & Analytics":
        return <BarChart3 className="w-4 h-4 text-teal-500" />;
      case "Future Development Opportunities":
        return <Rocket className="w-4 h-4 text-pink-500" />;
      default:
        return <Layers className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "Critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            Critical Priority
          </span>
        );
      case "High":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            High Priority
          </span>
        );
      case "Medium":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            Medium Priority
          </span>
        );
      case "Low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-700 border border-gray-200">
            Low Priority
          </span>
        );
      default:
        return null;
    }
  };

  const getComplexityBadge = (complexity: string) => {
    switch (complexity) {
      case "Easy":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Easy Implementation
          </span>
        );
      case "Moderate":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Moderate Complexity
          </span>
        );
      case "Advanced":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Advanced Architecture
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            Dismissed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#032e60] text-white px-4 py-3 rounded-xl shadow-xl border border-blue-400/30 flex items-center gap-3 animate-fade-in text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. TOP HEADER BANNER */}
      {/* ============================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#177d70]">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI-Powered Software Analysis & Recommendation Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#032e60] mt-1">
            AI Suggestions & Improvements
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-3xl">
            Intelligent recommendations to optimize efficiency, security, workflow automation, and citizen experience.
            Follows a strict <strong className="text-gray-700">recommendation-first approach</strong>—existing features remain 100% untouched until you approve.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleReanalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#032e60] hover:bg-[#0a3a75] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer disabled:opacity-75"
            title="Scan entire application and refresh recommendations"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? "Running AI Scan..." : "Run AI Re-Analysis"}</span>
          </button>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors"
          >
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. EXECUTIVE METRICS SCORECARD */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Total Insights</div>
          <div className="text-2xl font-bold text-[#032e60] mt-1">{metrics.total}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Across 9 Categories</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs text-amber-800 font-medium">Pending Review</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.pending}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Awaiting Your Input</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-xs text-emerald-800 font-medium">Approved</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.approved}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Ready for Next Phase</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-xs">
          <div className="text-xs text-red-800 font-medium">Critical Priority</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{metrics.critical}</div>
          <div className="text-[10px] text-red-600 mt-0.5">Immediate Value</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-xs text-blue-800 font-medium">High Priority</div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{metrics.high}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Core Enhancements</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Dismissed</div>
          <div className="text-2xl font-bold text-gray-600 mt-1">{metrics.rejected}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Can Be Restored</div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FILTERS & SEARCH CONTROLS */}
      {/* ============================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
        {/* Search & Status Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search recommendations by title, module, or benefit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#032e60] focus:border-transparent bg-gray-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segmented Control */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-semibold">
              {(["all", "pending", "approved", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                    statusFilter === st ? "bg-white text-[#032e60] shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {st === "all" ? "All Statuses" : st}
                </button>
              ))}
            </div>

            {/* Priority Dropdown */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#032e60]"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical Priority</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-colors flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#032e60] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat !== "All" && getCategoryIcon(cat)}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. RECOMMENDATIONS GRID */}
      {/* ============================================================== */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
          <RefreshCw className="w-8 h-8 animate-spin text-[#032e60] mx-auto mb-3" />
          <div className="text-base font-bold text-gray-800">Analyzing Airnet Computers Ecosystem...</div>
          <div className="text-xs text-gray-500 mt-1">Inspecting frontend components, database tables, and API endpoints.</div>
        </div>
      ) : filteredRecommendations.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200">
          <Info className="w-8 h-8 text-gray-400 mx-auto mb-3" />
          <div className="text-base font-bold text-gray-800">No Recommendations Match Current Filters</div>
          <div className="text-xs text-gray-500 mt-1">Try clearing your search query or selecting a different category.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecommendations.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border transition-all p-5 flex flex-col justify-between shadow-xs hover:shadow-md ${
                item.status === "approved"
                  ? "border-emerald-300 bg-emerald-50/10"
                  : item.status === "rejected"
                  ? "border-gray-200 opacity-60 bg-gray-50/40"
                  : item.priority === "Critical"
                  ? "border-red-200"
                  : "border-gray-200"
              }`}
            >
              <div>
                {/* Category & Status Bar */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    {getCategoryIcon(item.category)}
                    <span>{item.category}</span>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-[#032e60] leading-snug">
                  {item.name}
                </h3>

                {/* Badges: Priority & Complexity */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-3">
                  {getPriorityBadge(item.priority)}
                  {getComplexityBadge(item.complexity)}
                </div>

                {/* Explanation */}
                <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-3">
                  {item.explanation}
                </p>

                {/* Expected Benefit Highlight Box */}
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs text-gray-700 mb-4">
                  <strong className="text-emerald-700 block font-semibold mb-0.5">Expected Benefit:</strong>
                  <span>{item.benefits}</span>
                </div>
              </div>

              {/* Three User Actions: View Details, Approve, Reject */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2 mt-auto">
                <button
                  type="button"
                  onClick={() => setDetailModalItem(item)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#032e60] hover:bg-blue-50 transition-colors cursor-pointer"
                  title="View complete explanation and implementation requirements"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>View Details</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {item.status === "pending" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAction(item.id, "reject")}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        title="Dismiss recommendation"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAction(item.id, "approve")}
                        disabled={actionLoadingId === item.id}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] hover:bg-[#15803d] text-white transition-all shadow-xs cursor-pointer"
                        title="Authorize this recommendation for implementation"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                    </>
                  ) : item.status === "approved" ? (
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "reset")}
                      className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 underline"
                      title="Revert back to pending"
                    >
                      <span>Undo Approval</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "reset")}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline font-semibold"
                      title="Restore to pending"
                    >
                      <span>Restore to Pending</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. VIEW DETAILS MODAL */}
      {/* ============================================================== */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-4 sticky top-0 bg-white z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getCategoryIcon(detailModalItem.category)}
                  <span className="text-xs font-semibold text-gray-600">{detailModalItem.category}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs font-mono font-bold text-gray-500">{detailModalItem.id}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-[#032e60]">{detailModalItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs sm:text-sm text-gray-700">
              {/* Badges Bar */}
              <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-gray-100">
                {getPriorityBadge(detailModalItem.priority)}
                {getComplexityBadge(detailModalItem.complexity)}
                {getStatusBadge(detailModalItem.status)}
              </div>

              {/* Detailed Explanation */}
              <div>
                <h4 className="font-bold text-[#032e60] uppercase text-[11px] tracking-wider mb-1">Detailed Explanation</h4>
                <p className="text-gray-600 leading-relaxed bg-gray-50/60 p-3 rounded-xl border border-gray-100">
                  {detailModalItem.explanation}
                </p>
              </div>

              {/* Why It Is Needed */}
              <div>
                <h4 className="font-bold text-amber-800 uppercase text-[11px] tracking-wider mb-1">Why It Is Needed</h4>
                <p className="text-gray-600 leading-relaxed bg-amber-50/30 p-3 rounded-xl border border-amber-100">
                  {detailModalItem.whyNeeded}
                </p>
              </div>

              {/* Expected Benefits */}
              <div>
                <h4 className="font-bold text-emerald-800 uppercase text-[11px] tracking-wider mb-1">Expected Benefits</h4>
                <p className="text-gray-600 leading-relaxed bg-emerald-50/30 p-3 rounded-xl border border-emerald-100">
                  {detailModalItem.benefits}
                </p>
              </div>

              {/* How It Will Improve Existing Application */}
              <div>
                <h4 className="font-bold text-blue-800 uppercase text-[11px] tracking-wider mb-1">How It Improves Existing Application</h4>
                <p className="text-gray-600 leading-relaxed bg-blue-50/30 p-3 rounded-xl border border-blue-100">
                  {detailModalItem.improvement}
                </p>
              </div>

              {/* Implementation Requirements */}
              <div>
                <h4 className="font-bold text-[#032e60] uppercase text-[11px] tracking-wider mb-1">Implementation Requirements</h4>
                <p className="text-gray-600 leading-relaxed font-mono text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                  {detailModalItem.requirements}
                </p>
              </div>

              {/* Impact on Existing Modules */}
              <div>
                <h4 className="font-bold text-purple-800 uppercase text-[11px] tracking-wider mb-1">Impact on Existing Modules</h4>
                <p className="text-gray-600 leading-relaxed bg-purple-50/30 p-3 rounded-xl border border-purple-100">
                  {detailModalItem.impact}
                </p>
              </div>
            </div>

            {/* Modal Footer with Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/80 rounded-b-2xl flex items-center justify-between gap-3 sticky bottom-0">
              <span className="text-xs text-gray-500">
                Action requires explicit administrator approval.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailModalItem(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>

                {detailModalItem.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(detailModalItem.id, "reject")}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(detailModalItem.id, "approve")}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#16a34a] text-white hover:bg-[#15803d] transition-colors"
                    >
                      Authorize & Approve
                    </button>
                  </>
                ) : detailModalItem.status === "approved" ? (
                  <button
                    type="button"
                    onClick={() => handleAction(detailModalItem.id, "reset")}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-200 underline"
                  >
                    Reset to Pending
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAction(detailModalItem.id, "reset")}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-100 underline"
                  >
                    Restore to Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
