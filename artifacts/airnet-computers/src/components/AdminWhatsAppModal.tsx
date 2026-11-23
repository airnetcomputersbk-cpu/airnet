import React, { useState, useMemo } from "react";
import { MessageCircle, Copy, Check, X, ArrowUpRight, ShieldCheck, MapPin, Phone } from "lucide-react";
import {
  NotificationApplication,
  getAcceptedWhatsAppMessage,
  getRejectedWhatsAppMessage,
  getOnHoldWhatsAppMessage,
  openWhatsAppChat,
  AIRNET_WHATSAPP_BUSINESS_NUMBER,
  AIRNET_MAPS_URL,
} from "../lib/whatsapp-templates";

export interface AdminWhatsAppModalProps {
  isOpen: boolean;
  status: "Accepted" | "Rejected" | "On Hold" | null;
  application: NotificationApplication | null;
  onClose: () => void;
  onTrackerNavigate?: () => void;
}

export function AdminWhatsAppModal({
  isOpen,
  status,
  application,
  onClose,
  onTrackerNavigate,
}: AdminWhatsAppModalProps) {
  const [copied, setCopied] = useState(false);

  const messageText = useMemo(() => {
    if (!application || !status) return "";
    switch (status) {
      case "Accepted":
        return getAcceptedWhatsAppMessage(application);
      case "Rejected":
        return getRejectedWhatsAppMessage(application);
      case "On Hold":
        return getOnHoldWhatsAppMessage(application);
      default:
        return "";
    }
  }, [application, status]);

  if (!isOpen || !application || !status) return null;

  const cleanPhone = (application.mobileNumber || "").replace(/\D/g, "").slice(-10);

  const handleCopy = () => {
    if (messageText) {
      navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSend = () => {
    if (application.mobileNumber && messageText) {
      openWhatsAppChat(application.mobileNumber, messageText);
    }
  };

  const statusConfig = {
    Accepted: {
      title: "Application Accepted",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
      accentBorder: "border-emerald-500",
      iconColor: "text-emerald-600",
    },
    Rejected: {
      title: "Application Rejected",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
      accentBorder: "border-rose-500",
      iconColor: "text-rose-600",
    },
    "On Hold": {
      title: "Application On Hold",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      accentBorder: "border-amber-500",
      iconColor: "text-amber-600",
    },
  }[status];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 text-left"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3 bg-gray-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <MessageCircle size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg text-gray-900 leading-snug">
                {statusConfig.title} — WhatsApp Notification
              </h3>
              <p className="text-xs text-gray-500 truncate">
                Notify customer from official Airnet Computers Business Account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 grid place-items-center shrink-0 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 custom-scrollbar text-xs">
          {/* Sender & Recipient Metadata Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Official Sender Account</div>
                <div className="font-bold text-gray-800">{AIRNET_WHATSAPP_BUSINESS_NUMBER}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={15} className="text-blue-600 shrink-0" />
              <div>
                <div className="text-[10px] uppercase font-bold text-gray-400">Recipient Customer</div>
                <div className="font-bold text-gray-800">
                  {application.customerName} (+91 {cleanPhone})
                </div>
              </div>
            </div>
          </div>

          {/* Application Details Summary */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold">Reference ID:</span>
              <span className="font-mono font-bold text-gray-900">{application.customerId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-semibold">Service:</span>
              <span className="font-bold text-gray-900 truncate max-w-[240px]">{application.serviceName}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-200">
              <span className="text-gray-500 font-semibold">Updated Status:</span>
              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${statusConfig.badgeColor}`}>
                ● Application {status}
              </span>
            </div>
          </div>

          {/* Pre-Formatted Message Box */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-gray-700">Message Preview:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
              >
                {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                {copied ? "Copied to Clipboard!" : "Copy Text"}
              </button>
            </div>
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap select-all max-h-52 overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
              {messageText}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSend}
            disabled={!cleanPhone}
            className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all cursor-pointer text-xs"
          >
            <MessageCircle size={16} />
            <span>Send on WhatsApp</span>
            <ArrowUpRight size={14} />
          </button>

          {status === "Accepted" && onTrackerNavigate && (
            <button
              type="button"
              onClick={onTrackerNavigate}
              className="flex items-center justify-center gap-1.5 bg-[#032e60] hover:bg-[#0b477e] text-white font-bold py-2.5 px-3 rounded-xl transition-colors cursor-pointer text-xs"
            >
              <span>Go to Tracker</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 font-semibold transition-colors cursor-pointer text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
