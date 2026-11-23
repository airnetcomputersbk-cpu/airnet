import { useState, useEffect, useRef } from "react";
import { useModal } from "../../context/ModalContext";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useLiveSync } from "../../hooks/useLiveSync";
import {
  Bell,
  Plus,
  Search,
  Upload,
  Calendar,
  Building,
  GraduationCap,
  Users,
  IndianRupee,
  ExternalLink,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  Clock,
  Sparkles,
  AlertTriangle,
  X,
  FileText,
  Image as ImageIcon,
  Check,
  RefreshCw,
  Star,
  MessageSquare,
  Share2,
  Copy
} from "lucide-react";

export interface NotificationItem {
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
  posterUrl: string | null;
  attachmentUrl: string | null;
  applyUrl: string | null;
  description: string | null;
  isFeatured: boolean;
  status: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "All",
  "Featured ⭐",
  "Govt Jobs",
  "Scholarships",
  "Exams",
  "Admissions",
  "Public Schemes",
  "Drafts",
];

// Helper for standard Date-Month-Year (DD-MM-YYYY) format across all notification sections
export function parseDateString(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayDMY(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDateDMY(val?: string | Date | null): string {
  if (!val) return "Open / As per notice";
  if (val instanceof Date) {
    const day = String(val.getDate()).padStart(2, "0");
    const month = String(val.getMonth() + 1).padStart(2, "0");
    const year = val.getFullYear();
    return `${day}-${month}-${year}`;
  }
  const s = String(val).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  // YYYY-MM-DD -> DD-MM-YYYY
  const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[3].padStart(2, "0")}-${ymd[2].padStart(2, "0")}-${ymd[1]}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    return `${dmy[1].padStart(2, "0")}-${dmy[2].padStart(2, "0")}-${dmy[3]}`;
  }

  // Month name e.g. "20 August 2026"
  const monthMatch = s.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (monthMatch) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const d = monthMatch[1].padStart(2, "0");
    const m = months[monthMatch[2].slice(0, 3).toLowerCase()] || "01";
    return `${d}-${m}-${monthMatch[3]}`;
  }

  const d = parseDateString(s);
  if (d) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${d.getFullYear()}`;
  }
  return s;
}

// Helper for high-speed client-side image compression
async function compressImageIfNeeded(file: File): Promise<{ dataUrl: string; name: string }> {
  if (!file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ dataUrl: reader.result as string, name: file.name });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width / height > MAX_WIDTH / MAX_HEIGHT) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataUrl: compressed, name: file.name.replace(/\.[^.]+$/, ".jpg") });
        } else {
          resolve({ dataUrl: e.target?.result as string, name: file.name });
        }
      };
      img.onerror = () => resolve({ dataUrl: e.target?.result as string, name: file.name });
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Helper to generate ready-to-share WhatsApp & SMS broadcast message
export function generateNotificationMessage(item: NotificationItem, helpline: string = "+91 7892881086"): string {
  const isJob = item.category === "Govt Jobs";
  const header = isJob
    ? "📢 *NEW GOVT JOB RECRUITMENT ALERT* 📢"
    : `📢 *NEW ${item.category.toUpperCase()} ALERT* 📢`;

  const lines: string[] = [
    header,
    "═══════════════════════════",
    `📌 *Title:* ${item.title}`,
  ];

  if (item.organization) {
    lines.push(`🏛 *Department:* ${item.organization}`);
  }
  if (item.vacancies) {
    lines.push(`👥 *Total Posts:* ${item.vacancies}`);
  }
  if (item.qualification) {
    lines.push(`🎓 *Qualification:* ${item.qualification}`);
  }
  if (item.ageLimit) {
    lines.push(`⏳ *Age Limit:* ${item.ageLimit}`);
  }
  if (item.startDate) {
    lines.push(`📅 *Start Date:* ${formatDateDMY(item.startDate)}`);
  }
  if (item.lastDate) {
    lines.push(`⏰ *Last Date:* ${formatDateDMY(item.lastDate)}`);
  }
  if (item.applicationFee) {
    lines.push(`💰 *Application Fee:* ${item.applicationFee}`);
  }
  if (item.description) {
    lines.push("", `📝 *Overview & Notes:*`, item.description);
  }

  lines.push("═══════════════════════════");
  lines.push("✅ *Apply Online Hassle-Free At:*");
  lines.push("💻 *Airnet Computers Online Service Center*");
  lines.push("🏢 Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327");
  lines.push(`📞 Call / WhatsApp: ${helpline} (Md Amjad Ali)`);
  lines.push("🌐 Portal: https://airnetcomputers.in");

  return lines.join("\n");
}

export default function NotificationsAdmin() {
  const { showSuccess, showError, showWarning, confirmDelete } = useModal();
  
  // High performance SWR Cache: render cached notifications in 0ms without blank screen flicker
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    return getCachedData<NotificationItem[]>("admin_notifications") || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedData<NotificationItem[]>("admin_notifications");
  });
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState<NotificationItem | null>(null);
  const [viewingItem, setViewingItem] = useState<NotificationItem | null>(null);
  const [messagingItem, setMessagingItem] = useState<NotificationItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    organization: "",
    category: "Govt Jobs",
    vacancies: "",
    qualification: "",
    ageLimit: "",
    startDate: getTodayDMY(),
    lastDate: "",
    applicationFee: "",
    posterUrl: "",
    attachmentUrl: "",
    applyUrl: "https://airnetcomputers.in",
    description: "",
    isFeatured: false,
    status: "Published",
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Live Date and Time ticker (updates every second)
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const liveDateStr = `${currentDateTime.toLocaleDateString("en-IN", { weekday: "short" })}, ${formatDateDMY(currentDateTime)}`;

  const liveTimeStr = currentDateTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  const fetchNotifications = async (silent = false) => {
    if (!silent && notifications.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setCachedData("admin_notifications", data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(notifications.length > 0);
  }, []);

  // Multi-Device Instant Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("notifications", () => {
    fetchNotifications(true);
  });

  // Escape key listener for easy modal cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (messagingItem) {
          setMessagingItem(null);
        } else if (showUploadModal) {
          setShowUploadModal(false);
          resetForm();
        } else if (viewingItem) {
          setViewingItem(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showUploadModal, viewingItem, messagingItem]);

  const resetForm = () => {
    setFormData({
      title: "",
      organization: "",
      category: "Govt Jobs",
      vacancies: "",
      qualification: "",
      ageLimit: "",
      startDate: getTodayDMY(),
      lastDate: "",
      applicationFee: "",
      posterUrl: "",
      attachmentUrl: "",
      applyUrl: "https://airnetcomputers.in",
      description: "",
      isFeatured: false,
      status: "Published",
    });
    setFilePreview(null);
    setUploadedFileName("");
    setExtractionSuccess(false);
    setEditingItem(null);
  };

  const handleOpenFileUpload = () => {
    resetForm();
    setShowUploadModal(true);
  };

  const handleEditClick = (item: NotificationItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      organization: item.organization || "",
      category: item.category,
      vacancies: item.vacancies || "",
      qualification: item.qualification || "",
      ageLimit: item.ageLimit || "",
      startDate: item.startDate || "",
      lastDate: item.lastDate || "",
      applicationFee: item.applicationFee || "",
      posterUrl: item.posterUrl || "",
      attachmentUrl: item.attachmentUrl || "",
      applyUrl: item.applyUrl || "",
      description: item.description || "",
      isFeatured: item.isFeatured,
      status: item.status,
    });
    setFilePreview(item.posterUrl || null);
    setUploadedFileName(item.posterUrl ? "Current Attached Poster" : "");
    setShowUploadModal(true);
  };

  // Handle document/poster upload & automatic extraction with ultra-fast compression
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsExtracting(true);
    setExtractionSuccess(false);

    try {
      // Instant client-side compression for high-speed upload
      const { dataUrl, name } = await compressImageIfNeeded(file);
      setFilePreview(dataUrl);

      // Send optimized payload to backend for upload and heuristic extraction
      const res = await fetch("/api/admin/notifications/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: name,
          fileData: dataUrl,
          category: formData.category,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.extractedData) {
          const ext = data.extractedData;
          setFormData((prev) => ({
            ...prev,
            title: ext.title || prev.title,
            organization: ext.organization || prev.organization,
            category: ext.category || prev.category,
            vacancies: ext.vacancies || prev.vacancies,
            qualification: ext.qualification || prev.qualification,
            ageLimit: ext.ageLimit || prev.ageLimit,
            startDate: ext.startDate || prev.startDate,
            lastDate: ext.lastDate || prev.lastDate,
            applicationFee: ext.applicationFee || prev.applicationFee,
            applyUrl: ext.applyUrl || prev.applyUrl,
            description: ext.description || prev.description,
            posterUrl: data.fileUrl || prev.posterUrl,
            status: "Published", // Always Published by default so it's instantly live on the user website
          }));
          setExtractionSuccess(true);
        }
      }
    } catch (err) {
      console.error("Upload & extraction failed:", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showWarning("Missing Notification Title", "Please provide a valid notification title before saving.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        // Update existing notification
        const res = await fetch(`/api/admin/notifications/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          window.dispatchEvent(new CustomEvent("airnet_notifications_updated"));
          localStorage.setItem("airnet_notifications_updated", Date.now().toString());
          setShowUploadModal(false);
          resetForm();
          fetchNotifications();
          showSuccess("Notification Updated", `"${formData.title}" details updated successfully.`);
        } else {
          showError("Update Failed", "Failed to update notification. Please verify backend service.");
        }
      } else {
        // Create new notification
        const res = await fetch("/api/admin/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          window.dispatchEvent(new CustomEvent("airnet_notifications_updated"));
          localStorage.setItem("airnet_notifications_updated", Date.now().toString());
          setShowUploadModal(false);
          resetForm();
          fetchNotifications();
          showSuccess("Notification Published", `"${formData.title}" has been published successfully.`);
        } else {
          showError("Creation Failed", "Failed to create new notification. Please check your data.");
        }
      }
    } catch (err: any) {
      console.error("Submission error:", err);
      showError("Submission Error", err.message || "An error occurred while saving the notification.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/notifications/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "Failed to delete notification.");
    }
    window.dispatchEvent(new CustomEvent("airnet_notifications_updated"));
    localStorage.setItem("airnet_notifications_updated", Date.now().toString());
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleStatus = async (item: NotificationItem) => {
    const nextStatus = item.status === "Published" ? "Draft" : "Published";
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("airnet_notifications_updated"));
        localStorage.setItem("airnet_notifications_updated", Date.now().toString());
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, status: nextStatus } : n))
        );
        showSuccess(
          nextStatus === "Published" ? "Notification Published" : "Moved to Drafts",
          `"${item.title}" is now ${nextStatus.toLowerCase()}.`
        );
      } else {
        showError("Status Update Failed", "Failed to update publication status.");
      }
    } catch (err: any) {
      console.error("Status toggle error:", err);
      showError("Status Update Error", err.message || "An error occurred while updating status.");
    }
  };

  const handleToggleFeatured = async (item: NotificationItem) => {
    const nextFeatured = !item.isFeatured;
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured: nextFeatured }),
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("airnet_notifications_updated"));
        localStorage.setItem("airnet_notifications_updated", Date.now().toString());
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isFeatured: nextFeatured } : n))
        );
        if (viewingItem && viewingItem.id === item.id) {
          setViewingItem({ ...viewingItem, isFeatured: nextFeatured });
        }
        showSuccess(
          nextFeatured ? "Marked as Featured ⭐" : "Removed from Featured",
          nextFeatured
            ? `"${item.title}" is now pinned to the top of Featured notifications.`
            : `"${item.title}" has been moved back to Recently Added notifications according to its publication date.`
        );
      } else {
        showError("Featured Update Failed", "Failed to update featured status.");
      }
    } catch (err: any) {
      console.error("Featured toggle error:", err);
      showError("Featured Update Error", err.message || "An error occurred while updating featured status.");
    }
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === "Featured ⭐" || activeTab === "Featured") {
      if (!item.isFeatured) return false;
    } else if (activeTab === "Drafts") {
      if (item.status !== "Draft") return false;
    } else if (activeTab !== "All") {
      if (item.category !== activeTab) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchOrg = (item.organization || "").toLowerCase().includes(q);
      const matchQual = (item.qualification || "").toLowerCase().includes(q);
      return matchTitle || matchOrg || matchQual;
    }

    return true;
  });

  // Calculate statistics
  const totalCount = notifications.length;
  const featuredCount = notifications.filter((n) => n.isFeatured).length;
  const govtJobsCount = notifications.filter((n) => n.category === "Govt Jobs").length;
  const scholarshipsCount = notifications.filter((n) => n.category === "Scholarships" || n.category === "Public Schemes").length;
  const activeCount = notifications.filter((n) => n.status === "Published").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm uppercase tracking-wider mb-1">
            <Bell className="w-4 h-4" />
            <span>Public Alerts & Recruitment Engine</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Notification Management
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Upload job posters, exam notifications, and scholarship circulars with automatic AI extraction & instant publishing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Date and Time Display */}
          <div className="flex items-center gap-2 sm:gap-2.5 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-semibold text-slate-800">{liveDateStr}</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-mono font-bold text-slate-900">{liveTimeStr}</span>
            </div>
          </div>

          <button
            onClick={handleOpenFileUpload}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all transform active:scale-95 cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <span>Upload Poster / Circular</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Notifications
            </p>
            <h3 className="text-2xl font-extrabold text-slate-800 mt-1">
              {totalCount}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">All alerts in database</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between bg-gradient-to-br from-white to-amber-50/40">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Featured Priority
            </p>
            <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
              {featuredCount}
            </h3>
            <p className="text-xs text-amber-700/80 mt-0.5">Pinned to top</p>
          </div>
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Govt Jobs
            </p>
            <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
              {govtJobsCount}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Recruitments live</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Scholarships & Schemes
            </p>
            <h3 className="text-2xl font-extrabold text-purple-600 mt-1">
              {scholarshipsCount}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Student & Public aids</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Live on Website
            </p>
            <h3 className="text-2xl font-extrabold text-blue-600 mt-1">
              {activeCount}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Published & accessible</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                  activeTab === cat
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, department, qualification..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Notifications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <h3 className="font-semibold text-slate-700">No notifications found</h3>
            <p className="text-sm mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No notifications matched "${searchQuery}". Try a different search term.`
                : "No notifications have been uploaded yet. Click 'Upload Poster / Circular' to publish your first alert!"}
            </p>
            <button
              onClick={handleOpenFileUpload}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Upload Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Poster / Preview</th>
                  <th className="py-3 px-4">Title & Department</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Vacancies & Eligibility</th>
                  <th className="py-3 px-4">Last Date</th>
                  <th className="py-3 px-4 text-center">Featured Status</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Views</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredNotifications.map((item) => {
                  const parsedLast = parseDateString(item.lastDate);
                  const isExpiringSoon =
                    parsedLast &&
                    parsedLast.getTime() - new Date().getTime() <
                      5 * 24 * 60 * 60 * 1000 &&
                    parsedLast.getTime() >= new Date().getTime();

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Poster */}
                      <td className="py-3 px-4">
                        <div
                          onClick={() => setViewingItem(item)}
                          className="w-14 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center cursor-pointer group relative shadow-xs"
                        >
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-slate-400" />
                          )}
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </div>
                      </td>

                      {/* Title & Department */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          {item.isFeatured && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              Featured
                            </span>
                          )}
                          <span className="text-[11px] font-semibold text-blue-600 truncate">
                            {item.organization || "Public Notice"}
                          </span>
                        </div>
                        <h4
                          onClick={() => setViewingItem(item)}
                          className="font-bold text-slate-800 text-sm hover:text-blue-600 cursor-pointer line-clamp-2 mt-0.5"
                        >
                          {item.title}
                        </h4>
                        {item.applicationFee && (
                          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                            <IndianRupee className="w-3 h-3 text-slate-400" />
                            <span>{item.applicationFee}</span>
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            item.category === "Govt Jobs"
                              ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                              : item.category === "Scholarships"
                              ? "bg-purple-50 text-purple-700 border border-purple-200/60"
                              : item.category === "Exams"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : item.category === "Admissions"
                              ? "bg-teal-50 text-teal-700 border border-teal-200/60"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>

                      {/* Vacancies & Eligibility */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-700">
                          {item.vacancies || "Multiple Vacancies"}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-1">
                          {item.qualification || "Eligibility detailed in circular"}
                        </div>
                      </td>

                      {/* Last Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {item.lastDate ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {formatDateDMY(item.lastDate)}
                            </span>
                            {isExpiringSoon && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded w-fit mt-0.5 flex items-center gap-0.5 animate-pulse">
                                <AlertTriangle className="w-2.5 h-2.5" /> Closing Soon!
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">Not specified</span>
                        )}
                      </td>

                      {/* Featured Status Action Column */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {item.isFeatured ? (
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              FEATURED
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleFeatured(item)}
                              title="Click to remove from Featured and restore to Recently Added by publication date"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-amber-900 bg-amber-50 hover:bg-amber-200 border border-amber-300 transition-colors cursor-pointer"
                            >
                              <X className="w-2.5 h-2.5" />
                              <span>Remove Featured</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleFeatured(item)}
                            title="Click to mark as Featured (pin to the top on public website)"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-slate-200 transition-all active:scale-95 cursor-pointer"
                          >
                            <Star className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-500" />
                            <span>Make Featured</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(item)}
                          title="Click to toggle Published / Draft"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-transform active:scale-95 ${
                            item.status === "Published"
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              item.status === "Published"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                          {item.status}
                        </button>
                      </td>

                      {/* Views */}
                      <td className="py-3 px-4 text-center font-semibold text-slate-600">
                        {item.viewCount || 0}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleFeatured(item)}
                            title={item.isFeatured ? "Remove Featured (Move back to Recently Added)" : "Make Featured (Pin to Top)"}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              item.isFeatured
                                ? "text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                                : "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            }`}
                          >
                            <Star className={`w-4 h-4 ${item.isFeatured ? "fill-amber-500 text-amber-500" : ""}`} />
                          </button>
                          <button
                            onClick={() => setViewingItem(item)}
                            title="Preview Notification & Message"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setMessagingItem(item)}
                            title="Govt Job Announcement & WhatsApp Message"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(item)}
                            title="Edit Details"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              confirmDelete({
                                title: "Delete Notification?",
                                message: "Are you sure you want to delete this notification? This action may not be reversible.",
                                itemName: item.title,
                                onConfirm: async () => handleDelete(item.id),
                              })
                            }
                            title="Delete"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload & Auto-Extraction Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
              resetForm();
            }
          }}
        >
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">
                    {editingItem
                      ? "Edit Notification Alert"
                      : "Upload & Auto-Extract Notification"}
                  </h3>
                  <p className="text-xs text-blue-100">
                    Upload poster, advertisement image or circular PDF to automatically extract and publish details.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                title="Cancel / Close (Esc)"
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar-admin">
              {/* Document / Poster Upload Box */}
              <div className="border-2 border-dashed border-blue-200 hover:border-blue-400 bg-blue-50/40 rounded-2xl p-6 text-center transition-colors relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  className="hidden"
                />

                {isExtracting ? (
                  <div className="py-6 flex flex-col items-center">
                    <RefreshCw className="w-10 h-10 animate-spin text-blue-600 mb-3" />
                    <h4 className="font-bold text-slate-800 text-base">
                      Scanning & Extracting Details...
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Analyzing poster document, organization, vacancies, qualifications, and important dates.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    {filePreview ? (
                      <div className="w-24 h-32 rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden shrink-0 relative group">
                        <img
                          src={filePreview}
                          alt="Uploaded poster preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 text-white text-[10px] font-bold flex items-center justify-center transition-opacity"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-blue-100/60 text-blue-600 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-10 h-10" />
                      </div>
                    )}

                    <div className="text-left space-y-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                          {uploadedFileName
                            ? `File: ${uploadedFileName}`
                            : "Upload Notification Poster / Image / Circular PDF"}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Supports JPG, PNG, WebP posters or official PDF announcements (up to 50MB).
                        </p>
                      </div>

                      {extractionSuccess && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Extracted successfully! Review details below.</span>
                        </div>
                      )}

                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-white hover:bg-slate-50 text-blue-600 border border-blue-300 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{uploadedFileName ? "Replace File" : "Browse Computer"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Notification Title *</span>
                    <span className="text-[10px] font-normal text-slate-400">Appears on public website</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karnataka KPSC Group C Recruitment 2026"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Organization */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Organization / Department
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KPSC / SSC / Karnataka Police"
                    value={formData.organization}
                    onChange={(e) =>
                      setFormData({ ...formData, organization: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  >
                    <option value="Govt Jobs">Govt Jobs</option>
                    <option value="Scholarships">Scholarships</option>
                    <option value="Exams">Exams & Hall Tickets</option>
                    <option value="Admissions">Admissions & Counseling</option>
                    <option value="Public Schemes">Public Schemes</option>
                    <option value="Other">Other Public Notice</option>
                  </select>
                </div>

                {/* Vacancies */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Total Vacancies / Posts
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 450 Posts, 1,200 Seats"
                    value={formData.vacancies}
                    onChange={(e) =>
                      setFormData({ ...formData, vacancies: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Qualification */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Minimum Qualification
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10th / SSLC, PUC, Any Degree"
                    value={formData.qualification}
                    onChange={(e) =>
                      setFormData({ ...formData, qualification: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Age Limit */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Age Limit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18 - 35 Years"
                    value={formData.ageLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, ageLimit: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Application Fee */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Application Fee
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. General: ₹250, SC/ST: ₹100 or Free"
                    value={formData.applicationFee}
                    onChange={(e) =>
                      setFormData({ ...formData, applicationFee: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Application Start Date (Date-Month-Year)
                  </label>
                  <input
                    type="text"
                    placeholder="DD-MM-YYYY (e.g. 07-08-2026)"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Last Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Application Last Date (Date-Month-Year)</span>
                    <span className="text-[10px] text-red-500 font-medium">Important</span>
                  </label>
                  <input
                    type="text"
                    placeholder="DD-MM-YYYY (e.g. 20-08-2026)"
                    value={formData.lastDate}
                    onChange={(e) =>
                      setFormData({ ...formData, lastDate: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Apply URL / Official Portal */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Official Website / Apply Link
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={formData.applyUrl}
                    onChange={(e) =>
                      setFormData({ ...formData, applyUrl: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">
                    Full Description / Notes / How to Apply
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Key highlights, required documents, or instructions for applicants..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                  />
                </div>

                {/* Status & Featured Toggle */}
                <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-700">
                      Publish Status:
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, status: "Published" })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          formData.status === "Published"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Published (Live)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, status: "Draft" })}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                          formData.status === "Draft"
                            ? "bg-amber-600 text-white shadow-xs"
                            : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        Draft (Hidden)
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) =>
                        setFormData({ ...formData, isFeatured: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      Pin to Featured Alerts
                    </span>
                  </label>
                </div>
              </div>

              </div>

              {/* Modal Footer - Pinned */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/25 transition-all transform active:scale-95 disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        {editingItem
                          ? "Update Notification"
                          : "Publish Notification"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview / Details Modal */}
      {viewingItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingItem(null); }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header - Pinned (White with Black Text) */}
            <div className="p-5 sm:p-6 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold uppercase tracking-wider">
                  {viewingItem.category}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  {viewingItem.organization || "Public Department Notice"}
                </span>
              </div>
              <button
                onClick={() => setViewingItem(null)}
                title="Close / Cancel (Esc)"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable with custom vertical scroll bar */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar-admin">
              {viewingItem.posterUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-72 bg-slate-100 flex items-center justify-center">
                  <img
                    src={viewingItem.posterUrl}
                    alt={viewingItem.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  {viewingItem.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Published on {formatDateDMY(viewingItem.createdAt)} &bull; {viewingItem.viewCount || 0} views
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Vacancies
                  </span>
                  <span className="font-bold text-slate-800">
                    {viewingItem.vacancies || "Not specified"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Eligibility
                  </span>
                  <span className="font-bold text-slate-800">
                    {viewingItem.qualification || "Not specified"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Age Limit
                  </span>
                  <span className="font-bold text-slate-800">
                    {viewingItem.ageLimit || "Not specified"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Start Date
                  </span>
                  <span className="font-bold text-slate-800">
                    {formatDateDMY(viewingItem.startDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Last Date
                  </span>
                  <span className="font-bold text-red-600">
                    {formatDateDMY(viewingItem.lastDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Application Fee
                  </span>
                  <span className="font-bold text-slate-800">
                    {viewingItem.applicationFee || "Free / As per circular"}
                  </span>
                </div>
              </div>

              {viewingItem.description && (
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Description & Overview
                  </h4>
                  <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-44 overflow-y-auto custom-scrollbar-admin">
                    {viewingItem.description}
                  </div>
                </div>
              )}

              {/* WhatsApp Broadcast / Customer Announcement Message Preview */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>Customer Broadcast / WhatsApp Message</span>
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Auto-Formatted
                  </span>
                </div>
                <pre className="p-4 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto custom-scrollbar select-all shadow-xs border-l-4 border-l-emerald-600">
                  {generateNotificationMessage(viewingItem)}
                </pre>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generateNotificationMessage(viewingItem), `view-msg-${viewingItem.id}`)}
                    className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    {copiedId === `view-msg-${viewingItem.id}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy Broadcast Text</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(generateNotificationMessage(viewingItem))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Modal Footer - Pinned */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleFeatured(viewingItem)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewingItem.isFeatured
                      ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                      : "bg-slate-100 text-slate-700 border border-slate-300 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-400"
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${viewingItem.isFeatured ? "fill-amber-500 text-amber-500" : ""}`} />
                  <span>{viewingItem.isFeatured ? "Remove Featured" : "Make Featured"}</span>
                </button>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    viewingItem.status === "Published"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {viewingItem.status}
                </span>
                {viewingItem.applyUrl && (
                  <a
                    href={viewingItem.applyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span>Visit Official Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Govt Jobs Announcement / Broadcast Message Popup */}
      {messagingItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setMessagingItem(null); }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-200 overflow-hidden">
            {/* Modal Header - Pinned (White with Black Text) */}
            <div className="p-5 bg-white border-b border-slate-200 text-slate-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Govt Job Notification Message
                  </h3>
                  <p className="text-xs text-slate-500">
                    WhatsApp & SMS Customer Broadcast Template
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMessagingItem(null)}
                title="Close / Cancel (Esc)"
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body with visible vertical scrollbar */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar-admin">
              <div className="flex items-center justify-between text-xs bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Date: <strong className="text-slate-800">{liveDateStr}</strong></span>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Time: <strong className="text-slate-800 font-mono">{liveTimeStr}</strong></span>
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-bold text-emerald-950 block truncate text-sm">
                    {messagingItem.title}
                  </span>
                  <span className="text-emerald-700 text-xs mt-0.5 block">
                    {messagingItem.organization || "Public Department Notice"} &bull; {messagingItem.vacancies || "Multiple Posts"}
                  </span>
                </div>
                <span className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full text-[11px] shrink-0">
                  {messagingItem.category}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>Formatted Broadcast Message:</span>
                  <span className="text-[11px] text-slate-400">Vertical scrollbar enabled</span>
                </label>
                <pre className="p-4 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto custom-scrollbar select-all shadow-xs border-l-4 border-l-emerald-600">
                  {generateNotificationMessage(messagingItem)}
                </pre>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Ready to copy and share across WhatsApp channels, groups, and status updates. Contains key dates, eligibility, and Airnet Computers shop details.
                </span>
              </div>
            </div>

            {/* Modal Footer - Pinned */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setMessagingItem(null)}
                className="w-full sm:w-auto px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => copyToClipboard(generateNotificationMessage(messagingItem), `modal-msg-${messagingItem.id}`)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedId === `modal-msg-${messagingItem.id}` ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-500" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(generateNotificationMessage(messagingItem))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
