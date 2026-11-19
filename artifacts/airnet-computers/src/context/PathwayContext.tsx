import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useLiveSync } from "../hooks/useLiveSync";

export type AdminTab = {
  key: string;
  label: string;
  path: string;
};

export const ADMIN_NAVIGATION_TABS: AdminTab[] = [
  { key: "dashboard", label: "Dashboard", path: "/admin/dashboard" },
  { key: "pathway", label: "Pathway Hub", path: "/admin/pathway" },
  { key: "tracker", label: "Application Tracker", path: "/admin/tracker" },
  { key: "enquiries", label: "My Enquiry List", path: "/admin/enquiries" },
  { key: "records", label: "Customer Records", path: "/admin/records" },
  { key: "services", label: "Manage Services", path: "/admin/services" },
  { key: "government-services", label: "Govt Services", path: "/admin/government-services" },
  { key: "documents", label: "Documents", path: "/admin/documents" },
  { key: "reports", label: "Reports", path: "/admin/reports" },
  { key: "daily-reports", label: "Reminder", path: "/admin/daily-reports" },
  { key: "backup", label: "Backup", path: "/admin/backup" },
  { key: "notifications", label: "Notifications", path: "/admin/notifications" },
  { key: "settings", label: "Settings", path: "/admin/settings" },
];

export function getTabKeyFromPath(path: string): string {
  if (!path || path === "/" || !path.startsWith("/admin")) return "home";
  const segment = path.replace(/^\/admin\/?/, "").split("/")[0] || "dashboard";
  return segment || "dashboard";
}

export function getTabLabel(key: string): string {
  const match = ADMIN_NAVIGATION_TABS.find((t) => t.key === key);
  return match ? match.label : key.charAt(0).toUpperCase() + key.slice(1);
}

export type PathwayStep = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending" | "rejected";
  completedAt?: string | null;
  note?: string;
};

export type PathwayDocument = {
  id: number;
  fileName: string;
  fileExtension?: string;
  fileSize: number;
  category?: string;
  uploadedAt: string;
  driveFileId?: string;
};

export type PathwayCustomer = {
  id: string | number; // unique key, e.g. "task-1" or "enq-2" or "rec-3"
  taskId?: number;
  enquiryId?: number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  applicationStatus?: string;
  status?: string;
  currentStep?: string;
  progressPercent?: number;
  steps?: PathwayStep[];
  applicationNumber?: string | null;
  applyUrl?: string | null;
  priority?: string;
  targetDate?: string | null;
  assignedStaff?: string | null;
  paymentType?: string;
  amountCharged?: number;
  amountPaid?: number;
  amountPending?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  source?: "tracker" | "enquiry" | "record";
  documents?: PathwayDocument[];
  documentsCount?: number;
};

export type PathwaySettings = {
  closeBehavior: "tray" | "exit"; // 'tray' hides to system tray, 'exit' completely closes
  snapToEdges: boolean;
  autoExpandOnCustomerSelect: boolean;
  alwaysOnTop: boolean;
  rememberPerTabPosition: boolean; // Auto-switch and remember position per tab
};

interface PathwayContextType {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  isClosedToTray: boolean;
  isLocked: boolean;
  showDateTime: boolean;
  activeCustomer: PathwayCustomer | null;
  customers: PathwayCustomer[];
  isLoading: boolean;
  windowPosition: { x: number; y: number };
  windowSize: { width: number; height: number };
  minimizedSize: { width: number; height: number };
  settings: PathwaySettings;
  currentTab: string;
  currentTabLabel: string;
  openPathway: (customerOrId?: any) => void;
  closePathway: () => void;
  minimizePathway: () => void;
  maximizePathway: () => void;
  restorePathway: () => void;
  toggleLock: () => void;
  toggleDateTime: () => void;
  selectCustomer: (customerOrId: any) => void;
  refreshPathwayData: () => Promise<void>;
  updateSettings: (newSettings: Partial<PathwaySettings>) => void;
  setWindowPosition: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  setWindowSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  setMinimizedSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>;
  switchSide: () => void;
  switchTab: (pathOrKey: string) => void;
  resetTabPosition: (tabKey?: string) => void;
}

const DEFAULT_SETTINGS: PathwaySettings = {
  closeBehavior: "tray",
  snapToEdges: true,
  autoExpandOnCustomerSelect: true,
  alwaysOnTop: true,
  rememberPerTabPosition: true,
};

const DEFAULT_WINDOW_SIZE = { width: 560, height: 640 };
const DEFAULT_MINIMIZED_SIZE = { width: 360, height: 72 };

const PathwayContext = createContext<PathwayContextType | undefined>(undefined);

export function PathwayProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const currentTab = getTabKeyFromPath(location);
  const currentTabLabel = getTabLabel(currentTab);
  const tabSessionId = useRef<string>(Math.random().toString(36).substring(2));

  // Lock Window Position & Resizing State across all pages / sessions
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem("airnet_pathway_locked") === "true";
      } catch {}
    }
    return false;
  });

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedLocked = localStorage.getItem("airnet_pathway_locked") === "true";
        if (savedLocked) return true; // Always visible in each and every tab when locked!
        const savedOpen = localStorage.getItem("airnet_pathway_open");
        return savedOpen !== null ? savedOpen === "true" : false;
      } catch {}
    }
    return false;
  });

  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isClosedToTray, setIsClosedToTray] = useState<boolean>(false);
  const [activeCustomer, setActiveCustomer] = useState<PathwayCustomer | null>(null);
  const [customers, setCustomers] = useState<PathwayCustomer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Responsive default position (clamped safely inside viewport, allowing top: 0 for full height)
  const [windowPosition, setWindowPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const tabKey = getTabKeyFromPath(window.location.pathname);
        const savedTabPos = localStorage.getItem(`airnet_pathway_pos_${tabKey}`);
        const saved = savedTabPos || localStorage.getItem("airnet_pathway_pos");
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            x: Math.max(0, Math.min(window.innerWidth - 300, parsed.x ?? 60)),
            y: Math.max(0, Math.min(window.innerHeight - 100, parsed.y ?? 20)),
          };
        }
      } catch {}
      // Default to right side of screen
      const defaultX = Math.max(20, window.innerWidth - 600);
      const defaultY = 0; // Starts from top edge to allow full height usage
      return { x: defaultX, y: defaultY };
    }
    return { x: 100, y: 0 };
  });

  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("airnet_pathway_size");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_WINDOW_SIZE;
  });

  // User-resizable length & width when minimized!
  const [minimizedSize, setMinimizedSize] = useState<{ width: number; height: number }>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("airnet_pathway_min_size");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_MINIMIZED_SIZE;
  });

  const [settings, setSettings] = useState<PathwaySettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("airnet_pathway_settings");
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_SETTINGS;
  });

  // Live Date and Time Display Option in Pathway Window
  const [showDateTime, setShowDateTime] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("airnet_pathway_datetime");
        return saved !== null ? saved === "true" : true;
      } catch {}
    }
    return true;
  });

  // Refs for tracking position & minimize state when switching tabs
  const windowPositionRef = useRef(windowPosition);
  useEffect(() => {
    windowPositionRef.current = windowPosition;
  }, [windowPosition]);

  const isMinimizedRef = useRef(isMinimized);
  useEffect(() => {
    isMinimizedRef.current = isMinimized;
  }, [isMinimized]);

  const prevTabRef = useRef<string>(currentTab);

  // Tab-Switching Effect: Switch & remember position per tab
  useEffect(() => {
    const oldTab = prevTabRef.current;
    if (oldTab !== currentTab) {
      if (settings.rememberPerTabPosition) {
        // 1. Save previous tab's position & minimized state
        try {
          localStorage.setItem(`airnet_pathway_pos_${oldTab}`, JSON.stringify(windowPositionRef.current));
          localStorage.setItem(`airnet_pathway_min_${oldTab}`, String(isMinimizedRef.current));
        } catch {}

        // 2. Load position & minimized state for the new tab
        try {
          const savedNew = localStorage.getItem(`airnet_pathway_pos_${currentTab}`);
          if (savedNew) {
            const parsed = JSON.parse(savedNew);
            const curW = isMinimizedRef.current ? minimizedSize.width : windowSize.width;
            const curH = isMinimizedRef.current ? minimizedSize.height : windowSize.height;
            const maxX = Math.max(0, window.innerWidth - curW);
            const maxY = Math.max(0, window.innerHeight - curH);
            setWindowPosition({
              x: Math.max(0, Math.min(maxX, parsed.x ?? 20)),
              y: Math.max(0, Math.min(maxY, parsed.y ?? 0)),
            });
          }
          const savedMin = localStorage.getItem(`airnet_pathway_min_${currentTab}`);
          if (savedMin !== null) {
            setIsMinimized(savedMin === "true");
          }
        } catch {}
      }
      prevTabRef.current = currentTab;
    }
  }, [currentTab, settings.rememberPerTabPosition, windowSize, minimizedSize]);

  // Persist position & sizes to localStorage and broadcast across browser tabs
  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_pos", JSON.stringify(windowPosition));
      if (settings.rememberPerTabPosition && currentTab) {
        localStorage.setItem(`airnet_pathway_pos_${currentTab}`, JSON.stringify(windowPosition));
      }
      const channel = new BroadcastChannel("airnet_pathway_channel");
      channel.postMessage({
        type: "SYNC_POS",
        pos: windowPosition,
        tab: currentTab,
        senderId: tabSessionId.current,
      });
      channel.close();
    } catch {}
  }, [windowPosition, currentTab, settings.rememberPerTabPosition]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_size", JSON.stringify(windowSize));
    } catch {}
  }, [windowSize]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_min_size", JSON.stringify(minimizedSize));
    } catch {}
  }, [minimizedSize]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_locked", String(isLocked));
    } catch {}
  }, [isLocked]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_datetime", String(showDateTime));
    } catch {}
  }, [showDateTime]);

  useEffect(() => {
    try {
      localStorage.setItem("airnet_pathway_open", String(isOpen));
    } catch {}
  }, [isOpen]);

  // Cross-browser tab real-time synchronization
  useEffect(() => {
    if (typeof window === "undefined") return;

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("airnet_pathway_channel");
      channel.onmessage = (event) => {
        const data = event.data;
        if (!data) return;

        // Ignore messages sent by our own tab session
        if (data.senderId === tabSessionId.current) return;

        if (data.type === "SYNC_POS" && data.pos) {
          if (!settings.rememberPerTabPosition || data.tab === currentTab) {
            setWindowPosition((prev) => {
              if (Math.abs(prev.x - data.pos.x) < 1 && Math.abs(prev.y - data.pos.y) < 1) {
                return prev;
              }
              return data.pos;
            });
          }
        } else if (data.type === "SYNC_STATE") {
          if (data.isOpen !== undefined) setIsOpen(data.isOpen);
          if (data.isMinimized !== undefined) setIsMinimized(data.isMinimized);
          if (data.isMaximized !== undefined) setIsMaximized(data.isMaximized);
          if (data.isLocked !== undefined) setIsLocked(data.isLocked);
          if (data.activeCustomer !== undefined) setActiveCustomer(data.activeCustomer);
          if (data.windowSize) setWindowSize(data.windowSize);
          if (data.minimizedSize) setMinimizedSize(data.minimizedSize);
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || !e.newValue) return;
      try {
        if (e.key === `airnet_pathway_pos_${currentTab}` || e.key === "airnet_pathway_pos") {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
            setWindowPosition((prev) => {
              if (Math.abs(prev.x - parsed.x) < 1 && Math.abs(prev.y - parsed.y) < 1) {
                return prev;
              }
              return parsed;
            });
          }
        } else if (e.key === "airnet_pathway_open") {
          setIsOpen(e.newValue === "true");
        } else if (e.key === "airnet_pathway_locked") {
          setIsLocked(e.newValue === "true");
        }
      } catch {}
    };

    window.addEventListener("storage", handleStorage);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        try {
          const savedPos =
            (settings.rememberPerTabPosition && localStorage.getItem(`airnet_pathway_pos_${currentTab}`)) ||
            localStorage.getItem("airnet_pathway_pos");
          if (savedPos) {
            const parsed = JSON.parse(savedPos);
            if (parsed && typeof parsed.x === "number" && typeof parsed.y === "number") {
              setWindowPosition((prev) => {
                if (Math.abs(prev.x - parsed.x) < 1 && Math.abs(prev.y - parsed.y) < 1) {
                  return prev;
                }
                return parsed;
              });
            }
          }
          const savedOpen = localStorage.getItem("airnet_pathway_open");
          if (savedOpen !== null) {
            setIsOpen(savedOpen === "true");
          }
          const savedLock = localStorage.getItem("airnet_pathway_locked");
          if (savedLock !== null) {
            setIsLocked(savedLock === "true");
          }
        } catch {}
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      if (channel) {
        try { channel.close(); } catch {}
      }
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [currentTab, settings.rememberPerTabPosition]);

  // One-Click Switch Side: Flips between Left and Right side of screen
  const switchSide = useCallback(() => {
    const curW = isMinimized ? minimizedSize.width : windowSize.width;
    const curH = isMinimized ? minimizedSize.height : windowSize.height;
    const maxX = Math.max(0, window.innerWidth - curW);
    const maxY = Math.max(0, window.innerHeight - curH);

    setWindowPosition((prev) => {
      const isRight = prev.x > window.innerWidth / 2 - curW / 2;
      const targetX = isRight ? 20 : Math.max(20, maxX - 20);
      const targetY = Math.max(0, Math.min(maxY, prev.y));
      const nextPos = { x: targetX, y: targetY };

      try {
        localStorage.setItem("airnet_pathway_pos", JSON.stringify(nextPos));
        if (settings.rememberPerTabPosition && currentTab) {
          localStorage.setItem(`airnet_pathway_pos_${currentTab}`, JSON.stringify(nextPos));
        }
        const channel = new BroadcastChannel("airnet_pathway_channel");
        channel.postMessage({ type: "SYNC_POS", pos: nextPos, tab: currentTab });
        channel.close();
      } catch {}

      return nextPos;
    });
  }, [isMinimized, minimizedSize, windowSize, currentTab, settings.rememberPerTabPosition]);

  // Switch to another Admin Tab directly from Pathway
  const switchTab = useCallback(
    (tabPathOrKey: string) => {
      if (typeof window === "undefined") return;
      let targetPath = tabPathOrKey;
      if (!tabPathOrKey.startsWith("/")) {
        const match = ADMIN_NAVIGATION_TABS.find((t) => t.key === tabPathOrKey);
        targetPath = match ? match.path : `/admin/${tabPathOrKey}`;
      }
      setLocation(targetPath);
    },
    [setLocation]
  );

  // Reset tab position to default
  const resetTabPosition = useCallback(
    (tabKey?: string) => {
      const targetKey = tabKey || currentTab;
      try {
        localStorage.removeItem(`airnet_pathway_pos_${targetKey}`);
        localStorage.removeItem(`airnet_pathway_min_${targetKey}`);
      } catch {}
      const defaultX = Math.max(20, window.innerWidth - 600);
      const defaultY = 0;
      setWindowPosition({ x: defaultX, y: defaultY });
    },
    [currentTab]
  );

  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      if (next) {
        setIsOpen(true);
        setIsClosedToTray(false);
      }
      return next;
    });
  }, []);

  const toggleDateTime = useCallback(() => {
    setShowDateTime((prev) => !prev);
  }, []);

  // Keep window clamped within available screen boundaries on display scaling / multi-monitor resize
  useEffect(() => {
    const handleResize = () => {
      if (isLocked) return;
      setWindowPosition((prev) => {
        const currentW = isMinimized ? minimizedSize.width : windowSize.width;
        const currentH = isMinimized ? minimizedSize.height : windowSize.height;
        const maxX = Math.max(0, window.innerWidth - currentW);
        const maxY = Math.max(0, window.innerHeight - currentH);
        return {
          x: Math.max(0, Math.min(maxX, prev.x)),
          y: Math.max(0, Math.min(maxY, prev.y)),
        };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isLocked, isMinimized, windowSize, minimizedSize]);

  // Fetch pathway customers from secure backend API (Read-only)
  const refreshPathwayData = useCallback(async () => {
    try {
      setIsLoading(true);
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/pathway/customers", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const list: PathwayCustomer[] = data.customers || [];
        setCustomers(list);

        // Update activeCustomer if already selected
        setActiveCustomer((curr) => {
          if (!curr) return list[0] || null;
          const updated = list.find(
            (c) => c.id === curr.id || (c.customerId && c.customerId === curr.customerId && c.serviceName === curr.serviceName)
          );
          return updated || curr;
        });
      }
    } catch (err) {
      console.error("[Pathway] Failed to load pathway customers:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshPathwayData();
  }, [refreshPathwayData]);

  // Multi-Computer Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("tracker", () => refreshPathwayData());
  useLiveSync("enquiries", () => refreshPathwayData());
  useLiveSync("records", () => refreshPathwayData());
  useLiveSync("documents", () => refreshPathwayData());

  // Select customer and extract their specific details
  const selectCustomer = useCallback((customerOrId: any) => {
    if (typeof customerOrId === "object" && customerOrId !== null) {
      const normalized: PathwayCustomer = {
        ...customerOrId,
        id: customerOrId.id || `cust-${customerOrId.customerId || Math.random()}`,
        applicationStatus: customerOrId.applicationStatus || customerOrId.status || "In Progress",
      };
      setActiveCustomer(normalized);
      return;
    }

    const idStr = String(customerOrId);
    setCustomers((list) => {
      const found = list.find(
        (c) => String(c.id) === idStr || c.customerId === idStr || String(c.taskId) === idStr
      );
      if (found) {
        setActiveCustomer(found);
      }
      return list;
    });
  }, []);

  // Open Pathway window, optionally with a specific customer
  const openPathway = useCallback(
    (customerOrId?: any) => {
      setIsOpen(true);
      setIsClosedToTray(false);

      if (customerOrId) {
        if (typeof customerOrId === "object") {
          const normalized: PathwayCustomer = {
            ...customerOrId,
            id: customerOrId.id || `cust-${customerOrId.customerId || Math.random()}`,
            applicationStatus: customerOrId.applicationStatus || customerOrId.status || "In Progress",
          };
          setActiveCustomer(normalized);
        } else {
          selectCustomer(customerOrId);
        }
      } else if (!activeCustomer && customers.length > 0) {
        setActiveCustomer(customers[0]);
      }

      if (settings.autoExpandOnCustomerSelect) {
        setIsMinimized(false);
      }
    },
    [activeCustomer, customers, selectCustomer, settings.autoExpandOnCustomerSelect]
  );

  // Close based on user preference (Tray vs Exit) - prevented if locked!
  const closePathway = useCallback(() => {
    if (isLocked) return; // Locked in place! Unlock first to close or hide
    if (settings.closeBehavior === "tray") {
      setIsClosedToTray(true);
      setIsOpen(false);
    } else {
      setIsOpen(false);
      setIsClosedToTray(false);
      setIsMinimized(false);
      setIsMaximized(false);
    }
  }, [isLocked, settings.closeBehavior]);

  // Minimize into compact floating panel
  const minimizePathway = useCallback(() => {
    setIsMinimized(true);
    setIsMaximized(false);
  }, []);

  // Maximize to available desktop workspace
  const maximizePathway = useCallback(() => {
    setIsMaximized((prev) => !prev);
    setIsMinimized(false);
  }, []);

  // Restore to standard floating window
  const restorePathway = useCallback(() => {
    setIsOpen(true);
    setIsClosedToTray(false);
    setIsMinimized(false);
    setIsMaximized(false);
  }, []);

  const updateSettings = useCallback((newSettings: Partial<PathwaySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return (
    <PathwayContext.Provider
      value={{
        isOpen,
        isMinimized,
        isMaximized,
        isClosedToTray,
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
        openPathway,
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
      }}
    >
      {children}
    </PathwayContext.Provider>
  );
}

export function usePathway() {
  const context = useContext(PathwayContext);
  if (!context) {
    throw new Error("usePathway must be used within a PathwayProvider");
  }
  return context;
}
