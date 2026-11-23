import { useState, useEffect } from "react";
import {
  FileText,
  Mail,
  Clock,
  Download,
  Send,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  AlertCircle,
  Check,
  ExternalLink,
  ShieldCheck,
  Phone,
  Settings,
  X,
  Eye,
  EyeOff,
  Zap,
  Globe,
  Copy,
  CheckCheck,
  LogOut,
  Key,
  Lock,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { formatDateDMY, formatDateTimeDMY } from "../../lib/dateUtils";

interface ReportSettings {
  id: string;
  adminEmail: string;
  recipientEmail?: string | null;
  autoEnabled: boolean;
  scheduledTime: string;
  timeZone: string;
  emailProvider?: "gmail_api" | "smtp";
  smtpHost?: string | null;
  smtpPort?: string | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpFromName?: string | null;
  lastRunDate: string | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  updatedAt: string;
}

interface SmtpInfo {
  configured: boolean;
  host: string | null;
  port: string;
  secure?: boolean;
  senderEmail: string | null;
  fromName?: string;
  adminEmail: string;
  recipientEmail?: string;
  isTestMailer?: boolean;
  provider?: string;
  warning: string | null;
}

interface GmailStatusInfo {
  configured: boolean;
  connected: boolean;
  connectedEmail: string | null;
  connectionStatus: string;
  tokenExpiry: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  clientId: string | null;
  emailProvider: string;
  lastError: string | null;
  recipientEmail: string;
  adminEmail: string;
  scheduledTime: string;
  autoEnabled: boolean;
}

interface NextScheduledInfo {
  nextRunISTDate: string;
  nextRunFormatted: string;
  isToday: boolean;
}

interface StatusBreakdownItem {
  status: string;
  currentTotal: number;
  todayActivity: number;
  description: string;
}

interface ImmediateAttentionItem {
  id: string | number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  issueType: "Overdue Task" | "New Unhandled Enquiry" | "Pending Udhar / Balance";
  details: string;
  urgency: "High" | "Medium";
  amountPending?: number;
}

interface DailyReportMetrics {
  reportDate: string;
  reportingPeriodLabel: string;
  generatedAtIST: string;
  timeZone: string;
  totalRequests: number;
  requestsReceivedToday: number;
  requestsAcceptedToday: number;
  requestsOnHoldToday: number;
  requestsCompletedToday: number;
  requestsPendingEnd: number;
  overdueRequestsCount: number;
  paymentsReceivedTodayCount: number;
  totalPaymentAmountToday: number;
  requestsWithOutstandingBalanceCount: number;
  totalOutstandingAmount: number;
  totalHistoricalBilled: number;
  totalHistoricalCollected: number;
  statusBreakdown: StatusBreakdownItem[];
  immediateAttention: ImmediateAttentionItem[];
}

interface ReportLogEntry {
  id: number;
  reportDate: string;
  recipient: string;
  senderEmail?: string | null;
  emailProvider?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  deliveryStatus: string;
  retryCount: number;
  errorMessage: string | null;
  pdfGenerated: boolean;
  previewUrl: string | null;
  generatedAt: string;
}

export default function DailyReports() {
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [settings, setSettings] = useState<ReportSettings | null>(null);
  const [smtp, setSmtp] = useState<SmtpInfo | null>(null);
  const [gmail, setGmail] = useState<GmailStatusInfo | null>(null);
  const [nextScheduled, setNextScheduled] = useState<NextScheduledInfo | null>(null);
  const [metrics, setMetrics] = useState<DailyReportMetrics | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ReportLogEntry[]>([]);
  
  // Selected date for viewing report (defaults to today in IST)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  });

  // Schedule settings form states
  const [formAdminEmail, setFormAdminEmail] = useState("airnetcomputersbk@gmail.com");
  const [formRecipientEmail, setFormRecipientEmail] = useState("rasoolahmed246@gmail.com");
  const [formAutoEnabled, setFormAutoEnabled] = useState(true);
  const [formScheduledTime, setFormScheduledTime] = useState("23:00");
  const [formEmailProvider, setFormEmailProvider] = useState<"gmail_api" | "smtp">("gmail_api");
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Gmail API OAuth Modal & Action states
  const DEFAULT_GMAIL_CLIENT_ID = "438450701267-huqvap7ji7qtg64ijgu2no0amca4n47g.apps.googleusercontent.com";
  const [showGmailModal, setShowGmailModal] = useState(false);
  const [gmailClientIdInput, setGmailClientIdInput] = useState(DEFAULT_GMAIL_CLIENT_ID);
  const [gmailClientSecretInput, setGmailClientSecretInput] = useState("");
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [savingGmailCreds, setSavingGmailCreds] = useState(false);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);
  const [isDisconnectingGmail, setIsDisconnectingGmail] = useState(false);
  const [isSendingGmailTest, setIsSendingGmailTest] = useState(false);
  const [gmailModalError, setGmailModalError] = useState<string | null>(null);
  const [gmailModalSuccess, setGmailModalSuccess] = useState<string | null>(null);
  const [copiedRedirectUri, setCopiedRedirectUri] = useState(false);

  // SMTP Settings Modal states (fallback)
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [showSmtpDetails, setShowSmtpDetails] = useState(false);
  const [smtpHostInput, setSmtpHostInput] = useState("smtp.gmail.com");
  const [smtpPortInput, setSmtpPortInput] = useState("587");
  const [smtpSecureInput, setSmtpSecureInput] = useState(false);
  const [smtpUserInput, setSmtpUserInput] = useState("airnetcomputersbk@gmail.com");
  const [smtpPassInput, setSmtpPassInput] = useState("");
  const [smtpFromNameInput, setSmtpFromNameInput] = useState("Airnet Computers");
  const [showPassword, setShowPassword] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [smtpModalError, setSmtpModalError] = useState<string | null>(null);
  const [smtpModalSuccess, setSmtpModalSuccess] = useState<string | null>(null);

  // Action feedback banner
  const [isSendingNow, setIsSendingNow] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error" | "info";
    message: string;
    previewUrl?: string | null;
  } | null>(null);

  const redirectUri = typeof window !== "undefined"
    ? (window.location.port === "5000"
        ? `${window.location.protocol}//${window.location.hostname}:5001/api/admin/gmail/callback`
        : `${window.location.origin}/api/admin/gmail/callback`)
    : "http://localhost:5001/api/admin/gmail/callback";

  // Check URL query parameters for OAuth callback result
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const connectedParam = urlParams.get("gmail_connected");
    const errorParam = urlParams.get("gmail_error");

    if (connectedParam === "true") {
      setActionFeedback({
        type: "success",
        message: "Official Gmail account (airnetcomputersbk@gmail.com) connected and authorized successfully with Google OAuth 2.0! Automated dispatches are now active.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (errorParam) {
      setActionFeedback({
        type: "error",
        message: `Google OAuth Authorization Failed: ${decodeURIComponent(errorParam)}`,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Fetch settings & status
  const fetchSettingsAndStatus = async () => {
    try {
      const res = await fetch("/api/admin/reports-daily/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setSmtp(data.smtp);
        setGmail(data.gmail);
        setNextScheduled(data.nextScheduled);
        
        setFormAdminEmail(data.settings.adminEmail || "airnetcomputersbk@gmail.com");
        setFormRecipientEmail(data.settings.recipientEmail || "rasoolahmed246@gmail.com");
        setFormAutoEnabled(data.settings.autoEnabled ?? true);
        setFormScheduledTime(data.settings.scheduledTime || "23:00");
        setFormEmailProvider((data.settings.emailProvider as any) || "gmail_api");

        if (data.smtp?.host) setSmtpHostInput(data.smtp.host);
        if (data.smtp?.port) setSmtpPortInput(data.smtp.port);
        if (data.smtp?.senderEmail) setSmtpUserInput(data.smtp.senderEmail);
        if (data.smtp?.fromName) setSmtpFromNameInput(data.smtp.fromName);

        if (data.settings?.gmailClientId) {
          setGmailClientIdInput(data.settings.gmailClientId);
        } else {
          setGmailClientIdInput(DEFAULT_GMAIL_CLIENT_ID);
        }
      }
    } catch (err) {
      console.error("Error fetching report settings:", err);
    }
  };

  // Fetch metrics for selected date
  const fetchReportMetrics = async (dateStr: string) => {
    setMetricsLoading(true);
    try {
      const res = await fetch(`/api/admin/reports-daily/data?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Error fetching report metrics:", err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Fetch report logs
  const fetchReportHistory = async () => {
    try {
      const res = await fetch("/api/admin/reports-daily/history");
      if (res.ok) {
        const data = await res.json();
        setHistoryLogs(data);
      }
    } catch (err) {
      console.error("Error fetching report history:", err);
    }
  };

  useEffect(() => {
    Promise.all([fetchSettingsAndStatus(), fetchReportMetrics(selectedDate), fetchReportHistory()]).finally(() => {
      setLoading(false);
    });
  }, []);

  // Escape key listener for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSmtpModal) setShowSmtpModal(false);
        if (showGmailModal) setShowGmailModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSmtpModal, showGmailModal]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    fetchReportMetrics(newDate);
  };

  // Copy redirect URI to clipboard
  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirectUri(true);
    setTimeout(() => setCopiedRedirectUri(false), 2000);
  };

  // Connect or Reconnect Gmail Account via Google OAuth 2.0
  const handleConnectGmail = async () => {
    setIsConnectingGmail(true);
    setActionFeedback(null);
    try {
      const originParam = typeof window !== "undefined" ? window.location.origin : "http://localhost:5000";
      const res = await fetch(`/api/admin/gmail/auth-url?origin=${encodeURIComponent(originParam)}`);
      const data = await res.json();

      if (!res.ok || !data.url) {
        setShowGmailModal(true);
        setGmailModalError(data.error || "Please configure your Google Cloud OAuth Client ID & Secret first.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Failed to generate Google authorization link",
      });
    } finally {
      setIsConnectingGmail(false);
    }
  };

  // Disconnect Gmail Account
  const handleDisconnectGmail = async () => {
    if (!confirm("Are you sure you want to disconnect this Gmail account? Automated daily dispatches will stop until you reconnect.")) {
      return;
    }
    setIsDisconnectingGmail(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/admin/gmail/disconnect", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setGmail(data.status);
        setActionFeedback({
          type: "info",
          message: "Official Gmail account successfully disconnected and revoked.",
        });
        await fetchSettingsAndStatus();
      } else {
        setActionFeedback({
          type: "error",
          message: data.error || "Failed to disconnect Gmail account",
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Network error while disconnecting Gmail account",
      });
    } finally {
      setIsDisconnectingGmail(false);
    }
  };

  // Save Google Cloud OAuth Credentials (Client ID & Secret)
  const handleSaveGmailCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGmailCreds(true);
    setGmailModalError(null);
    setGmailModalSuccess(null);

    try {
      const res = await fetch("/api/admin/gmail/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: gmailClientIdInput.trim(),
          clientSecret: gmailClientSecretInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGmailModalSuccess("OAuth credentials encrypted and saved securely! Connecting to Google...");
        setGmail(data.status);
        setTimeout(async () => {
          setShowGmailModal(false);
          setGmailModalSuccess(null);
          await handleConnectGmail();
        }, 1200);
      } else {
        setGmailModalError(data.error || "Failed to save OAuth credentials");
      }
    } catch (err: any) {
      setGmailModalError(err.message || "Network error while saving credentials");
    } finally {
      setSavingGmailCreds(false);
    }
  };

  // Explicitly Delete Google OAuth Credentials from DB (Admin Action Only)
  const handleDeleteGmailCreds = async () => {
    if (!confirm("Are you sure you want to permanently delete Google Cloud OAuth credentials from the database? This cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch("/api/admin/gmail/credentials", { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        setGmailClientIdInput("");
        setGmailClientSecretInput("");
        setShowGmailModal(false);
        setActionFeedback({
          type: "info",
          message: "Google OAuth credentials permanently deleted by admin.",
        });
        await fetchSettingsAndStatus();
      } else {
        setGmailModalError(data.error || "Failed to delete OAuth credentials");
      }
    } catch (err: any) {
      setGmailModalError(err.message || "Failed to delete credentials");
    }
  };

  // Send Live Test Email via Gmail API
  const handleSendGmailTestEmail = async () => {
    setIsSendingGmailTest(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/admin/gmail/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: formRecipientEmail,
          adminEmail: formAdminEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback({
          type: "success",
          message: `${data.message} • Confirmed Gmail Message ID: ${data.messageId || "Accepted by Gmail API"}`,
          previewUrl: data.previewUrl,
        });
      } else {
        setActionFeedback({
          type: "error",
          message: data.message || "Failed to send test email via Gmail API",
        });
      }
      await fetchSettingsAndStatus();
      await fetchReportHistory();
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Network error while sending test email via Gmail API",
      });
    } finally {
      setIsSendingGmailTest(false);
    }
  };

  // Save Schedule Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/admin/reports-daily/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: formAdminEmail,
          recipientEmail: formRecipientEmail,
          autoEnabled: formAutoEnabled,
          scheduledTime: formScheduledTime,
          emailProvider: formEmailProvider,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        setNextScheduled(data.nextScheduled);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setActionFeedback({ type: "error", message: data.error || "Failed to save settings" });
      }
    } catch (err: any) {
      setActionFeedback({ type: "error", message: err.message || "Network error while saving settings" });
    } finally {
      setSavingSettings(false);
    }
  };

  // Save Custom SMTP Settings (Fallback)
  const handleSaveSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSmtp(true);
    setSmtpModalError(null);
    setSmtpModalSuccess(null);

    // Auto-correct if user accidentally typed an email address into host field
    let cleanHost = smtpHostInput.trim();
    if (cleanHost.includes("@")) {
      if (cleanHost.toLowerCase().includes("gmail")) {
        cleanHost = "smtp.gmail.com";
        setSmtpHostInput("smtp.gmail.com");
      }
    }

    try {
      const res = await fetch("/api/admin/reports-daily/smtp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: cleanHost,
          port: smtpPortInput,
          secure: smtpSecureInput,
          user: smtpUserInput,
          pass: smtpPassInput,
          fromName: smtpFromNameInput,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSmtpModalSuccess(data.message || "SMTP verified & connected successfully!");
        await fetchSettingsAndStatus();
        setTimeout(() => {
          setShowSmtpModal(false);
          setSmtpModalSuccess(null);
        }, 1500);
      } else {
        setSmtpModalError(data.message || "Could not connect to SMTP server with these credentials.");
      }
    } catch (err: any) {
      setSmtpModalError(err.message || "Network error while validating SMTP server");
    } finally {
      setSavingSmtp(false);
    }
  };

  // Quick Preset Handlers for SMTP
  const applyGmailPreset = () => {
    setSmtpHostInput("smtp.gmail.com");
    setSmtpPortInput("587");
    setSmtpSecureInput(false);
    setSmtpUserInput("airnetcomputersbk@gmail.com");
    setSmtpFromNameInput("Airnet Computers");
    setSmtpPassInput("");
    setSmtpModalError(null);
  };

  const applyEtherealPreset = () => {
    setSmtpHostInput("smtp.ethereal.email");
    setSmtpPortInput("587");
    setSmtpSecureInput(false);
    setSmtpUserInput("chk7o6ewtyj7gctg@ethereal.email");
    setSmtpPassInput("zCBghPy8cnYFNaGzZm");
    setSmtpFromNameInput("Airnet Computers");
    setSmtpModalError(null);
  };

  // Generate and Send Report Now
  const handleSendNow = async () => {
    const sender = gmail?.connectedEmail || formAdminEmail || "airnetcomputersbk@gmail.com";
    const recipient = formRecipientEmail || "rasoolahmed246@gmail.com";

    if (!confirm(`Generate latest pending-task report for ${selectedDate} and dispatch immediately from ${sender} to ${recipient}?`)) {
      return;
    }
    setIsSendingNow(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/admin/reports-daily/send-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          recipient,
          adminEmail: sender,
        }),
      });

      const data = await res.json();
      if (data.deliveryStatus === "Accepted by Gmail API" || data.deliveryStatus === "Success" || data.deliveryStatus === "Manual Sent") {
        setActionFeedback({
          type: "success",
          message: `Daily executive report for ${selectedDate} generated and accepted for delivery! Sender: ${data.adminEmail || sender} → Recipient: ${data.recipient || recipient}`,
          previewUrl: data.previewUrl,
        });
      } else if (data.deliveryStatus === "Config Missing") {
        setActionFeedback({
          type: "info",
          message: "Report and PDF generated, but Gmail API authorization is missing. Please click 'Connect Gmail Account' below.",
        });
      } else {
        setActionFeedback({
          type: "error",
          message: `Report generated, but email dispatch failed: ${data.errorMessage || "Unknown error"}`,
        });
      }
      await fetchSettingsAndStatus();
      await fetchReportHistory();
    } catch (err: any) {
      setActionFeedback({ type: "error", message: err.message || "Failed to trigger report dispatch" });
    } finally {
      setIsSendingNow(false);
    }
  };

  // Send Test Email (Fallback SMTP)
  const handleSendTestEmail = async () => {
    setIsSendingTest(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/admin/reports-daily/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: formRecipientEmail,
          adminEmail: formAdminEmail,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionFeedback({
          type: "success",
          message: data.message,
          previewUrl: data.previewUrl,
        });
      } else {
        setActionFeedback({ type: "error", message: data.message });
      }
    } catch (err: any) {
      setActionFeedback({ type: "error", message: err.message || "Failed to send test email" });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = (dateStr: string) => {
    window.open(`/api/admin/reports-daily/pdf?date=${dateStr}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="font-medium text-gray-700">Loading Reminders & Daily Reports System...</p>
      </div>
    );
  }

  const isGmailActive = (settings?.emailProvider ?? "gmail_api") === "gmail_api";

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-[#032e60] via-[#0b407a] to-[#1e5899] text-white p-6 rounded-2xl shadow-sm border border-[#1e4b75] relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2 bg-white/10 rounded-xl backdrop-blur-md">
                <FileText className="w-6 h-6 text-white" />
              </span>
              <h1 className="text-2xl font-black tracking-tight">Reminders & Daily Reports</h1>
              <span className="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2.5 py-0.5 rounded-full font-semibold">
                Asia/Kolkata (IST)
              </span>
            </div>
            <p className="text-blue-100 text-sm max-w-2xl leading-relaxed">
              Automated executive summary engine for AIRNET COMPUTERS. Generates high-fidelity A4 vector PDF reports,
              monitors pending citizen applications, tracks daily collections & Udhar, and dispatches automated daily email reports directly via Google Gmail API.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleDownloadPDF(selectedDate)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#032e60] hover:bg-blue-50 rounded-xl font-bold text-sm shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Download className="w-4 h-4 text-blue-700" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={handleSendNow}
              disabled={isSendingNow}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
            >
              {isSendingNow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSendingNow ? "Generating & Sending..." : "Send Report Now"}</span>
            </button>
          </div>
        </div>

        {/* Sub-bar with Date picker & Next scheduled indicator */}
        <div className="mt-6 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs text-blue-100">
          <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10">
            <Calendar className="w-4 h-4 text-blue-300" />
            <span className="font-semibold text-white">Report Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-white border-0 font-medium cursor-pointer focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span>Auto Run:</span>
              <span className="font-bold text-white">
                {settings?.autoEnabled
                  ? nextScheduled?.nextRunFormatted || "Scheduled (23:00 IST / 11:00 PM)"
                  : "Automatic Schedule Paused"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-300" />
              <span>Sender:</span>
              <span className="font-bold text-white">{gmail?.connectedEmail || settings?.adminEmail || "airnetcomputersbk@gmail.com"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-300" />
              <span>Deliver To:</span>
              <span className="font-bold text-yellow-300">{settings?.recipientEmail || "rasoolahmed246@gmail.com"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : actionFeedback.type === "error"
              ? "bg-red-50 border-red-200 text-red-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          {actionFeedback.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {actionFeedback.type === "error" && <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
          {actionFeedback.type === "info" && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
          <div className="flex-1 text-sm font-medium">
            <span>{actionFeedback.message}</span>
            {actionFeedback.previewUrl && (
              <a
                href={actionFeedback.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-3 inline-flex items-center gap-1 font-bold underline text-blue-700 hover:text-blue-900"
              >
                <span>View Dispatched Email ↗</span>
              </a>
            )}
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs opacity-60 hover:opacity-100 font-bold px-2 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. PRIMARY GMAIL API (OAUTH 2.0) INTEGRATION CARD               */}
      {/* ============================================================== */}
      <div className="bg-white border-2 border-blue-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/60 to-transparent pointer-events-none rounded-tr-2xl" />

        <div className="relative z-10 flex flex-col gap-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#ea4335] via-[#4285f4] to-[#34a853] p-0.5 shadow-sm shrink-0">
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center">
                  <Mail className="w-6 h-6 text-[#ea4335]" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-black text-gray-900">Official Gmail API Integration</h2>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Google OAuth 2.0
                  </span>
                  {gmail?.connected ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Connected & Authorized
                    </span>
                  ) : gmail?.connectionStatus === "Authorization Revoked / Expired" ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                      Authorization Revoked / Expired
                    </span>
                  ) : !gmail?.configured ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Google Cloud Setup Needed
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Disconnected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Sends automated daily executive reports directly from your official shop account without third-party email services or stored passwords.
                </p>
              </div>
            </div>

            {/* Quick OAuth App Config Trigger */}
            <button
              onClick={() => setShowGmailModal(true)}
              className="self-start sm:self-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-gray-600" />
              <span>{gmail?.configured ? "Edit OAuth Credentials" : "Configure OAuth App"}</span>
            </button>
          </div>

          {/* Details & Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Sender Account */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                Official Sender Account
              </span>
              <div className="font-mono text-xs font-bold text-gray-900 mt-1 flex items-center gap-1.5 truncate">
                <span className="truncate">{gmail?.connectedEmail || "airnetcomputersbk@gmail.com"}</span>
                {gmail?.connected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block">
                {gmail?.connected ? "Recipient sees this exact sender" : "Awaiting one-time authorization"}
              </span>
            </div>

            {/* Recipient */}
            <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                Destination Recipient
              </span>
              <div className="font-mono text-xs font-bold text-blue-950 mt-1 truncate">
                {settings?.recipientEmail || "rasoolahmed246@gmail.com"}
              </div>
              <span className="text-[11px] text-blue-700/80 mt-1 block font-medium">
                Rasool Ahmed (Daily Audit)
              </span>
            </div>

            {/* Daily Schedule */}
            <div className="p-3.5 bg-indigo-50/50 border border-indigo-200/70 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 block">
                Automated Schedule
              </span>
              <div className="text-xs font-black text-indigo-950 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Every Day at 11:00 PM IST</span>
              </div>
              <span className="text-[11px] text-indigo-700/80 mt-1 block">
                Server worker runs 24/7 (browser closed)
              </span>
            </div>

            {/* Security Mode */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Enterprise Token Security
              </span>
              <div className="text-xs font-bold text-emerald-950 mt-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>AES-256-GCM Encrypted</span>
              </div>
              <span className="text-[11px] text-emerald-800/80 mt-1 block">
                Minimal scope (gmail.send) • No passwords
              </span>
            </div>
          </div>

          {/* Last Error Notice (if any) */}
          {gmail?.lastError && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">Authorization Status Notice:</span>
                <p className="mt-0.5">{gmail.lastError}</p>
                <p className="text-[11px] text-amber-800 mt-1 font-semibold">
                  Click "Reconnect Gmail Account" below to restore automatic dispatches.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {!gmail?.connected ? (
                !gmail?.configured ? (
                  <button
                    type="button"
                    onClick={() => {
                      setGmailModalError(null);
                      setShowGmailModal(true);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.01]"
                  >
                    <Key className="w-4 h-4" />
                    <span>Configure Google Cloud OAuth (Client ID & Secret)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGmail}
                    disabled={isConnectingGmail}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer hover:scale-[1.01]"
                  >
                    {isConnectingGmail ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Globe className="w-4 h-4" />
                    )}
                    <span>Authorize Official Gmail Account</span>
                  </button>
                )
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleConnectGmail}
                    disabled={isConnectingGmail}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-800 rounded-xl font-bold text-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isConnectingGmail ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Reconnect Gmail Account</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendGmailTestEmail}
                    disabled={isSendingGmailTest}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isSendingGmailTest ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Mail className="w-3.5 h-3.5" />
                    )}
                    <span>Send Test Email (via Gmail API)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    disabled={isDisconnectingGmail}
                    className="px-3.5 py-2 border border-red-200 hover:bg-red-50 text-red-700 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isDisconnectingGmail ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <LogOut className="w-3.5 h-3.5 text-red-500" />
                    )}
                    <span>Disconnect Gmail Account</span>
                  </button>
                </>
              )}
            </div>

            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Offline Token Active: Single one-time authorization, no daily login required</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. FALLBACK SMTP SERVICE ACCORDION (SECONDARY)                 */}
      {/* ============================================================== */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-slate-100 text-slate-700 rounded-xl">
              <Settings className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-sm">Alternative Outbound SMTP Delivery (Fallback)</h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isGmailActive ? "bg-gray-100 text-gray-600" : "bg-emerald-100 text-emerald-800"}`}>
                  {isGmailActive ? "Standby Mode" : "Primary Provider"}
                </span>
              </div>
              <p className="text-gray-500 text-xs">
                Host: <span className="font-mono">{smtp?.host || "smtp.gmail.com"}</span> • Port: {smtp?.port || "587"} • Sender: {smtp?.senderEmail || "airnetcomputersbk@gmail.com"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSmtpModal(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Configure SMTP
            </button>
            <button
              onClick={() => setShowSmtpDetails(!showSmtpDetails)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
            >
              {showSmtpDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showSmtpDetails && (
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-3">
            <div>
              Custom SMTP serves as an alternative delivery method if you prefer using a Google App Password or a standard SMTP server.
            </div>
            <button
              onClick={handleSendTestEmail}
              disabled={isSendingTest}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {isSendingTest ? "Sending Test..." : "Send SMTP Test Email"}
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Settings & KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Admin Settings & Controls */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#032e60]" />
                <h2 className="font-bold text-gray-900 text-base">Report Settings & Schedule</h2>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                IST Timezone
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="mt-5 space-y-4">
              {/* Email Provider Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Email Dispatch Provider
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormEmailProvider("gmail_api")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formEmailProvider === "gmail_api"
                        ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                    }`}
                  >
                    <div className="text-xs">Official Gmail API</div>
                    <div className="text-[10px] text-blue-600 font-normal">OAuth 2.0 (Recommended)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormEmailProvider("smtp")}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      formEmailProvider === "smtp"
                        ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 font-medium"
                    }`}
                  >
                    <div className="text-xs">Custom SMTP</div>
                    <div className="text-[10px] text-gray-500 font-normal">App Passwords</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Admin Email (Official Shop Account)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={formAdminEmail}
                    onChange={(e) => setFormAdminEmail(e.target.value)}
                    placeholder="airnetcomputersbk@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Official sender email address.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                  <span>Destination Recipient Email</span>
                  <span className="text-[10px] text-blue-600 font-semibold normal-case">Receives all daily summaries</span>
                </label>
                <div className="relative">
                  <Send className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={formRecipientEmail}
                    onChange={(e) => setFormRecipientEmail(e.target.value)}
                    placeholder="rasoolahmed246@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-blue-300 bg-blue-50/20 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900 font-mono"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">All audit summaries, pending tasks & PDF reports are delivered to this mailbox.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">
                  Scheduled Delivery Time (IST)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="time"
                    required
                    value={formScheduledTime}
                    onChange={(e) => setFormScheduledTime(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">Default: 23:00 (11:00 PM IST) daily.</p>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={formAutoEnabled}
                    onChange={(e) => setFormAutoEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-sm text-gray-900 block">Automatic Daily Reporting</span>
                    <span className="text-xs text-gray-500">
                      Runs server-side background worker independently of browser.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="w-full py-2.5 px-4 bg-[#032e60] hover:bg-[#043c7d] text-white rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4 text-green-300" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{saveSuccess ? "Settings Saved!" : savingSettings ? "Saving..." : "Save Settings"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Schedule Status Box */}
          <div className="mt-6 pt-4 border-t border-gray-100 bg-slate-50 p-4 rounded-xl text-xs space-y-2 text-gray-600">
            <div className="flex justify-between items-center">
              <span>Delivery Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  settings?.lastRunStatus === "Accepted by Gmail API" || settings?.lastRunStatus === "Success" || settings?.lastRunStatus === "Manual Sent"
                    ? "bg-green-100 text-green-800"
                    : settings?.lastRunStatus === "Config Missing"
                    ? "bg-amber-100 text-amber-800"
                    : settings?.lastRunStatus === "Failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {settings?.lastRunStatus || "Ready to Send"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>Last Reported Date:</span>
              <span className="font-semibold text-gray-900">{settings?.lastRunDate ? formatDateDMY(settings.lastRunDate) : "Today"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Next Run (IST):</span>
              <span className="font-semibold text-blue-700">
                {settings?.autoEnabled ? nextScheduled?.nextRunFormatted : "Disabled"}
              </span>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={isGmailActive ? handleSendGmailTestEmail : handleSendTestEmail}
                disabled={isSendingTest || isSendingGmailTest}
                className="flex-1 py-1.5 px-2 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg font-semibold text-gray-700 text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                <span>Test Email</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadPDF(selectedDate)}
                className="flex-1 py-1.5 px-2 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg font-semibold text-gray-700 text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-gray-500" />
                <span>Get PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Executive Summary Cards (6 KPIs) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-base">Executive Metrics Summary</h2>
                <p className="text-xs text-gray-500">
                  Calculated for: <span className="font-semibold text-[#032e60]">{formatDateDMY(selectedDate)} (12:00 AM – 11:59 PM IST)</span>
                </p>
              </div>
              <button
                onClick={() => fetchReportMetrics(selectedDate)}
                className="p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition-colors cursor-pointer"
                title="Refresh metrics"
              >
                <RefreshCw className={`w-4 h-4 ${metricsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* 6 Executive Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {/* Total Requests */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Requests</span>
                <div className="text-2xl font-black text-slate-800 mt-1">{metrics?.totalRequests ?? 0}</div>
                <span className="text-[11px] text-slate-500 mt-1 block">All registered records</span>
              </div>

              {/* Received Today */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider block">Received Today</span>
                <div className="text-2xl font-black text-blue-900 mt-1">{metrics?.requestsReceivedToday ?? 0}</div>
                <span className="text-[11px] text-blue-600 font-semibold mt-1 block">New citizen enquiries</span>
              </div>

              {/* Completed Today */}
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Completed Today</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{metrics?.requestsCompletedToday ?? 0}</div>
                <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Delivered on report date</span>
              </div>

              {/* Pending End */}
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Requests</span>
                <div className="text-2xl font-black text-amber-900 mt-1">{metrics?.requestsPendingEnd ?? 0}</div>
                <span className="text-[11px] text-amber-700 font-semibold mt-1 block">Awaiting completion</span>
              </div>

              {/* Overdue */}
              <div className={`p-4 rounded-xl border ${
                (metrics?.overdueRequestsCount || 0) > 0
                  ? "bg-red-50 border-red-300 text-red-900"
                  : "bg-gray-50 border-gray-200 text-gray-700"
              }`}>
                <span className="text-[11px] font-bold uppercase tracking-wider block">Overdue Tasks</span>
                <div className="text-2xl font-black mt-1">{metrics?.overdueRequestsCount ?? 0}</div>
                <span className="text-[11px] font-semibold mt-1 block">Exceeded target deadline</span>
              </div>

              {/* Today's Collections */}
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl">
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Collected Today</span>
                <div className="text-2xl font-black text-indigo-900 mt-1">
                  ₹{(metrics?.totalPaymentAmountToday ?? 0).toLocaleString("en-IN")}
                </div>
                <span className="text-[11px] text-indigo-600 font-semibold mt-1 block">
                  {metrics?.paymentsReceivedTodayCount ?? 0} payments received
                </span>
              </div>
            </div>

            {/* Financial Overview Banner */}
            <div className="mt-5 p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block">Total Outstanding Udhar / Balance:</span>
                <span className="text-xl font-black text-orange-400">
                  ₹{(metrics?.totalOutstandingAmount ?? 0).toLocaleString("en-IN")}
                </span>
                <span className="text-xs text-slate-300 ml-2">
                  across {metrics?.requestsWithOutstandingBalanceCount ?? 0} requests
                </span>
              </div>
              <div className="text-right text-xs text-slate-300 space-y-1">
                <div>Total Billed: <strong className="text-white">₹{(metrics?.totalHistoricalBilled ?? 0).toLocaleString("en-IN")}</strong></div>
                <div>Total Collected: <strong className="text-white">₹{(metrics?.totalHistoricalCollected ?? 0).toLocaleString("en-IN")}</strong></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Request Status Breakdown Table */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-900 text-base">Request Status Breakdown</h2>
            <span className="text-xs text-gray-500 font-normal">
              (Separates current cumulative totals from today's status transitions)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                <th className="py-3 px-4">Request Status</th>
                <th className="py-3 px-4 text-right">Current Total</th>
                <th className="py-3 px-4 text-right">Today's Activity</th>
                <th className="py-3 px-4">Description & Operational Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {metrics?.statusBreakdown.map((row) => (
                <tr key={row.status} className="hover:bg-blue-50/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        row.status === "New"
                          ? "bg-blue-500"
                          : row.status === "In Progress"
                          ? "bg-indigo-500"
                          : row.status === "On Hold"
                          ? "bg-amber-500"
                          : row.status === "Accepted"
                          ? "bg-emerald-500"
                          : row.status === "Rejected"
                          ? "bg-red-500"
                          : "bg-gray-500"
                      }`}
                    />
                    <span>{row.status}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-black text-gray-800">{row.currentTotal}</td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        row.todayActivity > 0 ? "bg-blue-100 text-blue-800" : "text-gray-400"
                      }`}
                    >
                      {row.todayActivity > 0 ? `+${row.todayActivity}` : "0"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Immediate Attention Required Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-gray-900 text-base">Immediate Attention Required</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {metrics?.immediateAttention.length || 0} Priority Items
          </span>
        </div>

        {metrics?.immediateAttention && metrics.immediateAttention.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Service</th>
                  <th className="py-3 px-4">Issue Type</th>
                  <th className="py-3 px-4">Details & Unpaid Udhar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {metrics.immediateAttention.map((item, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      <div>{item.customerName}</div>
                      <div className="text-[11px] font-mono text-gray-500">{item.customerId}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-blue-700 font-medium">
                        <Phone className="w-3.5 h-3.5" />
                        <a href={`tel:${item.mobileNumber}`} className="hover:underline">
                          {item.mobileNumber}
                        </a>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-800">{item.serviceName}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          item.issueType === "Overdue Task"
                            ? "bg-red-100 text-red-800"
                            : item.issueType === "Pending Udhar / Balance"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {item.issueType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600">
                      <div>{item.details}</div>
                      {item.amountPending ? (
                        <div className="text-orange-700 font-bold mt-0.5">
                          Pending: ₹{item.amountPending.toLocaleString("en-IN")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="font-semibold text-gray-600">No immediate issues requiring attention!</p>
            <p className="text-xs text-gray-400 mt-1">All applications are up to date and pending balances handled.</p>
          </div>
        )}
      </div>

      {/* Scheduled Report Logs & History */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-600" />
            <h2 className="font-bold text-gray-900 text-base">Report Generation & Delivery History</h2>
          </div>
          <button
            onClick={fetchReportHistory}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Logs</span>
          </button>
        </div>

        {historyLogs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                  <th className="py-3 px-4">Reporting Date</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Generated (IST)</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4 text-center">Retries</th>
                  <th className="py-3 px-4 text-right">Dispatched Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {historyLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-bold text-gray-900">{formatDateDMY(log.reportDate)}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        log.emailProvider === "gmail_api"
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}>
                        {log.emailProvider === "gmail_api" ? "Gmail API" : "SMTP"}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-500 font-medium">
                      {formatDateTimeDMY(log.generatedAt)}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-gray-600">{log.recipient}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold w-fit ${
                            log.deliveryStatus === "Accepted by Gmail API" || log.deliveryStatus === "Success" || log.deliveryStatus === "Manual Sent"
                              ? "bg-green-100 text-green-800"
                              : log.deliveryStatus === "Config Missing"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {log.deliveryStatus}
                        </span>
                        {log.gmailMessageId && (
                          <span className="font-mono text-[10px] text-gray-500 truncate max-w-[200px]" title={`Gmail ID: ${log.gmailMessageId}`}>
                            ID: {log.gmailMessageId}
                          </span>
                        )}
                        {log.errorMessage && (
                          <span className="block text-[10px] text-red-600 max-w-xs truncate" title={log.errorMessage}>
                            {log.errorMessage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">{log.retryCount}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {log.previewUrl && (
                          <a
                            href={log.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition-colors"
                            title="Open delivered email in web viewer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View Email</span>
                          </a>
                        )}
                        <button
                          onClick={() => handleDownloadPDF(log.reportDate)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-400">
            <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-600">No report delivery records yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "Send Report Now" above or wait for the 11:00 PM IST daily scheduled dispatch.
            </p>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 3. GOOGLE CLOUD OAUTH APP CREDENTIALS MODAL                    */}
      {/* ============================================================== */}
      {showGmailModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowGmailModal(false); }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-[#032e60] to-[#0d4a8d] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Google Cloud OAuth 2.0 Setup</h3>
                  <p className="text-xs text-blue-200">Direct integration for airnetcomputersbk@gmail.com</p>
                </div>
              </div>
              <button
                onClick={() => setShowGmailModal(false)}
                title="Cancel / Close (Esc)"
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGmailCreds} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                {/* Step-by-step Setup Guide */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <span>Quick Google Cloud Console Instructions</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-600">
                    <li>
                      Go to{" "}
                      <a
                        href="https://console.cloud.google.com/apis/credentials"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        Google Cloud Console Credentials ↗
                      </a>
                    </li>
                    <li>
                      Ensure the <strong>Gmail API</strong> is enabled under <em>APIs & Services &gt; Library</em>.
                    </li>
                    <li>
                      Under <em>Credentials &gt; Create Credentials</em>, choose <strong>OAuth client ID</strong> with Application type <strong>Web application</strong>.
                    </li>
                    <li>
                      Add this exact <strong>Authorized redirect URI</strong>:
                    </li>
                  </ol>

                  {/* Copyable Redirect URI Box */}
                  <div className="mt-2 flex items-center gap-2 bg-white p-2 border border-slate-300 rounded-lg">
                    <span className="font-mono text-[11px] text-gray-800 flex-1 truncate select-all">
                      {redirectUri}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRedirectUri}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiedRedirectUri ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedRedirectUri ? "Copied!" : "Copy URI"}</span>
                    </button>
                  </div>
                </div>

                {/* Instant alternative callout */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-amber-900 block">Need immediate sending without Google Cloud?</span>
                    <span className="text-amber-700 text-[11px]">Use a Google App Password from your Google Account in 30 seconds.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowGmailModal(false);
                      applyGmailPreset();
                      setShowSmtpModal(true);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shrink-0 cursor-pointer"
                  >
                    Use App Password
                  </button>
                </div>

                {/* Permanent Storage Notice */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Permanently Stored in Database:</span>
                    <span className="text-[11px] text-emerald-700">Client ID and Client Secret stay permanently saved in the database until you explicitly remove them. Disconnecting an account only revokes the temporary OAuth session.</span>
                  </div>
                </div>

                {gmailModalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>{gmailModalError}</div>
                  </div>
                )}

                {gmailModalSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>{gmailModalSuccess}</div>
                  </div>
                )}

                {/* Client ID Input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Google OAuth Client ID
                  </label>
                  <input
                    type="text"
                    required
                    value={gmailClientIdInput}
                    onChange={(e) => setGmailClientIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Found in your Google Cloud OAuth Client page.</p>
                </div>

                {/* Client Secret Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      Google OAuth Client Secret
                    </label>
                    <a
                      href="https://console.cloud.google.com/apis/credentials?project=438450701267"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline font-medium"
                    >
                      Find / Reset Secret in GCP ↗
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showClientSecret ? "text" : "password"}
                      required
                      value={gmailClientSecretInput}
                      onChange={(e) => setGmailClientSecretInput(e.target.value)}
                      placeholder="Paste active Client Secret from Google Cloud Console (GOCSPX-...)"
                      className="w-full px-3 pr-10 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Never shared with frontend browsers or stored in plaintext.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2.5 shrink-0">
                <div>
                  {gmail?.hasClientId && (
                    <button
                      type="button"
                      onClick={handleDeleteGmailCreds}
                      className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                      title="Permanently remove credentials from database"
                    >
                      Delete Credentials
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowGmailModal(false)}
                    className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel / Close
                  </button>
                  <button
                    type="submit"
                    disabled={savingGmailCreds}
                    className="px-5 py-2 bg-[#032e60] hover:bg-[#05438c] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {savingGmailCreds && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{savingGmailCreds ? "Encrypting & Saving..." : "Save & Connect"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. SMTP CONFIGURATION MODAL (FALLBACK)                          */}
      {/* ============================================================== */}
      {showSmtpModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSmtpModal(false); }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-[#032e60] to-[#0d4a8d] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-blue-300" />
                <h3 className="font-bold text-base">Outbound SMTP Server Configuration</h3>
              </div>
              <button
                onClick={() => setShowSmtpModal(false)}
                title="Cancel / Close (Esc)"
                className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSmtp} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                {/* Preset Shortcuts */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                    Quick Server Presets
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={applyGmailPreset}
                      className="p-2.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-left transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-4 h-4 text-red-600" />
                      <div>
                        <div className="font-bold text-xs text-red-900">Gmail Official</div>
                        <div className="text-[10px] text-red-700">smtp.gmail.com:587</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={applyEtherealPreset}
                      className="p-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-left transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Zap className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-bold text-xs text-blue-900">Cloud Mailer</div>
                        <div className="text-[10px] text-blue-700">Instant test delivery</div>
                      </div>
                    </button>
                  </div>
                </div>

                {smtpModalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>{smtpModalError}</div>
                  </div>
                )}

                {smtpModalSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>{smtpModalSuccess}</div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">SMTP Host / Server</label>
                    <input
                      type="text"
                      required
                      value={smtpHostInput}
                      onChange={(e) => setSmtpHostInput(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <p className="text-[11px] text-gray-500 mt-1">
                      For Gmail: Use <span className="font-semibold text-gray-700 font-mono">smtp.gmail.com</span> (not your email address)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Port</label>
                    <input
                      type="text"
                      required
                      value={smtpPortInput}
                      onChange={(e) => setSmtpPortInput(e.target.value)}
                      placeholder="587"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Sender Email / Username
                  </label>
                  <input
                    type="email"
                    required
                    value={smtpUserInput}
                    onChange={(e) => setSmtpUserInput(e.target.value)}
                    placeholder="airnetcomputersbk@gmail.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-gray-700">
                      SMTP Password / Google App Password
                    </label>
                    <span className="text-[11px] text-gray-500">16-char app password for Gmail</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={smtpPassInput}
                      onChange={(e) => setSmtpPassInput(e.target.value)}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 pr-10 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">
                    For Gmail: Go to Google Account → Security → 2-Step Verification → App passwords.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">From Display Name</label>
                    <input
                      type="text"
                      value={smtpFromNameInput}
                      onChange={(e) => setSmtpFromNameInput(e.target.value)}
                      placeholder="Airnet Computers"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                      <input
                        type="checkbox"
                        checked={smtpSecureInput}
                        onChange={(e) => setSmtpSecureInput(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                      />
                      <span>SSL/TLS (Port 465)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSmtpModal(false)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel / Close
                </button>
                <button
                  type="submit"
                  disabled={savingSmtp}
                  className="px-5 py-2 bg-[#032e60] hover:bg-[#05438c] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {savingSmtp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{savingSmtp ? "Verifying & Saving..." : "Verify & Save Credentials"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
