import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, Trash2, X, RefreshCw, Check } from "lucide-react";

export type ModalType = "success" | "error" | "warning" | "info" | "confirm";

export interface ModalConfig {
  id: string;
  type: ModalType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  okText?: string;
  retryText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  duration?: number; // ms, 0 = no auto-dismiss
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
  onRetry?: () => Promise<void> | void;
  resolve?: (value: boolean) => void;
}

export interface ModalContextType {
  showSuccess: (title: string, message?: string, duration?: number) => Promise<void>;
  showError: (title: string, message?: string, onRetry?: () => Promise<void> | void) => Promise<void>;
  showWarning: (title: string, message?: string) => Promise<void>;
  showInfo: (title: string, message?: string, duration?: number) => Promise<void>;
  confirm: (options: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  confirmDelete: (options?: {
    title?: string;
    message?: string;
    itemName?: string;
    onConfirm?: () => Promise<void>;
  }) => Promise<boolean>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | null>(null);

// Global bridge for non-React contexts or legacy alert polyfill
let globalModalBridge: ModalContextType | null = null;

export const appModal = {
  success: (title: string, message?: string, duration?: number) =>
    globalModalBridge ? globalModalBridge.showSuccess(title, message, duration) : console.log("[Success]", title, message),
  error: (title: string, message?: string, onRetry?: () => Promise<void> | void) =>
    globalModalBridge ? globalModalBridge.showError(title, message, onRetry) : console.error("[Error]", title, message),
  warning: (title: string, message?: string) =>
    globalModalBridge ? globalModalBridge.showWarning(title, message) : console.warn("[Warning]", title, message),
  info: (title: string, message?: string, duration?: number) =>
    globalModalBridge ? globalModalBridge.showInfo(title, message, duration) : console.info("[Info]", title, message),
  confirm: (options: { title: string; message?: string; confirmText?: string; cancelText?: string; isDanger?: boolean }) =>
    globalModalBridge ? globalModalBridge.confirm(options) : Promise.resolve(false),
  confirmDelete: (options?: { title?: string; message?: string; itemName?: string; onConfirm?: () => Promise<void> }) =>
    globalModalBridge ? globalModalBridge.confirmDelete(options) : Promise.resolve(false),
  close: () => globalModalBridge?.closeModal(),
};

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeModalIdRef = useRef<string | null>(null);

  // Clear any existing timer
  const clearTimer = useCallback(() => {
    if (autoDismissTimer.current) {
      clearTimeout(autoDismissTimer.current);
      autoDismissTimer.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    clearTimer();
    setModal((current) => {
      if (current?.resolve) {
        current.resolve(false);
      }
      return null;
    });
    activeModalIdRef.current = null;
    setIsActionLoading(false);
  }, [clearTimer]);

  const showModal = useCallback((config: Omit<ModalConfig, "id">): Promise<boolean> => {
    return new Promise((resolve) => {
      clearTimer();
      const id = `${config.type}-${config.title}-${Date.now()}`;
      
      // Deduplication: prevent identical prompt spam
      if (activeModalIdRef.current && activeModalIdRef.current.startsWith(`${config.type}-${config.title}`)) {
        resolve(false);
        return;
      }
      activeModalIdRef.current = id;
      setIsActionLoading(false);

      const fullConfig: ModalConfig = {
        ...config,
        id,
        resolve,
      };

      setModal(fullConfig);

      // Auto dismiss for temporary messages
      if (config.duration && config.duration > 0) {
        autoDismissTimer.current = setTimeout(() => {
          setModal((curr) => {
            if (curr && curr.id === id) {
              if (curr.resolve) curr.resolve(true);
              activeModalIdRef.current = null;
              return null;
            }
            return curr;
          });
        }, config.duration);
      }
    });
  }, [clearTimer]);

  const showSuccess = useCallback((title: string, message?: string, duration: number = 3200): Promise<void> => {
    return showModal({
      type: "success",
      title,
      message,
      duration,
      okText: "OK",
    }).then(() => {});
  }, [showModal]);

  const showError = useCallback((title: string, message?: string, onRetry?: () => Promise<void> | void): Promise<void> => {
    return showModal({
      type: "error",
      title,
      message,
      duration: 0, // Errors stay visible until dismissed
      okText: "Close",
      onRetry,
      retryText: onRetry ? "Retry" : undefined,
    }).then(() => {});
  }, [showModal]);

  const showWarning = useCallback((title: string, message?: string): Promise<void> => {
    return showModal({
      type: "warning",
      title,
      message,
      duration: 0,
      okText: "Understood",
    }).then(() => {});
  }, [showModal]);

  const showInfo = useCallback((title: string, message?: string, duration: number = 3500): Promise<void> => {
    return showModal({
      type: "info",
      title,
      message,
      duration,
      okText: "OK",
    }).then(() => {});
  }, [showModal]);

  const confirm = useCallback((options: {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }): Promise<boolean> => {
    return showModal({
      type: "confirm",
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
      isDanger: options.isDanger ?? false,
      duration: 0,
    });
  }, [showModal]);

  const confirmDelete = useCallback(async (options?: {
    title?: string;
    message?: string;
    itemName?: string;
    onConfirm?: () => Promise<void>;
  }): Promise<boolean> => {
    const title = options?.title || (options?.itemName ? `Delete ${options.itemName}?` : "Confirm Deletion");
    const message = options?.message || "Are you sure you want to delete this item? This action may not be reversible.";

    return new Promise((resolve) => {
      showModal({
        type: "confirm",
        title,
        message,
        confirmText: "YES – Delete",
        cancelText: "NO – Cancel",
        isDanger: true,
        duration: 0,
        onConfirm: async () => {
          if (options?.onConfirm) {
            setIsActionLoading(true);
            try {
              await options.onConfirm();
              closeModal();
              showSuccess(
                "Deleted Successfully",
                options.itemName ? `"${options.itemName}" has been permanently deleted.` : "The record has been permanently removed."
              );
              resolve(true);
            } catch (err: any) {
              closeModal();
              showError("Deletion Failed", err.message || "An error occurred while deleting the item. Please try again.");
              resolve(false);
            } finally {
              setIsActionLoading(false);
            }
          } else {
            closeModal();
            resolve(true);
          }
        },
        onCancel: () => {
          closeModal();
          resolve(false);
        },
      });
    });
  }, [showModal, closeModal, showSuccess, showError]);

  // Expose context value to global bridge
  const contextValue: ModalContextType = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    confirm,
    confirmDelete,
    closeModal,
  };

  useEffect(() => {
    globalModalBridge = contextValue;

    // Polyfill window.alert to automatically route legacy alerts to centered modals
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      const text = String(msg || "");
      if (text.toLowerCase().includes("fail") || text.toLowerCase().includes("error")) {
        showError("Alert", text);
      } else if (text.toLowerCase().includes("success")) {
        showSuccess("Notification", text);
      } else {
        showInfo("Notice", text);
      }
    };

    return () => {
      window.alert = originalAlert;
      globalModalBridge = null;
    };
  }, [contextValue, showError, showSuccess, showInfo]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && modal && !isActionLoading) {
        closeModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, isActionLoading, closeModal]);

  const handleConfirmClick = async () => {
    if (isActionLoading) return;
    if (modal?.onConfirm) {
      setIsActionLoading(true);
      try {
        await modal.onConfirm();
      } catch (err: any) {
        showError("Action Failed", err.message || "An error occurred.");
      } finally {
        setIsActionLoading(false);
      }
    } else {
      if (modal?.resolve) modal.resolve(true);
      closeModal();
    }
  };

  const handleCancelClick = () => {
    if (isActionLoading) return;
    if (modal?.onCancel) {
      modal.onCancel();
    } else {
      if (modal?.resolve) modal.resolve(false);
      closeModal();
    }
  };

  const handleRetryClick = async () => {
    if (isActionLoading || !modal?.onRetry) return;
    setIsActionLoading(true);
    try {
      await modal.onRetry();
      closeModal();
    } catch (err: any) {
      showError("Retry Failed", err.message || "Retry attempt unsuccessful.");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}

      {/* Centered Modal Overlay & Dialog */}
      {modal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="centered-modal-title"
          className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isActionLoading && modal.type !== "confirm") {
              closeModal();
            }
          }}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.35)] overflow-hidden transform transition-all animate-in zoom-in-95 duration-150 p-6 sm:p-7 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close / Cancel Button */}
            {!isActionLoading && (
              <button
                type="button"
                onClick={closeModal}
                title="Close (Esc)"
                aria-label="Close message dialog"
                className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}

            {/* Central Icon Header */}
            <div className="mb-4 flex justify-center">
              {modal.type === "success" && (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm animate-in zoom-in duration-200">
                  <CheckCircle2 size={36} strokeWidth={2.2} />
                </div>
              )}

              {modal.type === "error" && (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600 border border-red-200 shadow-sm animate-in zoom-in duration-200">
                  <XCircle size={36} strokeWidth={2.2} />
                </div>
              )}

              {modal.type === "warning" && (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm animate-in zoom-in duration-200">
                  <AlertTriangle size={36} strokeWidth={2.2} />
                </div>
              )}

              {modal.type === "info" && (
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 shadow-sm animate-in zoom-in duration-200">
                  <Info size={36} strokeWidth={2.2} />
                </div>
              )}

              {modal.type === "confirm" && (
                <div className={`grid h-16 w-16 place-items-center rounded-2xl shadow-sm animate-in zoom-in duration-200 ${
                  modal.isDanger ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-600 border border-blue-200"
                }`}>
                  {modal.isDanger ? (
                    <Trash2 size={34} strokeWidth={2.2} />
                  ) : (
                    <AlertTriangle size={34} strokeWidth={2.2} />
                  )}
                </div>
              )}
            </div>

            {/* Modal Title */}
            <h3
              id="centered-modal-title"
              className="text-xl font-bold tracking-tight text-slate-900 leading-snug"
            >
              {modal.title}
            </h3>

            {/* Modal Message */}
            {modal.message && (
              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto px-1">
                {modal.message}
              </p>
            )}

            {/* Actions Footer */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {modal.type === "confirm" ? (
                <>
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleCancelClick}
                    className="flex-1 min-w-[120px] px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {modal.cancelText || "NO – Cancel"}
                  </button>

                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={handleConfirmClick}
                    className={`flex-1 min-w-[140px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer ${
                      modal.isDanger
                        ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"
                    }`}
                  >
                    {isActionLoading ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        {modal.isDanger && <Trash2 size={15} />}
                        <span>{modal.confirmText || "YES – Delete"}</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {modal.onRetry && (
                    <button
                      type="button"
                      disabled={isActionLoading}
                      onClick={handleRetryClick}
                      className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isActionLoading && <RefreshCw size={14} className="animate-spin" />}
                      <span>{modal.retryText || "Retry"}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={closeModal}
                    className={`px-8 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md transition-all active:scale-95 cursor-pointer ${
                      modal.type === "success"
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                        : modal.type === "error"
                        ? "bg-red-600 hover:bg-red-700 shadow-red-500/20"
                        : modal.type === "warning"
                        ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20"
                        : "bg-[#032e60] hover:bg-[#0b477e] shadow-blue-900/20"
                    }`}
                  >
                    {modal.okText || "OK"}
                  </button>
                </>
              )}
            </div>

            {/* Optional Subtle Auto-Dismiss Countdown Bar */}
            {Boolean(modal.duration && modal.duration > 0) && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden">
                <div
                  className={`h-full ${
                    modal.type === "success" ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{
                    animation: `modalCountdown ${modal.duration}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
