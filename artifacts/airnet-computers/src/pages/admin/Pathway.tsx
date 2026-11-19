import React, { useState } from "react";
import {
  Route,
  Search,
  ExternalLink,
  User,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  IndianRupee,
  RefreshCw,
  FolderOpen,
  Filter,
  Maximize2,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  ArrowRight,
  SlidersHorizontal,
  AppWindow,
  Lock,
  Unlock,
  Bookmark,
  Copy,
  Check,
  Globe,
  Layers,
  Laptop
} from "lucide-react";
import { usePathway, PathwayCustomer } from "../../context/PathwayContext";

export default function PathwayPage() {
  const {
    customers,
    activeCustomer,
    isLoading,
    openPathway,
    refreshPathwayData,
    isOpen,
    isLocked,
    toggleLock,
    showDateTime,
    toggleDateTime,
  } = usePathway();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  const embedOrigin = typeof window !== "undefined" && window.location.port !== "5000" ? window.location.origin : "http://localhost:5001";
  const bookmarkletCode = `javascript:(function(){var s=document.createElement('script');s.src='${embedOrigin}/api/pathway/embed.js?t='+Date.now();document.body.appendChild(s);})();`;

  const openStandaloneWindow = () => {
    window.open(
      "/admin/pathway/popout",
      "AirnetPathwayDossier",
      "width=520,height=700,status=no,toolbar=no,menubar=no,scrollbars=yes"
    );
  };

  const customerList = Array.isArray(customers) ? customers : [];

  const filtered = customerList.filter((c) => {
    if (!c) return false;
    const q = (search || "").toLowerCase();
    const matchesSearch =
      (c.customerName || "").toLowerCase().includes(q) ||
      String(c.customerId || "").toLowerCase().includes(q) ||
      String(c.mobileNumber || "").includes(q) ||
      (c.serviceName || "").toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" ||
      String(c.applicationStatus || "").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Analytics stats
  const totalCustomers = customerList.length;
  const inProgressCount = customerList.filter(
    (c) => String(c?.applicationStatus || "").toLowerCase() === "in progress"
  ).length;
  const completedCount = customerList.filter(
    (c) => String(c?.applicationStatus || "").toLowerCase() === "completed"
  ).length;
  const pendingCount = customerList.filter(
    (c) => {
      const s = String(c?.applicationStatus || "").toLowerCase();
      return s === "pending" || s === "new";
    }
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* =====================================================================
          PAGE HEADER WITH FLOATING WINDOW LAUNCHER
         ===================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#022349] to-blue-600 flex items-center justify-center text-white shadow-md">
              <Route className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#032e60] tracking-tight">
                Pathway Hub & Customer Processing
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Always-on-top draggable & resizable desktop dossier connected via secure website APIs
              </p>
            </div>
          </div>
        </div>

        {/* Global Floating Window Launcher & Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleLock}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isLocked
                ? "bg-amber-50 border-amber-300 text-amber-800 shadow-2xs"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
            }`}
            title={isLocked ? "Pathway Screen is Locked. Click to unlock." : "Lock Pathway Screen in place."}
          >
            {isLocked ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
            <span>{isLocked ? "Screen Locked" : "Lock Position"}</span>
          </button>

          <button
            type="button"
            onClick={toggleDateTime}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              showDateTime
                ? "bg-blue-50 border-blue-200 text-blue-700 shadow-2xs"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
            }`}
            title="Toggle Live Date & Time Ribbon on Pathway Window"
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Time Ribbon</span>
          </button>

          <button
            type="button"
            onClick={refreshPathwayData}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Refresh customer data from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => openPathway(activeCustomer || (customers[0] ?? null))}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <AppWindow className="w-4 h-4" />
            <span>{isOpen ? "Bring Window to Front" : "Open Floating Desktop Window"}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          ACCESS ON OTHER WEBSITES & TABS (Government Portals, Seva Sindhu, Nadakacheri)
         ===================================================================== */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-[#022349] text-white p-5 rounded-2xl shadow-lg border border-cyan-500/30 relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-400/30 uppercase tracking-wider flex items-center gap-1">
                  <Globe size={11} />
                  <span>Cross-Website & Multi-Tab Enabled</span>
                </span>
                <span className="text-cyan-200 text-xs font-medium">• Seva Sindhu, Nadakacheri, PAN, Passport & All Portals</span>
              </div>
              <h2 className="text-base font-extrabold text-white mt-1">
                Access Customer Pathway on Any External Website or Browser Tab
              </h2>
              <p className="text-xs text-blue-100/90 max-w-3xl mt-0.5">
                Work seamlessly across other tabs and government websites with live customer data, 1-click field copying, and document viewing.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={openStandaloneWindow}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="Open Independent Companion Window"
              >
                <ExternalLink size={13} />
                <span>Open Popout Window</span>
              </button>
            </div>
          </div>

          {/* 3 Quick Launch Methods */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-white/10">
            {/* Method 1: Bookmarklet */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs mb-1">
                  <Bookmark size={14} />
                  <span>1. Universal Bookmarklet (Any Website)</span>
                </div>
                <p className="text-[11px] text-blue-100/80 leading-relaxed">
                  Drag the button below to your Chrome/Edge bookmarks bar. Click it on any government website to inject the floating dossier!
                </p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    // Prevent normal navigation if clicked directly
                    e.preventDefault();
                    navigator.clipboard.writeText(bookmarkletCode);
                    setCopiedBookmarklet(true);
                    setTimeout(() => setCopiedBookmarklet(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg text-xs font-bold shadow-md cursor-grab active:cursor-grabbing inline-flex items-center gap-1.5"
                  title="Drag this button to your Bookmarks Bar (or click to copy code)"
                >
                  <Bookmark size={12} />
                  <span>{copiedBookmarklet ? "Copied Link!" : "📍 Drag to Bookmarks"}</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookmarkletCode);
                    setCopiedBookmarklet(true);
                    setTimeout(() => setCopiedBookmarklet(false), 2000);
                  }}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-cyan-200 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  {copiedBookmarklet ? "✓ Copied" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* Method 2: Picture-in-Picture (Always on Top) */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs mb-1">
                  <Layers size={14} />
                  <span>2. Always-On-Top Floating Mode</span>
                </div>
                <p className="text-[11px] text-blue-100/80 leading-relaxed">
                  Pops Pathway into an OS-level always-on-top window that stays pinned over all other browser tabs and external websites.
                </p>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => openPathway(activeCustomer || (customers[0] ?? null))}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Laptop size={12} />
                  <span>Launch Always-On-Top</span>
                </button>
              </div>
            </div>

            {/* Method 3: Chrome Extension */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs mb-1">
                  <Sparkles size={14} />
                  <span>3. Chrome Extension (Alt + P)</span>
                </div>
                <p className="text-[11px] text-blue-100/80 leading-relaxed">
                  Permanently available in <code className="bg-black/30 px-1 py-0.5 rounded text-[10px]">extensions/pathway-chrome-extension</code>. Load unpacked in Chrome for instant shortcut access anywhere!
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-amber-200 font-semibold">
                <span>Shortcut: <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">Alt</kbd> + <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">P</kbd></span>
                <span className="text-emerald-400 font-bold">● Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          FEATURE SPOTLIGHT BANNER
         ===================================================================== */}
      <div className="bg-gradient-to-r from-[#032e60] via-[#044085] to-[#0d59a8] text-white p-5 rounded-2xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-cyan-400/20 text-cyan-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-cyan-300/30 uppercase tracking-wider">
                Multi-Monitor Ready
              </span>
              <span className="text-blue-200 text-xs font-medium">
                • Always-on-top desktop overlay
              </span>
            </div>
            <h2 className="text-base font-bold text-white">
              Compact, Draggable & Resizable Desktop Window
            </h2>
            <p className="text-xs text-blue-100/90 leading-relaxed">
              Drag by the dedicated title bar across any display, resize both normal and minimized
              panels to your preferred dimensions, and click <strong>Pathway</strong> on any customer
              to immediately inspect their live application progress without leaving your current workspace.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 text-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-300 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Protected Read-Only Mode</span>
              </div>
              <p className="text-[11px] text-blue-100/80">
                Original customer records remain untouched.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          METRICS CARDS
         ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Customers</span>
          <span className="text-2xl font-extrabold text-[#032e60] mt-1 block">
            {totalCustomers}
          </span>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Live from database</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-amber-600 block">In Progress</span>
          <span className="text-2xl font-extrabold text-amber-700 mt-1 block">
            {inProgressCount}
          </span>
          <span className="text-[10px] text-amber-600/80 mt-0.5 block">Active applications</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-600 block">Completed</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {completedCount}
          </span>
          <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Delivered successfully</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-blue-600 block">New / Pending</span>
          <span className="text-2xl font-extrabold text-blue-700 mt-1 block">
            {pendingCount}
          </span>
          <span className="text-[10px] text-blue-600/80 mt-0.5 block">Awaiting action</span>
        </div>
      </div>

      {/* =====================================================================
          SEARCH & STATUS FILTERS
         ===================================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, ID, phone, or service..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {["all", "in progress", "completed", "pending", "new"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === status
                  ? "bg-[#032e60] text-white shadow-2xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          CUSTOMER PATHWAYS TABLE / CARDS
         ===================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#032e60]">
            Customer Pathway Dossiers ({filtered.length})
          </h3>
          <span className="text-xs text-slate-400">
            Click &ldquo;Pathway&rdquo; on any row to launch its individual floating window
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <span className="text-xs font-semibold">Retrieving customer pathway records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No customer records matched your query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Customer ID</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4">Service Name</th>
                  <th className="py-3 px-4">Application Status</th>
                  <th className="py-3 px-4">Processing Stage</th>
                  <th className="py-3 px-4 text-right">Pathway Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group"
                  >
                    {/* Customer ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {item.customerId}
                    </td>

                    {/* Customer Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.customerName}</div>
                      {item.assignedStaff && (
                        <div className="text-[10px] text-slate-400">
                          Staff: {item.assignedStaff}
                        </div>
                      )}
                    </td>

                    {/* Mobile Number */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {item.mobileNumber}
                    </td>

                    {/* Service Name */}
                    <td className="py-3.5 px-4">
                      <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 font-semibold">
                        {item.serviceName}
                      </span>
                    </td>

                    {/* Application Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                          item.applicationStatus === "Completed"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : item.applicationStatus === "In Progress"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : item.applicationStatus === "Rejected"
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {item.applicationStatus || "Active"}
                      </span>
                    </td>

                    {/* Processing Stage & Progress */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <div className="text-[11px] font-semibold text-slate-800 truncate">
                        {item.currentStep || "Processing"}
                      </div>
                      <div className="w-28 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full rounded-full"
                          style={{ width: `${item.progressPercent ?? 20}%` }}
                        />
                      </div>
                    </td>

                    {/* Pathway Action Button */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openPathway(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                        title="Open individual customer pathway in floating desktop window"
                      >
                        <Route className="w-3.5 h-3.5" />
                        <span>Pathway</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
