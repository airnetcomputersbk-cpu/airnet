import { useState, useEffect, useMemo, useRef, useDeferredValue } from "react";
import {
  FolderArchive,
  Search,
  UploadCloud,
  Eye,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Clock,
  Copy,
  Check,
  Settings,
  HardDrive,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Info,
} from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { useLiveSync } from "../../hooks/useLiveSync";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { formatDateDMY, formatDateTimeDMY } from "../../lib/dateUtils";

export interface CustomerDocumentItem {
  id: number;
  customerId: string;
  customerName?: string | null;
  serviceName?: string | null;
  acknowledgementNumber?: string | null;
  driveFileId: string;
  driveFolderId: string;
  fileName: string;
  mimeType: string;
  fileExtension?: string | null;
  fileSize: number;
  category: string;
  notes?: string | null;
  uploadedBy: string;
  uploadedAt: string;
  uploadStatus: string;
}

export interface CustomerRecordEntry {
  customerId: string;
  customerName: string;
  serviceName: string;
  acknowledgementNumber: string;
  mobileNumber: string;
  status: string;
  totalDocuments: number;
  lastUploadDate: string | null;
  documents: CustomerDocumentItem[];
  driveFolderId?: string | null;
  source: string;
  createdAt: string;
}

export interface DriveStatus {
  configured: boolean;
  permanentlySaved?: boolean;
  connected: boolean;
  connectedEmail: string | null;
  connectionStatus: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  clientId: string | null;
  fullClientId?: string | null;
  rootFolderId: string | null;
  customerDocumentsFolderId: string | null;
  tokenExpiry: string | null;
  lastError: string | null;
}

export default function Documents() {
  const { showSuccess, showError, showWarning, confirmDelete } = useModal();

  // Customer List with SWR caching
  const [customers, setCustomers] = useState<CustomerRecordEntry[]>(() => {
    return getCachedData<CustomerRecordEntry[]>("admin_documents_customers") || [];
  });
  const [summary, setSummary] = useState({
    totalCustomers: 0,
    totalDocuments: 0,
    customersWithDocs: 0,
    customersWithoutDocs: 0,
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedData<CustomerRecordEntry[]>("admin_documents_customers");
  });

  // Google Drive Status
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [checkingDrive, setCheckingDrive] = useState(false);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("All");
  const [filterCustomerStatus, setFilterCustomerStatus] = useState<"completed" | "all">("completed");
  const [filterDocStatus, setFilterDocStatus] = useState<"All" | "WithDocs" | "WithoutDocs">("All");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals state
  const [viewCustomer, setViewCustomer] = useState<CustomerRecordEntry | null>(null);
  const [uploadCustomer, setUploadCustomer] = useState<CustomerRecordEntry | null>(null);
  const [editCustomer, setEditCustomer] = useState<CustomerRecordEntry | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CustomerDocumentItem | null>(null);
  const [showDriveSettings, setShowDriveSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload Form State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadNotes, setUploadNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Edit Customer Form State
  const [editForm, setEditForm] = useState({
    customerName: "",
    serviceName: "",
    acknowledgementNumber: "",
    status: "Completed",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Inline Acknowledgement Number Edit State
  const [editingAckCustomerId, setEditingAckCustomerId] = useState<string | null>(null);
  const [inlineAckValue, setInlineAckValue] = useState<string>("");
  const [isSavingInlineAck, setIsSavingInlineAck] = useState<boolean>(false);

  const DEFAULT_DRIVE_CLIENT_ID = "438450701267-huqvap7ji7qtg64ijgu2no0amca4n47g.apps.googleusercontent.com";
  // Drive Settings Form State
  const [driveCredentials, setDriveCredentials] = useState({
    clientId: DEFAULT_DRIVE_CLIENT_ID,
    clientSecret: "",
  });
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Google Drive Connection Status
  const fetchDriveStatus = async () => {
    setCheckingDrive(true);
    try {
      const res = await fetch("/api/admin/google-drive/status");
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
        if (data.fullClientId) {
          setDriveCredentials((prev) => ({ ...prev, clientId: data.fullClientId }));
        }
      }
    } catch (err) {
      console.error("[Documents] Failed to fetch Drive status:", err);
    } finally {
      setCheckingDrive(false);
    }
  };

  // 2. Fetch Customer Records with Google Drive Documents
  const fetchCustomers = async (silent = false, statusParam = filterCustomerStatus) => {
    if (!silent && customers.length === 0) setLoading(true);
    try {
      const res = await fetch(`/api/admin/documents/customers?status=${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        if (data.summary) setSummary(data.summary);
        setCachedData("admin_documents_customers", data.customers);
      }
    } catch (err) {
      console.error("[Documents] Failed to load customer documents:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and URL query param check (for OAuth callback redirect)
  useEffect(() => {
    fetchCustomers(customers.length > 0);
    fetchDriveStatus();

    // Check URL parameters for OAuth result
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("drive_connected") === "true") {
        const email = params.get("email") || "Google Account";
        showSuccess(
          "Google Drive Connected!",
          `Successfully connected business Google Drive (${email}). All documents will be stored directly in Google Drive.`
        );
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchDriveStatus();
      } else if (params.get("drive_error")) {
        const err = params.get("drive_error") || "Authentication failed";
        showError("Google Drive Connection Failed", err);
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchDriveStatus();
      }
    }
  }, []);

  // Real-Time Multi-Device Sync via Server-Sent Events (SSE)
  useLiveSync("documents", () => {
    fetchCustomers(true);
    fetchDriveStatus();
  });
  useLiveSync("tracker", () => fetchCustomers(true));
  useLiveSync("records", () => fetchCustomers(true));

  // Copy Customer ID to Clipboard
  const handleCopyId = (cid: string) => {
    navigator.clipboard.writeText(cid);
    setCopiedId(cid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Unique list of services for filter dropdown
  const uniqueServices = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.serviceName) set.add(c.serviceName.trim());
    });
    return Array.from(set).sort();
  }, [customers]);

  const deferredSearch = useDeferredValue(search);

  // Filtered & Searched Customers (non-blocking concurrent filter)
  const filteredCustomers = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return customers.filter((c) => {
      // Search
      const matchesSearch =
        !q ||
        c.customerName?.toLowerCase().includes(q) ||
        c.customerId?.toLowerCase().includes(q) ||
        c.serviceName?.toLowerCase().includes(q) ||
        c.acknowledgementNumber?.toLowerCase().includes(q) ||
        c.mobileNumber?.toLowerCase().includes(q) ||
        c.documents?.some((d) => d.fileName?.toLowerCase().includes(q));

      // Filter by Service
      const matchesService = filterService === "All" || c.serviceName === filterService;

      // Filter by Doc Status
      const matchesDocStatus =
        filterDocStatus === "All" ||
        (filterDocStatus === "WithDocs" && c.totalDocuments > 0) ||
        (filterDocStatus === "WithoutDocs" && c.totalDocuments === 0);

      return matchesSearch && matchesService && matchesDocStatus;
    });
  }, [customers, deferredSearch, filterService, filterDocStatus]);

  // Paginated Customers
  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage, pageSize]);

  // Helper to format file sizes
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // File type icon helper
  const getFileIcon = (mime: string, ext?: string | null) => {
    const e = (ext || "").toLowerCase();
    if (mime.includes("pdf") || e === "pdf") return <FileText className="text-red-500" size={18} />;
    if (mime.includes("image") || ["jpg", "jpeg", "png", "webp"].includes(e))
      return <FileImage className="text-blue-500" size={18} />;
    if (mime.includes("sheet") || mime.includes("excel") || ["xls", "xlsx", "csv"].includes(e))
      return <FileSpreadsheet className="text-emerald-500" size={18} />;
    return <File className="text-amber-500" size={18} />;
  };

  // Connect Google Drive OAuth flow
  const handleConnectDrive = async () => {
    try {
      // If user provided credentials in the settings modal, save them first before initiating OAuth
      if (driveCredentials.clientId && driveCredentials.clientSecret) {
        await fetch("/api/admin/google-drive/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(driveCredentials),
        });
      }

      const originParam = typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";
      const res = await fetch(`/api/admin/google-drive/auth?origin=${encodeURIComponent(originParam)}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to initialize Google OAuth.");
      }
      // Redirect to Google OAuth consent screen
      window.location.href = data.url;
    } catch (err: any) {
      showError("Connection Failed", err.message || "Failed to connect to Google Drive.");
    }
  };

  // Disconnect Google Drive
  const handleDisconnectDrive = async () => {
    const confirmed = await confirmDelete({
      title: "Disconnect Google Drive?",
      message:
        "Are you sure you want to disconnect Google Drive? New uploads will be blocked until reconnected. Existing documents remain safely in your Google Drive.",
      itemName: driveStatus?.connectedEmail || "Google Drive Account",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/google-drive/disconnect", { method: "POST" });
      if (res.ok) {
        showSuccess("Disconnected", "Google Drive account was disconnected successfully.");
        fetchDriveStatus();
      }
    } catch (err: any) {
      showError("Disconnect Failed", err.message || "Could not disconnect Google Drive.");
    }
  };

  // Save Client Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveCredentials.clientId || !driveCredentials.clientSecret) {
      showWarning("Missing Fields", "Please provide both Google Cloud Client ID and Client Secret.");
      return;
    }
    setIsSavingCredentials(true);
    try {
      const res = await fetch("/api/admin/google-drive/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driveCredentials),
      });
      if (res.ok) {
        showSuccess("Credentials Saved", "Google OAuth credentials saved. You can now connect your business account.");
        setShowDriveSettings(false);
        fetchDriveStatus();
      } else {
        const err = await res.json();
        showError("Save Failed", err.error || "Failed to save credentials.");
      }
    } catch (err: any) {
      showError("Save Error", err.message);
    } finally {
      setIsSavingCredentials(false);
    }
  };

  // Explicitly Remove/Delete OAuth Credentials (Admin Action Only)
  const handleDeleteCredentials = async () => {
    const confirmed = await confirmDelete({
      title: "Permanently Delete OAuth Credentials?",
      message:
        "Are you sure you want to completely remove the Google OAuth Client ID & Secret from the database? This will disconnect the Google integration until you reconfigure them.",
      itemName: "Google Cloud OAuth App Credentials",
    });
    if (!confirmed) return;

    try {
      const res = await fetch("/api/admin/google-drive/credentials", { method: "DELETE" });
      if (res.ok) {
        showSuccess("Credentials Deleted", "Google OAuth credentials have been completely removed by admin.");
        setDriveCredentials({ clientId: "", clientSecret: "" });
        fetchDriveStatus();
      } else {
        const err = await res.json();
        showError("Deletion Failed", err.error || "Failed to delete credentials.");
      }
    } catch (err: any) {
      showError("Error", err.message);
    }
  };

  // Open Upload Modal
  const openUploadModal = (c: CustomerRecordEntry) => {
    if (!driveStatus?.connected) {
      showWarning(
        "Google Drive Not Connected",
        "Please connect your AIRNET COMPUTERS Google Drive account before uploading customer documents."
      );
      return;
    }
    setUploadCustomer(c);
    setSelectedFiles([]);
    setUploadCategory("General");
    setUploadNotes("");
    setUploadProgress(0);
  };

  // File selection handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Remove file from pending upload list
  const removePendingFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  // Execute Upload directly to Google Drive
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCustomer) return;
    if (selectedFiles.length === 0) {
      showWarning("No Files Selected", "Please select at least one file from your computer to upload.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    try {
      const encodedFiles = [];
      for (let i = 0; i < selectedFiles.length; i++) {
        const f = selectedFiles[i];
        const base64Data = await fileToBase64(f);
        encodedFiles.push({
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
          fileSize: f.size,
          fileData: base64Data,
        });
        setUploadProgress(20 + Math.round(((i + 1) / selectedFiles.length) * 40));
      }

      setUploadProgress(70);

      const res = await fetch("/api/admin/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: uploadCustomer.customerId,
          customerName: uploadCustomer.customerName,
          serviceName: uploadCustomer.serviceName,
          acknowledgementNumber: uploadCustomer.acknowledgementNumber,
          category: uploadCategory,
          notes: uploadNotes,
          files: encodedFiles,
        }),
      });

      setUploadProgress(95);

      if (res.ok) {
        const data = await res.json();
        setUploadProgress(100);
        showSuccess(
          "Documents Uploaded to Google Drive!",
          `Successfully uploaded ${data.uploadedCount || selectedFiles.length} document(s) directly to Google Drive in folder "${uploadCustomer.customerId} - ${uploadCustomer.customerName}".`
        );
        setUploadCustomer(null);
        setSelectedFiles([]);
        fetchCustomers(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showError("Upload Failed", err.error || "Failed to upload documents to Google Drive.");
      }
    } catch (err: any) {
      showError("Upload Error", err.message || "An unexpected error occurred during upload.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Inline Acknowledgement Edit Actions
  const startEditingAck = (c: CustomerRecordEntry) => {
    setEditingAckCustomerId(c.customerId);
    setInlineAckValue(c.acknowledgementNumber || "");
  };

  const cancelEditingAck = () => {
    setEditingAckCustomerId(null);
    setInlineAckValue("");
  };

  const saveInlineAck = async (customerId: string) => {
    if (isSavingInlineAck) return;
    setIsSavingInlineAck(true);
    const trimmedVal = inlineAckValue.trim();

    try {
      const res = await fetch(`/api/admin/documents/customers/${encodeURIComponent(customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acknowledgementNumber: trimmedVal }),
      });

      if (res.ok) {
        showSuccess("Saved", "Acknowledgement Number updated successfully.");
        // Instantly update local state
        setCustomers((prev) =>
          prev.map((cust) =>
            cust.customerId === customerId
              ? { ...cust, acknowledgementNumber: trimmedVal }
              : cust
          )
        );
        if (viewCustomer && viewCustomer.customerId === customerId) {
          setViewCustomer((prev) => (prev ? { ...prev, acknowledgementNumber: trimmedVal } : null));
        }
        setEditingAckCustomerId(null);
        setInlineAckValue("");
        fetchCustomers(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showError("Save Failed", err.error || "Failed to update Acknowledgement Number.");
      }
    } catch (err: any) {
      showError("Save Error", err.message);
    } finally {
      setIsSavingInlineAck(false);
    }
  };

  // Open Edit Customer Modal
  const openEditModal = (c: CustomerRecordEntry) => {
    setEditCustomer(c);
    setEditForm({
      customerName: c.customerName || "",
      serviceName: c.serviceName || "",
      acknowledgementNumber: c.acknowledgementNumber || "",
      status: c.status || "Completed",
    });
  };

  // Submit Edit Customer
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustomer) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/documents/customers/${encodeURIComponent(editCustomer.customerId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        showSuccess("Customer Updated", `Details for "${editForm.customerName}" updated successfully across Ledger and Documents.`);
        if (viewCustomer && viewCustomer.customerId === editCustomer.customerId) {
          setViewCustomer((prev) =>
            prev
              ? {
                  ...prev,
                  customerName: editForm.customerName,
                  serviceName: editForm.serviceName,
                  acknowledgementNumber: editForm.acknowledgementNumber,
                  status: editForm.status,
                }
              : null
          );
        }
        setEditCustomer(null);
        fetchCustomers(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showError("Update Failed", err.error || "Failed to update customer details.");
      }
    } catch (err: any) {
      showError("Update Error", err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete Individual File from Google Drive
  const handleDeleteFile = async (doc: CustomerDocumentItem) => {
    const confirmed = await confirmDelete({
      title: "Delete File from Google Drive?",
      message: `Are you sure you want to permanently delete "${doc.fileName}" from Google Drive? This action cannot be undone.`,
      itemName: doc.fileName,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/documents/files/${encodeURIComponent(doc.driveFileId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("File Deleted", `"${doc.fileName}" permanently removed from Google Drive.`);
        fetchCustomers(true);
        // Also update viewCustomer if open
        if (viewCustomer) {
          setViewCustomer((prev) =>
            prev
              ? {
                  ...prev,
                  documents: prev.documents.filter((d) => d.driveFileId !== doc.driveFileId),
                  totalDocuments: Math.max(0, prev.totalDocuments - 1),
                }
              : null
          );
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showError("Deletion Failed", err.error || "Failed to delete file from Google Drive.");
      }
    } catch (err: any) {
      showError("Deletion Error", err.message);
    }
  };

  // Delete Customer Documents from Google Drive (Preserving Ledger Records)
  const handleDeleteCustomerDocuments = async (c: CustomerRecordEntry) => {
    const confirmed = await confirmDelete({
      title: `Delete All Documents for ${c.customerName}?`,
      message: `This will permanently remove all ${c.totalDocuments} uploaded document(s) and the customer's folder from Google Drive.\n\nNOTE: The customer's original Ledger Record will NOT be deleted.`,
      itemName: `${c.customerId} - ${c.customerName}`,
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/documents/customers/${encodeURIComponent(c.customerId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        showSuccess(
          "Customer Documents Deleted",
          data.message || `Deleted documents from Google Drive. Ledger Record preserved.`
        );
        fetchCustomers(true);
        if (viewCustomer?.customerId === c.customerId) setViewCustomer(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showError("Deletion Failed", err.error || "Failed to delete documents.");
      }
    } catch (err: any) {
      showError("Deletion Error", err.message);
    }
  };

  // Export Documents Table to CSV
  const exportToCSV = () => {
    const headers = ["SL No", "Customer ID", "Customer Name", "Service Name", "Acknowledgement No", "Total Documents", "Last Upload Date"];
    const rows = filteredCustomers.map((c, i) => [
      i + 1,
      c.customerId,
      `"${c.customerName.replace(/"/g, '""')}"`,
      `"${c.serviceName.replace(/"/g, '""')}"`,
      `"${c.acknowledgementNumber || '-'}"`,
      c.totalDocuments,
      formatDateDMY(c.lastUploadDate),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Airnet-Customer-Documents-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Bar with Google Drive Connection Status & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#032e60]">
              <FolderArchive size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#032e60] flex items-center gap-2.5">
                Customer Documents
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Completed Records
                </span>
                <span className="text-[11px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-300">
                  Google Drive Storage
                </span>
              </h1>
              <p className="text-slate-500 text-xs mt-0.5">
                Displaying customer records with "Completed" status. Files are uploaded and stored directly in business Google Drive.
              </p>
            </div>
          </div>
        </div>

        {/* Google Drive Status Pill & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {driveStatus?.connected ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="font-bold text-emerald-800 flex items-center gap-1">
                  Google Drive Connected
                </span>
                <span className="text-[11px] text-emerald-600 font-mono">
                  {driveStatus.connectedEmail || "airnetcomputersbk@gmail.com"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleDisconnectDrive}
                className="ml-2 px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                title="Disconnect Google Drive"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span className="font-semibold text-amber-800">Drive Disconnected</span>
              <button
                type="button"
                onClick={handleConnectDrive}
                className="ml-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <HardDrive size={13} />
                Connect Google Drive
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowDriveSettings(true)}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-200"
            title="Google Drive Settings"
          >
            <Settings size={18} />
          </button>

          <button
            type="button"
            onClick={() => fetchCustomers()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Dashboard 4 Summary Cards (Section 13) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Completed Customers */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Completed Customers
            </span>
            <div className="text-2xl font-bold text-[#032e60] mt-1">{summary.totalCustomers}</div>
            <span className="text-[11px] text-emerald-600 font-medium">From Ledger Records</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Users size={22} />
          </div>
        </div>

        {/* Card 2: Total Uploaded Documents */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Uploaded Documents
            </span>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.totalDocuments}</div>
            <span className="text-[11px] text-emerald-600/80">Stored on Google Drive</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <FolderArchive size={22} />
          </div>
        </div>

        {/* Card 3: Customers With Documents */}
        <div
          onClick={() => setFilterDocStatus("WithDocs")}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
            filterDocStatus === "WithDocs" ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200/80 hover:border-blue-300"
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              With Documents
            </span>
            <div className="text-2xl font-bold text-blue-600 mt-1">{summary.customersWithDocs}</div>
            <span className="text-[11px] text-blue-500">Ready on Cloud</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Card 4: Customers Without Documents */}
        <div
          onClick={() => setFilterDocStatus("WithoutDocs")}
          className={`bg-white p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs flex items-center justify-between ${
            filterDocStatus === "WithoutDocs" ? "border-amber-500 ring-2 ring-amber-100" : "border-slate-200/80 hover:border-amber-300"
          }`}
        >
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Uploads
            </span>
            <div className="text-2xl font-bold text-amber-600 mt-1">{summary.customersWithoutDocs}</div>
            <span className="text-[11px] text-amber-600/80">Zero documents</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Real-time Search input */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search Customer, ID, Service, Ack No..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Service Filter */}
          <div className="md:col-span-3 relative">
            <select
              value={filterService}
              onChange={(e) => {
                setFilterService(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Services ({uniqueServices.length})</option>
              {uniqueServices.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Status Filter (Completed Only by default) */}
          <div className="md:col-span-3">
            <select
              value={filterCustomerStatus}
              onChange={(e) => {
                const val = e.target.value as "completed" | "all";
                setFilterCustomerStatus(val);
                fetchCustomers(false, val);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-300 font-semibold text-emerald-900 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="completed">Status: Completed Only (Default)</option>
              <option value="all">Status: All Records</option>
            </select>
          </div>

          {/* Document Availability Filter */}
          <div className="md:col-span-2">
            <select
              value={filterDocStatus}
              onChange={(e: any) => {
                setFilterDocStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Docs</option>
              <option value="WithDocs">With Docs ({summary.customersWithDocs})</option>
              <option value="WithoutDocs">No Docs ({summary.customersWithoutDocs})</option>
            </select>
          </div>
        </div>

        {/* Filter status ticker */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div>
            Showing <span className="font-semibold text-slate-900">{filteredCustomers.length}</span> of{" "}
            <span className="font-semibold text-slate-900">{customers.length}</span>{" "}
            {filterCustomerStatus === "completed" ? "completed customers" : "total customers"}
          </div>
          {(search || filterService !== "All" || filterDocStatus !== "All" || filterCustomerStatus !== "completed") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setFilterService("All");
                setFilterCustomerStatus("completed");
                setFilterDocStatus("All");
                fetchCustomers(false, "completed");
              }}
              className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Customer Records Table (Section 7 & 13) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#032e60] text-white uppercase text-[11px] font-bold tracking-wider">
                <th className="py-3.5 px-4">Customer ID</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Service Name</th>
                <th className="py-3.5 px-4">Acknowledgement No</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Documents</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="inline-block w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <div>Loading Completed Ledger Records & Google Drive documents...</div>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FolderArchive size={40} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No matching completed customer records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search terms or filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((c) => (
                  <tr key={c.customerId} className="hover:bg-slate-50/80 transition-colors group">
                    {/* Customer ID */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#032e60] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                          {c.customerId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyId(c.customerId)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                          title="Copy Customer ID"
                        >
                          {copiedId === c.customerId ? (
                            <Check size={13} className="text-emerald-600" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Customer Name */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-[#032e60] font-bold flex items-center justify-center text-xs border border-slate-200 shrink-0">
                          {c.customerName ? c.customerName.charAt(0).toUpperCase() : "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{c.customerName}</div>
                          {c.mobileNumber && (
                            <div className="text-[11px] text-slate-500 font-mono">{c.mobileNumber}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Service Name */}
                    <td className="py-3 px-4">
                      <span className="inline-block max-w-[200px] truncate bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-medium text-xs border border-slate-200" title={c.serviceName}>
                        {c.serviceName || "General Service"}
                      </span>
                    </td>

                    {/* Acknowledgement Number */}
                    <td className="py-3 px-4 font-mono">
                      {editingAckCustomerId === c.customerId ? (
                        <div className="flex items-center gap-1 min-w-[190px]" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Enter Ack No..."
                            value={inlineAckValue}
                            onChange={(e) => setInlineAckValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveInlineAck(c.customerId);
                              } else if (e.key === "Escape") {
                                cancelEditingAck();
                              }
                            }}
                            className="w-full px-2 py-1 text-xs bg-white border border-blue-500 rounded font-mono shadow-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={isSavingInlineAck}
                          />
                          <button
                            type="button"
                            onClick={() => saveInlineAck(c.customerId)}
                            disabled={isSavingInlineAck}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                            title="Save (Enter)"
                          >
                            {isSavingInlineAck ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingAck}
                            disabled={isSavingInlineAck}
                            className="p-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer shrink-0"
                            title="Cancel (Esc)"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          {c.acknowledgementNumber ? (
                            <button
                              type="button"
                              onClick={() => startEditingAck(c)}
                              className="font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Click to edit Acknowledgement No"
                            >
                              <span>{c.acknowledgementNumber}</span>
                              <Pencil size={11} className="text-emerald-600 opacity-60 group-hover:opacity-100" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditingAck(c)}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded border border-dashed border-blue-300 transition-colors cursor-pointer"
                              title="Click to write Acknowledgement No"
                            >
                              <Plus size={11} />
                              <span>Write Ack No</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          (c.status || "").toLowerCase() === "completed"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-blue-100 text-blue-800 border border-blue-300"
                        }`}
                      >
                        <CheckCircle2 size={12} className={(c.status || "").toLowerCase() === "completed" ? "text-emerald-600" : "text-blue-600"} />
                        <span>{c.status || "Completed"}</span>
                      </span>
                    </td>

                    {/* Total Documents Badge */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setViewCustomer(c)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-transform hover:scale-105 cursor-pointer ${
                          c.totalDocuments > 0
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                        title="Click to view documents"
                      >
                        <FolderArchive size={13} />
                        <span>{c.totalDocuments} {c.totalDocuments === 1 ? "File" : "Files"}</span>
                      </button>
                    </td>

                    {/* Actions: View / Upload / Edit / Delete */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 1. View */}
                        <button
                          type="button"
                          onClick={() => setViewCustomer(c)}
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View customer details and Google Drive documents"
                        >
                          <Eye size={16} />
                        </button>

                        {/* 2. Upload */}
                        <button
                          type="button"
                          onClick={() => openUploadModal(c)}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Upload new document to Google Drive"
                        >
                          <UploadCloud size={16} />
                        </button>

                        {/* 3. Edit */}
                        <button
                          type="button"
                          onClick={() => openEditModal(c)}
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                          title="Edit customer details"
                        >
                          <Pencil size={16} />
                        </button>

                        {/* 4. Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomerDocuments(c)}
                          disabled={c.totalDocuments === 0}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            c.totalDocuments > 0
                              ? "text-red-500 hover:bg-red-50 hover:text-red-700"
                              : "text-slate-300 cursor-not-allowed"
                          }`}
                          title={
                            c.totalDocuments > 0
                              ? "Delete customer documents from Google Drive (Preserves Ledger Record)"
                              : "No documents to delete"
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records per page</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-2">
              Page <span className="font-bold text-slate-900">{currentPage}</span> of{" "}
              <span className="font-bold text-slate-900">{totalPages}</span>
            </span>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: VIEW CUSTOMER DETAILS & DOCUMENTS
         ========================================================================= */}
      {viewCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#032e60] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-200">
                  <FolderArchive size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{viewCustomer.customerName}</h2>
                  <div className="flex items-center gap-2 text-xs text-blue-200 mt-0.5">
                    <span className="font-mono bg-blue-500/30 px-1.5 py-0.5 rounded font-semibold">
                      {viewCustomer.customerId}
                    </span>
                    <span>•</span>
                    <span>{viewCustomer.serviceName}</span>
                    {viewCustomer.acknowledgementNumber ? (
                      <>
                        <span>•</span>
                        <div className="inline-flex items-center gap-1.5 font-mono text-emerald-300 font-semibold bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded">
                          <span>Ack: {viewCustomer.acknowledgementNumber}</span>
                          <button
                            type="button"
                            onClick={() => openEditModal(viewCustomer)}
                            className="p-0.5 hover:text-white transition-colors cursor-pointer"
                            title="Edit Acknowledgement No"
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>•</span>
                        <button
                          type="button"
                          onClick={() => openEditModal(viewCustomer)}
                          className="inline-flex items-center gap-1 font-mono text-amber-300 hover:text-white font-semibold bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/40 px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                          title="Write Acknowledgement No"
                        >
                          <Plus size={11} />
                          <span>+ Add Ack No</span>
                        </button>
                      </>
                    )}
                    <span>•</span>
                    <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-semibold text-[10px]">
                      {viewCustomer.status || "Completed"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewCustomer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Google Drive Folder Banner */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <HardDrive size={18} className="text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold">Google Drive Folder:</span>{" "}
                    <span className="font-mono font-semibold">
                      AIRNET COMPUTERS / Customer Documents / {viewCustomer.customerId} - {viewCustomer.customerName}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewCustomer(null);
                    openUploadModal(viewCustomer);
                  }}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Plus size={14} />
                  <span>Upload More</span>
                </button>
              </div>

              {/* Document List */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center justify-between">
                  <span>Uploaded Documents ({viewCustomer.documents?.length || 0})</span>
                  <span className="text-xs font-normal text-slate-500">
                    Stored permanently in Google Drive
                  </span>
                </h3>

                {(!viewCustomer.documents || viewCustomer.documents.length === 0) ? (
                  <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    <FolderArchive size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">No documents uploaded yet</p>
                    <p className="text-xs text-slate-400 mt-1 mb-4">
                      Upload customer identity documents, certificates, or acknowledgement slips.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setViewCustomer(null);
                        openUploadModal(viewCustomer);
                      }}
                      className="px-4 py-2 bg-[#032e60] hover:bg-[#021f40] text-white rounded-xl font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <UploadCloud size={15} />
                      <span>Upload Document Now</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {viewCustomer.documents.map((doc) => (
                      <div
                        key={doc.driveFileId}
                        className="bg-white border border-slate-200 p-3 rounded-xl hover:border-blue-300 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                            {getFileIcon(doc.mimeType, doc.fileExtension)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs sm:text-sm text-slate-900 truncate" title={doc.fileName}>
                              {doc.fileName}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                                {doc.category || "General"}
                              </span>
                              <span>•</span>
                              <span>{formatFileSize(doc.fileSize)}</span>
                              <span>•</span>
                              <span>{formatDateTimeDMY(doc.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Preview Button */}
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Preview file"
                          >
                            <Eye size={16} />
                          </button>

                          {/* Download Button */}
                          <a
                            href={`/api/admin/documents/files/${encodeURIComponent(doc.driveFileId)}/download`}
                            download={doc.fileName}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Download file"
                          >
                            <Download size={16} />
                          </a>

                          {/* Delete File */}
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(doc)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete file from Google Drive"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewCustomer(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: UPLOAD DOCUMENT DIRECTLY TO GOOGLE DRIVE (Section 5)
         ========================================================================= */}
      {uploadCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#032e60] text-white p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <UploadCloud size={22} className="text-emerald-400" />
                <div>
                  <h2 className="text-base font-bold">Upload to Google Drive</h2>
                  <p className="text-xs text-blue-200">
                    Customer: {uploadCustomer.customerName} ({uploadCustomer.customerId})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadCustomer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Category & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Document Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Identity Proof">Identity Proof (Aadhaar / Voter / PAN)</option>
                    <option value="Address Proof">Address Proof (Ration Card / Utility)</option>
                    <option value="Photo">Passport Photo</option>
                    <option value="Acknowledgement Slip">Acknowledgement / Receipt Slip</option>
                    <option value="Certificate">Certificate / Caste / Income</option>
                    <option value="General">General Document</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Optional Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Front & Back scan"
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* File Dropzone Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Files from Computer
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50/80 rounded-2xl p-6 text-center cursor-pointer transition-all"
                >
                  <UploadCloud size={36} className="mx-auto text-blue-600 mb-2" />
                  <p className="text-sm font-bold text-[#032e60]">
                    Click or Drag & Drop files here
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports PDF, JPG, PNG, DOC, DOCX, XLS, XLSX (Max 30 MB per file)
                  </p>
                  <span className="inline-block mt-2 text-[11px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                    Multiple files supported
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Selected Files ({selectedFiles.length})</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-red-500 hover:text-red-700 text-[11px]"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={15} className="text-blue-600 shrink-0" />
                          <span className="font-semibold truncate text-slate-800" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingFile(idx)}
                          className="text-slate-400 hover:text-red-600 p-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress bar during upload */}
              {isUploading && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-blue-700">
                    <span>Uploading directly to Google Drive...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setUploadCustomer(null)}
                  disabled={isUploading}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || selectedFiles.length === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading to Drive...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      <span>Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""} to Drive</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DOCUMENT PREVIEW WINDOW (Section 6)
         ========================================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5 z-50">
          <div className="bg-[#0b1b2d] text-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Top Toolbar */}
            <div className="bg-[#032e60] px-4 py-3 flex items-center justify-between border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Eye size={18} className="text-blue-300 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate" title={previewDoc.fileName}>
                    {previewDoc.fileName}
                  </div>
                  <div className="text-[11px] text-blue-200 font-mono">
                    {formatFileSize(previewDoc.fileSize)} • {previewDoc.category}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/admin/documents/files/${encodeURIComponent(previewDoc.driveFileId)}/preview`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink size={14} />
                  <span className="hidden sm:inline">New Tab</span>
                </a>

                <a
                  href={`/api/admin/documents/files/${encodeURIComponent(previewDoc.driveFileId)}/download`}
                  download={previewDoc.fileName}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                  title="Download file"
                >
                  <Download size={14} />
                  <span className="hidden sm:inline">Download</span>
                </a>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Preview Canvas */}
            <div className="flex-1 bg-black/40 flex items-center justify-center p-2 overflow-hidden">
              {previewDoc.mimeType.includes("pdf") ? (
                <iframe
                  src={`/api/admin/documents/files/${encodeURIComponent(previewDoc.driveFileId)}/preview`}
                  title={previewDoc.fileName}
                  className="w-full h-full rounded-lg border-0 bg-white"
                />
              ) : previewDoc.mimeType.includes("image") ? (
                <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                  <img
                    src={`/api/admin/documents/files/${encodeURIComponent(previewDoc.driveFileId)}/preview`}
                    alt={previewDoc.fileName}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg border border-slate-700"
                  />
                </div>
              ) : (
                <div className="text-center p-8 bg-slate-800/80 rounded-2xl border border-slate-700 max-w-md">
                  <FileText size={48} className="mx-auto text-blue-400 mb-3" />
                  <h3 className="text-base font-bold text-white">{previewDoc.fileName}</h3>
                  <p className="text-xs text-slate-300 mt-1 mb-4">
                    In-browser preview is optimized for PDF and image documents. You can download this file directly from Google Drive.
                  </p>
                  <a
                    href={`/api/admin/documents/files/${encodeURIComponent(previewDoc.driveFileId)}/download`}
                    download={previewDoc.fileName}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors"
                  >
                    <Download size={15} />
                    <span>Download {previewDoc.fileName}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: EDIT CUSTOMER DETAILS (Section 8.B)
         ========================================================================= */}
      {editCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#032e60] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil size={18} className="text-amber-400" />
                <h2 className="text-base font-bold">Edit Customer Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditCustomer(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-3.5">
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl text-[11px] text-blue-800 flex items-center gap-2">
                <Info size={16} className="text-blue-600 shrink-0" />
                <span>Customer ID: <strong className="font-mono">{editCustomer.customerId}</strong> (Master key)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">Renames Google Drive folder automatically</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={editForm.serviceName}
                  onChange={(e) => setEditForm({ ...editForm, serviceName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Acknowledgement Number</label>
                <input
                  type="text"
                  placeholder="e.g. ACK-2026-9812"
                  value={editForm.acknowledgementNumber}
                  onChange={(e) => setEditForm({ ...editForm, acknowledgementNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Completed">Completed</option>
                  <option value="In Progress">In Progress</option>
                  <option value="New">New</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <span className="text-[10px] text-slate-400">Only "Completed" records appear on this page by default</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditCustomer(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  {isSavingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: GOOGLE DRIVE INTEGRATION SETTINGS (Section 2 & 4)
         ========================================================================= */}
      {showDriveSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#032e60] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-blue-300" />
                <h2 className="text-base font-bold">Google Drive Integration Settings</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDriveSettings(false)}
                className="text-white/70 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status Section */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Connection Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full ${
                      driveStatus?.connected
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {driveStatus?.connectionStatus || "Disconnected"}
                  </span>
                </div>
                {driveStatus?.connectedEmail && (
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-slate-500">Business Account:</span>
                    <span className="font-semibold text-slate-800">{driveStatus.connectedEmail}</span>
                  </div>
                )}
                {driveStatus?.rootFolderId && (
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-slate-500">AIRNET Root Folder:</span>
                    <span className="font-semibold text-blue-700">Verified on Drive</span>
                  </div>
                )}
                {driveStatus?.lastError && (
                  <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-800 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-rose-900 text-[11px]">
                      <AlertCircle size={13} className="text-rose-600 shrink-0" />
                      <span>Google Error Notice:</span>
                    </div>
                    <div className="text-[10px] leading-relaxed break-words">{driveStatus.lastError}</div>
                  </div>
                )}
              </div>

              {/* Folder Architecture Info */}
              <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xl text-[11px] text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <FolderArchive size={14} className="text-blue-600" />
                  <span>Google Drive Folder Hierarchy:</span>
                </div>
                <div className="font-mono pl-3 text-slate-600 space-y-0.5">
                  <div>📁 AIRNET COMPUTERS</div>
                  <div>&nbsp;&nbsp;└── 📁 Customer Documents</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 📁 AC001 - Customer Name</div>
                  <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 📁 AC002 - Customer Name</div>
                </div>
              </div>

              {/* Authorized Redirect URI Notice */}
              <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center justify-between">
                  <span>Google Cloud Authorized Redirect URI:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const redirectUrl = `${window.location.origin}/api/admin/google-drive/callback`;
                      navigator.clipboard.writeText(redirectUrl);
                      showSuccess("Copied!", "Redirect URI copied to clipboard. Paste this into Google Cloud Console.");
                    }}
                    className="text-blue-700 hover:text-blue-900 font-semibold underline text-[10px] cursor-pointer"
                  >
                    Copy Redirect URI
                  </button>
                </div>
                <code className="block bg-white p-2 rounded-lg border border-amber-200 font-mono text-[10px] text-slate-800 break-all select-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/admin/google-drive/callback` : "http://localhost:5000/api/admin/google-drive/callback"}
                </code>
                <div className="text-[10px] text-amber-800 leading-normal">
                  In <strong>Google Cloud Console &gt; Credentials &gt; OAuth 2.0 Client IDs</strong>, ensure this exact URL is added under <strong>Authorized redirect URIs</strong>.
                </div>
              </div>

              {/* Client Credentials Form */}
              <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-800">
                    Google Cloud OAuth Credentials
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Permanently Saved in DB
                  </span>
                </div>

                <div className="flex items-center gap-2 p-2 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-800 text-[11px]">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <span>Credentials remain stored permanently until explicitly deleted by admin. Disconnecting only clears the runtime session.</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                    Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 123456789-abcdefg.apps.googleusercontent.com"
                    value={driveCredentials.clientId}
                    onChange={(e) => setDriveCredentials({ ...driveCredentials, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[11px] font-bold text-slate-600">
                      Client Secret
                    </label>
                    <a
                      href="https://console.cloud.google.com/apis/credentials?project=438450701267"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:underline font-medium"
                    >
                      Find / Reset Secret in GCP ↗
                    </a>
                  </div>
                  <input
                    type="password"
                    placeholder="Enter or paste active Google Cloud Client Secret (e.g. GOCSPX-...)"
                    value={driveCredentials.clientSecret}
                    onChange={(e) => setDriveCredentials({ ...driveCredentials, clientSecret: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Copy the Client Secret directly from Google Cloud Console &gt; Credentials &gt; OAuth 2.0 Web Client.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <HardDrive size={14} />
                      <span>Authorize with Google</span>
                    </button>

                    {driveStatus?.hasClientId && (
                      <button
                        type="button"
                        onClick={handleDeleteCredentials}
                        className="px-2.5 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
                        title="Permanently delete credentials from database"
                      >
                        Delete Credentials
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCredentials}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                  >
                    {isSavingCredentials ? "Saving..." : "Save Credentials"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
