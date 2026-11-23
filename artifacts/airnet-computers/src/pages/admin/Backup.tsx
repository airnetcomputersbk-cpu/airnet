import { useState, useEffect, useMemo, useRef } from "react";
import {
  Download,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Filter,
  Database,
  Upload,
  RefreshCw,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Activity,
  Inbox,
  Bell,
  Wallet,
  Clock,
  Sparkles,
  ArrowRight,
  HardDrive,
  Info
} from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { formatDateDMY, formatDateTimeDMY } from "../../lib/dateUtils";

type RecordEntry = {
  id: number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceId: string;
  amountCharged: number;
  amountPaid: number;
  amountPending: number;
  paymentMethod: string;
  applicationStatus: string;
  notes: string;
  createdAt: string;
  source?: "tracker" | "enquiry";
};

type TableCounts = {
  applicationTasks: number;
  enquiries: number;
  notifications: number;
  services: number;
  records: number;
  total: number;
};

export default function Backup() {
  const { showSuccess, showError, showWarning, confirm } = useModal();
  const [activeTab, setActiveTab] = useState<"snapshot" | "modules" | "restore" | "purge">("snapshot");
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [tableCounts, setTableCounts] = useState<TableCounts>({
    applicationTasks: 0,
    enquiries: 0,
    notifications: 0,
    services: 0,
    records: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    return localStorage.getItem("airnet_last_backup_time") || null;
  });

  // Filtered Module Export States
  const [selectedModule, setSelectedModule] = useState<"records" | "tracker" | "enquiries" | "notifications">("records");
  const [downloadMonth, setDownloadMonth] = useState("All");
  const [downloadStatus, setDownloadStatus] = useState("All");
  const [downloadPayment, setDownloadPayment] = useState("All");

  // Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePayload, setRestorePayload] = useState<any | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Purge states
  const [purgeTarget, setPurgeTarget] = useState<"rejected_enquiries" | "completed_enquiries" | "completed_tasks">("rejected_enquiries");
  const [purgeConfirmation, setPurgeConfirmation] = useState("");
  const [isPurging, setIsPurging] = useState(false);

  // Full snapshot states
  const [isDownloadingSnapshot, setIsDownloadingSnapshot] = useState(false);

  const fetchSummaryData = async () => {
    setLoading(true);
    try {
      const [trackerRes, enquiriesRes, notifRes, servicesRes] = await Promise.all([
        fetch("/api/admin/tracker"),
        fetch("/api/admin/enquiries"),
        fetch("/api/notifications"),
        fetch("/api/services")
      ]);

      let trackerTasks: any[] = [];
      let enquiriesData: any[] = [];
      let notifData: any[] = [];
      let servicesData: any[] = [];

      if (trackerRes.ok) trackerTasks = await trackerRes.json();
      if (enquiriesRes.ok) enquiriesData = await enquiriesRes.json();
      if (notifRes.ok) notifData = await notifRes.json();
      if (servicesRes.ok) servicesData = await servicesRes.json();

      const counts: TableCounts = {
        applicationTasks: trackerTasks.length,
        enquiries: enquiriesData.length,
        notifications: notifData.length,
        services: servicesData.length,
        records: trackerTasks.length + enquiriesData.length,
        total: trackerTasks.length + enquiriesData.length + notifData.length + servicesData.length
      };
      setTableCounts(counts);

      // Build consolidated records list for CSV exports
      const list: RecordEntry[] = [];
      const seenCustomerIds = new Set<string>();

      trackerTasks.forEach((t: any) => {
        if (t.customerId) seenCustomerIds.add(t.customerId);
        const paid = Number(t.amountPaid) || 0;
        const pending = Number(t.amountPending) || 0;
        list.push({
          id: t.id,
          customerId: t.customerId || "AN-TRACKER",
          customerName: t.customerName,
          mobileNumber: t.mobileNumber || "",
          serviceId: t.serviceName || "General",
          amountPaid: paid,
          amountPending: pending,
          amountCharged: paid + pending,
          paymentMethod: t.paymentType || "Cash",
          applicationStatus: t.status || "In Progress",
          notes: t.notes || "",
          createdAt: t.createdAt,
          source: "tracker"
        });
      });

      enquiriesData.forEach((e: any) => {
        if (!seenCustomerIds.has(e.customerId)) {
          const charged = Number(e.amountCharged) || 0;
          const isPending = e.paymentMethod === "Pending" || e.paymentMethod === "Pending / Udhar" || e.paymentMethod === "Pending / Pay Later";
          const paid = e.amountPaid !== undefined && e.amountPaid !== null ? Number(e.amountPaid) || 0 : (isPending ? 0 : charged);
          const pending = e.amountPending !== undefined && e.amountPending !== null ? Number(e.amountPending) || 0 : Math.max(0, charged - paid);
          list.push({
            id: e.id,
            customerId: e.customerId || "AN-MIGRATED",
            customerName: e.customerName,
            mobileNumber: e.mobileNumber || "",
            serviceId: e.serviceId || "General",
            amountPaid: paid,
            amountPending: pending,
            amountCharged: charged || (paid + pending),
            paymentMethod: e.paymentMethod || "Cash",
            applicationStatus: e.applicationStatus || "Completed",
            notes: e.notes || "",
            createdAt: e.createdAt,
            source: "enquiry"
          });
        }
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(list);
    } catch (err) {
      console.error("Error loading backup data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryData();
  }, []);

  // Available months for filters
  const availableMonths = useMemo(() => {
    return Array.from(new Set(records.map(r => {
      const d = new Date(r.createdAt);
      if (isNaN(d.getTime())) return "";
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }).filter(Boolean))).sort().reverse();
  }, [records]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const recDate = new Date(r.createdAt);
      const recMonth = `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}`;
      const matchMonth = downloadMonth === "All" || recMonth === downloadMonth;
      const matchStatus = downloadStatus === "All" || r.applicationStatus === downloadStatus;
      const matchPayment = downloadPayment === "All" || r.paymentMethod === downloadPayment;
      return matchMonth && matchStatus && matchPayment;
    });
  }, [records, downloadMonth, downloadStatus, downloadPayment]);

  // Download Full System Snapshot (JSON)
  const handleDownloadFullSnapshot = async () => {
    setIsDownloadingSnapshot(true);
    try {
      const res = await fetch("/api/admin/backup/full");
      if (!res.ok) throw new Error("Server returned " + res.status);
      const snapshot = await res.json();

      const jsonStr = JSON.stringify(snapshot, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const today = new Date().toISOString().split("T")[0];
      link.href = url;
      link.download = `Airnet-Computers-Full-System-Backup-${today}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const nowFormatted = new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
      setLastBackupTime(nowFormatted);
      localStorage.setItem("airnet_last_backup_time", nowFormatted);
    } catch (err: any) {
      console.error(err);
      showError("Backup Snapshot Failed", err.message || "Failed to generate full system backup snapshot. Please check backend connection.");
    } finally {
      setIsDownloadingSnapshot(false);
    }
  };

  // Download Filtered Module CSV
  const handleDownloadModuleCSV = () => {
    if (selectedModule === "records") {
      if (filteredRecords.length === 0) {
        showWarning("No Records Found", "No customer records match the selected filters.");
        return;
      }
      const headers = ["SL No", "Customer ID", "Date", "Customer Name", "Mobile", "Service", "Paid Amount", "Payment Type", "Pending Amount", "Status", "Notes"];
      const rows = filteredRecords.map((r, i) => [
        filteredRecords.length - i,
        r.customerId || "AN-MIGRATED",
        formatDateDMY(r.createdAt),
        `"${r.customerName}"`,
        r.mobileNumber,
        `"${r.serviceId || 'General'}"`,
        r.amountPaid ?? 0,
        r.paymentMethod || "Cash",
        r.amountPending ?? 0,
        r.applicationStatus || "In Progress",
        `"${(r.notes || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`
      ]);

      downloadCSV(headers, rows, `Airnet-Customer-Ledger-${new Date().toISOString().split("T")[0]}.csv`);
    } else {
      // Direct module export from records
      const headers = ["SL No", "Customer ID", "Date", "Customer Name", "Mobile", "Service", "Paid Amount", "Pending Balance", "Status"];
      const rows = records.map((r, i) => [
        records.length - i,
        r.customerId,
        formatDateDMY(r.createdAt),
        `"${r.customerName}"`,
        r.mobileNumber,
        `"${r.serviceId}"`,
        r.amountPaid,
        r.amountPending,
        r.applicationStatus
      ]);

      downloadCSV(headers, rows, `Airnet-${selectedModule}-export-${new Date().toISOString().split("T")[0]}.csv`);
    }
  };

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Restore file selection and inspection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    setRestoreSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      setRestoreError("Please upload a valid JSON backup file (*.json).");
      return;
    }

    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !parsed.metadata) {
          setRestoreError("The uploaded file is missing required metadata or schema. Please provide an authentic Airnet Computers backup file.");
          setRestorePayload(null);
          return;
        }
        setRestorePayload(parsed);
      } catch (err) {
        setRestoreError("Failed to parse JSON file. The file may be corrupt.");
        setRestorePayload(null);
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!restorePayload) return;
    const confirmed = await confirm({
      title: "Confirm Database Restore?",
      message: "This will safely import the verified backup into your database. New records, tasks, services, and notifications will be added.\n\nDo you want to proceed?",
      confirmText: "YES – Restore",
      cancelText: "NO – Cancel",
      isDanger: false,
    });
    if (!confirmed) return;

    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccessMsg(null);

    try {
      const res = await fetch("/api/admin/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: restorePayload })
      });

      if (!res.ok) throw new Error("Server returned status " + res.status);
      const data = await res.json();
      const msg = `Data successfully restored! Added ${data.restoredCounts.applicationTasks} tasks, ${data.restoredCounts.enquiries} enquiries, ${data.restoredCounts.notifications} notifications, and ${data.restoredCounts.services} services.`;
      setRestoreSuccessMsg(`✓ ${msg}`);
      showSuccess("Database Restored Successfully", msg);
      setRestorePayload(null);
      setRestoreFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchSummaryData();
    } catch (err: any) {
      console.error(err);
      setRestoreError("Failed to execute database restore. Please verify your connection.");
      showError("Restore Failed", err.message || "Failed to execute database restore. Please verify your connection.");
    } finally {
      setIsRestoring(false);
    }
  };

  // Execute Safe Purge
  const handleExecutePurge = async () => {
    if (purgeConfirmation !== "CONFIRM_DELETE") {
      showWarning("Confirmation Required", 'You must type "CONFIRM_DELETE" exactly to confirm.');
      return;
    }

    const confirmed = await confirm({
      title: "Permanent Database Cleanup?",
      message: `Are you sure you want to permanently delete records for target "${purgeTarget}"? This action cannot be undone.`,
      confirmText: "YES – Delete",
      cancelText: "NO – Cancel",
      isDanger: true,
    });
    if (!confirmed) return;

    setIsPurging(true);
    try {
      const res = await fetch("/api/admin/backup/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: purgeTarget,
          confirmation: purgeConfirmation
        })
      });

      if (res.ok) {
        const data = await res.json();
        showSuccess("Purge Completed", `Successfully cleaned up ${data.purgedCount} records.`);
        setPurgeConfirmation("");
        fetchSummaryData();
      } else {
        showError("Purge Failed", "Failed to purge database records.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Purge Error", err.message || "An error occurred during database cleanup.");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* ============================================================== */}
      {/* 1. HEADER & SYSTEM STORAGE OVERVIEW */}
      {/* ============================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#177d70]">
            <Database className="w-4 h-4 text-[#177d70]" />
            <span>Airnet Computers • Data Safety & Lifecycle Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#032e60] mt-1">
            Data Backup & Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Safeguard your citizen records, application tasks, and accounting ledger with one-click backups, restores, and safe hygiene.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={fetchSummaryData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            <span>{loading ? "Refreshing..." : "Refresh Status"}</span>
          </button>

          <button
            onClick={handleDownloadFullSnapshot}
            disabled={isDownloadingSnapshot}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#032e60] hover:bg-[#0b477e] text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs"
          >
            <Download size={16} className="text-[#f2b544]" />
            <span>{isDownloadingSnapshot ? "Generating Snapshot..." : "Full System Backup"}</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. STORAGE HEALTH & RECORD VOLUME BAR */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-gray-400 block">Total Database Records</span>
          <span className="text-2xl font-extrabold text-[#032e60] font-mono mt-1 block">
            {loading ? "..." : tableCounts.total}
          </span>
          <span className="text-[10px] text-emerald-600 font-bold mt-1 block">● Active Database</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-gray-400 block">Application Tasks</span>
          <span className="text-2xl font-extrabold text-blue-700 font-mono mt-1 block">
            {loading ? "..." : tableCounts.applicationTasks}
          </span>
          <span className="text-[10px] text-gray-500 mt-1 block">Milestones & Stages</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-gray-400 block">Customer Enquiries</span>
          <span className="text-2xl font-extrabold text-amber-700 font-mono mt-1 block">
            {loading ? "..." : tableCounts.enquiries}
          </span>
          <span className="text-[10px] text-gray-500 mt-1 block">Portal & Notifications</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase text-gray-400 block">Public Notifications</span>
          <span className="text-2xl font-extrabold text-indigo-700 font-mono mt-1 block">
            {loading ? "..." : tableCounts.notifications}
          </span>
          <span className="text-[10px] text-gray-500 mt-1 block">Circulars & OCR Alerts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold uppercase text-gray-400 block">Last Snapshot Backup</span>
          <span className="text-xs font-bold text-[#032e60] mt-1 block truncate">
            {lastBackupTime || "Not yet created"}
          </span>
          <span className="text-[10px] text-gray-500 mt-1 block">Disaster Recovery Ready</span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. TAB NAVIGATION */}
      {/* ============================================================== */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-2xl px-3 pt-2 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("snapshot")}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "snapshot"
              ? "border-[#032e60] text-[#032e60] bg-blue-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <HardDrive size={16} /> Full System Snapshot (JSON)
        </button>

        <button
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "modules"
              ? "border-[#032e60] text-[#032e60] bg-blue-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <FileSpreadsheet size={16} /> Filtered Ledger & Excel Exports
        </button>

        <button
          onClick={() => setActiveTab("restore")}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "restore"
              ? "border-[#032e60] text-[#032e60] bg-blue-50/50"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <Upload size={16} /> Restore & Import Data
        </button>

        <button
          onClick={() => setActiveTab("purge")}
          className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === "purge"
              ? "border-red-600 text-red-700 bg-red-50/50"
              : "border-transparent text-gray-500 hover:text-red-700"
          }`}
        >
          <Trash2 size={16} /> Safe Data Hygiene & Cleanup
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: FULL SYSTEM SNAPSHOT (DISASTER RECOVERY) */}
      {/* ============================================================== */}
      {activeTab === "snapshot" && (
        <div className="bg-white rounded-b-2xl border border-gray-200 border-t-0 p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-[#032e60] flex items-center gap-2">
              <HardDrive size={22} className="text-blue-600" />
              Complete System Snapshot & Disaster Recovery
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Download an encrypted, versioned JSON archive containing every table in your database. This snapshot preserves all citizen details, payment records, tasks, and announcements.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <FileJson size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-[#032e60] text-base">One-Click Disaster Backup</h3>
                  <span className="text-xs text-blue-700 font-medium">Includes 5 Essential Tables</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-700 bg-white/80 p-3.5 rounded-xl border border-blue-100 font-medium">
                <div className="flex justify-between">
                  <span>✓ Application Tasks Table:</span>
                  <strong className="font-mono">{tableCounts.applicationTasks} records</strong>
                </div>
                <div className="flex justify-between">
                  <span>✓ Citizen Enquiries Table:</span>
                  <strong className="font-mono">{tableCounts.enquiries} records</strong>
                </div>
                <div className="flex justify-between">
                  <span>✓ Public Notifications Table:</span>
                  <strong className="font-mono">{tableCounts.notifications} records</strong>
                </div>
                <div className="flex justify-between">
                  <span>✓ Services Catalog Table:</span>
                  <strong className="font-mono">{tableCounts.services} records</strong>
                </div>
                <div className="flex justify-between">
                  <span>✓ Customer Ledger Records:</span>
                  <strong className="font-mono">{tableCounts.records} entries</strong>
                </div>
              </div>

              <button
                onClick={handleDownloadFullSnapshot}
                disabled={isDownloadingSnapshot}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#032e60] hover:bg-[#0b477e] text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
              >
                <Download size={18} className="text-[#f2b544]" />
                {isDownloadingSnapshot ? "Packaging Snapshot..." : "Download Disaster Recovery Snapshot (JSON)"}
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3.5 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-emerald-950 text-base flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-700" />
                  Recommended Backup Protocol for Amjad Ali
                </h3>
                <p className="text-xs text-emerald-800 leading-relaxed mt-1.5">
                  Follow these best practices to ensure zero data loss at Airnet Computers:
                </p>
                <ul className="mt-3 space-y-2 text-xs text-emerald-900">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">1.</span>
                    <span><strong>Daily Cash Close:</strong> Download the Customer Ledger (CSV) at the end of each business day.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">2.</span>
                    <span><strong>Weekly Full Snapshot:</strong> Download the Complete System Snapshot every Saturday and store a copy on Google Drive or a USB drive.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-emerald-700">3.</span>
                    <span><strong>Before Bulk Deletion:</strong> Always take a backup before purging old records.</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-900">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Center Location & Ownership</span>
                <strong>Airnet Computers</strong> • Opp. Congress Office, Haralayya Chowk, Basavakalyan
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: FILTERED LEDGER & EXCEL EXPORTS */}
      {/* ============================================================== */}
      {activeTab === "modules" && (
        <div className="bg-white rounded-b-2xl border border-gray-200 border-t-0 p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-[#032e60] flex items-center gap-2">
              <FileSpreadsheet size={22} className="text-emerald-600" />
              Filtered Ledger & Excel (CSV) Exports
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Export specific spreadsheets for bookkeeping, auditor reviews, or customer balance collections.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            {/* Filter Configuration (7 cols) */}
            <div className="md:col-span-7 space-y-4 bg-gray-50/70 p-5 rounded-2xl border border-gray-200">
              <h3 className="font-bold text-sm text-[#032e60] uppercase tracking-wider">
                1. Select Export Parameters
              </h3>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Layers size={13} /> Select Dataset
                  </label>
                  <select
                    value={selectedModule}
                    onChange={(e: any) => setSelectedModule(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs font-semibold bg-white outline-none focus:border-blue-500"
                  >
                    <option value="records">Customer Accounts & Ledger</option>
                    <option value="tracker">Application Tracker Tasks</option>
                    <option value="enquiries">My Enquiry List</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Calendar size={13} /> Target Month
                  </label>
                  <select
                    value={downloadMonth}
                    onChange={e => setDownloadMonth(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs font-semibold bg-white outline-none focus:border-blue-500"
                  >
                    <option value="All">All Months (Entire History)</option>
                    {availableMonths.map(m => (
                      <option key={m} value={m}>
                        {new Date(m + "-01").toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Wallet size={13} /> Payment Method
                  </label>
                  <select
                    value={downloadPayment}
                    onChange={e => setDownloadPayment(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs font-semibold bg-white outline-none focus:border-blue-500"
                  >
                    <option value="All">All Payment Types</option>
                    <option value="Cash">Cash Only</option>
                    <option value="UPI / QR">UPI / QR (PhonePe, GPay)</option>
                    <option value="Pending / Udhar">Pending / Udhar (Unpaid)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                    <Filter size={13} /> Application Status
                  </label>
                  <select
                    value={downloadStatus}
                    onChange={e => setDownloadStatus(e.target.value)}
                    className="w-full border rounded-xl p-2.5 text-xs font-semibold bg-white outline-none focus:border-blue-500"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Completed">Completed & Delivered</option>
                    <option value="In Progress">In Progress</option>
                    <option value="New">New / Pending</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={handleDownloadModuleCSV}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>Download Excel CSV File</span>
                </button>
              </div>
            </div>

            {/* Live Preview Box (5 cols) */}
            <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#032e60] uppercase tracking-wider mb-2">
                  2. Export Preview & Summary
                </h3>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-950 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Matching Rows:</span>
                    <strong className="font-mono text-sm text-blue-800">{filteredRecords.length} records</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Format:</span>
                    <span className="font-mono font-bold">Standard UTF-8 CSV</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Compatibility:</span>
                    <span className="font-semibold text-emerald-700">MS Excel, Google Sheets</span>
                  </div>
                </div>

                <div className="mt-4 text-xs text-gray-500 space-y-1">
                  <p>Includes fields:</p>
                  <div className="font-mono text-[10px] bg-gray-100 p-2.5 rounded-lg text-gray-700">
                    SL No, Customer ID, Date, Name, Mobile, Service, Paid Amount, Payment Type, Pending Balance, Status, Notes
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-gray-400 mt-4">
                Airnet Computers standard accounting export format.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: RESTORE & IMPORT DATA */}
      {/* ============================================================== */}
      {activeTab === "restore" && (
        <div className="bg-white rounded-b-2xl border border-gray-200 border-t-0 p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-[#032e60] flex items-center gap-2">
              <Upload size={22} className="text-indigo-600" />
              Database Restore & Migration
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Restore citizen tasks, enquiries, circulars, or services from a previously exported system snapshot.
            </p>
          </div>

          <div className="grid md:grid-cols-12 gap-6">
            <div className="md:col-span-6 space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 p-8 rounded-2xl text-center cursor-pointer transition-colors"
              >
                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 mx-auto grid place-items-center mb-3">
                  <Upload size={24} />
                </div>
                <h3 className="font-bold text-sm text-[#032e60]">Click to select Backup File (.json)</h3>
                <p className="text-xs text-gray-500 mt-1">Upload an authentic Airnet Computers JSON snapshot file</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {restoreFile && (
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <FileJson size={16} className="text-indigo-600" />
                    <span className="font-bold text-gray-800 truncate">{restoreFile.name}</span>
                  </div>
                  <span className="text-gray-400 font-mono">{(restoreFile.size / 1024).toFixed(1)} KB</span>
                </div>
              )}

              {restoreError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{restoreSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Inspection & Execution Box */}
            <div className="md:col-span-6 bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#032e60] uppercase tracking-wider mb-2">
                  Inspection & Pre-Restore Validation
                </h3>

                {restorePayload ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
                      <span className="font-bold block">✓ Valid Airnet Backup Snapshot Verified</span>
                      <span className="text-[11px] text-emerald-800">
                        Exported on {formatDateDMY(restorePayload.metadata?.exportedAt)} by {restorePayload.metadata?.owner}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-1.5 text-xs">
                      <span className="font-bold text-gray-700 block">Payload Contents Detected:</span>
                      <div className="flex justify-between">
                        <span>Application Tasks:</span>
                        <strong className="font-mono">{restorePayload.applicationTasks?.length || 0} tasks</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Customer Enquiries:</span>
                        <strong className="font-mono">{restorePayload.enquiries?.length || 0} enquiries</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Public Notifications:</span>
                        <strong className="font-mono">{restorePayload.notifications?.length || 0} notices</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Services Catalog:</span>
                        <strong className="font-mono">{restorePayload.services?.length || 0} services</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                    Select a JSON backup file on the left to inspect its contents before restoring.
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-gray-200">
                <button
                  onClick={handleExecuteRestore}
                  disabled={!restorePayload || isRestoring}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
                >
                  <RefreshCw size={16} className={isRestoring ? "animate-spin" : ""} />
                  <span>{isRestoring ? "Restoring Database..." : "Execute Safe Database Restore"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: SAFE DATA HYGIENE & CLEANUP */}
      {/* ============================================================== */}
      {activeTab === "purge" && (
        <div className="bg-white rounded-b-2xl border border-gray-200 border-t-0 p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
              <Trash2 size={22} className="text-red-600" />
              Safe Data Hygiene & Lifecycle Cleanup
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Selectively purge obsolete rejected enquiries or historic completed tasks to maintain database responsiveness.
            </p>
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
            <ShieldAlert size={24} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs text-red-900 leading-relaxed">
              <strong className="block font-bold">CAUTION: DELETION OPERATIONS ARE PERMANENT</strong>
              Purging removes selected records permanently from the PostgreSQL database. It is strongly recommended to download a <strong>Full System Snapshot</strong> first before executing any cleanup.
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200">
              <h3 className="font-bold text-sm text-[#032e60] uppercase tracking-wider">
                1. Select Cleanup Target
              </h3>

              <div className="space-y-2.5">
                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  purgeTarget === "rejected_enquiries" ? "bg-red-50/70 border-red-300" : "bg-white border-gray-200"
                }`}>
                  <input
                    type="radio"
                    name="purgeTarget"
                    checked={purgeTarget === "rejected_enquiries"}
                    onChange={() => setPurgeTarget("rejected_enquiries")}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <strong className="block text-gray-900">Rejected Customer Enquiries (Safe)</strong>
                    <span className="text-gray-500">Purges cancelled or rejected requests from My Enquiry List.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  purgeTarget === "completed_enquiries" ? "bg-red-50/70 border-red-300" : "bg-white border-gray-200"
                }`}>
                  <input
                    type="radio"
                    name="purgeTarget"
                    checked={purgeTarget === "completed_enquiries"}
                    onChange={() => setPurgeTarget("completed_enquiries")}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <strong className="block text-gray-900">Completed & Delivered Enquiries</strong>
                    <span className="text-gray-500">Purges customer enquiries marked as "Completed".</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  purgeTarget === "completed_tasks" ? "bg-red-50/70 border-red-300" : "bg-white border-gray-200"
                }`}>
                  <input
                    type="radio"
                    name="purgeTarget"
                    checked={purgeTarget === "completed_tasks"}
                    onChange={() => setPurgeTarget("completed_tasks")}
                    className="mt-0.5"
                  />
                  <div className="text-xs">
                    <strong className="block text-gray-900">Completed Application Tracker Tasks</strong>
                    <span className="text-gray-500">Purges delivered tasks that have finished all milestones.</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="space-y-4 bg-gray-50 p-5 rounded-2xl border border-gray-200 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#032e60] uppercase tracking-wider mb-2">
                  2. Safety Verification
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  To confirm permanent deletion, type <code className="bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">CONFIRM_DELETE</code> in the field below:
                </p>

                <input
                  type="text"
                  value={purgeConfirmation}
                  onChange={e => setPurgeConfirmation(e.target.value)}
                  placeholder='Type "CONFIRM_DELETE"'
                  className="w-full border border-gray-300 rounded-xl p-3 text-xs font-mono font-bold bg-white outline-none focus:border-red-500"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 space-y-2">
                <button
                  onClick={handleExecutePurge}
                  disabled={purgeConfirmation !== "CONFIRM_DELETE" || isPurging}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <Trash2 size={16} />
                  <span>{isPurging ? "Purging..." : "Permanently Delete Selected Records"}</span>
                </button>
                <p className="text-[11px] text-center text-gray-500">
                  This action is recorded in system logs and cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}