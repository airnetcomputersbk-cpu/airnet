import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useLiveSync } from "../../hooks/useLiveSync";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  ExternalLink,
  Eye,
  FileText,
  IndianRupee,
  Inbox,
  Layers,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Wallet,
  XCircle
} from "lucide-react";

// Types
export type ApplicationStep = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending" | "rejected";
  completedAt?: string | null;
  note?: string;
};

export type ApplicationTask = {
  id: number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  applicationNumber?: string;
  currentStep: string;
  status: "In Progress" | "Completed" | "On Hold" | "Pending" | "Rejected";
  progressPercent: number;
  steps: ApplicationStep[];
  priority: "Low" | "Normal" | "Urgent";
  targetDate?: string;
  assignedStaff?: string;
  paymentType?: string;
  amountCharged?: number;
  amountPaid?: number;
  amountPending?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type EnquiryItem = {
  id: number;
  customerId?: string;
  customerName: string;
  mobileNumber: string;
  serviceId: string;
  serviceTitle?: string;
  applicationStatus: string;
  amountCharged?: number;
  amountPaid?: number;
  amountPending?: number;
  paymentMethod?: string;
  notes: string;
  createdAt: string;
};

export type NotificationItem = {
  id: number;
  title: string;
  organization: string | null;
  category: string;
  vacancies: string | null;
  qualification: string | null;
  ageLimit: string | null;
  startDate: string | null;
  lastDate: string | null;
  applicationFee: string | null;
  isFeatured: boolean;
  status: string;
  viewCount: number;
  createdAt: string;
};

export type ServiceItem = {
  id: string;
  title: string;
  category: string;
  price: string;
  timing: string;
  documents: string;
  copy: string;
};

// Date & Helper functions
function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateDMY(val?: string | null): string {
  if (!val) return "Open";
  const s = String(val).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) return `${ymd[3].padStart(2, "0")}-${ymd[2].padStart(2, "0")}-${ymd[1]}`;
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}-${dmy[2].padStart(2, "0")}-${dmy[3]}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return s;
}

function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return formatDateDMY(dateStr);
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

export default function Dashboard() {
  // SWR initial cache read: instant 0ms mount
  const initialTasks = getCachedData<ApplicationTask[]>("admin_tracker");
  const initialEnquiries = getCachedData<EnquiryItem[]>("admin_enquiries");

  const [trackerTasks, setTrackerTasks] = useState<ApplicationTask[]>(() => initialTasks || []);
  const [enquiries, setEnquiries] = useState<EnquiryItem[]>(() => initialEnquiries || []);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => getCachedData<NotificationItem[]>("admin_notifications") || []);
  const [services, setServices] = useState<ServiceItem[]>(() => getCachedData<ServiceItem[]>("admin_services") || []);
  const [adminPhone, setAdminPhone] = useState<string>("+91 7892881086");
  const [loading, setLoading] = useState<boolean>(() => !initialTasks && !initialEnquiries);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  // Filter for active task widget
  const [taskFilter, setTaskFilter] = useState<"urgent" | "in-progress" | "ready" | "all">("urgent");

  const fetchData = async () => {
    setIsRefreshing(true);
    try {
      const [trackerRes, enquiriesRes, notifRes, servicesRes, infoRes] = await Promise.all([
        fetch("/api/admin/tracker"),
        fetch("/api/admin/enquiries"),
        fetch("/api/notifications"),
        fetch("/api/services"),
        fetch("/api/business-info")
      ]);

      if (trackerRes.ok) {
        const tData = await trackerRes.json();
        const tList = Array.isArray(tData) ? tData : [];
        setTrackerTasks(tList);
        setCachedData("admin_tracker", tList);
      }
      if (enquiriesRes.ok) {
        const eData = await enquiriesRes.json();
        const eList = Array.isArray(eData) ? eData : [];
        setEnquiries(eList);
        setCachedData("admin_enquiries", eList);
      }
      if (notifRes.ok) {
        const nData = await notifRes.json();
        const nList = Array.isArray(nData) ? nData : [];
        setNotifications(nList);
        setCachedData("admin_notifications", nList);
      }
      if (servicesRes.ok) {
        const sData = await servicesRes.json();
        const sList = Array.isArray(sData) ? sData : [];
        setServices(sList);
        setCachedData("admin_services", sList);
      }
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info.helpline || info.mobileNumber) {
          setAdminPhone(info.helpline || info.mobileNumber);
        }
      }
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Multi-Device Instant Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("all", () => {
    fetchData();
  });

  // ==========================================
  // METRICS & COMPUTED DATA
  // ==========================================
  
  // 1. Tracker Metrics
  const trackerStats = useMemo(() => {
    const total = trackerTasks.length;
    const inProgress = trackerTasks.filter(t => t.status === "In Progress").length;
    const completed = trackerTasks.filter(t => t.status === "Completed" || t.progressPercent === 100).length;
    const onHold = trackerTasks.filter(t => t.status === "On Hold").length;
    const pending = trackerTasks.filter(t => t.status === "Pending").length;
    const urgent = trackerTasks.filter(t => t.priority === "Urgent" && t.status !== "Completed").length;

    return { total, inProgress, completed, onHold, pending, urgent };
  }, [trackerTasks]);

  // 2. Enquiry Metrics ("My Enquiry List")
  const enquiryStats = useMemo(() => {
    const total = enquiries.length;
    const newCount = enquiries.filter(e => e.applicationStatus === "New" || !e.applicationStatus).length;
    const accepted = enquiries.filter(e => e.applicationStatus === "Accepted").length;
    const inProgress = enquiries.filter(e => e.applicationStatus === "In Progress").length;
    const completed = enquiries.filter(e => e.applicationStatus === "Completed").length;

    // Unique customer IDs
    const uniqueCustomerIds = new Set<string>();
    enquiries.forEach(e => {
      if (e.customerId) uniqueCustomerIds.add(e.customerId);
      else if (e.mobileNumber) uniqueCustomerIds.add(e.mobileNumber);
    });
    trackerTasks.forEach(t => {
      if (t.customerId) uniqueCustomerIds.add(t.customerId);
    });

    return { total, newCount, accepted, inProgress, completed, uniqueUsers: uniqueCustomerIds.size };
  }, [enquiries, trackerTasks]);

  // 3. Consolidated Financial Metrics (combining Tracker tasks and Enquiries ledger)
  const financialStats = useMemo(() => {
    const seenCustomerIds = new Set<string>();
    let totalBilled = 0;
    let totalCollected = 0;
    let totalPending = 0;
    const paymentMethods: Record<string, { count: number; total: number }> = {
      "Cash": { count: 0, total: 0 },
      "Online / UPI": { count: 0, total: 0 },
      "Pending / Udhar": { count: 0, total: 0 },
      "Other": { count: 0, total: 0 }
    };

    const customersWithDues: {
      customerId: string;
      customerName: string;
      mobileNumber: string;
      serviceName: string;
      amountPending: number;
      amountPaid: number;
    }[] = [];

    // From Tracker Tasks
    trackerTasks.forEach(t => {
      if (t.customerId) seenCustomerIds.add(t.customerId);
      const paid = Number(t.amountPaid) || 0;
      const pending = Number(t.amountPending) || 0;
      const charged = Number(t.amountCharged) || (paid + pending);

      totalBilled += charged;
      totalCollected += paid;
      totalPending += pending;

      const pType = (t.paymentType || "Cash").toLowerCase();
      if (pType.includes("upi") || pType.includes("online") || pType.includes("phonepe") || pType.includes("gpay")) {
        paymentMethods["Online / UPI"].count += 1;
        paymentMethods["Online / UPI"].total += paid;
      } else if (pType.includes("pending") || pType.includes("udhar") || pending > 0) {
        paymentMethods["Pending / Udhar"].count += 1;
        paymentMethods["Pending / Udhar"].total += pending;
      } else {
        paymentMethods["Cash"].count += 1;
        paymentMethods["Cash"].total += paid;
      }

      if (pending > 0) {
        customersWithDues.push({
          customerId: t.customerId,
          customerName: t.customerName,
          mobileNumber: t.mobileNumber,
          serviceName: t.serviceName,
          amountPending: pending,
          amountPaid: paid
        });
      }
    });

    // From Enquiries not yet migrated to Tracker
    enquiries.forEach(e => {
      if (!seenCustomerIds.has(e.customerId || "")) {
        const charged = Number(e.amountCharged) || 0;
        const isPending = e.paymentMethod === "Pending" || e.paymentMethod === "Pending / Udhar";
        const paid = e.amountPaid !== undefined && e.amountPaid !== null ? Number(e.amountPaid) || 0 : (isPending ? 0 : charged);
        const pending = e.amountPending !== undefined && e.amountPending !== null ? Number(e.amountPending) || 0 : Math.max(0, charged - paid);

        totalBilled += charged || (paid + pending);
        totalCollected += paid;
        totalPending += pending;

        const pType = (e.paymentMethod || "Cash").toLowerCase();
        if (pType.includes("upi") || pType.includes("online")) {
          paymentMethods["Online / UPI"].count += 1;
          paymentMethods["Online / UPI"].total += paid;
        } else if (isPending || pending > 0) {
          paymentMethods["Pending / Udhar"].count += 1;
          paymentMethods["Pending / Udhar"].total += pending;
        } else {
          paymentMethods["Cash"].count += 1;
          paymentMethods["Cash"].total += paid;
        }

        if (pending > 0 && e.customerId) {
          customersWithDues.push({
            customerId: e.customerId,
            customerName: e.customerName,
            mobileNumber: e.mobileNumber,
            serviceName: e.serviceId,
            amountPending: pending,
            amountPaid: paid
          });
        }
      }
    });

    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    return {
      totalBilled,
      totalCollected,
      totalPending,
      collectionRate,
      paymentMethods,
      customersWithDues: customersWithDues.sort((a, b) => b.amountPending - a.amountPending).slice(0, 4)
    };
  }, [trackerTasks, enquiries]);

  // 4. Notifications Radar Metrics
  const notifStats = useMemo(() => {
    const total = notifications.length;
    const now = Date.now();
    let closingSoonCount = 0;

    const activeList = notifications.filter(n => {
      const parsedLast = parseDateString(n.lastDate);
      if (parsedLast) {
        const diff = parsedLast.getTime() - now;
        if (diff >= 0 && diff < 5 * 24 * 60 * 60 * 1000) {
          closingSoonCount += 1;
        }
      }
      return n.status !== "draft";
    });

    const totalViews = notifications.reduce((acc, n) => acc + (Number(n.viewCount) || 0), 0);
    const featured = notifications.filter(n => n.isFeatured);

    return {
      total,
      activeCount: activeList.length,
      closingSoonCount,
      totalViews,
      featuredCount: featured.length,
      urgentList: notifications
        .filter(n => {
          const d = parseDateString(n.lastDate);
          return d && (d.getTime() - now) >= 0 && (d.getTime() - now) < 7 * 24 * 3600 * 1000;
        })
        .slice(0, 3)
    };
  }, [notifications]);

  // 5. Popular Services Frequency
  const popularServices = useMemo(() => {
    const counts: Record<string, number> = {};
    enquiries.forEach(e => {
      const name = e.serviceId || "General";
      counts[name] = (counts[name] || 0) + 1;
    });
    trackerTasks.forEach(t => {
      const name = t.serviceName || "General";
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [enquiries, trackerTasks]);

  // Filtered task list for the active tasks widget
  const displayedTasks = useMemo(() => {
    if (taskFilter === "urgent") {
      const urgentList = trackerTasks.filter(t => t.priority === "Urgent" && t.status !== "Completed");
      if (urgentList.length > 0) return urgentList.slice(0, 5);
      return trackerTasks.filter(t => t.status === "In Progress").slice(0, 5);
    }
    if (taskFilter === "in-progress") {
      return trackerTasks.filter(t => t.status === "In Progress").slice(0, 5);
    }
    if (taskFilter === "ready") {
      return trackerTasks.filter(t => t.status === "Completed" || t.progressPercent === 100).slice(0, 5);
    }
    return trackerTasks.slice(0, 5);
  }, [trackerTasks, taskFilter]);

  // Latest 5 enquiries
  const recentEnquiries = useMemo(() => {
    return [...enquiries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [enquiries]);

  return (
    <div className="space-y-6 pb-12">
      {/* ============================================================== */}
      {/* 1. TOP HEADER & COMMAND STATUS BAR */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#177d70]">
            <ShieldCheck className="w-4 h-4 text-[#177d70]" />
            <span>Airnet Computers • Basavakalyan Hub</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#032e60] mt-1">
            Dashboard Overview
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time management for Customer Enquiries, Application Tracker, Revenue & Job Notifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Real-time Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Center Active</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
            title="Refresh real-time data"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-blue-600" : ""} />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>

          {/* AI Suggestions Hub Button */}
          <Link
            href="/admin/ai-suggestions"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs"
            title="Open AI Suggestions & Improvements Hub"
          >
            <Sparkles size={15} className="text-white" />
            <span>AI Suggestions</span>
          </Link>

          {/* Track Application Button */}
          <Link
            href="/admin/tracker"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#032e60] hover:bg-[#0b477e] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs"
          >
            <Plus size={16} className="text-[#f2b544]" />
            <span>Track New Task</span>
          </Link>
        </div>
      </div>

      {/* AI Intelligence Advisory Banner */}
      <div className="bg-gradient-to-r from-[#032e60] via-[#094182] to-[#032e60] rounded-2xl p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs border border-blue-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 grid place-items-center shrink-0">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider font-bold text-amber-300 flex items-center gap-1.5">
              <span>AI Software Analyst</span>
              <span className="text-[10px] bg-amber-400/20 text-amber-200 px-1.5 py-0.5 rounded font-semibold">18 Insights Available</span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              Review smart feature recommendations, workflow automations, and security enhancements for Airnet Computers.
            </p>
          </div>
        </div>
        <Link
          href="/admin/ai-suggestions"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white text-[#032e60] hover:bg-blue-50 font-bold rounded-xl text-xs transition-colors shrink-0 shadow-xs"
        >
          <span>Explore AI Recommendations</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ============================================================== */}
      {/* 2. EXECUTIVE 4-PILLAR KPI SUMMARY CARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* KPI 1: Application Tracker */}
        <Link
          href="/admin/tracker"
          className="group relative bg-white hover:bg-blue-50/40 p-5 rounded-2xl border border-gray-200 hover:border-blue-300 shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Application Tracker
              </span>
              <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 grid place-items-center group-hover:scale-105 transition-transform">
                <Activity size={18} />
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#032e60] mt-3">
              {loading ? "..." : trackerStats.total}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-blue-700 font-bold flex items-center gap-1">
              <Clock size={12} /> {trackerStats.inProgress} In Progress
            </span>
            <span className="text-emerald-700 font-semibold">
              ✓ {trackerStats.completed} Completed
            </span>
          </div>
          {trackerStats.urgent > 0 && (
            <div className="mt-2 text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <AlertCircle size={12} /> {trackerStats.urgent} Urgent Task{trackerStats.urgent > 1 ? "s" : ""}
            </div>
          )}
        </Link>

        {/* KPI 2: My Enquiry List */}
        <Link
          href="/admin/enquiries"
          className="group relative bg-white hover:bg-amber-50/40 p-5 rounded-2xl border border-gray-200 hover:border-amber-300 shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                My Enquiry List
              </span>
              <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-700 grid place-items-center group-hover:scale-105 transition-transform">
                <Inbox size={18} />
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#032e60] mt-3">
              {loading ? "..." : enquiryStats.total}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className={`font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${
              enquiryStats.newCount > 0 ? "bg-amber-100 text-amber-800 animate-pulse" : "text-gray-500"
            }`}>
              ● {enquiryStats.newCount} New Unhandled
            </span>
            <span className="text-gray-500 font-medium">
              {enquiryStats.accepted} Accepted
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            Assigned to {enquiryStats.uniqueUsers} unique customer IDs
          </div>
        </Link>

        {/* KPI 3: Financial & Collections */}
        <Link
          href="/admin/reports"
          className="group relative bg-white hover:bg-emerald-50/40 p-5 rounded-2xl border border-gray-200 hover:border-emerald-300 shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Total Collections
              </span>
              <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center group-hover:scale-105 transition-transform">
                <IndianRupee size={18} />
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-800 mt-3 font-mono">
              {loading ? "..." : formatINR(financialStats.totalCollected)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">
              Efficiency: <strong className="text-emerald-700">{financialStats.collectionRate}%</strong>
            </span>
            {financialStats.totalPending > 0 ? (
              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                ₹{financialStats.totalPending} Dues
              </span>
            ) : (
              <span className="text-emerald-700 font-bold">✓ Zero Dues</span>
            )}
          </div>
          <div className="mt-2 text-[11px] text-gray-400">
            Total Billed: {formatINR(financialStats.totalBilled)}
          </div>
        </Link>

        {/* KPI 4: Public Alerts & Notifications */}
        <Link
          href="/admin/notifications"
          className="group relative bg-white hover:bg-indigo-50/40 p-5 rounded-2xl border border-gray-200 hover:border-indigo-300 shadow-xs transition-all flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Public Notifications
              </span>
              <div className="h-9 w-9 rounded-xl bg-indigo-100 text-indigo-700 grid place-items-center group-hover:scale-105 transition-transform">
                <Bell size={18} />
              </div>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#032e60] mt-3">
              {loading ? "..." : notifStats.activeCount}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            {notifStats.closingSoonCount > 0 ? (
              <span className="text-red-600 font-extrabold flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
                <AlertTriangle size={12} /> {notifStats.closingSoonCount} Closing Soon!
              </span>
            ) : (
              <span className="text-indigo-700 font-semibold">
                ✓ All active on portal
              </span>
            )}
            <span className="text-gray-500 text-[11px] font-medium flex items-center gap-1">
              <Eye size={12} /> {notifStats.totalViews} views
            </span>
          </div>
          <div className="mt-2 text-[11px] text-gray-500">
            {notifStats.featuredCount} featured banners active
          </div>
        </Link>
      </div>

      {/* ============================================================== */}
      {/* 3. QUICK ADMINISTRATIVE ACTION DOCK */}
      {/* ============================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-3">
          Quick Management Actions
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <Link
            href="/admin/tracker"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-blue-100 bg-blue-50/60 hover:bg-blue-100/70 text-blue-900 transition-all text-center group"
          >
            <Activity className="w-5 h-5 mb-1.5 text-blue-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">Live Tracker</span>
            <span className="text-[10px] text-blue-600 mt-0.5">Tasks & Stages</span>
          </Link>

          <Link
            href="/admin/enquiries"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-amber-100 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 transition-all text-center group relative"
          >
            <Inbox className="w-5 h-5 mb-1.5 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">My Enquiry List</span>
            <span className="text-[10px] text-amber-700 mt-0.5">
              {enquiryStats.newCount > 0 ? `${enquiryStats.newCount} New Requests` : "Review Enquiries"}
            </span>
            {enquiryStats.newCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-xs">
                {enquiryStats.newCount}
              </span>
            )}
          </Link>

          <Link
            href="/admin/notifications"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-100/70 text-indigo-900 transition-all text-center group"
          >
            <Sparkles className="w-5 h-5 mb-1.5 text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">Post Alert (OCR)</span>
            <span className="text-[10px] text-indigo-600 mt-0.5">Upload Circular</span>
          </Link>

          <Link
            href="/admin/records"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-emerald-100 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 transition-all text-center group"
          >
            <Wallet className="w-5 h-5 mb-1.5 text-emerald-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">Customer Records</span>
            <span className="text-[10px] text-emerald-700 mt-0.5">Accounts & Dues</span>
          </Link>

          <Link
            href="/admin/reports"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-teal-100 bg-teal-50/60 hover:bg-teal-100/70 text-teal-900 transition-all text-center group"
          >
            <TrendingUp className="w-5 h-5 mb-1.5 text-teal-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">Financial Reports</span>
            <span className="text-[10px] text-teal-700 mt-0.5">Daily Register</span>
          </Link>

          <Link
            href="/admin/services"
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 transition-all text-center group"
          >
            <Layers className="w-5 h-5 mb-1.5 text-gray-600 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold leading-tight">Manage Services</span>
            <span className="text-[10px] text-gray-500 mt-0.5">{services.length} Services</span>
          </Link>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. MAIN TWO-COLUMN OPERATIONAL CORE */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: ACTIVE WORKFLOWS & ENQUIRIES (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Module 1: Live Application Tasks */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#032e60] flex items-center gap-2">
                  <Activity size={18} className="text-blue-600" />
                  Live Application Pipeline
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Real-time milestone progress & status tracking for customers
                </p>
              </div>

              {/* Task filter tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setTaskFilter("urgent")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    taskFilter === "urgent" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600 hover:text-black"
                  }`}
                >
                  Urgent
                </button>
                <button
                  onClick={() => setTaskFilter("in-progress")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    taskFilter === "in-progress" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600 hover:text-black"
                  }`}
                >
                  In Progress
                </button>
                <button
                  onClick={() => setTaskFilter("ready")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    taskFilter === "ready" ? "bg-white text-blue-700 shadow-2xs" : "text-gray-600 hover:text-black"
                  }`}
                >
                  Ready ({trackerStats.completed})
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-xs">Loading tasks...</div>
              ) : displayedTasks.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-semibold text-gray-600">No tasks in this category</p>
                  <p className="text-xs text-gray-400 mt-1">All applications are up to date or completed.</p>
                </div>
              ) : (
                displayedTasks.map((task) => {
                  const cleanPhone = (task.mobileNumber || "").replace(/\D/g, "");
                  const isReady = task.status === "Completed" || task.progressPercent === 100;

                  return (
                    <div key={task.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold bg-[#032e60] text-white px-2 py-0.5 rounded">
                              {task.customerId}
                            </span>
                            <span className="font-bold text-sm text-[#032e60] truncate">
                              {task.customerName}
                            </span>
                            {task.priority === "Urgent" && (
                              <span className="text-[10px] font-extrabold text-red-700 bg-red-100 border border-red-200 px-2 py-0.2 rounded-full">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 font-medium mt-1 truncate">
                            {task.serviceName}
                          </p>
                        </div>

                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                          isReady ? "bg-emerald-100 text-emerald-800" :
                          task.status === "On Hold" ? "bg-amber-100 text-amber-800" :
                          "bg-blue-100 text-blue-800"
                        }`}>
                          {task.status}
                        </span>
                      </div>

                      {/* Progress Bar & Current Stage */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-500 text-[11px] truncate">
                            Stage: <strong className="text-blue-700">{task.currentStep || "Under processing"}</strong>
                          </span>
                          <span className="font-mono font-bold text-gray-700">{task.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              isReady ? "bg-emerald-500" : "bg-blue-600"
                            }`}
                            style={{ width: `${task.progressPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Quick Communication Actions */}
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-gray-500 font-mono text-[11px]">
                          +91 {task.mobileNumber}
                        </span>
                        <div className="flex items-center gap-2">
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/91${cleanPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors"
                              title="Message customer on WhatsApp"
                            >
                              <MessageSquare size={12} /> WhatsApp
                            </a>
                          )}
                          <Link
                            href="/admin/tracker"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline"
                          >
                            Manage <ArrowRight size={12} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
              <Link
                href="/admin/tracker"
                className="text-xs font-bold text-[#032e60] hover:text-blue-700 inline-flex items-center gap-1"
              >
                <span>View all {trackerStats.total} applications in Application Tracker</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* Module 2: Inbound Citizen Enquiries ("My Enquiry List") */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#032e60] flex items-center gap-2">
                  <Inbox size={18} className="text-amber-600" />
                  Recent Inbound Enquiries ("My Enquiry List")
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Citizen requests received through portal & notifications
                </p>
              </div>
              <Link
                href="/admin/enquiries"
                className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1 shrink-0"
              >
                View all ({enquiryStats.total}) <ArrowRight size={13} />
              </Link>
            </div>

            <div className="p-4 sm:p-5 divide-y divide-gray-100">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-xs">Loading enquiries...</div>
              ) : recentEnquiries.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-sm font-semibold text-gray-600">No customer enquiries received yet</p>
                  <p className="text-xs text-gray-400 mt-1">New citizen applications will automatically appear here.</p>
                </div>
              ) : (
                recentEnquiries.map((enq) => {
                  const isNew = enq.applicationStatus === "New" || !enq.applicationStatus;
                  return (
                    <div key={enq.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-[#032e60]">
                            {enq.customerName}
                          </span>
                          <span className="font-mono text-xs text-gray-500">
                            +91 {enq.mobileNumber}
                          </span>
                          {enq.customerId && (
                            <span className="font-mono text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                              {enq.customerId}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-700 font-medium mt-1 truncate">
                          Service: <span className="text-[#032e60] font-bold">{enq.serviceId}</span>
                        </p>
                        {enq.notes && (
                          <p className="text-[11px] text-gray-500 italic mt-0.5 line-clamp-1">
                            "{enq.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isNew ? "bg-amber-100 text-amber-800 animate-pulse border border-amber-300" :
                          enq.applicationStatus === "Accepted" ? "bg-blue-100 text-blue-800" :
                          "bg-emerald-100 text-emerald-800"
                        }`}>
                          {enq.applicationStatus || "New"}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium font-mono">
                          {formatDateDMY(enq.createdAt)} · {timeAgo(enq.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-amber-50/50 border-t border-amber-100 flex items-center justify-between text-xs px-5">
              <span className="text-amber-900 font-medium">
                {enquiryStats.newCount} enquiries require review & action
              </span>
              <Link
                href="/admin/enquiries"
                className="font-bold text-amber-800 hover:text-amber-950 underline"
              >
                Go to My Enquiry List →
              </Link>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: FINANCIALS, RADAR & POPULAR SERVICES (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Module 3: Financial Health & Dues Tracker */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-[#032e60] flex items-center gap-2">
                <Wallet size={18} className="text-emerald-600" />
                Financial Pulse & Collections
              </h2>
              <Link href="/admin/reports" className="text-xs font-bold text-emerald-700 hover:underline">
                Reports →
              </Link>
            </div>

            {/* Collection Progress Meter */}
            <div className="mt-4">
              <div className="flex justify-between items-baseline text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Collected / Total Billed</span>
                <span className="font-bold font-mono text-emerald-700">
                  {financialStats.collectionRate}% Collected
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-3 transition-all duration-500"
                  style={{ width: `${financialStats.collectionRate}%` }}
                />
                <div
                  className="bg-amber-400 h-3 transition-all duration-500"
                  style={{ width: `${100 - financialStats.collectionRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                <span>Paid: {formatINR(financialStats.totalCollected)}</span>
                <span className="text-amber-700 font-semibold">Dues: {formatINR(financialStats.totalPending)}</span>
              </div>
            </div>

            {/* Outstanding Udhar / Dues Callout */}
            {financialStats.customersWithDues.length > 0 ? (
              <div className="mt-5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-700" />
                    Pending Dues by Customers ({financialStats.customersWithDues.length})
                  </span>
                  <Link href="/admin/records" className="text-[11px] font-bold text-amber-800 underline">
                    Open Records
                  </Link>
                </div>

                <div className="space-y-1.5 pt-1">
                  {financialStats.customersWithDues.map((c, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-amber-100">
                      <div className="min-w-0 pr-2">
                        <span className="font-bold text-[#032e60] block truncate">{c.customerName}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{c.customerId} • +91 {c.mobileNumber}</span>
                      </div>
                      <span className="font-mono font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded shrink-0">
                        ₹{c.amountPending}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>All customer balances are fully paid and clear. Zero outstanding udhar!</span>
              </div>
            )}
          </div>

          {/* Module 4: Public Circulars & Closing Soon Alerts */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-[#032e60] flex items-center gap-2">
                <Bell size={18} className="text-indigo-600" />
                Notifications & Job Alerts Radar
              </h2>
              <Link href="/admin/notifications" className="text-xs font-bold text-indigo-700 hover:underline">
                Manage ({notifStats.total}) →
              </Link>
            </div>

            {notifStats.urgentList.length > 0 ? (
              <div className="mt-4 space-y-2.5">
                <div className="text-[11px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> Closing Soon Alerts (This Week)
                </div>
                {notifStats.urgentList.map((n) => (
                  <div key={n.id} className="p-3 rounded-xl border border-red-200 bg-red-50/50 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#032e60] leading-snug line-clamp-1">
                        {n.title}
                      </span>
                      <span className="text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.2 rounded shrink-0">
                        Closing
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>{n.organization || n.category}</span>
                      <span className="font-bold text-red-700">
                        Last Date: {formatDateDMY(n.lastDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 p-4 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-500">
                No immediate deadline alerts expiring within 7 days.
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>{notifStats.activeCount} public notices live</span>
              <Link
                href="/admin/notifications"
                className="font-bold text-indigo-700 hover:underline flex items-center gap-1"
              >
                <Plus size={13} /> Add Notification
              </Link>
            </div>
          </div>

          {/* Module 5: Most Demanded Services */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-base font-bold text-[#032e60] flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Top Demanded Services
              </h2>
              <Link href="/admin/services" className="text-xs font-bold text-blue-700 hover:underline">
                Catalog →
              </Link>
            </div>

            <div className="mt-3 divide-y divide-gray-100">
              {popularServices.length === 0 ? (
                <div className="py-4 text-xs text-gray-400 text-center">No service data yet</div>
              ) : (
                popularServices.map((svc, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <span className="font-mono text-[11px] font-bold text-gray-400 w-4">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-[#032e60] truncate">{svc.name}</span>
                    </div>
                    <span className="font-mono font-bold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                      {svc.count} request{svc.count > 1 ? "s" : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. SHOP DETAILS & SYSTEM STATUS FOOTER */}
      {/* ============================================================== */}
      <div className="bg-[#032e60] text-[#f8f4eb] p-5 sm:p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#f2b544] uppercase tracking-wider">
            <MapPin size={14} /> Airnet Computers Online Service Center
          </div>
          <p className="text-xs text-gray-300">
            Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327 • Helpline: {adminPhone} (Md Amjad Ali)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-300 border-t md:border-t-0 md:border-l border-gray-700 pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Database Sync</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              ✓ Connected & Backed Up
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-gray-400 font-bold">Last Synced</span>
            <span className="font-mono text-gray-200">
              {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}