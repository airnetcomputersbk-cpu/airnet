import React from "react";
import { Route, Maximize2, Sparkles, ChevronUp, User, Lock } from "lucide-react";
import { usePathway } from "../context/PathwayContext";

export default function PathwaySystemTray() {
  const {
    isOpen,
    isMinimized,
    isClosedToTray,
    isLocked,
    activeCustomer,
    restorePathway,
    openPathway,
  } = usePathway();

  const handleTrayClick = () => {
    if (!isOpen || isMinimized || isClosedToTray) {
      restorePathway();
    } else {
      // Bring to front or open
      openPathway(activeCustomer);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleTrayClick}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-2xs cursor-pointer ${
          isClosedToTray
            ? "bg-amber-500/10 border-amber-400/40 text-amber-800 hover:bg-amber-500/20 animate-pulse"
            : isOpen && !isMinimized
            ? "bg-cyan-50 border-cyan-300 text-cyan-900 hover:bg-cyan-100"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
        title="Click to restore Pathway Floating Desktop Window"
      >
        <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shrink-0 shadow-xs">
          <Route className="w-3 h-3 text-white" />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-900 hidden sm:inline">Pathway</span>
          {activeCustomer ? (
            <>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="font-semibold text-slate-800 truncate max-w-[110px] hidden md:inline">
                {activeCustomer.customerName}
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                  activeCustomer.applicationStatus === "Completed"
                    ? "bg-emerald-100 text-emerald-800"
                    : activeCustomer.applicationStatus === "In Progress"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {activeCustomer.applicationStatus}
              </span>
            </>
          ) : (
            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-semibold">
              Idle
            </span>
          )}
        </div>

        {isLocked && (
          <span title="Pathway Screen is Locked in position">
            <Lock className="w-3 h-3 text-amber-500 shrink-0" />
          </span>
        )}
        <Maximize2 className="w-3 h-3 text-slate-400 group-hover:text-slate-600 shrink-0 ml-0.5" />
      </button>
    </div>
  );
}
