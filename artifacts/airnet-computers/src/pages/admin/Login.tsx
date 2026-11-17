import { useState } from "react";
import { Lock, Eye, EyeOff, Mail, KeyRound, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";

export default function AdminLogin({ onLogin }: { onLogin?: () => void }) {
  const [mode, setMode] = useState<"login" | "forgot_request" | "forgot_verify">("login");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  // Forgot password states
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const CONSTANT_ADMIN_EMAIL = "airnetcomputersbk@gmail.com";

  // 1. Standard Login Handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.token) {
          localStorage.setItem("admin_token", data.token);
        } else if (password) {
          localStorage.setItem("admin_token", password);
        }
        if (onLogin) onLogin();
        setLocation("/admin/dashboard");
      } else {
        const data = await response.json().catch(() => null);
        setError(data?.error || data?.message || "Incorrect master password. Please try again or use 'Forgot Password?'.");
      }
    } catch (err: any) {
      setError("An error occurred connecting to the security server. Please ensure the server is active.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Request OTP to constant admin email
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    setPreviewUrl(null);

    try {
      const res = await fetch("/api/admin/forgot-password/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setSuccessMsg(data.message || `OTP PIN sent to ${CONSTANT_ADMIN_EMAIL}`);
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
        setMode("forgot_verify");
      } else {
        setError(data?.message || "Failed to dispatch OTP PIN. Please try again.");
      }
    } catch (err: any) {
      setError("Network error while connecting to security server. Please verify the admin backend service is running.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Verify OTP & Reset Password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!otp.trim() || otp.trim().length !== 6) {
      setError("Please enter the complete 6-digit OTP security PIN.");
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError("New password must be at least 4 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation password do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/forgot-password/verify-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim(), newPassword }),
      });

      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setSuccessMsg("Password reset successfully! Redirecting to Dashboard...");
        setTimeout(() => {
          if (onLogin) onLogin();
          setLocation("/admin/dashboard");
        }, 1500);
      } else {
        setError(data?.message || "Invalid or expired OTP PIN. Please try again.");
      }
    } catch (err: any) {
      setError("Network error occurred during password reset.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: "login" | "forgot_request" | "forgot_verify") => {
    setError("");
    setSuccessMsg("");
    setMode(newMode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f5f7fb] p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-[0_12px_40px_rgb(0,0,0,0.06)] border border-[#e5e7eb] transition-all">
        {/* ========================================================= */}
        {/* VIEW 1: STANDARD ADMIN LOGIN                              */}
        {/* ========================================================= */}
        {mode === "login" && (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 bg-[#eff6ff] rounded-2xl flex items-center justify-center mb-3 shadow-inner">
                <Lock className="w-7 h-7 text-[#2563eb]" />
              </div>
              <h2 className="text-2xl font-bold text-[#032e60]">Admin Login</h2>
              <p className="text-[#6b7280] text-sm mt-1">Airnet Computers Management Portal</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Master Password"
                    className="w-full px-4 py-3.5 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent text-sm transition-all pr-12 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#032e60] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => switchMode("forgot_request")}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 mt-3">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#032e60] hover:bg-[#021f40] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex justify-center items-center cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Login to Dashboard"
                )}
              </button>
            </form>
          </>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: FORGOT PASSWORD - REQUEST OTP                     */}
        {/* ========================================================= */}
        {mode === "forgot_request" && (
          <>
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mb-3 text-amber-600 shadow-inner">
                <KeyRound className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-[#032e60]">Reset Password</h2>
              <p className="text-gray-500 text-xs text-center mt-1">
                Security verification via Official Admin Email
              </p>
            </div>

            <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl mb-6 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Constant Admin Email Destination</span>
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">
                A 6-digit OTP PIN will be sent to the official constant admin email address:
              </p>
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 font-mono text-xs font-bold text-blue-950 flex items-center gap-2 select-all">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{CONSTANT_ADMIN_EMAIL}</span>
              </div>
              <p className="text-[11px] text-gray-500">
                The OTP is valid for 10 minutes from dispatch.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex justify-center items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Send 6-Digit OTP PIN</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                disabled={loading}
                className="w-full py-2.5 text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: FORGOT PASSWORD - VERIFY OTP & SET NEW PASSWORD   */}
        {/* ========================================================= */}
        {mode === "forgot_verify" && (
          <>
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3 text-emerald-600 shadow-inner">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-[#032e60]">Enter OTP & Reset</h2>
              <p className="text-gray-500 text-xs text-center mt-1">
                OTP sent to <span className="font-semibold text-gray-700">{CONSTANT_ADMIN_EMAIL}</span>
              </p>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {previewUrl && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-4">
                <span className="font-bold block mb-1">⚡ Test Mailer Preview Active:</span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 font-semibold underline break-all"
                >
                  Click here to view OTP Email in Test Mailbox ↗
                </a>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAndReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  6-Digit OTP Security PIN
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="• • • • • •"
                  className="w-full text-center tracking-[10px] text-xl font-mono py-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] font-bold"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  New Master Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new master password"
                    className="w-full px-4 py-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm pr-12 font-medium"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 bg-[#f9fafb] border border-[#e5e7eb] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-sm font-medium"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex justify-center items-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verify OTP & Reset Password</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Resend OTP PIN
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
