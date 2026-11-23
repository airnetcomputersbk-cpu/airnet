import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { formatDateDMY } from "../lib/dateUtils";
import {
  Route,
  Minus,
  Square,
  X,
  SlidersHorizontal,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Phone,
  MessageCircle,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  FolderOpen,
  Maximize2,
  Minimize2,
  ChevronDown,
  Layers,
  ArrowRight,
  GripHorizontal,
  Compass,
  FileText,
  Lock,
  Unlock,
  ArrowUpDown,
  ArrowLeftRight,
  Bookmark,
  Globe,
  Laptop,
  Sparkles,
} from "lucide-react";
import { usePathway, PathwayCustomer, ADMIN_NAVIGATION_TABS } from "../context/PathwayContext";
import { PathwayPopoutView } from "../pages/admin/PathwayPopout";

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export default function PathwayWindow() {
  const {
    isOpen,
    isMinimized,
    isMaximized,
    isLocked,
    showDateTime,
    activeCustomer,
    customers,
    isLoading,
    windowPosition,
    windowSize,
    minimizedSize,
    settings,
    currentTab,
    currentTabLabel,
    closePathway,
    minimizePathway,
    maximizePathway,
    restorePathway,
    toggleLock,
    toggleDateTime,
    selectCustomer,
    refreshPathwayData,
    updateSettings,
    setWindowPosition,
    setWindowSize,
    setMinimizedSize,
    switchSide,
    switchTab,
    resetTabPosition,
  } = usePathway();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showTabSwitcherDropdown, setShowTabSwitcherDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState<"flow" | "details" | "documents">("flow");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);

  const embedOrigin = typeof window !== "undefined" && window.location.port !== "5000" ? window.location.origin : "http://localhost:5001";
  const bookmarkletCode = `javascript:(function(){var s=document.createElement('script');s.src='${embedOrigin}/api/pathway/embed.js?t='+Date.now();document.body.appendChild(s);})();`;

  const launchAlwaysOnTopPiP = async () => {
    if (typeof window === "undefined") return;

    if (pipWindow) {
      try { pipWindow.close(); } catch {}
      setPipWindow(null);
      setPipContainer(null);
      return;
    }

    if ("documentPictureInPicture" in window) {
      try {
        const win = await (window as any).documentPictureInPicture.requestWindow({
          width: 520,
          height: 680,
        });

        // Copy styles
        [...document.styleSheets].forEach((sheet) => {
          try {
            const rules = [...sheet.cssRules].map((r) => r.cssText).join("");
            const styleEl = win.document.createElement("style");
            styleEl.textContent = rules;
            win.document.head.appendChild(styleEl);
          } catch (e) {
            const linkEl = win.document.createElement("link");
            linkEl.rel = "stylesheet";
            linkEl.href = sheet.href;
            win.document.head.appendChild(linkEl);
          }
        });

        win.document.body.style.margin = "0";
        win.document.body.style.padding = "0";
        win.document.body.style.overflow = "hidden";
        win.document.body.style.backgroundColor = "#f8fafc";
        win.document.title = "Airnet Pathway Dossier (Always On Top)";

        const container = win.document.createElement("div");
        container.id = "pip-pathway-root";
        win.document.body.appendChild(container);

        setPipWindow(win);
        setPipContainer(container);

        win.addEventListener("pagehide", () => {
          setPipWindow(null);
          setPipContainer(null);
        });

        return;
      } catch (err) {
        console.warn("[PiP] Document PiP unavailable, opening companion window:", err);
      }
    }

    // Fallback: Open standalone companion window
    window.open(
      "/admin/pathway/popout",
      "AirnetPathwayCompanion",
      "width=520,height=700,status=no,toolbar=no,menubar=no,scrollbars=yes"
    );
  };

  // Real-time ticking live date and time state
  const [currentDateTime, setCurrentDateTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = `${currentDateTime.toLocaleDateString("en-IN", { weekday: "short" })}, ${formatDateDMY(currentDateTime)}`;

  const formattedTime = currentDateTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  // Window DOM element refs for ultra-smooth direct hardware-accelerated manipulation
  const normalWindowRef = useRef<HTMLDivElement>(null);
  const minimizedWindowRef = useRef<HTMLDivElement>(null);

  // Position and Size tracking refs (avoids re-rendering huge tree 120 times/sec during drags)
  const currentPosRef = useRef({ x: windowPosition.x, y: windowPosition.y });
  useEffect(() => {
    currentPosRef.current = windowPosition;
  }, [windowPosition]);

  const currentSizeRef = useRef(windowSize);
  useEffect(() => {
    currentSizeRef.current = windowSize;
  }, [windowSize]);

  const currentMinSizeRef = useRef(minimizedSize);
  useEffect(() => {
    currentMinSizeRef.current = minimizedSize;
  }, [minimizedSize]);

  // Programmatic animation flag (enables smooth slide transitions ONLY on buttons like Switch Side)
  const [isProgrammaticMove, setIsProgrammaticMove] = useState(false);

  // Dragging and Resizing UI states
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragRafId = useRef<number | null>(null);

  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const resizeRafId = useRef<number | null>(null);

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Programmatic Switch Side (Slides smoothly across the screen)
  const handleSwitchSide = () => {
    setIsProgrammaticMove(true);
    switchSide();
    setTimeout(() => setIsProgrammaticMove(false), 320);
  };

  // Full Screen Height Snap / Toggle (Allows screen to move upward until full height of screen)
  const [isFullHeight, setIsFullHeight] = useState(false);
  const prevHeightRef = useRef<{ y: number; height: number }>({ y: 0, height: 640 });

  const toggleFullHeight = () => {
    if (isLocked || isMaximized) return;
    setIsProgrammaticMove(true);
    if (!isFullHeight) {
      prevHeightRef.current = { y: currentPosRef.current.y, height: currentSizeRef.current.height };
      setWindowPosition((prev) => ({ ...prev, y: 0 }));
      setWindowSize((prev) => ({ ...prev, height: window.innerHeight }));
      setIsFullHeight(true);
    } else {
      setWindowPosition((prev) => ({ ...prev, y: Math.max(0, prevHeightRef.current.y) }));
      setWindowSize((prev) => ({ ...prev, height: prevHeightRef.current.height }));
      setIsFullHeight(false);
    }
    setTimeout(() => setIsProgrammaticMove(false), 320);
  };

  // High-Performance Hardware-Accelerated Title Bar Drag Handler (Global Listeners + rAF)
  const handlePointerDownDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMaximized || isLocked) return;
    if (e.button !== 0) return; // Only primary mouse button / touch
    const target = e.target as HTMLElement;
    // Strictly prevent dragging when clicking buttons, inputs, links, or form controls
    if (target.closest("button, input, select, textarea, a, [data-no-drag]")) {
      return;
    }

    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = currentPosRef.current.x;
    const initialY = currentPosRef.current.y;
    const curW = isMinimized ? currentMinSizeRef.current.width : currentSizeRef.current.width;
    const curH = isMinimized ? currentMinSizeRef.current.height : currentSizeRef.current.height;

    isDraggingRef.current = true;
    setIsDragging(true);

    const activeEl = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
    if (activeEl) {
      activeEl.style.transition = "none";
      activeEl.style.willChange = "left, top";
    }
    document.body.style.userSelect = "none";

    let lastX = initialX;
    let lastY = initialY;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      const maxX = Math.max(0, window.innerWidth - curW);
      const maxY = Math.max(0, window.innerHeight - curH);

      let nextX = Math.max(0, Math.min(maxX, initialX + dx));
      let nextY = Math.max(0, Math.min(maxY, initialY + dy));

      // Gentle edge magnetic snapping for clean alignment
      if (settings.snapToEdges) {
        if (nextX < 14) nextX = 0;
        else if (nextX > maxX - 14) nextX = maxX;

        if (nextY < 14) nextY = 0;
        else if (nextY > maxY - 14) nextY = maxY;
      }

      lastX = nextX;
      lastY = nextY;
      currentPosRef.current = { x: nextX, y: nextY };

      if (dragRafId.current !== null) {
        cancelAnimationFrame(dragRafId.current);
      }
      dragRafId.current = requestAnimationFrame(() => {
        const el = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
        if (el) {
          el.style.left = `${lastX}px`;
          el.style.top = `${lastY}px`;
        }
      });
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (dragRafId.current !== null) {
        cancelAnimationFrame(dragRafId.current);
        dragRafId.current = null;
      }

      document.body.style.userSelect = "";

      const el = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
      if (el) {
        el.style.willChange = "auto";
        el.style.transition = "none";
        el.style.left = `${lastX}px`;
        el.style.top = `${lastY}px`;
      }

      // Commit final position to React state and localStorage ONCE (Rock-solid, zero vibration)
      setWindowPosition({ x: lastX, y: lastY });
      setIsDragging(false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  // High-Performance Multi-Directional Window Resizing Handler (Global Listeners + rAF)
  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    if (isLocked || isMaximized) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = currentPosRef.current.x;
    const origY = currentPosRef.current.y;
    const origW = isMinimized ? currentMinSizeRef.current.width : currentSizeRef.current.width;
    const origH = isMinimized ? currentMinSizeRef.current.height : currentSizeRef.current.height;

    const minW = isMinimized ? 280 : 380;
    const minH = isMinimized ? 52 : 300;
    const maxW = isMinimized ? 760 : Math.max(minW, window.innerWidth);
    const maxH = isMinimized ? 220 : Math.max(minH, window.innerHeight);

    isResizingRef.current = true;
    setIsResizing(true);

    const activeEl = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
    if (activeEl) {
      activeEl.style.transition = "none";
      activeEl.style.willChange = "width, height, left, top";
    }
    document.body.style.userSelect = "none";

    let finalX = origX;
    let finalY = origY;
    let finalW = origW;
    let finalH = origH;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!isResizingRef.current) return;
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      let nextX = origX;
      let nextY = origY;
      let nextW = origW;
      let nextH = origH;

      // Horizontal stretch
      if (direction.includes("e")) {
        const proposedW = origW + dx;
        const boundMaxW = window.innerWidth - origX;
        nextW = Math.max(minW, Math.min(boundMaxW, proposedW));
      } else if (direction.includes("w")) {
        const proposedW = origW - dx;
        if (proposedW < minW) {
          nextW = minW;
          nextX = origX + (origW - minW);
        } else if (origX + dx <= 0) {
          nextX = 0;
          nextW = Math.min(maxW, origX + origW);
        } else {
          nextW = Math.min(maxW, proposedW);
          nextX = origX + (origW - nextW);
        }
      }

      // Vertical stretch
      if (direction.includes("s")) {
        const proposedH = origH + dy;
        const boundMaxH = window.innerHeight - origY;
        nextH = Math.max(minH, Math.min(boundMaxH, proposedH));
      } else if (direction.includes("n")) {
        const proposedH = origH - dy;
        if (origY + dy <= 0) {
          nextY = 0;
          nextH = Math.min(window.innerHeight, origY + origH);
        } else if (proposedH < minH) {
          nextH = minH;
          nextY = origY + (origH - minH);
        } else {
          nextH = Math.min(window.innerHeight, proposedH);
          nextY = Math.max(0, origY + (origH - nextH));
        }
      }

      nextX = Math.max(0, Math.min(window.innerWidth - nextW, nextX));
      nextY = Math.max(0, Math.min(window.innerHeight - nextH, nextY));

      finalX = nextX;
      finalY = nextY;
      finalW = nextW;
      finalH = nextH;
      currentPosRef.current = { x: nextX, y: nextY };

      if (resizeRafId.current !== null) {
        cancelAnimationFrame(resizeRafId.current);
      }
      resizeRafId.current = requestAnimationFrame(() => {
        const el = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
        if (el) {
          el.style.width = `${nextW}px`;
          el.style.height = `${nextH}px`;
          el.style.left = `${nextX}px`;
          el.style.top = `${nextY}px`;
        }
      });
    };

    const onPointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (resizeRafId.current !== null) {
        cancelAnimationFrame(resizeRafId.current);
        resizeRafId.current = null;
      }

      document.body.style.userSelect = "";

      const el = isMinimized ? minimizedWindowRef.current : normalWindowRef.current;
      if (el) {
        el.style.willChange = "auto";
        el.style.transition = "none";
        el.style.width = `${finalW}px`;
        el.style.height = `${finalH}px`;
        el.style.left = `${finalX}px`;
        el.style.top = `${finalY}px`;
      }

      if (isMinimized) {
        setMinimizedSize({ width: finalW, height: finalH });
      } else {
        setWindowSize({ width: finalW, height: finalH });
      }
      if (direction.includes("w") || direction.includes("n")) {
        setWindowPosition({ x: finalX, y: finalY });
      }
      setIsResizing(false);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  if (pipWindow && pipContainer) {
    return (
      <>
        {createPortal(
          <PathwayPopoutView
            onRestore={() => {
              try { pipWindow.close(); } catch {}
              setPipWindow(null);
              setPipContainer(null);
            }}
          />,
          pipContainer
        )}
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
          }}
          className="bg-[#022349]/95 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl border border-cyan-400/50 flex items-center gap-3 animate-in fade-in select-none"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <div className="text-xs">
            <div className="font-bold text-cyan-200">Pathway Floating Over Other Websites</div>
            <div className="text-[10px] text-slate-300">Picture-in-Picture window active</div>
          </div>
          <button
            type="button"
            onClick={() => {
              try { pipWindow.close(); } catch {}
              setPipWindow(null);
              setPipContainer(null);
            }}
            className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 text-xs font-semibold rounded-lg border border-cyan-400/40 cursor-pointer transition-colors"
          >
            Dock Back
          </button>
        </div>
      </>
    );
  }

  if (!isOpen) return null;

  // Filter customers for dropdown switcher
  const customerList = Array.isArray(customers) ? customers : [];
  const filteredCustomers = customerList.filter((c) => {
    if (!c) return false;
    const q = (searchQuery || "").toLowerCase();
    return (
      (c.customerName || "").toLowerCase().includes(q) ||
      String(c.customerId || "").toLowerCase().includes(q) ||
      String(c.mobileNumber || "").includes(q) ||
      (c.serviceName || "").toLowerCase().includes(q)
    );
  });

  // =========================================================================
  // 1. MINIMIZED STATE: Compact, Multi-Directional Resizable Floating Desktop Panel
  // =========================================================================
  if (isMinimized) {
    return (
      <div
        ref={minimizedWindowRef}
        style={{
          position: "fixed",
          left: `${windowPosition.x}px`,
          top: `${windowPosition.y}px`,
          width: `${minimizedSize.width}px`,
          height: `${minimizedSize.height}px`,
          zIndex: 9999,
          transition: isProgrammaticMove
            ? "left 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease, height 0.2s ease"
            : isResizing
            ? "none"
            : "width 0.2s ease, height 0.2s ease",
        }}
        className={`group select-none bg-[#032e60]/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border flex flex-col justify-between p-2.5 transition-shadow hover:shadow-cyan-500/20 ${
          isLocked ? "border-amber-400/50 shadow-amber-500/10" : "border-blue-400/40"
        }`}
      >
        {/* All-Direction Resize Handles for Minimized Panel */}
        {!isLocked && (
          <>
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "n")}
              className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize z-50 hover:bg-cyan-500/30"
              title="Resize Height (Top)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "s")}
              className="absolute -bottom-1 left-2 right-2 h-2 cursor-ns-resize z-50 hover:bg-cyan-500/30"
              title="Resize Height (Bottom)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "w")}
              className="absolute -left-1 top-2 bottom-2 w-2 cursor-ew-resize z-50 hover:bg-cyan-500/30"
              title="Resize Width (Left)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "e")}
              className="absolute -right-1 top-2 bottom-2 w-2 cursor-ew-resize z-50 hover:bg-cyan-500/30"
              title="Resize Width (Right)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "nw")}
              className="absolute -top-1 -left-1 w-3 h-3 cursor-nwse-resize z-50 hover:bg-cyan-500/40"
              title="Resize Corner (Top-Left)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "ne")}
              className="absolute -top-1 -right-1 w-3 h-3 cursor-nesw-resize z-50 hover:bg-cyan-500/40"
              title="Resize Corner (Top-Right)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "sw")}
              className="absolute -bottom-1 -left-1 w-3 h-3 cursor-nesw-resize z-50 hover:bg-cyan-500/40"
              title="Resize Corner (Bottom-Left)"
            />
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "se")}
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 cursor-nwse-resize z-50 flex items-end justify-end p-0.5 text-cyan-300/70 hover:text-cyan-200"
              title="Resize Corner (Bottom-Right)"
            >
              <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
                <circle cx="5" cy="5" r="1" />
                <circle cx="5" cy="2" r="1" />
                <circle cx="2" cy="5" r="1" />
              </svg>
            </div>
          </>
        )}

        {/* Title bar drag area */}
        <div
          onPointerDown={handlePointerDownDrag}
          className={`flex items-center justify-between gap-2 h-full ${
            isLocked ? "cursor-default" : isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          title={isLocked ? "Position Locked (Click Lock icon to unlock)" : "Drag to reposition minimized Pathway floating panel"}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md">
              <Route className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-xs truncate max-w-[120px]">
                  {activeCustomer ? activeCustomer.customerName : "Pathway Panel"}
                </span>
                {activeCustomer?.customerId && (
                  <span className="text-[10px] font-mono bg-blue-500/30 text-cyan-200 px-1 py-0.2 rounded border border-cyan-400/30">
                    {activeCustomer.customerId}
                  </span>
                )}
                {isLocked && (
                  <span className="text-[9px] bg-amber-500/30 text-amber-300 border border-amber-400/40 px-1 py-0.2 rounded flex items-center gap-0.5">
                    <Lock size={9} />
                    <span>Locked</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-cyan-200/80 truncate">
                <span className="truncate">{activeCustomer ? activeCustomer.serviceName : "No customer selected"}</span>
                {showDateTime && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="font-mono text-emerald-300 font-bold">{formattedTime}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons (non-draggable) */}
          <div className="flex items-center gap-1 shrink-0" data-no-drag>
            {/* Float Over Other Websites (PiP / Popout) */}
            <button
              type="button"
              onClick={launchAlwaysOnTopPiP}
              className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Float Over Other Websites & Tabs (Always On Top PiP)"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Switch Side Button (Left ↔ Right) */}
            <button
              type="button"
              onClick={handleSwitchSide}
              className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Switch Side (Move Left ↔ Right)"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>

            {/* Lock Toggle Button */}
            <button
              type="button"
              onClick={toggleLock}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLocked
                  ? "bg-amber-500/30 text-amber-300 border border-amber-400/40"
                  : "text-cyan-200 hover:text-white hover:bg-white/10"
              }`}
              title={isLocked ? "Window Locked (Click to Unlock)" : "Lock Window in Position"}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>

            {/* Expand / Restore Button */}
            <button
              type="button"
              onClick={restorePathway}
              className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Expand to Full Pathway Window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Close / Hide Button */}
            <button
              type="button"
              onClick={closePathway}
              className="p-1.5 text-red-300 hover:text-white hover:bg-red-600/80 rounded-lg transition-colors cursor-pointer"
              title={settings.closeBehavior === "tray" ? "Minimize to Tray" : "Close Pathway"}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Line */}
        {activeCustomer && (
          <div className="w-full bg-blue-950/60 rounded-full h-1 mt-1 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${activeCustomer.progressPercent ?? 30}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. NORMAL / MAXIMIZED STATE: Full Draggable & Resizable Desktop Window
  // =========================================================================
  const windowStyles: React.CSSProperties = isMaximized
    ? {
        position: "fixed",
        top: "10px",
        left: "10px",
        width: "calc(100vw - 20px)",
        height: "calc(100vh - 20px)",
        zIndex: 9999,
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }
    : {
        position: "fixed",
        top: `${windowPosition.y}px`,
        left: `${windowPosition.x}px`,
        width: `${windowSize.width}px`,
        height: `${windowSize.height}px`,
        zIndex: 9999,
        transition: isProgrammaticMove
          ? "left 0.25s cubic-bezier(0.16, 1, 0.3, 1), top 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s ease, height 0.2s ease"
          : isResizing
          ? "none"
          : "width 0.2s ease, height 0.2s ease",
      };

  return (
    <div
      ref={normalWindowRef}
      style={windowStyles}
      className={`flex flex-col bg-white rounded-2xl shadow-2xl border text-slate-800 overflow-hidden font-sans select-none backdrop-blur-xl relative ${
        isLocked
          ? "border-amber-400/60 shadow-amber-500/10"
          : "border-slate-300/80"
      } ${isMaximized ? "rounded-xl" : ""}`}
    >
      {/* =====================================================================
          MULTI-DIRECTIONAL RESIZE HANDLERS (All 8 Directions: N, S, E, W & Corners)
         ===================================================================== */}
      {!isLocked && !isMaximized && (
        <>
          {/* North (Top edge) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "n")}
            className="absolute -top-1.5 left-3 right-3 h-3.5 cursor-ns-resize z-50 hover:bg-cyan-500/30 active:bg-cyan-500/60 transition-colors"
            title="Stretch window upward"
          />
          {/* South (Bottom edge) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "s")}
            className="absolute -bottom-1.5 left-3 right-3 h-3.5 cursor-ns-resize z-50 hover:bg-cyan-500/30 active:bg-cyan-500/60 transition-colors"
            title="Stretch window downward"
          />
          {/* West (Left edge) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "w")}
            className="absolute -left-1.5 top-3 bottom-3 w-3.5 cursor-ew-resize z-50 hover:bg-cyan-500/30 active:bg-cyan-500/60 transition-colors"
            title="Stretch window leftward"
          />
          {/* East (Right edge) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "e")}
            className="absolute -right-1.5 top-3 bottom-3 w-3.5 cursor-ew-resize z-50 hover:bg-cyan-500/30 active:bg-cyan-500/60 transition-colors"
            title="Stretch window rightward"
          />
          {/* North-West (Top-Left corner) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "nw")}
            className="absolute -top-2 -left-2 w-5 h-5 cursor-nwse-resize z-50 hover:bg-cyan-500/40 active:bg-cyan-500/70 transition-colors rounded-tl"
            title="Stretch diagonally (Top-Left)"
          />
          {/* North-East (Top-Right corner) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "ne")}
            className="absolute -top-2 -right-2 w-5 h-5 cursor-nesw-resize z-50 hover:bg-cyan-500/40 active:bg-cyan-500/70 transition-colors rounded-tr"
            title="Stretch diagonally (Top-Right)"
          />
          {/* South-West (Bottom-Left corner) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "sw")}
            className="absolute -bottom-2 -left-2 w-5 h-5 cursor-nesw-resize z-50 hover:bg-cyan-500/40 active:bg-cyan-500/70 transition-colors rounded-bl"
            title="Stretch diagonally (Bottom-Left)"
          />
          {/* South-East (Bottom-Right corner) */}
          <div
            onPointerDown={(e) => handlePointerDownResize(e, "se")}
            className="absolute -bottom-2 -right-2 w-5 h-5 cursor-nwse-resize z-50 hover:bg-cyan-500/40 active:bg-cyan-500/70 transition-colors rounded-br"
            title="Stretch diagonally (Bottom-Right)"
          />
        </>
      )}

      {/* =====================================================================
          DEDICATED TITLE BAR (Draggable, with Window Controls & Lock Option)
         ===================================================================== */}
      <div
        onPointerDown={handlePointerDownDrag}
        onDoubleClick={toggleFullHeight}
        className={`bg-gradient-to-r from-[#022349] via-[#032e60] to-[#044085] text-white px-3.5 py-2.5 flex items-center justify-between border-b border-[#1e4b75] shrink-0 select-none ${
          isLocked || isMaximized ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
        title={
          isLocked
            ? "Pathway Window Locked in Position (Click Lock icon to unlock)"
            : isMaximized
            ? "Pathway Desktop Window (Maximized)"
            : "Drag to move • Double-click to toggle Full Screen Height"
        }
      >
        {/* Brand & Active Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center shrink-0 shadow-sm">
            <Route className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              Pathway
              <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-1.5 py-0.2 rounded">
                Dossier
              </span>
            </span>

            {/* Position Lock Status Badge */}
            {isLocked && (
              <span className="text-[10px] bg-amber-500/25 text-amber-300 border border-amber-400/40 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1 shadow-xs animate-in fade-in duration-200">
                <Lock size={10} className="text-amber-300" />
                <span>Locked</span>
              </span>
            )}

            <span className="text-white/30 hidden sm:inline">•</span>
            <span className="text-xs text-blue-200/90 truncate hidden sm:inline font-medium">
              {activeCustomer ? `${activeCustomer.customerName}` : "Customer Window"}
            </span>
          </div>
        </div>

        {/* Customer Quick Selector & Window Action Buttons (Non-draggable) */}
        <div className="flex items-center gap-1.5 shrink-0" data-no-drag>
          {/* Website Tab Switcher Pill & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTabSwitcherDropdown(!showTabSwitcherDropdown);
                setShowCustomerDropdown(false);
                setShowSettingsPopover(false);
              }}
              className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 rounded-lg text-xs font-semibold border border-cyan-400/30 transition-colors cursor-pointer"
              title={`Active Tab: ${currentTabLabel} • Click to switch website tab`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden lg:inline max-w-[100px] truncate">{currentTabLabel}</span>
              <ChevronDown className="w-3 h-3 text-cyan-300" />
            </button>

            {showTabSwitcherDropdown && (
              <div
                className="absolute right-0 mt-1.5 w-60 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Switch Website Tab</span>
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded">Tabs</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar mt-1">
                  {ADMIN_NAVIGATION_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        switchTab(tab.path);
                        setShowTabSwitcherDropdown(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                        currentTab === tab.key
                          ? "bg-blue-50 text-blue-700 font-bold border border-blue-200"
                          : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span>{tab.label}</span>
                      {currentTab === tab.key && (
                        <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.2 rounded">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Customer Switcher Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowCustomerDropdown(!showCustomerDropdown);
                setShowTabSwitcherDropdown(false);
                setShowSettingsPopover(false);
              }}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 text-cyan-100 rounded-lg text-xs font-medium transition-colors border border-white/10 cursor-pointer"
              title="Switch Active Customer"
            >
              <User className="w-3.5 h-3.5 text-cyan-300" />
              <span className="hidden md:inline max-w-[100px] truncate">
                {activeCustomer ? activeCustomer.customerName : "Select Customer"}
              </span>
              <ChevronDown className="w-3 h-3 text-cyan-300" />
            </button>

            {/* Customer Switcher Dropdown */}
            {showCustomerDropdown && (
              <div
                className="absolute right-0 mt-1.5 w-72 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50 p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, ID, or phone..."
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800"
                    autoFocus
                  />
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1 custom-scrollbar">
                  {filteredCustomers.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No matching customers found
                    </div>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          selectCustomer(c);
                          setShowCustomerDropdown(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          activeCustomer?.id === c.id
                            ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="font-semibold text-slate-900 truncate">
                            {c.customerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {c.customerId} • {c.serviceName}
                          </div>
                        </div>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                            c.applicationStatus === "Completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {c.applicationStatus}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={refreshPathwayData}
            disabled={isLoading}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Refresh Customer Data from Website"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {/* Lock Window Position Toggle Button */}
          <button
            type="button"
            onClick={toggleLock}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isLocked
                ? "bg-amber-500/30 text-amber-300 border border-amber-400/50 shadow-xs ring-1 ring-amber-400/30"
                : "text-cyan-200 hover:text-white hover:bg-white/10"
            }`}
            title={
              isLocked
                ? "Window Position Locked (Click to Unlock for dragging & resizing)"
                : "Lock Window in Current Position"
            }
          >
            {isLocked ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Date & Time Toggle Button */}
          <button
            type="button"
            onClick={toggleDateTime}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              showDateTime
                ? "bg-cyan-500/20 text-cyan-200 border border-cyan-400/30"
                : "text-white/40 hover:text-white hover:bg-white/10"
            }`}
            title={showDateTime ? "Hide Live Date & Time Ribbon" : "Show Live Date & Time Ribbon"}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>

          {/* Settings Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSettingsPopover(!showSettingsPopover)}
              className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Pathway Window Settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {showSettingsPopover && (
              <div
                className="absolute right-0 mt-1.5 w-64 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50 p-3 text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-bold text-slate-900 mb-2 border-b border-slate-100 pb-1.5 flex items-center justify-between">
                  <span>Window Settings</span>
                  <button
                    onClick={() => setShowSettingsPopover(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Close Button Action:
                    </label>
                    <select
                      value={settings.closeBehavior}
                      onChange={(e) =>
                        updateSettings({ closeBehavior: e.target.value as "tray" | "exit" })
                      }
                      className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                    >
                      <option value="tray">Minimize to System Tray (Recommended)</option>
                      <option value="exit">Completely Exit / Close</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={toggleLock}
                      className="rounded text-amber-600"
                    />
                    <span className="text-[11px] font-medium text-slate-700">
                      Lock Window in Current Position
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDateTime}
                      onChange={toggleDateTime}
                      className="rounded text-blue-600"
                    />
                    <span className="text-[11px] font-medium text-slate-700">
                      Show Live Date & Time Ribbon
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.rememberPerTabPosition ?? true}
                      onChange={(e) =>
                        updateSettings({ rememberPerTabPosition: e.target.checked })
                      }
                      className="rounded text-blue-600"
                    />
                    <span className="text-[11px] font-medium text-slate-700">
                      Remember position per tab (Auto-switch)
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoExpandOnCustomerSelect}
                      onChange={(e) =>
                        updateSettings({ autoExpandOnCustomerSelect: e.target.checked })
                      }
                      className="rounded text-blue-600"
                    />
                    <span className="text-[11px] text-slate-700">
                      Auto-expand when customer clicked
                    </span>
                  </label>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Tab: {currentTabLabel}</span>
                    <button
                      type="button"
                      onClick={() => resetTabPosition(currentTab)}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                      title="Reset this tab's window position to default"
                    >
                      Reset Tab Position
                    </button>
                  </div>

                  {/* Access on Other Websites & Government Portals */}
                  <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe size={12} className="text-blue-600" />
                      <span>Use on Other Websites & Portals</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsPopover(false);
                        launchAlwaysOnTopPiP();
                      }}
                      className="w-full p-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ExternalLink size={12} />
                      <span>Float Over Other Websites (PiP)</span>
                    </button>

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <a
                        href={bookmarkletCode}
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText(bookmarkletCode);
                          setCopiedBookmarklet(true);
                          setTimeout(() => setCopiedBookmarklet(false), 2000);
                        }}
                        className="flex-1 p-1 bg-slate-100 hover:bg-slate-200 text-blue-700 border border-slate-300 rounded text-[10px] font-bold text-center cursor-grab active:cursor-grabbing truncate"
                        title="Drag to your Bookmarks Bar (or click to copy code)"
                      >
                        {copiedBookmarklet ? "✓ Copied Link" : "📍 Drag Bookmarklet"}
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          window.open(
                            "/admin/pathway/popout",
                            "AirnetPathwayCompanion",
                            "width=520,height=700,status=no,toolbar=no,menubar=no,scrollbars=yes"
                          );
                        }}
                        className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-[10px] font-semibold cursor-pointer"
                        title="Open in Independent Popout Window"
                      >
                        Popout
                      </button>
                    </div>

                    <div className="text-[9px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200 leading-tight">
                      <strong>Extension:</strong> Load <code className="text-slate-700 font-bold">extensions/pathway-chrome-extension</code> in Chrome to access via <kbd className="bg-slate-200 px-1 py-0.2 rounded font-mono">Alt+P</kbd>.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Float Over Other Websites Button (PiP / Popout) */}
          <button
            type="button"
            onClick={launchAlwaysOnTopPiP}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Float Over Other Websites & Tabs (Always On Top PiP / Popout)"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Switch Side Button (Left ↔ Right Position) */}
          <button
            type="button"
            onClick={handleSwitchSide}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Switch Side (Move Window Left ↔ Right)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>

          {/* Full Screen Height Snap / Stretch Button */}
          <button
            type="button"
            onClick={toggleFullHeight}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isFullHeight
                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/40"
                : "text-cyan-200 hover:text-white hover:bg-white/10"
            }`}
            title={isFullHeight ? "Restore Window Height" : "Expand Upward to Full Screen Height (or double-click title bar)"}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>

          {/* Minimize Button */}
          <button
            type="button"
            onClick={minimizePathway}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Minimize to Compact Floating Panel"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* Maximize / Restore Button */}
          <button
            type="button"
            onClick={maximizePathway}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title={isMaximized ? "Restore Window Size" : "Maximize to Desktop Workspace"}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={closePathway}
            className="p-1.5 text-red-300 hover:text-white hover:bg-red-600/90 rounded-lg transition-colors cursor-pointer"
            title={settings.closeBehavior === "tray" ? "Hide to System Tray" : "Exit Pathway"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          LIVE DATE & TIME STATUS RIBBON (Interactive & Option-Driven)
         ===================================================================== */}
      {showDateTime && (
        <div className="bg-[#021c3b] border-b border-blue-900/40 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-cyan-100 shrink-0 select-none animate-in fade-in duration-200">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-cyan-200">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-white">{formattedDate}</span>
            </div>
            <span className="text-white/30 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md shadow-2xs">
              <Clock className="w-3 h-3 text-emerald-400 shrink-0 animate-pulse" />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isLocked ? (
              <button
                type="button"
                onClick={toggleLock}
                className="flex items-center gap-1 text-[10px] bg-amber-500/25 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider cursor-pointer transition-colors"
                title="Position is locked. Click to unlock."
              >
                <Lock className="w-2.5 h-2.5" />
                <span>Locked Position</span>
              </button>
            ) : (
              <span className="text-[10px] text-cyan-300/80 font-medium hidden sm:inline">
                ↔ 8-Direction Stretch Ready
              </span>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          CUSTOMER PROFILE & WORKING SERVICE HERO HEADER
         ===================================================================== */}
      {activeCustomer ? (
        <div className="bg-slate-50 border-b border-slate-200 p-3.5 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Left: Customer Name, ID, Service */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {activeCustomer.customerName}
                </h3>
                <span className="bg-blue-100 text-blue-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-blue-200 flex items-center gap-1">
                  <span>ID:</span>
                  <span>{activeCustomer.customerId}</span>
                  <button
                    onClick={() => handleCopy(activeCustomer.customerId, "id")}
                    className="hover:text-blue-900"
                    title="Copy Customer ID"
                  >
                    {copiedField === "id" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    activeCustomer.applicationStatus === "Completed"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : activeCustomer.applicationStatus === "In Progress"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : activeCustomer.applicationStatus === "Rejected"
                      ? "bg-red-100 text-red-800 border border-red-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}
                >
                  {activeCustomer.applicationStatus || "Active"}
                </span>
              </div>

              {/* Working Service Highlight */}
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 flex-wrap">
                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {activeCustomer.serviceName}
                </span>

                {activeCustomer.mobileNumber && (
                  <div className="flex items-center gap-1 font-mono text-slate-700">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{activeCustomer.mobileNumber}</span>
                    <button
                      onClick={() => handleCopy(activeCustomer.mobileNumber, "phone")}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy Mobile Number"
                    >
                      {copiedField === "phone" ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                    <a
                      href={`https://wa.me/91${activeCustomer.mobileNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700 ml-1"
                      title="Chat on WhatsApp"
                    >
                      <MessageCircle size={13} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Progress Meter */}
            <div className="sm:text-right shrink-0">
              <div className="text-xs text-slate-500 font-medium">Processing Status</div>
              <div className="text-lg font-extrabold text-[#032e60]">
                {activeCustomer.progressPercent ?? 20}%
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${activeCustomer.progressPercent ?? 20}%` }}
            />
          </div>

          {/* Current Step Banner */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
            <span className="font-semibold text-slate-500 uppercase tracking-wide text-[10px]">
              Current Stage:
            </span>
            <span className="font-bold text-slate-800 truncate ml-2">
              {activeCustomer.currentStep || "Application Received"}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center bg-slate-50 border-b border-slate-200">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-slate-800">No Customer Selected</h4>
          <p className="text-xs text-slate-500 mt-1">
            Use the customer switcher dropdown above or click &ldquo;Pathway&rdquo; on any customer in
            Application Tracker, Records, or Enquiries.
          </p>
        </div>
      )}

      {/* =====================================================================
          TAB NAVIGATION
         ===================================================================== */}
      <div className="flex border-b border-slate-200 bg-white px-3.5 pt-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("flow")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "flow"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Stage Pathway</span>
          {activeCustomer?.steps && (
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full font-semibold">
              {activeCustomer.steps.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "details"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Application Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "documents"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Documents</span>
          {activeCustomer?.documents && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-semibold">
              {activeCustomer.documents.length}
            </span>
          )}
        </button>
      </div>

      {/* =====================================================================
          SCROLLABLE TAB CONTENT AREA
         ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
        {activeCustomer ? (
          <>
            {/* TAB 1: STAGE PATHWAY (Visual Step Pipeline) */}
            {activeTab === "flow" && (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                  <span>Application Processing Pipeline</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {activeCustomer.steps?.filter((s) => s.status === "completed").length || 0} of{" "}
                    {activeCustomer.steps?.length || 0} steps completed
                  </span>
                </div>

                {activeCustomer.steps && activeCustomer.steps.length > 0 ? (
                  <div className="space-y-2.5 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {activeCustomer.steps.map((step, idx) => {
                      const isCompleted = step.status === "completed";
                      const isInProgress = step.status === "in-progress";
                      const isRejected = step.status === "rejected";

                      return (
                        <div
                          key={step.id || idx}
                          className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all ${
                            isCompleted
                              ? "bg-white border-emerald-200 shadow-2xs"
                              : isInProgress
                              ? "bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-300/50"
                              : isRejected
                              ? "bg-red-50 border-red-200"
                              : "bg-white/80 border-slate-200 text-slate-400"
                          }`}
                        >
                          {/* Step status icon */}
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${
                              isCompleted
                                ? "bg-emerald-500 text-white shadow-sm"
                                : isInProgress
                                ? "bg-blue-600 text-white animate-pulse"
                                : isRejected
                                ? "bg-red-500 text-white"
                                : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : isInProgress ? (
                              <Clock className="w-4 h-4" />
                            ) : (
                              <span className="text-xs font-bold">{idx + 1}</span>
                            )}
                          </div>

                          {/* Step content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h5
                                className={`text-xs font-bold ${
                                  isCompleted
                                    ? "text-emerald-900"
                                    : isInProgress
                                    ? "text-blue-900"
                                    : "text-slate-700"
                                }`}
                              >
                                {step.title}
                              </h5>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                                  isCompleted
                                    ? "bg-emerald-100 text-emerald-800"
                                    : isInProgress
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {step.status}
                              </span>
                            </div>

                            {step.note && (
                              <p className="text-[11px] text-slate-600 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100">
                                {step.note}
                              </p>
                            )}

                            {step.completedAt && (
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3" />
                                <span>Completed: {new Date(step.completedAt).toLocaleString("en-IN")}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                    No custom processing steps defined for this customer service.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: APPLICATION DETAILS */}
            {activeTab === "details" && (
              <div className="space-y-3.5">
                {/* Meta details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Application / Acknowledgement Number */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Application / Ack No.
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-xs text-slate-900 truncate">
                        {activeCustomer.applicationNumber || "Pending Generation"}
                      </span>
                      {activeCustomer.applicationNumber && (
                        <button
                          onClick={() =>
                            handleCopy(activeCustomer.applicationNumber!, "appNum")
                          }
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="Copy Application Number"
                        >
                          {copiedField === "appNum" ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Portal URL */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Official Portal
                    </span>
                    <div className="mt-1">
                      {activeCustomer.applyUrl ? (
                        <a
                          href={activeCustomer.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline truncate max-w-full"
                        >
                          <span>Open Portal</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Direct Dept Link</span>
                      )}
                    </div>
                  </div>

                  {/* Assigned Staff */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Assigned Staff
                    </span>
                    <span className="font-semibold text-xs text-slate-800 mt-1 block">
                      {activeCustomer.assignedStaff || "Admin Operator"}
                    </span>
                  </div>

                  {/* Priority & Target Date */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Priority & Target
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          activeCustomer.priority === "Urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {activeCustomer.priority || "Normal"}
                      </span>
                      {activeCustomer.targetDate && (
                        <span className="text-xs text-slate-600 font-mono">
                          {activeCustomer.targetDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Payment & Fee Breakdown</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold">Total</span>
                      <span className="text-xs font-bold text-slate-800">
                        ₹{activeCustomer.amountCharged ?? (activeCustomer.amountPaid || 0) + (activeCustomer.amountPending || 0)}
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      <span className="text-[10px] text-emerald-600 block font-semibold">Paid</span>
                      <span className="text-xs font-bold text-emerald-700">
                        ₹{activeCustomer.amountPaid || 0}
                      </span>
                    </div>
                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                      <span className="text-[10px] text-amber-600 block font-semibold">Pending</span>
                      <span className="text-xs font-bold text-amber-700">
                        ₹{activeCustomer.amountPending || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {activeCustomer.notes && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                      Customer / Service Notes
                    </span>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">
                      {activeCustomer.notes}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DOCUMENTS */}
            {activeTab === "documents" && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wide">
                  <span>Attached Customer Documents</span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {activeCustomer.documents?.length || 0} files found
                  </span>
                </div>

                {activeCustomer.documents && activeCustomer.documents.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeCustomer.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-semibold text-slate-800 truncate block">
                              {doc.fileName}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {doc.category || "Document"} •{" "}
                              {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : ""}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono shrink-0">
                          Google Drive
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                    <FolderOpen className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    No uploaded documents linked to this customer ID yet.
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* =====================================================================
          FOOTER (Protected Integration Banner & Multi-Direction Indicator)
         ===================================================================== */}
      <div className="bg-slate-100 border-t border-slate-200 px-3.5 py-2 flex items-center justify-between text-[11px] text-slate-500 shrink-0 select-none">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="font-semibold text-slate-600">
            Secure Read-Only Integration
          </span>
          <span className="text-slate-400 hidden sm:inline">
            (Website records protected & unmodified)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
              <Lock size={10} />
              <span>Locked</span>
            </span>
          ) : !isMaximized ? (
            <div
              onPointerDown={(e) => handlePointerDownResize(e, "se")}
              className="w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 text-slate-400 hover:text-cyan-600 transition-colors"
              title="Drag corner to resize both directions"
            >
              <svg viewBox="0 0 6 6" className="w-3 h-3 fill-current">
                <circle cx="5" cy="5" r="1" />
                <circle cx="5" cy="2" r="1" />
                <circle cx="2" cy="5" r="1" />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
