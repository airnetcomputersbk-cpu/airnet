import { useState, useEffect, useMemo, useDeferredValue } from "react";
import { useLiveSync } from "../../hooks/useLiveSync";
import {
  IndianRupee,
  TrendingUp,
  Calendar,
  CalendarDays,
  CreditCard,
  PieChart,
  Activity,
  Clock,
  Search,
  Download,
  Printer,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Smartphone,
  Landmark,
  ArrowUpRight,
  Filter,
  ChevronRight,
  Sparkles,
  FileSpreadsheet
} from "lucide-react";

type UnifiedTransaction = {
  id: string;
  sourceId: number;
  source: "records" | "tracker" | "enquiry";
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  amountCharged: number;
  amountPaid: number;
  amountPending: number;
  paymentMethod: string;
  status: string;
  notes?: string;
  createdAt: string;
  dateStr: string;  // YYYY-MM-DD (local)
  monthStr: string; // YYYY-MM (local)
};

// Helper to convert any date input to YYYY-MM-DD in local time
function toLocalDateString(d: Date | string | number): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to convert any date input to YYYY-MM in local time
function toLocalMonthString(d: Date | string | number): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

// Format date into human-readable format e.g., "Thursday, 29 October 2026"
function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// Format month into human-readable format e.g., "October 2026"
function formatMonthDisplay(monthStr: string): string {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-").map(Number);
  const date = new Date(y, m - 1, 1);
  if (isNaN(date.getTime())) return monthStr;
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });
}

export default function Reports() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Checking Modes: "daily" | "monthly" | "range" | "all"
  const [checkMode, setCheckMode] = useState<"daily" | "monthly" | "range" | "all">("daily");

  // Selected Date for Daily checking (defaults to today in local time)
  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Selected Month for Monthly checking (defaults to current month in local time)
  const currentMonthStr = useMemo(() => toLocalMonthString(new Date()), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);

  // Date Range Checker
  const [rangeStartDate, setRangeStartDate] = useState<string>(todayStr);
  const [rangeEndDate, setRangeEndDate] = useState<string>(todayStr);

  // Table Filters
  const [search, setSearch] = useState("");
  const [filterPayment, setFilterPayment] = useState("All");

  const fetchAllData = async () => {
    setIsRefreshing(true);
    try {
      const [recordsRes, trackerRes, enquiriesRes] = await Promise.all([
        fetch("/api/admin/records"),
        fetch("/api/admin/tracker"),
        fetch("/api/admin/enquiries")
      ]);

      const list: UnifiedTransaction[] = [];
      const seenCustomerIds = new Set<string>();

      // 1. Process explicit records (Ledger)
      if (recordsRes.ok) {
        const records = await recordsRes.json();
        records.forEach((r: any) => {
          const custKey = r.customerId ? r.customerId.trim() : `rec-${r.id}`;
          if (seenCustomerIds.has(custKey)) return;
          seenCustomerIds.add(custKey);

          const charged = Number(r.amountCharged) || 0;
          const paid = Number(r.amountPaid) || 0;
          const pending = r.amountPending !== undefined ? Number(r.amountPending) || 0 : Math.max(0, charged - paid);
          const d = new Date(r.createdAt);

          list.push({
            id: `rec-${r.id}`,
            sourceId: r.id,
            source: "records",
            customerId: r.customerId || `AN-${r.id}`,
            customerName: r.customerName || "Customer",
            mobileNumber: r.mobileNumber || "",
            serviceName: r.serviceProvided || "General Service",
            amountCharged: charged || (paid + pending),
            amountPaid: paid,
            amountPending: pending,
            paymentMethod: r.paymentMethod || "Cash",
            status: "Completed",
            notes: r.notes || "",
            createdAt: r.createdAt,
            dateStr: toLocalDateString(d),
            monthStr: toLocalMonthString(d),
          });
        });
      }

      // 2. Process tracker application tasks
      if (trackerRes.ok) {
        const tasks = await trackerRes.json();
        tasks.forEach((t: any) => {
          const custKey = t.customerId ? t.customerId.trim() : `track-${t.id}`;
          if (seenCustomerIds.has(custKey)) return;
          seenCustomerIds.add(custKey);

          const paid = Number(t.amountPaid) || 0;
          const pending = Number(t.amountPending) || 0;
          const charged = paid + pending;
          const d = new Date(t.createdAt);

          list.push({
            id: `track-${t.id}`,
            sourceId: t.id,
            source: "tracker",
            customerId: t.customerId || `APP-${t.id}`,
            customerName: t.customerName || "Customer",
            mobileNumber: t.mobileNumber || "",
            serviceName: t.serviceName || "General Service",
            amountCharged: charged,
            amountPaid: paid,
            amountPending: pending,
            paymentMethod: t.paymentType || "Cash",
            status: t.status || "In Progress",
            notes: t.notes || "",
            createdAt: t.createdAt,
            dateStr: toLocalDateString(d),
            monthStr: toLocalMonthString(d),
          });
        });
      }

      // 3. Process enquiries (non-rejected)
      if (enquiriesRes.ok) {
        const enquiries = await enquiriesRes.json();
        enquiries.forEach((e: any) => {
          if (e.applicationStatus === "Rejected") return;
          const custKey = e.customerId ? e.customerId.trim() : `enq-${e.id}`;
          if (seenCustomerIds.has(custKey)) return;
          seenCustomerIds.add(custKey);

          const charged = Number(e.amountCharged) || 0;
          const isPendingMethod = e.paymentMethod === "Pending" || e.paymentMethod === "Pending / Udhar" || e.paymentMethod === "Pending / Pay Later";
          const paid = e.amountPaid !== undefined && e.amountPaid !== null ? Number(e.amountPaid) || 0 : (isPendingMethod ? 0 : charged);
          const pending = e.amountPending !== undefined && e.amountPending !== null ? Number(e.amountPending) || 0 : Math.max(0, charged - paid);
          const d = new Date(e.createdAt);

          let serviceName = e.serviceId;
          if (!serviceName && e.notes) {
            const match = e.notes.match(/Requested Service:\s*([^\n\r]+)/);
            if (match && match[1]) serviceName = match[1].trim();
          }
          if (!serviceName) serviceName = "General Enquiry";

          list.push({
            id: `enq-${e.id}`,
            sourceId: e.id,
            source: "enquiry",
            customerId: e.customerId || `ENQ-${e.id}`,
            customerName: e.customerName || "Customer",
            mobileNumber: e.mobileNumber || "",
            serviceName: serviceName,
            amountCharged: charged || (paid + pending),
            amountPaid: paid,
            amountPending: pending,
            paymentMethod: e.paymentMethod || "Cash",
            status: e.applicationStatus || "Completed",
            notes: e.notes || "",
            createdAt: e.createdAt,
            dateStr: toLocalDateString(d),
            monthStr: toLocalMonthString(d),
          });
        });
      }

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(list);
    } catch (err) {
      console.error("Failed to load report transactions:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Multi-Computer Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("records", () => fetchAllData());
  useLiveSync("tracker", () => fetchAllData());
  useLiveSync("enquiries", () => fetchAllData());

  // Permanent Top-Level Metrics (Always accurate for Today, This Month, All-Time)
  const permanentStats = useMemo(() => {
    let todayIncome = 0;
    let todayCharged = 0;
    let todayPending = 0;
    let todayOrders = 0;

    let monthIncome = 0;
    let monthCharged = 0;
    let monthPending = 0;
    let monthOrders = 0;

    let allIncome = 0;
    let allCharged = 0;
    let allPending = 0;
    let allOrders = transactions.length;

    transactions.forEach(t => {
      const paid = t.amountPaid || 0;
      const charged = t.amountCharged || 0;
      const pending = t.amountPending || 0;

      allIncome += paid;
      allCharged += charged;
      allPending += pending;

      if (t.dateStr === todayStr) {
        todayIncome += paid;
        todayCharged += charged;
        todayPending += pending;
        todayOrders += 1;
      }

      if (t.monthStr === currentMonthStr) {
        monthIncome += paid;
        monthCharged += charged;
        monthPending += pending;
        monthOrders += 1;
      }
    });

    return {
      todayIncome,
      todayCharged,
      todayPending,
      todayOrders,
      monthIncome,
      monthCharged,
      monthPending,
      monthOrders,
      allIncome,
      allCharged,
      allPending,
      allOrders
    };
  }, [transactions, todayStr, currentMonthStr]);

  // Selected Checking Period Calculation (for Desired Date / Desired Month / Range / All)
  const periodData = useMemo(() => {
    let filtered = transactions;

    if (checkMode === "daily") {
      filtered = transactions.filter(t => t.dateStr === selectedDate);
    } else if (checkMode === "monthly") {
      filtered = transactions.filter(t => t.monthStr === selectedMonth);
    } else if (checkMode === "range") {
      filtered = transactions.filter(t => t.dateStr >= rangeStartDate && t.dateStr <= rangeEndDate);
    }

    let income = 0;
    let charged = 0;
    let pending = 0;
    const paymentBreakdown: Record<string, number> = {};
    const serviceBreakdown: Record<string, { count: number; revenue: number; pending: number }> = {};
    const dayWiseMap: Record<string, { dateStr: string; income: number; charged: number; pending: number; count: number }> = {};

    filtered.forEach(t => {
      const paid = t.amountPaid || 0;
      const chg = t.amountCharged || 0;
      const pnd = t.amountPending || 0;

      income += paid;
      charged += chg;
      pending += pnd;

      // Payment method breakdown
      const method = t.paymentMethod || "Cash";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + paid;

      // Service breakdown
      const sName = t.serviceName || "General Service";
      if (!serviceBreakdown[sName]) {
        serviceBreakdown[sName] = { count: 0, revenue: 0, pending: 0 };
      }
      serviceBreakdown[sName].count += 1;
      serviceBreakdown[sName].revenue += paid;
      serviceBreakdown[sName].pending += pnd;

      // Day-wise map (for monthly chart/table)
      if (!dayWiseMap[t.dateStr]) {
        dayWiseMap[t.dateStr] = { dateStr: t.dateStr, income: 0, charged: 0, pending: 0, count: 0 };
      }
      dayWiseMap[t.dateStr].income += paid;
      dayWiseMap[t.dateStr].charged += chg;
      dayWiseMap[t.dateStr].pending += pnd;
      dayWiseMap[t.dateStr].count += 1;
    });

    const topServices = Object.entries(serviceBreakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    const dayWiseList = Object.values(dayWiseMap).sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    const activeDaysCount = dayWiseList.length || 1;
    const averageDailyIncome = Math.round(income / activeDaysCount);

    return {
      filteredItems: filtered,
      income,
      charged,
      pending,
      count: filtered.length,
      averageDailyIncome,
      paymentBreakdown,
      topServices,
      dayWiseList
    };
  }, [transactions, checkMode, selectedDate, selectedMonth, rangeStartDate, rangeEndDate]);

  const deferredSearch = useDeferredValue(search);

  // Final table list filtered by search and payment method (non-blocking concurrent filter)
  const tableTransactions = useMemo(() => {
    const q = deferredSearch.toLowerCase();
    return periodData.filteredItems.filter(t => {
      const matchSearch =
        !q ||
        t.customerName.toLowerCase().includes(q) ||
        t.mobileNumber.includes(q) ||
        t.customerId.toLowerCase().includes(q) ||
        t.serviceName.toLowerCase().includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      const matchPayment =
        filterPayment === "All" ||
        (filterPayment === "Pending" && t.amountPending > 0) ||
        t.paymentMethod.toLowerCase() === filterPayment.toLowerCase();

      return matchSearch && matchPayment;
    });
  }, [periodData.filteredItems, deferredSearch, filterPayment]);

  // Quick Action Handlers
  const setQuickToday = () => {
    setCheckMode("daily");
    setSelectedDate(todayStr);
  };

  const setQuickYesterday = () => {
    setCheckMode("daily");
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalDateString(d));
  };

  const setQuickThisMonth = () => {
    setCheckMode("monthly");
    setSelectedMonth(currentMonthStr);
  };

  const setQuickLastMonth = () => {
    setCheckMode("monthly");
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(toLocalMonthString(d));
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      "Transaction ID",
      "Customer ID",
      "Date",
      "Customer Name",
      "Mobile Number",
      "Service Requested",
      "Payment Mode",
      "Amount Charged (INR)",
      "Amount Paid / Income (INR)",
      "Pending Due (INR)",
      "Status",
      "Notes"
    ];

    const rows = tableTransactions.map(t => [
      `"${t.id}"`,
      `"${t.customerId}"`,
      `"${t.dateStr}"`,
      `"${t.customerName.replace(/"/g, '""')}"`,
      `"${t.mobileNumber}"`,
      `"${t.serviceName.replace(/"/g, '""')}"`,
      `"${t.paymentMethod}"`,
      t.amountCharged,
      t.amountPaid,
      t.amountPending,
      `"${t.status}"`,
      `"${(t.notes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const fileName = `Airnet_Income_Report_${checkMode}_${checkMode === "daily" ? selectedDate : checkMode === "monthly" ? selectedMonth : "custom"}.csv`;
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw size={36} className="animate-spin text-[#032e60]" />
        <p className="text-gray-600 font-semibold text-base">Loading Financial & Income Reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold text-[#032e60] tracking-tight">Business & Income Reports</h1>
            <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
              Live Accounting
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time daily income, monthly revenue analysis, and date-wise checking for Airnet Computers.
          </p>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <button
            type="button"
            onClick={fetchAllData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-all"
            title="Reload data"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
            title="Download CSV for Excel"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#032e60] hover:bg-[#021f40] text-white rounded-lg text-xs font-bold shadow-sm transition-all"
            title="Print or Save PDF"
          >
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* 4 Permanent KPI Metric Cards: Always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Income */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-white p-5 rounded-2xl border border-emerald-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Activity size={15} className="text-emerald-600" />
              Today's Income
            </span>
            <span className="text-[10px] bg-emerald-200/60 text-emerald-900 font-mono font-bold px-1.5 py-0.5 rounded">
              {todayStr}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-emerald-700">₹</span>
            <h2 className="text-3xl font-extrabold text-emerald-800 font-mono tracking-tight">
              {permanentStats.todayIncome.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-emerald-100 flex items-center justify-between text-xs text-gray-600">
            <span>Billed: <strong className="text-gray-900 font-mono">₹{permanentStats.todayCharged}</strong></span>
            <span>Due: <strong className="text-amber-700 font-mono">₹{permanentStats.todayPending}</strong></span>
            <span className="text-emerald-700 font-semibold">{permanentStats.todayOrders} {permanentStats.todayOrders === 1 ? 'order' : 'orders'}</span>
          </div>
        </div>

        {/* This Month's Income */}
        <div className="bg-gradient-to-br from-blue-50/80 to-white p-5 rounded-2xl border border-blue-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Calendar size={15} className="text-blue-600" />
              This Month's Income
            </span>
            <span className="text-[10px] bg-blue-200/60 text-blue-900 font-mono font-bold px-1.5 py-0.5 rounded">
              {formatMonthDisplay(currentMonthStr)}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-blue-700">₹</span>
            <h2 className="text-3xl font-extrabold text-[#032e60] font-mono tracking-tight">
              {permanentStats.monthIncome.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-blue-100 flex items-center justify-between text-xs text-gray-600">
            <span>Billed: <strong className="text-gray-900 font-mono">₹{permanentStats.monthCharged}</strong></span>
            <span>Due: <strong className="text-amber-700 font-mono">₹{permanentStats.monthPending}</strong></span>
            <span className="text-blue-700 font-semibold">{permanentStats.monthOrders} orders</span>
          </div>
        </div>

        {/* Total All-Time Income */}
        <div className="bg-gradient-to-br from-indigo-50/80 to-white p-5 rounded-2xl border border-indigo-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <TrendingUp size={15} className="text-indigo-600" />
              Total All-Time Income
            </span>
            <span className="text-[10px] bg-indigo-200/60 text-indigo-900 font-mono font-bold px-1.5 py-0.5 rounded">
              All Records
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-indigo-700">₹</span>
            <h2 className="text-3xl font-extrabold text-[#032e60] font-mono tracking-tight">
              {permanentStats.allIncome.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-indigo-100 flex items-center justify-between text-xs text-gray-600">
            <span>Total Billed: <strong className="text-gray-900 font-mono">₹{permanentStats.allCharged}</strong></span>
            <span className="text-indigo-700 font-semibold">{permanentStats.allOrders} orders</span>
          </div>
        </div>

        {/* Total Pending Dues (Udhar) */}
        <div className="bg-gradient-to-br from-amber-50/80 to-white p-5 rounded-2xl border border-amber-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <Clock size={15} className="text-amber-600" />
              Total Pending Dues (Udhar)
            </span>
            <span className="text-[10px] bg-amber-200/70 text-amber-900 font-mono font-bold px-1.5 py-0.5 rounded">
              To Collect
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs font-bold text-amber-700">₹</span>
            <h2 className="text-3xl font-extrabold text-amber-800 font-mono tracking-tight">
              {permanentStats.allPending.toLocaleString("en-IN")}
            </h2>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-amber-100 flex items-center justify-between text-xs text-gray-600">
            <span className="text-amber-800 font-medium">Customer balance receivable</span>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* CHECKING OPTION FOR DESIRED DATE & MONTHS (CORE USER REQUEST) */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-[#032e60] flex items-center gap-2">
              <CalendarDays className="text-[#2563eb]" size={20} />
              Check Income for Desired Date & Month
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any specific date or month to calculate income, bills, customer breakdown, and dues.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start print:hidden">
            <button
              type="button"
              onClick={() => setCheckMode("daily")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                checkMode === "daily"
                  ? "bg-white text-[#032e60] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Check Specific Date
            </button>
            <button
              type="button"
              onClick={() => setCheckMode("monthly")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                checkMode === "monthly"
                  ? "bg-white text-[#032e60] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Check Specific Month
            </button>
            <button
              type="button"
              onClick={() => setCheckMode("range")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                checkMode === "range"
                  ? "bg-white text-[#032e60] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Custom Date Range
            </button>
            <button
              type="button"
              onClick={() => setCheckMode("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                checkMode === "all"
                  ? "bg-white text-[#032e60] shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              All Records
            </button>
          </div>
        </div>

        {/* Date / Month Selection Controls */}
        <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 flex flex-wrap items-center justify-between gap-4 print:hidden">
          {checkMode === "daily" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Calendar size={15} className="text-[#032e60]" />
                Select Desired Date:
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white shadow-sm focus:ring-2 focus:ring-[#2563eb] outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={setQuickToday}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                    selectedDate === todayStr
                      ? "bg-[#032e60] text-white border-[#032e60]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={setQuickYesterday}
                  className="text-[11px] px-2.5 py-1 rounded-md font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Yesterday
                </button>
              </div>
            </div>
          )}

          {checkMode === "monthly" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <CalendarDays size={15} className="text-[#032e60]" />
                Select Desired Month:
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white shadow-sm focus:ring-2 focus:ring-[#2563eb] outline-none"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={setQuickThisMonth}
                  className={`text-[11px] px-2.5 py-1 rounded-md font-semibold border transition-colors ${
                    selectedMonth === currentMonthStr
                      ? "bg-[#032e60] text-white border-[#032e60]"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={setQuickLastMonth}
                  className="text-[11px] px-2.5 py-1 rounded-md font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Last Month
                </button>
              </div>
            </div>
          )}

          {checkMode === "range" && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">From:</label>
                <input
                  type="date"
                  value={rangeStartDate}
                  onChange={(e) => setRangeStartDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white shadow-sm focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-700">To:</label>
                <input
                  type="date"
                  value={rangeEndDate}
                  onChange={(e) => setRangeEndDate(e.target.value)}
                  className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white shadow-sm focus:ring-2 focus:ring-[#2563eb] outline-none"
                />
              </div>
            </div>
          )}

          {checkMode === "all" && (
            <div className="text-xs font-semibold text-gray-600">
              Showing complete accounting history across all time.
            </div>
          )}

          <div className="text-xs font-medium text-gray-500">
            Found <strong className="text-gray-900 font-bold">{periodData.count}</strong> transactions in selected period
          </div>
        </div>

        {/* Highlighted Results Banner for Selected Period */}
        <div className="p-5 rounded-2xl bg-[#032e60] text-white shadow-md relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                {checkMode === "daily"
                  ? "Daily Report Summary"
                  : checkMode === "monthly"
                  ? "Monthly Report Summary"
                  : checkMode === "range"
                  ? "Custom Range Summary"
                  : "All-Time Summary"}
              </span>
              <h3 className="text-xl sm:text-2xl font-black mt-0.5 tracking-tight">
                {checkMode === "daily"
                  ? formatDateDisplay(selectedDate)
                  : checkMode === "monthly"
                  ? formatMonthDisplay(selectedMonth)
                  : checkMode === "range"
                  ? `${formatDateDisplay(rangeStartDate)} to ${formatDateDisplay(rangeEndDate)}`
                  : "Complete Business History"}
              </h3>
              <p className="text-xs text-blue-200/90 mt-1">
                {checkMode === "monthly"
                  ? `Average daily income: ₹${periodData.averageDailyIncome.toLocaleString("en-IN")} / day`
                  : `${periodData.count} customer service records calculated`}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/10 p-3.5 rounded-xl border border-white/15 backdrop-blur-sm">
              <div>
                <span className="text-[11px] text-blue-200 block font-medium">Income Collected</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                  ₹{periodData.income.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-blue-200 block font-medium">Total Billed</span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono">
                  ₹{periodData.charged.toLocaleString("en-IN")}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-blue-200 block font-medium">Pending Due</span>
                <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
                  ₹{periodData.pending.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Breakdowns: Payment Mode + Top Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Payment Method Breakdown */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#032e60] mb-3 flex items-center gap-1.5">
              <CreditCard size={15} className="text-[#2563eb]" />
              Payment Methods Breakdown ({checkMode === "daily" ? "Selected Date" : "Selected Period"})
            </h4>

            {Object.keys(periodData.paymentBreakdown).length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">No payment transactions in this period.</p>
            ) : (
              <div className="space-y-2.5">
                {Object.entries(periodData.paymentBreakdown).map(([method, amount]) => {
                  const percent = periodData.income > 0 ? Math.round((amount / periodData.income) * 100) : 0;
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                          {method === "Cash" && <IndianRupee size={13} className="text-emerald-600" />}
                          {method.includes("UPI") && <QrCode size={13} className="text-purple-600" />}
                          {method === "Card" && <CreditCard size={13} className="text-blue-600" />}
                          {method === "Net Banking" && <Landmark size={13} className="text-indigo-600" />}
                          {method}
                        </span>
                        <div className="font-mono text-right">
                          <span className="font-bold text-gray-900">₹{amount.toLocaleString("en-IN")}</span>
                          <span className="text-[11px] text-gray-400 ml-1.5">({percent}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-600 h-1.5 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Services Breakdown */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#032e60] mb-3 flex items-center gap-1.5">
              <TrendingUp size={15} className="text-[#2563eb]" />
              Service Performance ({checkMode === "daily" ? "Selected Date" : "Selected Period"})
            </h4>

            {periodData.topServices.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-4 text-center">No services recorded in this period.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {periodData.topServices.slice(0, 5).map((srv, index) => (
                  <div
                    key={srv.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[10px]">
                        {index + 1}
                      </span>
                      <div className="truncate">
                        <span className="font-semibold text-gray-900 block truncate">{srv.name}</span>
                        <span className="text-[10px] text-gray-400">{srv.count} orders</span>
                      </div>
                    </div>
                    <div className="text-right font-mono flex-shrink-0">
                      <span className="font-bold text-emerald-800">₹{srv.revenue}</span>
                      {srv.pending > 0 && (
                        <span className="text-[10px] text-amber-700 block">(+₹{srv.pending} due)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* If Monthly Mode: Show Day-by-Day Table & Drill-down for Desired Month */}
        {checkMode === "monthly" && periodData.dayWiseList.length > 0 && (
          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#032e60] flex items-center gap-1.5">
                  <CalendarDays size={15} className="text-[#2563eb]" />
                  Day-by-Day Breakdown for {formatMonthDisplay(selectedMonth)}
                </h4>
                <p className="text-[11px] text-gray-500">Click "View Day" on any date to inspect that day's individual orders.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left bg-white rounded-lg border border-gray-200 overflow-hidden">
                <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Orders</th>
                    <th className="p-2.5">Income Collected</th>
                    <th className="p-2.5">Amount Billed</th>
                    <th className="p-2.5">Due Amount</th>
                    <th className="p-2.5 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {periodData.dayWiseList.map((day) => (
                    <tr key={day.dateStr} className="hover:bg-gray-50 transition-colors">
                      <td className="p-2.5 font-semibold text-gray-900 whitespace-nowrap">
                        {formatDateDisplay(day.dateStr)}
                      </td>
                      <td className="p-2.5 font-medium text-gray-600">{day.count} {day.count === 1 ? 'order' : 'orders'}</td>
                      <td className="p-2.5 font-bold font-mono text-emerald-800">₹{day.income.toLocaleString("en-IN")}</td>
                      <td className="p-2.5 font-medium font-mono text-gray-800">₹{day.charged.toLocaleString("en-IN")}</td>
                      <td className="p-2.5 font-mono">
                        {day.pending > 0 ? (
                          <span className="text-amber-800 font-bold bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded text-[11px]">
                            ₹{day.pending} Due
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">✓ Cleared</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right print:hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(day.dateStr);
                            setCheckMode("daily");
                          }}
                          className="text-[11px] font-bold text-[#2563eb] hover:text-[#032e60] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors"
                        >
                          View Day →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* DETAILED TRANSACTIONS TABLE FOR SELECTED DATE / MONTH */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h3 className="text-base font-bold text-[#032e60] flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-[#177d70]" />
              Detailed Transactions
              <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-0.5 rounded-full">
                {tableTransactions.length} items
              </span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Showing customers served in {checkMode === "daily" ? formatDateDisplay(selectedDate) : checkMode === "monthly" ? formatMonthDisplay(selectedMonth) : "selected period"}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto print:hidden">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search customer, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
              />
            </div>

            {/* Payment Filter */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold bg-white text-gray-700 outline-none cursor-pointer"
            >
              <option value="All">All Payment Modes</option>
              <option value="Cash">Cash Only</option>
              <option value="UPI / QR">UPI / QR Only</option>
              <option value="Card">Card Only</option>
              <option value="Pending">Pending / Udhar Only</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer Details</th>
                <th className="p-3.5">Service Requested</th>
                <th className="p-3.5">Payment Mode</th>
                <th className="p-3.5 text-right">Charged</th>
                <th className="p-3.5 text-right font-bold text-emerald-800">Paid (Income)</th>
                <th className="p-3.5 text-right">Due Amount</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-gray-500">
                    <p className="font-semibold text-sm">No transactions match your selection.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Pick another date/month or check your search filters.
                    </p>
                  </td>
                </tr>
              ) : (
                tableTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 whitespace-nowrap text-gray-600">
                      <div className="font-semibold text-gray-900">{t.dateStr}</div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(t.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-[#032e60]">{t.customerName}</div>
                      <div className="text-gray-500 font-mono text-[11px]">{t.mobileNumber}</div>
                    </td>

                    <td className="p-3.5 max-w-xs">
                      <div className="font-semibold text-gray-800 truncate">{t.serviceName}</div>
                      <span className="text-[10px] text-gray-400 font-mono">{t.customerId}</span>
                    </td>

                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-md text-[11px] bg-gray-100 text-gray-700">
                        {t.paymentMethod}
                      </span>
                    </td>

                    <td className="p-3.5 text-right font-mono font-medium text-gray-700">
                      ₹{t.amountCharged}
                    </td>

                    <td className="p-3.5 text-right font-mono font-bold text-emerald-800">
                      ₹{t.amountPaid}
                    </td>

                    <td className="p-3.5 text-right font-mono">
                      {t.amountPending > 0 ? (
                        <span className="inline-block bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded text-[11px]">
                          ₹{t.amountPending} Due
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold text-[11px]">✓ Cleared</span>
                      )}
                    </td>

                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                          t.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : t.status === "In Progress"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Total Footer */}
            {tableTransactions.length > 0 && (
              <tfoot className="bg-gray-50 font-bold border-t-2 border-gray-300 text-gray-900">
                <tr>
                  <td colSpan={4} className="p-3.5 text-right uppercase tracking-wider text-xs font-extrabold text-[#032e60]">
                    Total Summary for Filtered View:
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-gray-900">
                    ₹{tableTransactions.reduce((acc, cur) => acc + (cur.amountCharged || 0), 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-right font-mono font-black text-emerald-800 text-sm">
                    ₹{tableTransactions.reduce((acc, cur) => acc + (cur.amountPaid || 0), 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-amber-900">
                    ₹{tableTransactions.reduce((acc, cur) => acc + (cur.amountPending || 0), 0).toLocaleString("en-IN")}
                  </td>
                  <td className="p-3.5 text-center text-xs text-gray-500 font-semibold">
                    {tableTransactions.length} records
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
