import { useState, useEffect } from "react";
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Send,
  Building2,
  Phone,
  Clock,
  Sparkles,
  RefreshCw,
  Smartphone,
  PhoneCall,
  Check,
  Globe,
  ShieldAlert,
} from "lucide-react";
import { formatDateTimeDMY } from "../../lib/dateUtils";

interface AdminSettingsData {
  adminEmail: string;
  isConstantEmail: boolean;
  passwordUpdatedAt: string | null;
  lastOtpSentAt: string | null;
  supportPhone: string;
  adminMobileNumber?: string;
  frontendMobileNumber?: string;
  showUpdatedMobileOnFrontend?: boolean;
  effectiveFrontendNumber?: string;
  organization: string;
  location: string;
}

export default function AdminSettings() {
  const [data, setData] = useState<AdminSettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Change password form states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Change mobile number form states
  const [newMobileNumber, setNewMobileNumber] = useState("");
  const [mobileOtpCode, setMobileOtpCode] = useState("");
  const [isSendingMobileOtp, setIsSendingMobileOtp] = useState(false);
  const [isVerifyingMobileOtp, setIsVerifyingMobileOtp] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [mobileSuccess, setMobileSuccess] = useState<string | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  // Frontend permission states
  const [isTogglingFrontendPermission, setIsTogglingFrontendPermission] = useState(false);
  const [frontendPermissionFeedback, setFrontendPermissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Test OTP states
  const [isSendingTestOtp, setIsSendingTestOtp] = useState(false);
  const [testOtpFeedback, setTestOtpFeedback] = useState<{
    type: "success" | "error";
    message: string;
    previewUrl?: string | null;
  } | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load admin settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current master password.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setPasswordError("New password must be at least 4 characters long.");
      return;
    }

    if (!newPassword !== !confirmPassword && newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const res = await fetch("/api/admin/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const resData = await res.json();

      if (resData.success) {
        setPasswordSuccess(resData.message || "Master password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await fetchSettings();
      } else {
        setPasswordError(resData.message || "Failed to update master password.");
      }
    } catch (err: any) {
      setPasswordError("Network error while updating master password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRequestMobileOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setMobileError(null);
    setMobileSuccess(null);
    setMobilePreviewUrl(null);

    const cleanInput = newMobileNumber.replace(/\D/g, "");
    if (!cleanInput || cleanInput.length < 10) {
      setMobileError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setIsSendingMobileOtp(true);

    try {
      const res = await fetch("/api/admin/settings/request-mobile-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newMobileNumber }),
      });

      const resData = await res.json();

      if (resData.success) {
        setMobileOtpSent(true);
        setMobileSuccess(resData.message || "A 6-digit OTP has been sent to airnetcomputersbk@gmail.com.");
        setMobilePreviewUrl(resData.previewUrl || null);
        setResendTimer(60);
      } else {
        setMobileError(resData.message || "Failed to dispatch mobile change OTP.");
      }
    } catch (err: any) {
      setMobileError("Network error while requesting mobile change OTP.");
    } finally {
      setIsSendingMobileOtp(false);
    }
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMobileError(null);
    setMobileSuccess(null);

    const cleanOtp = mobileOtpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setMobileError("Please enter the complete 6-digit OTP PIN.");
      return;
    }

    setIsVerifyingMobileOtp(true);

    try {
      const res = await fetch("/api/admin/settings/verify-mobile-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: cleanOtp }),
      });

      const resData = await res.json();

      if (resData.success) {
        setMobileSuccess(resData.message || "Mobile number updated successfully!");
        setMobileOtpSent(false);
        setMobileOtpCode("");
        setNewMobileNumber("");
        setMobilePreviewUrl(null);
        await fetchSettings();
      } else {
        setMobileError(resData.message || "Invalid or expired OTP PIN.");
      }
    } catch (err: any) {
      setMobileError("Network error while verifying OTP.");
    } finally {
      setIsVerifyingMobileOtp(false);
    }
  };

  const handleToggleFrontendPermission = async (grantPermission: boolean) => {
    setIsTogglingFrontendPermission(true);
    setFrontendPermissionFeedback(null);

    try {
      const res = await fetch("/api/admin/settings/frontend-mobile-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grantPermission }),
      });

      const resData = await res.json();

      if (resData.success) {
        setFrontendPermissionFeedback({
          type: "success",
          message: resData.message || "Frontend display permission updated successfully!",
        });
        await fetchSettings();
      } else {
        setFrontendPermissionFeedback({
          type: "error",
          message: resData.message || "Failed to update frontend display permission.",
        });
      }
    } catch (err: any) {
      setFrontendPermissionFeedback({
        type: "error",
        message: "Network error while updating frontend display permission.",
      });
    } finally {
      setIsTogglingFrontendPermission(false);
    }
  };

  const handleSendTestOtp = async () => {
    setIsSendingTestOtp(true);
    setTestOtpFeedback(null);

    try {
      const res = await fetch("/api/admin/settings/send-test-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const resData = await res.json();

      if (resData.success) {
        setTestOtpFeedback({
          type: "success",
          message: resData.message || "Security OTP PIN dispatched to airnetcomputersbk@gmail.com successfully!",
          previewUrl: resData.previewUrl,
        });
        await fetchSettings();
      } else {
        setTestOtpFeedback({
          type: "error",
          message: resData.message || "Failed to send test OTP PIN.",
        });
      }
    } catch (err: any) {
      setTestOtpFeedback({
        type: "error",
        message: "Network error while triggering test OTP.",
      });
    } finally {
      setIsSendingTestOtp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Security Center</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings & Credentials</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your master administrator password, security recovery email, and authentication OTP PINs.
          </p>
        </div>

        <button
          onClick={fetchSettings}
          className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold border border-gray-200 flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Admin Identity Profile */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-50 text-blue-700 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">
                  {data?.organization || "Airnet Computers"}
                </h3>
                <span className="text-xs text-gray-500">
                  {data?.location || "Basavakalyan - 585327"}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Official Admin Email
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    Constant
                  </span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2 select-all font-mono text-xs font-bold text-gray-800">
                  <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate">{data?.adminEmail || "airnetcomputersbk@gmail.com"}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 leading-normal">
                  Hardcoded security recipient. All emergency password reset OTP PINs are delivered exclusively to this inbox.
                </p>
              </div>

              <div className="pt-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                  Backend Mobile Number
                </span>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-800 font-mono">
                  <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{data?.adminMobileNumber || data?.supportPhone || "+91 7892881086"}</span>
                </div>
              </div>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Frontend Public Helpline
                  </span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    data?.showUpdatedMobileOnFrontend
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {data?.showUpdatedMobileOnFrontend ? "Live" : "Protected"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-gray-800 font-mono">
                  <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{data?.effectiveFrontendNumber || data?.frontendMobileNumber || "+91 7892881086"}</span>
                </div>
              </div>

              {data?.passwordUpdatedAt && (
                <div className="pt-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Password Last Changed
                  </span>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formatDateTimeDMY(data.passwordUpdatedAt)} IST</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Security Tip Card */}
          <div className="bg-gradient-to-br from-[#032e60] to-[#0a4d9c] text-white p-5 rounded-2xl shadow-sm space-y-2.5">
            <div className="flex items-center gap-2 text-blue-200 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>Two-Factor Security Note</span>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              If you ever forget your master password, use the <strong>"Forgot Password?"</strong> link on the login page. A 6-digit OTP will be dispatched immediately to <strong className="text-white">airnetcomputersbk@gmail.com</strong>.
            </p>
          </div>
        </div>

        {/* Right Column: Change Password & Emergency OTP Testing */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Change Master Password */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Change Master Password</h2>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Update the administrator master password for the management portal.
            </p>

            {passwordSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 mb-5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 mb-5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                  Current Master Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-medium pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                    New Master Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-medium pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2.5 bg-[#032e60] hover:bg-[#021f40] text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-60 flex items-center gap-2 cursor-pointer"
                >
                  {isChangingPassword ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save New Password</span>
                </button>
              </div>
            </form>
          </div>

          {/* Card: Change Admin Mobile Number via OTP */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Change Helpline / Admin Mobile Number</h2>
                  <p className="text-xs text-gray-500">
                    Update the official contact number across customer portals, WhatsApp receipts, and PDF reports.
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                OTP Verified
              </span>
            </div>

            {/* Dual Number Status Cards: Backend vs Frontend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Card 1: Backend Tasks Number */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                    <span>Backend Active Number</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                    Backend Active
                  </span>
                </div>
                <div className="font-mono text-base font-extrabold text-slate-900">
                  {data?.adminMobileNumber || data?.supportPhone || "+91 7892881086"}
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Drives all internal backend tasks, daily PDF audits, nightly 11:00 PM email summaries, and database records.
                </p>
              </div>

              {/* Card 2: Frontend Website Display */}
              <div className={`p-4 rounded-xl border space-y-2 ${
                data?.showUpdatedMobileOnFrontend
                  ? "bg-emerald-50/70 border-emerald-200"
                  : "bg-amber-50/70 border-amber-200"
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] uppercase font-bold tracking-wider flex items-center gap-1.5 ${
                    data?.showUpdatedMobileOnFrontend ? "text-emerald-700" : "text-amber-800"
                  }`}>
                    <Globe className="w-3.5 h-3.5" />
                    <span>Frontend Display Number</span>
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    data?.showUpdatedMobileOnFrontend
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}>
                    {data?.showUpdatedMobileOnFrontend ? "Live on Website" : "Protected"}
                  </span>
                </div>
                <div className="font-mono text-base font-extrabold text-slate-900">
                  {data?.effectiveFrontendNumber || data?.frontendMobileNumber || "+91 7892881086"}
                </div>
                <p className={`text-[11px] leading-normal ${
                  data?.showUpdatedMobileOnFrontend ? "text-emerald-700" : "text-amber-800"
                }`}>
                  {data?.showUpdatedMobileOnFrontend
                    ? "Visible publicly to customers on the homepage, click-to-call buttons, and registration receipts."
                    : "The frontend is protected. Customers continue seeing the approved public helpline until you grant permission."}
                </p>
              </div>
            </div>

            {/* Dedicated Frontend Permission Control Box */}
            <div className={`p-4 rounded-xl border space-y-3 ${
              data?.showUpdatedMobileOnFrontend
                ? "bg-emerald-50/50 border-emerald-300"
                : "bg-slate-50 border-slate-200"
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className={`w-4 h-4 ${data?.showUpdatedMobileOnFrontend ? "text-emerald-600" : "text-slate-600"}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Frontend Website Display Permission
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-xl">
                    {data?.showUpdatedMobileOnFrontend
                      ? `Permission is currently GRANTED. The public website is actively displaying ${data?.adminMobileNumber}. You can revoke this anytime to revert the public website to ${data?.frontendMobileNumber || "+91 7892881086"}.`
                      : `Permission is currently NOT GRANTED. The public website remains unaltered on ${data?.frontendMobileNumber || "+91 7892881086"}, while the backend executes all tasks using ${data?.adminMobileNumber || "+91 7892881086"}.`}
                  </p>
                </div>

                <div className="shrink-0">
                  {data?.showUpdatedMobileOnFrontend ? (
                    <button
                      type="button"
                      disabled={isTogglingFrontendPermission}
                      onClick={() => handleToggleFrontendPermission(false)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {isTogglingFrontendPermission ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      )}
                      <span>Revoke Frontend Permission</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isTogglingFrontendPermission}
                      onClick={() => handleToggleFrontendPermission(true)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-60 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      {isTogglingFrontendPermission ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Grant Permission: Show on Frontend</span>
                    </button>
                  )}
                </div>
              </div>

              {frontendPermissionFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    frontendPermissionFeedback.type === "success"
                      ? "bg-emerald-100/70 border border-emerald-300 text-emerald-900"
                      : "bg-red-100/70 border border-red-300 text-red-900"
                  }`}
                >
                  {frontendPermissionFeedback.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                  )}
                  <span>{frontendPermissionFeedback.message}</span>
                </div>
              )}
            </div>

            {/* Success message */}
            {mobileSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span>{mobileSuccess}</span>
                  {mobilePreviewUrl && (
                    <a
                      href={mobilePreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 font-bold underline block mt-1"
                    >
                      View Dispatched OTP Email ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {mobileError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{mobileError}</span>
              </div>
            )}

            {/* Step 1: Input new mobile & request OTP */}
            <form onSubmit={handleRequestMobileOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">
                  New Admin Mobile Number
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newMobileNumber}
                      onChange={(e) => setNewMobileNumber(e.target.value)}
                      placeholder="e.g. 7892881086 or +91 9876543210"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 font-medium"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingMobileOtp || resendTimer > 0}
                    className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {isSendingMobileOtp ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {resendTimer > 0
                        ? `Resend in ${resendTimer}s`
                        : mobileOtpSent
                        ? "Resend Security OTP"
                        : "Send Security OTP to Email"}
                    </span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Security OTP will be dispatched immediately to constant email: <strong className="text-gray-800">airnetcomputersbk@gmail.com</strong>.
                </p>
              </div>
            </form>

            {/* Step 2: Verification section (when OTP sent or ready to enter) */}
            {mobileOtpSent && (
              <form
                onSubmit={handleVerifyMobileOtp}
                className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    Enter 6-Digit OTP Security PIN
                  </label>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                    Valid for 10 min
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    value={mobileOtpCode}
                    onChange={(e) => setMobileOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full sm:w-44 px-4 py-2 bg-white border border-emerald-300 rounded-xl text-center font-mono text-lg font-bold tracking-[0.3em] text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    disabled={isVerifyingMobileOtp || mobileOtpCode.length < 6}
                    className="px-5 py-2.5 bg-[#032e60] hover:bg-[#021f40] text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  >
                    {isVerifyingMobileOtp ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>Verify & Apply Mobile Number</span>
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Once verified, the new number is activated immediately for all backend tasks, emails, and PDF reports. The public frontend website remains unaltered until you grant permission above.
                </p>
              </form>
            )}
          </div>

          {/* Card: Emergency OTP PIN Recovery Testing */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900">OTP PIN Recovery Verification</h2>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Test whether the system can successfully deliver a 6-digit OTP security PIN to your official email (<strong>airnetcomputersbk@gmail.com</strong>). This verifies that the reset password mechanism is working properly.
            </p>

            {testOtpFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2 ${
                  testOtpFeedback.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {testOtpFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div>{testOtpFeedback.message}</div>
                  {testOtpFeedback.previewUrl && (
                    <a
                      href={testOtpFeedback.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 font-bold underline block mt-1"
                    >
                      View Dispatched OTP Email in Test Mailer ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={handleSendTestOtp}
                disabled={isSendingTestOtp}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-60 flex items-center gap-2 cursor-pointer"
              >
                {isSendingTestOtp ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Send Test Security OTP to airnetcomputersbk@gmail.com</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
