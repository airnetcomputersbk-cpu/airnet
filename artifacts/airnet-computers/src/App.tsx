import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useModal } from "./context/ModalContext";
import logoImage from "@assets/LOGO_1787581255968.png";
import storefrontImage from "@assets/WhatsApp_Image_2026-08-27_at_10.54.13_AM_1787836315161.jpeg";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, Bell, Calendar, Camera, Check, CheckCircle2, CircleHelp, Clock3, Copy, ExternalLink, Eye, FileCheck2, FileText, Home, IdCard,
  Landmark, Mail, MapPin, Menu, MessageCircle, MessageSquare, Navigation, Phone, Plus, Printer, Receipt, Search, Send, Share2, ShieldCheck, Star, Trash2, UsersRound,
  WalletCards, X, type LucideIcon
} from "lucide-react";
import { useGetServices } from "@workspace/api-client-react";

type Service = {
  id: string;
  category: string;
  title: string;
  copy: string;
  timing: string;
  price: string;
  documents: string;
  icon?: string;
  accent?: string;
};

import * as icons from "lucide-react";

export function toPascalCase(str?: string): string {
  if (!str) return "FileText";
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

const IconMapper = ({ name, ...props }: { name?: string } & any) => {
  const normalized = toPascalCase(name);
  const IconComponent = (icons as any)[normalized] || (icons as any)[name || ""] || icons.FileText;
  return <IconComponent {...props} />;
};

export function getCategoryServiceTheme(category?: string, accent?: string, icon?: string) {
  const cat = (category || "").trim();
  const presets: Record<string, { accent: string; icon: string }> = {
    "Identity": { accent: "bg-[#e5f0ea]", icon: "IdCard" },
    "Certificates": { accent: "bg-[#e6faee]", icon: "FileText" },
    "Online Applications": { accent: "bg-[#f5e6e6]", icon: "Briefcase" },
    "Document Services": { accent: "bg-[#e6f0fa]", icon: "BookOpen" },
    "Financial Services": { accent: "bg-[#e6faf6]", icon: "Banknote" },
    "Forms & payments": { accent: "bg-[#f4efe4]", icon: "Receipt" },
  };

  const preset = presets[cat] || { accent: "bg-[#e6f0fa]", icon: "FileText" };
  const validAccent = accent && accent.startsWith("bg-[#") && accent !== "bg-blue-500" ? accent : preset.accent;
  const validIcon = icon && icon !== "file-text" && !icon.includes("-") ? icon : preset.icon;

  return { accent: validAccent, icon: validIcon };
}

export function getNotificationCategoryTheme(category?: string) {
  const cat = (category || "").trim().toLowerCase();
  if (cat.includes("job") || cat.includes("recruit") || cat.includes("kpsc")) {
    return { accent: "bg-[#e1edf7]", icon: icons.Briefcase };
  }
  if (cat.includes("scholarship")) {
    return { accent: "bg-[#faebf2]", icon: icons.GraduationCap };
  }
  if (cat.includes("exam") || cat.includes("hall") || cat.includes("test")) {
    return { accent: "bg-[#fef4e2]", icon: icons.FileCheck2 };
  }
  if (cat.includes("admission") || cat.includes("college") || cat.includes("school")) {
    return { accent: "bg-[#e2f5f1]", icon: icons.BookOpen };
  }
  if (cat.includes("scheme") || cat.includes("yojana") || cat.includes("public") || cat.includes("govt")) {
    return { accent: "bg-[#e2f5eb]", icon: icons.Landmark };
  }
  return { accent: "bg-[#edf2f7]", icon: icons.Bell };
}

const categories = ["All", "Identity", "Certificates", "Online Applications", "Document Services", "Financial Services"];

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

export function formatDateDMY(val?: string | null): string {
  if (!val) return "Open / As per notice";
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

function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"application" | "success" | "tracker" | null>(null);
  const [selectedService, setSelectedService] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);
  const [notice, setNotice] = useState("");
  const [activeSection, setActiveSection] = useState("top");

  // Services state
  const { data: servicesData, refetch: refetchServices } = useGetServices();
  const services = Array.isArray(servicesData) ? servicesData : [];

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [activeNotificationCategory, setActiveNotificationCategory] = useState("All");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [helplinePhone, setHelplinePhone] = useState("+91 7892881086");

  // Dynamic Categories
  const availableCategories = useMemo(() => {
    const base = ["All", "Identity", "Certificates", "Online Applications", "Document Services", "Financial Services"];
    const dynamicCats = services.map((s: any) => s.category).filter(Boolean);
    return Array.from(new Set([...base, ...dynamicCats]));
  }, [services]);

  const availableNotificationCategories = useMemo(() => {
    const base = ["All", "Govt Jobs", "Scholarships", "Exams", "Admissions", "Public Schemes"];
    const dynamicCats = notifications.map((n: any) => n.category).filter(Boolean);
    return Array.from(new Set([...base, ...dynamicCats]));
  }, [notifications]);

  const fetchBusinessInfo = async () => {
    try {
      const res = await fetch("/api/business-info");
      if (res.ok) {
        const data = await res.json();
        if (data?.helpline || data?.mobileNumber) {
          setHelplinePhone(data.helpline || data.mobileNumber);
        }
      }
    } catch (e) {
      console.error("Failed to load business info:", e);
    }
  };

  const fetchNotifications = async (showLoading = false) => {
    try {
      if (showLoading) setNotificationsLoading(true);
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (showLoading) setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessInfo();
    fetchNotifications(true);

    // Intelligent sync: relaxed 25s polling when visible + instant sync on focus / visibilitychange / storage event
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications(false);
        refetchServices();
      }
    }, 25000);

    const onFocusOrVisible = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications(false);
        refetchServices();
      }
    };
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "airnet_notifications_updated") {
        fetchNotifications(false);
      }
      if (e.key === "airnet_services_updated") {
        refetchServices();
      }
    };
    window.addEventListener("storage", onStorage);

    const onCustomNotification = () => fetchNotifications(false);
    const onCustomService = () => refetchServices();
    window.addEventListener("airnet_notifications_updated", onCustomNotification);
    window.addEventListener("airnet_services_updated", onCustomService);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("airnet_notifications_updated", onCustomNotification);
      window.removeEventListener("airnet_services_updated", onCustomService);
    };
  }, [refetchServices]);

  // Always guarantee that page refresh or initial visit opens strictly at the top Hero Home section
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Disable browser's automatic scroll restoration so it never jumps back to previously scrolled sections
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    // 2. Clear any anchor hash (#documents, #visit, etc.) so browser doesn't anchor down on reload
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // 3. Immediately scroll to top
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    setActiveSection("top");

    // 4. Double check across next animation frames as dynamic data (services/notifications) loads
    const frameId = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
      setActiveSection("top");
    });

    const timerId = setTimeout(() => {
      if (window.scrollY < 200) {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
        setActiveSection("top");
      }
    }, 100);

    // 5. Reset scroll to top before unloading / page refresh
    const handleBeforeUnload = () => {
      window.scrollTo(0, 0);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timerId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Track window scroll position to lock Home / top section when near the header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY < 120) {
        setActiveSection("top");
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (window.scrollY < 120) {
              setActiveSection("top");
            } else {
              setActiveSection(entry.target.id);
            }
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" } // trigger when section crosses the viewport
    );

    const sections = ["top", "services", "notifications", "how-it-works", "documents", "visit"];
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Close open popups when pressing the Escape key for easy cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedNotification) {
          setSelectedNotification(null);
        } else if (modal) {
          setModal(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modal, selectedNotification]);

  const [submittedEnquiries, setSubmittedEnquiries] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("airnet_enquiries") || "[]");
    } catch {
      return [];
    }
  });

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((service) => {
      const matchesCategory = activeCategory === "All" || service.category === activeCategory;
      const searchable = `${service.title} ${service.copy} ${service.category} ${service.documents}`.toLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
  }, [activeCategory, search, services]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeNotificationCategory !== "All" && item.category !== activeNotificationCategory) {
        return false;
      }
      if (notificationSearch.trim()) {
        const q = notificationSearch.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchOrg = item.organization?.toLowerCase().includes(q);
        const matchQual = item.qualification?.toLowerCase().includes(q);
        return matchTitle || matchOrg || matchQual;
      }
      return true;
    });
  }, [notifications, activeNotificationCategory, notificationSearch]);

  // All active Featured Notifications displayed pinned at top
  const featuredNotifications = useMemo(() => {
    return filteredNotifications
      .filter((item) => Boolean(item.isFeatured))
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
        return timeB - timeA;
      });
  }, [filteredNotifications]);

  // Recently Added Notifications: strictly non-featured notifications, chronologically sorted (newest first)
  // Guarantees zero duplicate display between sections and preserves original publication date/time
  const recentlyAddedNotifications = useMemo(() => {
    return filteredNotifications
      .filter((item) => !item.isFeatured)
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.id || 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.id || 0);
        return timeB - timeA;
      });
  }, [filteredNotifications]);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function scrollTo(id: string) {
    setMobileOpen(false);
    if (id === "top") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      setActiveSection("top");
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  const [lastSubmittedApplication, setLastSubmittedApplication] = useState<{
    id?: number;
    customerId?: string;
    customerName?: string;
    mobileNumber?: string;
    service?: string;
  } | null>(null);
  const [trackerInitialQuery, setTrackerInitialQuery] = useState("");

  function openApplication(service: string) {
    setSelectedService(service);
    setModal("application");
  }

  function completeApplication(details: {
    id?: number;
    customerId?: string;
    customerName?: string;
    mobileNumber?: string;
    service?: string;
  }) {
    setLastSubmittedApplication(details);
    setModal("success");
  }

  return (
    <div className="noise min-h-[100dvh] bg-[#f4efe4] text-[#15263b]">
      <header className="sticky top-0 z-50 w-full border-b border-[#1e4b75] bg-[#061f3d]/95 backdrop-blur-md text-[#f8f4eb] shadow-md transition-all">
        <div className="container-airnet flex min-h-[68px] sm:min-h-[76px] py-2 items-center justify-between gap-3 sm:gap-5">
          <button data-testid="button-logo" onClick={() => scrollTo("top")} className="group flex items-center gap-2.5 sm:gap-3 text-left shrink-0 min-w-0">
            <img src={logoImage} alt="Airnet Computer logo" className="h-10 w-10 sm:h-12 sm:w-12 rounded-[12px] bg-white object-contain shadow-[4px_4px_0_#06101e] transition-transform group-hover:-translate-y-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="font-display block text-[15px] sm:text-[17px] font-bold leading-none tracking-[-.04em] whitespace-nowrap">Airnet Computer</span>
              <span className="mt-1 block text-[8.5px] sm:text-[9px] font-bold uppercase tracking-[.14em] sm:tracking-[.16em] text-[#afd0d4] whitespace-nowrap">Online Service Center</span>
            </span>
          </button>
          
          <nav className="desktop-only flex-1 flex justify-evenly items-center gap-1 xl:gap-3 text-[13px] xl:text-[15px] font-bold text-[#cfdae3]">
            {[
              ['top', 'Home'],
              ['services', 'Services'],
              ['notifications', 'Notifications'],
              ['how-it-works', 'How it works'],
              ['documents', 'Documents'],
              ['visit', 'Visit us']
            ].map(([id, label]) => (
              <button 
                key={id}
                data-testid={`link-${id}`} 
                onClick={() => scrollTo(id)} 
                className={`px-3 xl:px-4 py-2 rounded-full whitespace-nowrap transition-all duration-300 flex items-center gap-1.5 ${
                  activeSection === id 
                    ? "bg-white text-[#032e60] shadow-sm" 
                    : "hover:text-white hover:bg-[#1e4b75]/50"
                }`}
              >
                {id === "top" && <Home size={14} className={activeSection === id ? "text-[#032e60]" : "text-[#afd0d4]"} />}
                {id === "notifications" && <Bell size={14} className={activeSection === id ? "text-[#032e60]" : "text-[#f2b544]"} />}
                <span>{label}</span>
                {id === "notifications" && notifications.length > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {notifications.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <a href="/admin/dashboard" className="desktop-only flex items-center gap-1.5 sm:gap-2 rounded-full border border-[#6686a2] px-3.5 xl:px-4 py-2 text-[12px] font-bold transition-colors hover:border-[#f2b544] hover:text-[#f2b544]">
              <UsersRound size={15} /> Admin
            </a>
            <button data-testid="button-mobile-menu" onClick={() => setMobileOpen((value) => !value)} className="mobile-only grid h-10 w-10 place-items-center rounded-full border border-[#6686a2] text-white">
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileOpen && <nav className="mobile-only border-t border-[#1e4b75] bg-[#0a294c] px-4 sm:px-5 py-4 max-h-[80vh] overflow-y-auto">
          <div className="container-airnet flex flex-col gap-3 text-sm font-semibold">
            {[
              ["Home", "top"],
              ["Services", "services"],
              ["Notifications", "notifications"],
              ["How it works", "how-it-works"],
              ["Documents", "documents"],
              ["Visit us", "visit"]
            ].map(([label, id]) => (
              <button data-testid={`mobile-link-${id}`} key={id} onClick={() => scrollTo(id)} className="border-b border-[#355779] py-2.5 text-left text-[#e1e9ef] flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {id === "top" && <Home size={15} className="text-[#f2b544]" />}
                  {label}
                </span>
                {id === "notifications" && notifications.length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {notifications.length} New
                  </span>
                )}
              </button>
            ))}
            <button data-testid="mobile-button-notifications" onClick={() => { setMobileOpen(false); scrollTo("notifications"); }} className="mt-1 flex items-center gap-2 text-left text-[#f2b544]"><Bell size={15} /> Check Latest Notifications <ArrowRight size={15} /></button>
          </div>
        </nav>}
      </header>

      <main>
        <section id="top" className="hero-grid relative overflow-hidden bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet relative grid min-h-[500px] items-center gap-8 lg:gap-12 py-10 sm:py-14 lg:grid-cols-[1.08fr_.92fr] lg:py-16">
            <div className="relative z-10 max-w-[615px]">
              <div className="fade-up mb-4 sm:mb-6 flex items-center gap-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-[.18em] text-[#a5d8c9]">
                <span className="h-px w-6 sm:w-8 bg-[#f2b544]" /> Your local online service center
              </div>
              <h1 data-testid="text-hero-heading" className="fade-up font-display text-[clamp(2.1rem,5.5vw,5.2rem)] font-bold leading-[1.02] tracking-[-.04em] sm:tracking-[-.06em]">
                Online services,<br /><span className="text-[#f2b544]">locally explained.</span>
              </h1>
              <p data-testid="text-hero-copy" className="fade-up fade-up-delay mt-5 sm:mt-7 max-w-[510px] text-base sm:text-[17px] leading-relaxed text-[#c6d5df]">
                Apply for PAN, voter ID, certificates and everyday government forms with a little help from people nearby. Bring your documents. We’ll help with the rest.
              </p>
              <div className="fade-up fade-up-delay-2 mt-7 sm:mt-9 flex flex-wrap gap-3">
                <button data-testid="button-hero-start" onClick={() => scrollTo("services")} className="group flex items-center gap-3 rounded-full bg-[#f2b544] px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[#032e60] transition-all hover:bg-[#ffc968]">
                  Start an application <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button data-testid="button-hero-visit" onClick={() => scrollTo("visit")} className="flex items-center gap-2 rounded-full border border-[#6e8ca5] px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-bold text-[#f8f4eb] transition-all hover:border-[#f2b544] hover:text-[#f2b544]">
                  Book a visit
                </button>
              </div>
              <div className="fade-up fade-up-delay-3 mt-8 sm:mt-11 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#244a70] pt-4 sm:pt-5 text-[11px] text-[#a7bdc9]">
                <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-[#a5d8c9]" /> Clear pricing before we begin</span>
                <button onClick={() => setModal("tracker")} className="flex items-center gap-2 text-[#f8f4eb] hover:text-[#f2b544] transition-colors cursor-pointer"><Clock3 size={15} className="text-[#f2b544]" /> Track your application</button>
              </div>
            </div>
            <div className="relative flex items-center justify-center lg:justify-end py-4 lg:py-0 overflow-hidden">
               <div className="relative w-full max-w-[420px] overflow-hidden rounded-[20px] sm:rounded-[24px] border border-[#7796aa] bg-[#174675] shadow-[12px_14px_0_rgba(2,19,41,.4)] sm:shadow-[20px_24px_0_rgba(2,19,41,.4)]">
                 <img src={storefrontImage} alt="Airnet Computers Online Service Center in Basavakalyan" className="block aspect-[4/3] h-auto w-full object-cover" />
               </div>
              <div className="pointer-events-none absolute -right-2 top-0 h-14 w-14 rounded-full border border-[#f2b544] opacity-50 hidden sm:block" />
              <div className="pointer-events-none absolute right-2 top-5 h-2.5 w-2.5 rounded-full bg-[#f2b544] hidden sm:block" />
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full border border-[#527493] opacity-30" />
        </section>

        <section className="border-b border-[#ded4c3] bg-[#ece5d8]">
          <div className="container-airnet grid grid-cols-2 gap-x-4 sm:gap-x-7 gap-y-5 sm:gap-y-6 py-6 sm:py-7 md:grid-cols-4">
            {[
              ["12+", "years serving the neighbourhood"], ["20+", "Services under one roof"], ["1 visit", "to get your application started"], ["100%", "clear before we charge"],
            ].map(([value, label], index) => <div data-testid={`stat-item-${index}`} key={label} className="flex flex-col gap-1 border-l-2 border-[#d96f4a] pl-3 min-w-0">
              <strong className="font-display text-lg sm:text-xl font-bold tracking-[-.04em] text-[#032e60]">{value}</strong><span className="text-[10.5px] sm:text-[11px] text-[#5f6e74] leading-tight">{label}</span>
            </div>)}
          </div>
        </section>

        <section id="services" className="section-pad bg-[#f4efe4]">
          <div className="container-airnet">
            <div className="mb-8 sm:mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="eyebrow">Online services</p>
                <h2 className="font-display mt-3 text-3xl sm:text-4xl font-bold tracking-[-.05em] text-[#032e60] md:text-5xl">The important stuff,<br /><span className="serif-italic text-[#d96f4a]">made manageable.</span></h2>
                <p className="mt-3 sm:mt-4 max-w-[500px] text-sm leading-6 text-[#5f6e74]">Choose a service to see what to bring and start a request now — there’s no account to create.</p>
              </div>
              <div className="relative w-full md:w-[320px] max-w-full">
                <Search size={17} className="absolute left-3 top-3.5 text-[#66808e]" />
                <input data-testid="input-service-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PAN, voter ID, certificate..." className="h-11 w-full rounded-xl border border-[#d4c9b8] bg-[#fcfaf5] pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#839096] focus:border-[#177d70] focus:ring-2 focus:ring-[#bdddd3]" />
              </div>
            </div>
            <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((category) => <button data-testid={`button-category-${category.toLowerCase().replaceAll(" ", "-")}`} key={category} onClick={() => setActiveCategory(category)} className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${activeCategory === category ? "bg-[#032e60] text-[#f8f4eb] shadow-[3px_3px_0_#f2b544]" : "border border-[#d4c9b8] bg-[#fcfaf5] text-[#52616b] hover:border-[#177d70] hover:text-[#177d70]"}`}>{category}</button>)}
              </div>
              <p data-testid="text-service-count" className="text-xs text-[#77858a]">{filteredServices.length} services available</p>
            </div>
            {filteredServices.length > 0 ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => <ServiceCard key={service.id} service={service} onStart={() => openApplication(service.title)} />)}
            </div> : <div data-testid="empty-service-search" className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9bfaf] bg-[#fcfaf5] px-5 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e2eee8] text-[#177d70]"><Search size={20} /></div>
              <h3 className="font-display text-xl font-bold text-[#032e60]">No service found</h3>
              <p className="mt-2 text-sm text-[#6b797b]">Try “PAN”, “certificate” or “print”, or ask us directly.</p>
              <button data-testid="button-clear-service-search" onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-4 text-xs font-bold text-[#177d70] underline underline-offset-4">Clear filters</button>
            </div>}
            <div className="mt-7 flex flex-col items-start justify-between gap-4 border-t border-[#ddd4c5] pt-5 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2 text-xs text-[#6b797b]"><MapPin size={14} className="text-[#d96f4a]" /> Visit Airnet Computers for help in person</span>
              <button data-testid="button-service-help" onClick={() => openApplication("General online service enquiry")} className="flex items-center gap-2 text-xs font-bold text-[#032e60]">Not sure which service? Ask us here <ArrowUpRight size={14} /></button>
            </div>
          </div>
        </section>

        {/* LATEST NOTIFICATIONS & JOB ALERTS SECTION */}
        <section id="notifications" className="section-pad bg-gradient-to-b from-[#f9f7f2] to-[#ede7dc] border-b border-[#ded5c6]">
          <div className="container-airnet">
            <div className="mb-8 sm:mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase tracking-widest mb-2">
                  <Bell className="w-4 h-4 text-[#d96f4a]" />
                  <span>Public Alerts & Recruitment Engine</span>
                </div>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-.05em] text-[#032e60] md:text-5xl">
                  Latest Notifications,<br />
                  <span className="serif-italic text-[#d96f4a]">Recruitments & Schemes.</span>
                </h2>
                <p className="mt-3 max-w-[560px] text-sm leading-6 text-[#5f6e74]">
                  Browse verified government job posters, scholarship alerts, university admission circulars, and exam timetables. Apply directly through Airnet Computers with full document assistance.
                </p>
              </div>

              {/* Notification Search */}
              <div className="relative w-full md:w-[340px] max-w-full">
                <Search size={17} className="absolute left-3.5 top-3.5 text-[#66808e]" />
                <input
                  type="text"
                  value={notificationSearch}
                  onChange={(e) => setNotificationSearch(e.target.value)}
                  placeholder="Search job title, KPSC, police, SSP..."
                  className="h-11 w-full rounded-xl border border-[#d4c9b8] bg-[#fcfaf5] pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-[#839096] focus:border-[#177d70] focus:ring-2 focus:ring-[#bdddd3]"
                />
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {availableNotificationCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveNotificationCategory(cat)}
                    className={`rounded-full px-4 py-2 text-xs font-bold transition-all ${
                      activeNotificationCategory === cat
                        ? "bg-[#032e60] text-[#f8f4eb] shadow-[3px_3px_0_#f2b544]"
                        : "border border-[#d4c9b8] bg-[#fcfaf5] text-[#52616b] hover:border-[#177d70] hover:text-[#177d70]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#77858a]">
                {filteredNotifications.length} active announcements
              </p>
            </div>

            {/* Notifications Grid / Dual Sections */}
            {notificationsLoading ? (
              <div className="p-12 text-center text-slate-500 bg-[#fcfaf5] rounded-2xl border border-[#ded5c6]">
                <Clock3 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#032e60]" />
                <p className="text-sm font-semibold">Loading latest notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9bfaf] bg-[#fcfaf5] px-5 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#e2eee8] text-[#177d70]">
                  <Bell size={20} />
                </div>
                <h3 className="font-display text-xl font-bold text-[#032e60]">No notifications in this category</h3>
                <p className="mt-2 text-sm text-[#6b797b]">Try changing the category or search keyword.</p>
                <button
                  onClick={() => { setActiveNotificationCategory("All"); setNotificationSearch(""); }}
                  className="mt-4 text-xs font-bold text-[#177d70] underline underline-offset-4 cursor-pointer"
                >
                  Show all notifications
                </button>
              </div>
            ) : (
              <div className="space-y-12">
                {/* 1. FEATURED NOTIFICATIONS SECTION */}
                {featuredNotifications.length > 0 && (
                  <section aria-label="Featured Notifications" className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b-2 border-[#f2b544]/60 pb-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2b544] text-[#032e60] shadow-sm">
                          <Star className="h-5 w-5 fill-[#032e60]" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#032e60]">
                              Featured Notifications
                            </h3>
                            <span className="rounded-full bg-[#f2b544] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#032e60] shadow-2xs">
                              ⭐ Pinned Top
                            </span>
                          </div>
                          <p className="text-xs text-[#6e7d82] mt-0.5">
                            Priority recruitment drives, urgent job circulars & major government schemes
                          </p>
                        </div>
                      </div>
                      <span className="self-start sm:self-center rounded-full bg-[#f2b544]/20 border border-[#f2b544]/50 px-3 py-1 text-xs font-bold text-[#032e60]">
                        {featuredNotifications.length} {featuredNotifications.length === 1 ? "Featured Notification" : "Featured Notifications"}
                      </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {featuredNotifications.map((item) => {
                        const parsedLast = parseDateString(item.lastDate);
                        const isExpiringSoon =
                          parsedLast &&
                          parsedLast.getTime() - new Date().getTime() < 5 * 24 * 60 * 60 * 1000 &&
                          parsedLast.getTime() >= new Date().getTime();
                        const notifTheme = getNotificationCategoryTheme(item.category);
                        const NotifIcon = notifTheme.icon;

                        return (
                          <article
                            key={item.id}
                            data-testid={`notification-card-${item.id}`}
                            className="group relative flex flex-col rounded-2xl border border-[#f2b544]/80 ring-1 ring-[#f2b544]/50 shadow-[0_4px_20px_rgba(242,181,68,0.12)] bg-[#fcfaf5] overflow-hidden hover:shadow-md transition-all hover:-translate-y-1"
                          >
                            {/* Top Notification Icon Header */}
                            <div 
                              onClick={() => setSelectedNotification(item)}
                              className={`relative flex h-[132px] items-center justify-center overflow-hidden rounded-t-2xl cursor-pointer ${notifTheme.accent}`}
                            >
                              <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border border-[#032e60]/10" />
                              <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-[#032e60]/10" />
                              
                              <div className="relative grid h-20 w-24 place-items-center rounded-[18px] border-2 border-[#23405a] bg-[#f7f4eb] shadow-[6px_7px_0_#23405a] group-hover:scale-105 transition-transform">
                                <NotifIcon size={36} strokeWidth={1.6} className="text-[#177d70]" />
                              </div>

                              <span className="absolute left-3 top-3 rounded-full bg-[#032e60] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#f8f4eb] shadow-xs">
                                {item.category}
                              </span>

                              <span className="absolute right-3 top-3 rounded-full bg-[#f2b544] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#032e60] shadow-xs flex items-center gap-1">
                                <Star size={11} className="fill-[#032e60]" /> Featured
                              </span>

                              {item.organization && (
                                <span className="absolute bottom-2 left-3 right-3 text-[10px] font-bold text-[#032e60]/75 truncate">
                                  {item.organization}
                                </span>
                              )}
                            </div>

                            {/* Content Card Body */}
                            <div className="flex flex-1 flex-col p-4 sm:p-5">
                              <h3 
                                onClick={() => setSelectedNotification(item)}
                                className="font-display text-lg font-bold tracking-tight text-[#032e60] group-hover:text-blue-700 cursor-pointer line-clamp-2 leading-snug"
                              >
                                {item.title}
                              </h3>

                              {/* Highlights Grid */}
                              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] bg-[#f4efe4] p-3 rounded-xl border border-[#e8decb]">
                                <div>
                                  <span className="text-[#7d8b8e] font-semibold block text-[10px] uppercase">Vacancies</span>
                                  <span className="font-bold text-[#032e60] truncate block">{item.vacancies || "Multiple"}</span>
                                </div>
                                <div>
                                  <span className="text-[#7d8b8e] font-semibold block text-[10px] uppercase">Eligibility</span>
                                  <span className="font-bold text-[#032e60] truncate block">{item.qualification || "Any Degree/PUC"}</span>
                                </div>
                                <div className="col-span-2 pt-1 border-t border-[#e2d6c0] flex items-center justify-between">
                                  <span className="text-[#7d8b8e] font-semibold text-[10px] uppercase">Last Date</span>
                                  <span className={`font-bold flex items-center gap-1 ${isExpiringSoon ? "text-red-600 animate-pulse" : "text-[#032e60]"}`}>
                                    <Calendar size={12} className="text-[#d96f4a]" />
                                    {formatDateDMY(item.lastDate)}
                                    {isExpiringSoon && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-extrabold">Closing soon!</span>}
                                  </span>
                                </div>
                              </div>

                              {/* Card Footer Actions */}
                              <div className="mt-auto pt-4 sm:pt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5dccd]">
                                <button
                                  onClick={() => setSelectedNotification(item)}
                                  className="text-xs font-bold text-[#032e60] hover:text-[#177d70] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye size={14} /> View Details
                                </button>
                                
                                <button
                                  onClick={() => openApplication(item.title)}
                                  className="rounded-full bg-[#032e60] hover:bg-[#0b477e] text-[#f8f4eb] px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Apply at Airnet</span>
                                  <ArrowRight size={13} className="text-[#f2b544]" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. RECENTLY ADDED NOTIFICATIONS SECTION */}
                {recentlyAddedNotifications.length > 0 && (
                  <section aria-label="Recently Added Notifications" className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b-2 border-[#032e60]/20 pb-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#032e60] text-[#f8f4eb] shadow-sm">
                          <Clock3 className="h-5 w-5 text-[#f2b544]" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#032e60]">
                              Recently Added Notifications
                            </h3>
                            <span className="rounded-full bg-[#032e60]/10 border border-[#032e60]/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#032e60]">
                              Newest First
                            </span>
                          </div>
                          <p className="text-xs text-[#6e7d82] mt-0.5">
                            Chronologically published notifications, exams & circulars (newest at the top)
                          </p>
                        </div>
                      </div>
                      <span className="self-start sm:self-center rounded-full bg-[#032e60]/10 border border-[#032e60]/20 px-3 py-1 text-xs font-bold text-[#032e60]">
                        {recentlyAddedNotifications.length} {recentlyAddedNotifications.length === 1 ? "Recent Notification" : "Recent Notifications"}
                      </span>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {recentlyAddedNotifications.map((item) => {
                        const parsedLast = parseDateString(item.lastDate);
                        const isExpiringSoon =
                          parsedLast &&
                          parsedLast.getTime() - new Date().getTime() < 5 * 24 * 60 * 60 * 1000 &&
                          parsedLast.getTime() >= new Date().getTime();
                        const notifTheme = getNotificationCategoryTheme(item.category);
                        const NotifIcon = notifTheme.icon;

                        return (
                          <article
                            key={item.id}
                            data-testid={`notification-card-${item.id}`}
                            className="group relative flex flex-col rounded-2xl border border-[#ded5c6] bg-[#fcfaf5] overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
                          >
                            {/* Top Notification Icon Header */}
                            <div 
                              onClick={() => setSelectedNotification(item)}
                              className={`relative flex h-[132px] items-center justify-center overflow-hidden rounded-t-2xl cursor-pointer ${notifTheme.accent}`}
                            >
                              <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border border-[#032e60]/10" />
                              <div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-[#032e60]/10" />
                              
                              <div className="relative grid h-20 w-24 place-items-center rounded-[18px] border-2 border-[#23405a] bg-[#f7f4eb] shadow-[6px_7px_0_#23405a] group-hover:scale-105 transition-transform">
                                <NotifIcon size={36} strokeWidth={1.6} className="text-[#177d70]" />
                              </div>

                              <span className="absolute left-3 top-3 rounded-full bg-[#032e60] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#f8f4eb] shadow-xs">
                                {item.category}
                              </span>

                              <span className="absolute right-3 top-3 rounded-full bg-white/85 border border-[#032e60]/15 px-2 py-0.5 text-[9px] font-bold text-[#032e60] shadow-xs">
                                Active Alert
                              </span>

                              {item.organization && (
                                <span className="absolute bottom-2 left-3 right-3 text-[10px] font-bold text-[#032e60]/75 truncate">
                                  {item.organization}
                                </span>
                              )}
                            </div>

                            {/* Content Card Body */}
                            <div className="flex flex-1 flex-col p-4 sm:p-5">
                              <h3 
                                onClick={() => setSelectedNotification(item)}
                                className="font-display text-lg font-bold tracking-tight text-[#032e60] group-hover:text-blue-700 cursor-pointer line-clamp-2 leading-snug"
                              >
                                {item.title}
                              </h3>

                              {/* Highlights Grid */}
                              <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] bg-[#f4efe4] p-3 rounded-xl border border-[#e8decb]">
                                <div>
                                  <span className="text-[#7d8b8e] font-semibold block text-[10px] uppercase">Vacancies</span>
                                  <span className="font-bold text-[#032e60] truncate block">{item.vacancies || "Multiple"}</span>
                                </div>
                                <div>
                                  <span className="text-[#7d8b8e] font-semibold block text-[10px] uppercase">Eligibility</span>
                                  <span className="font-bold text-[#032e60] truncate block">{item.qualification || "Any Degree/PUC"}</span>
                                </div>
                                <div className="col-span-2 pt-1 border-t border-[#e2d6c0] flex items-center justify-between">
                                  <span className="text-[#7d8b8e] font-semibold text-[10px] uppercase">Last Date</span>
                                  <span className={`font-bold flex items-center gap-1 ${isExpiringSoon ? "text-red-600 animate-pulse" : "text-[#032e60]"}`}>
                                    <Calendar size={12} className="text-[#d96f4a]" />
                                    {formatDateDMY(item.lastDate)}
                                    {isExpiringSoon && <span className="text-[9px] bg-red-100 text-red-700 px-1 rounded font-extrabold">Closing soon!</span>}
                                  </span>
                                </div>
                              </div>

                              {/* Card Footer Actions */}
                              <div className="mt-auto pt-4 sm:pt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5dccd]">
                                <button
                                  onClick={() => setSelectedNotification(item)}
                                  className="text-xs font-bold text-[#032e60] hover:text-[#177d70] flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye size={14} /> View Details
                                </button>
                                
                                <button
                                  onClick={() => openApplication(item.title)}
                                  className="rounded-full bg-[#032e60] hover:bg-[#0b477e] text-[#f8f4eb] px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Apply at Airnet</span>
                                  <ArrowRight size={13} className="text-[#f2b544]" />
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </section>

        <section id="how-it-works" className="section-pad bg-[#e4f0eb]">
          <div className="container-airnet">
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[.73fr_1.27fr]">
              <div>
                <p className="eyebrow">How it works</p>
                <h2 className="font-display mt-3 text-3xl sm:text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">A little help<br /><span className="serif-italic text-[#177d70]">goes a long way.</span></h2>
                <p className="mt-4 sm:mt-5 max-w-[370px] text-sm leading-6 text-[#526d70]">Government websites can be confusing. We slow the process down, check the details and tell you what happens next.</p>
                <button data-testid="button-how-start" onClick={() => openApplication("General online service enquiry")} className="mt-6 sm:mt-7 flex items-center gap-2 text-sm font-bold text-[#032e60] underline decoration-[#f2b544] decoration-2 underline-offset-8">Start with a conversation <ArrowRight size={16} /></button>
              </div>
              <div className="divide-y divide-[#c7ddd4] border-y border-[#c7ddd4]">
                {[
                  { number: "01", title: "Tell us what you need", copy: "Choose a service online or walk in and explain it in your own words. We’ll make sure you’re in the right place.", icon: MessageCircle },
                  { number: "02", title: "Bring your documents", copy: "We check your originals, take the scans or copies needed and show you the service fee before submitting anything.", icon: FileCheck2 },
                  { number: "03", title: "Track the next step", copy: "Keep your acknowledgement or reference number. Come back for help checking the status or downloading the result.", icon: CircleHelp },
                ].map(({ number, title, copy, icon: Icon }) => <div key={number} className="group flex gap-3 sm:gap-5 py-5 sm:py-6 first:pt-0 last:pb-0">
                  <span className="font-mono text-[11px] font-bold text-[#d96f4a] shrink-0">{number}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg sm:text-xl font-bold tracking-[-.04em] text-[#032e60]">{title}</h3><Icon size={21} className="shrink-0 text-[#177d70] transition-transform group-hover:rotate-[-8deg]" /></div>
                    <p className="mt-2 max-w-[540px] text-sm leading-6 text-[#5b7374]">{copy}</p>
                  </div>
                </div>)}
              </div>
            </div>
          </div>
        </section>

        <section id="documents" className="section-pad bg-[#f4efe4]">
          <div className="container-airnet">
            <div className="mb-8 sm:mb-11 flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="eyebrow">Before you visit</p><h2 className="font-display mt-3 max-w-[600px] text-3xl sm:text-4xl font-bold leading-[.98] tracking-[-.065em] text-[#032e60] md:text-5xl">Bring what you have.<br /><span className="text-[#d96f4a]">We’ll check the rest.</span></h2></div>
              <p className="max-w-[330px] text-sm leading-6 text-[#6b797b]">Originals are helpful for checking. Bring a phone number that can receive OTPs and a few photocopies if you have them.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {[
                { icon: IdCard, title: "Photo ID", copy: "Aadhaar, driving licence, voter ID or another accepted identity document." },
                { icon: FileText, title: "Address proof", copy: "Aadhaar, electricity bill, ration card or another current proof of address." },
                { icon: Camera, title: "Recent photo", copy: "Bring a passport-size photo, or use our quick photo service at the desk." },
              ].map(({ icon: Icon, title, copy }, index) => <div data-testid={`card-document-${index}`} key={title} className={`lift rounded-2xl p-6 sm:p-7 ${index === 1 ? "bg-[#032e60] text-[#f8f4eb]" : "border border-[#ded5c6] bg-[#fcfaf5]"}`}>
                <Icon size={23} className={index === 1 ? "text-[#f2b544]" : "text-[#177d70]"} />
                <h3 className={`font-display mt-8 sm:mt-12 text-lg sm:text-xl font-bold leading-tight tracking-[-.04em] ${index === 1 ? "text-[#f8f4eb]" : "text-[#032e60]"}`}>{title}</h3>
                <p className={`mt-3 text-sm leading-6 ${index === 1 ? "text-[#bfcfda]" : "text-[#667276]"}`}>{copy}</p>
              </div>)}
            </div>
            <div className="mt-8 sm:mt-10 grid gap-6 sm:gap-8 rounded-2xl bg-[#f0dfc6] p-6 sm:p-7 md:grid-cols-[1fr_auto] md:items-center md:p-10">
              <div><p className="eyebrow text-[#ad5a41]">A useful promise</p><blockquote className="mt-4 max-w-[730px] font-display text-xl sm:text-2xl font-bold leading-tight tracking-[-.05em] text-[#032e60] md:text-3xl">“You never have to pretend you understood the form. Ask us, and we’ll go through it with you.”</blockquote><p className="mt-4 sm:mt-5 text-xs font-bold text-[#6e6e62]">— Md Amjad Ali, Airnet Computers</p></div>
              <div className="relative h-20 w-20 sm:h-24 sm:w-24 rotate-3 rounded-full border-2 border-[#d96f4a] p-2 shrink-0"><div className="grid h-full w-full place-items-center rounded-full border border-[#d96f4a] text-center text-[9px] font-bold uppercase leading-3 tracking-[.1em] text-[#ad5a41]">local<br />help<br />first</div></div>
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#d9e9ee] py-12 sm:py-16">
          <div className="container-airnet relative grid items-center gap-6 sm:gap-8 md:grid-cols-[1fr_auto]">
            <div><p className="eyebrow text-[#17687d]">Need to check an application?</p><h2 className="font-display mt-3 max-w-[650px] text-2xl sm:text-3xl font-bold leading-tight tracking-[-.06em] text-[#032e60] md:text-4xl">Keep your reference number.<br /><span className="serif-italic text-[#17687d]">We’ll help track the rest.</span></h2></div>
            <button data-testid="button-cta-contact" onClick={() => setModal("tracker")} className="group flex w-fit items-center gap-3 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:bg-[#0b477e]">Track my application <Clock3 size={17} className="text-[#f2b544] transition-transform group-hover:rotate-12" /></button>
          </div>
          <div className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full border border-[#8cb4c0]" />
        </section>

        <section id="visit" className="section-pad bg-[#032e60] text-[#f8f4eb]">
          <div className="container-airnet grid gap-8 sm:gap-12 lg:grid-cols-[1fr_.82fr]">
            <div>
              <p className="eyebrow text-[#a5d8c9]">Find Airnet Computers Online Service center</p>
              <h2 className="font-display mt-3 max-w-[560px] text-4xl sm:text-5xl font-bold leading-[.95] tracking-[-.06em] md:text-6xl">Bring the form.<br /><span className="text-[#f2b544]">Leave with a plan.</span></h2>
              <div className="mt-7 sm:mt-9 grid gap-4 sm:gap-5 text-sm text-[#c5d5df] sm:grid-cols-2">
                 <div className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-[#f2b544]" /><span>Opp. Congress Office, Near Omer Masjid<br />Haralayya Chowk, Basavakalyan – 585327</span></div>
                 <div className="flex gap-3"><Clock3 size={18} className="mt-0.5 shrink-0 text-[#a5d8c9]" /><span>Mon–Sat 10 AM to 10 PM<br />Sun 1 PM to 9 PM</span></div>
                 <div className="flex gap-3"><Phone size={18} className="mt-0.5 shrink-0 text-[#f2b544]" /><span>Md Amjad Ali<br />{helplinePhone}</span></div>
                 <div className="flex gap-3"><Mail size={18} className="mt-0.5 shrink-0 text-[#a5d8c9]" /><span>Call Md Amjad Ali<br />for help with your application</span></div>
              </div>
               <div className="mt-7 sm:mt-9 flex flex-wrap gap-3"><a data-testid="button-get-directions" href="https://www.google.com/maps/place/Airnet+Computers.+Amjad+Ali,+Haralayya+Chowk+oppsite+Kaish+Motor+Hero+Showroom,+near+omer+masjid,+Basavakalyan,+Karnataka+585327/data=!4m2!3m1!1s0x3bcf3be23e8892a9:0x84ce7fa678a0994d!18m1!1e1?utm_source=mstt_1&entry=gps&coh=192189&g_ep=CAESBzI2LjE3LjUYACCenQoqngEsOTQyNjc3MjcsOTQyOTIxOTUsOTQyOTk1MzIsMTAwNzk2NDk4LDEwMDc5Nzc2MSwxMDA3OTY1MzUsOTQyODQ0NTQsOTQyODA1NzYsOTQyMDczOTQsOTQyMDc1MDYsOTQyMDg1MDYsOTQyMTg2NTMsOTQyMjk4MzksOTQyNzUxNjgsOTQyNzk2MTksMTAwNzk5MjQ2LDEwMDc5MjU2OE" target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-full bg-[#f2b544] px-5 py-3 text-sm font-bold text-[#032e60] hover:bg-[#ffc968]"><Navigation size={15} /> Get directions</a><a data-testid="button-call-desk" href={`tel:${helplinePhone.replace(/\s+/g, '')}`} className="flex items-center gap-2 rounded-full border border-[#63829d] px-5 py-3 text-sm font-bold hover:border-[#f2b544] hover:text-[#f2b544]"><Phone size={15} /> Call Md Amjad Ali</a></div>
            </div>
            <div className="relative min-h-[280px] sm:min-h-[290px] overflow-hidden rounded-2xl border border-[#355779] bg-[#0d3a69] p-5 sm:p-6">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#6c8ba2 1px, transparent 1px), linear-gradient(90deg, #6c8ba2 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
              <div className="relative flex h-full flex-col justify-between">
                 <div className="flex items-start justify-between"><div className="rounded-lg bg-[#f2b544] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#032e60]">Airnet Computers Online Service center</div><div className="grid h-10 w-10 place-items-center rounded-full border border-[#f2b544] text-[#f2b544]"><MapPin size={18} /></div></div>
                <div className="self-center text-center"><div className="mx-auto mb-3 h-3 w-3 rounded-full bg-[#f2b544] shadow-[0_0_0_8px_rgba(242,181,68,.18)]" /><p className="font-display text-xl sm:text-2xl font-bold tracking-[-.05em]">Friendly help<br />for online forms</p></div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-[.16em] text-[#9bb2c3]"><span>walk in welcome</span><span>clear next step</span></div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#02234a] py-6 sm:py-8 text-[#95aec0]">
        <div className="container-airnet flex flex-col justify-between gap-4 text-xs md:flex-row md:items-center text-center md:text-left">
          <span className="font-display font-bold text-[#f8f4eb]">Airnet Computers Online Service center</span>
          <span>Practical online help, close to home.</span>
          <div className="flex justify-center md:justify-end gap-5"><button data-testid="footer-link-privacy" onClick={() => flash("We handle your documents carefully and only for the service you request.")} className="hover:text-[#f2b544]">Privacy</button><button data-testid="footer-link-notifications" onClick={() => scrollTo("notifications")} className="hover:text-[#f2b544]">Notifications</button></div>
        </div>
      </footer>

      {notice && <div data-testid="status-notice" className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#032e60] px-4 py-3 text-xs font-bold text-[#f8f4eb] shadow-[0_12px_32px_rgba(3,46,96,.25)]"><Check size={15} className="text-[#a5d8c9]" /> {notice}</div>}
      {modal === "application" && (
        <ApplicationModal
          service={selectedService}
          services={services}
          onClose={() => setModal(null)}
          onComplete={completeApplication}
        />
      )}
      {modal === "success" && (
        <SuccessModal
          application={lastSubmittedApplication}
          helpline={helplinePhone}
          onClose={() => setModal(null)}
          onTrack={(query) => {
            setTrackerInitialQuery(query);
            setModal("tracker");
          }}
        />
      )}
      {modal === "tracker" && (
        <CustomerTrackerModal
          initialQuery={trackerInitialQuery}
          helpline={helplinePhone}
          onClose={() => {
            setModal(null);
            setTrackerInitialQuery("");
          }}
        />
      )}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
          onApply={(title) => {
            setSelectedNotification(null);
            openApplication(title);
          }}
        />
      )}
    </div>
  );
}

function ServiceCard({ service, onStart }: { service: Service; onStart: () => void }) {
  const theme = getCategoryServiceTheme(service.category, service.accent, service.icon);
  return <article data-testid={`card-service-${service.id}`} className="lift group relative flex min-h-[365px] flex-col overflow-hidden rounded-2xl border border-[#ded5c6] bg-[#fcfaf5] p-4">
    <div className={`relative flex h-[132px] items-center justify-center overflow-hidden rounded-xl ${theme.accent}`}>
      <div className="absolute -right-7 -top-7 h-24 w-24 rounded-full border border-[#ffffff90]" /><div className="absolute -bottom-10 -left-6 h-28 w-28 rounded-full border border-[#ffffff90]" />
      <div className="relative grid h-20 w-24 place-items-center rounded-[18px] border-2 border-[#23405a] bg-[#f7f4eb] shadow-[6px_7px_0_#23405a]">
        <IconMapper name={theme.icon} size={38} strokeWidth={1.5} className="text-[#177d70]" />
      </div>
      <span className="absolute left-3 top-3 rounded-full bg-[#032e60] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-[#f8f4eb]">{service.category}</span>
    </div>
    <div className="flex flex-1 flex-col pt-4">
      <h3 className="font-display text-xl font-bold tracking-[-.045em] text-[#032e60]">{service.title}</h3>
      <p className="mt-2 text-xs leading-5 text-[#687579]">{service.copy}</p>
      <div className="mt-4 grid gap-2 text-[11px] text-[#667276]"><span className="flex items-center gap-2"><Clock3 size={13} className="text-[#d96f4a]" /> {service.timing}</span><span className="flex items-center gap-2"><FileText size={13} className="text-[#177d70]" /> Bring: {service.documents}</span></div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-[#e5dccd] pt-4">
        <span className="font-display text-base font-bold text-[#032e60]">{service.price}</span>
        <button data-testid={`button-start-service-${service.id}`} onClick={onStart} className="rounded-full bg-[#032e60] px-4 py-2 text-[12px] font-bold text-[#f8f4eb] transition-colors hover:bg-[#0b477e]">Start</button>
      </div>
    </div>
  </article>;
}

function ModalFrame({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return (
    <div 
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-[#032e60]/75 p-3 sm:p-4 md:p-6 backdrop-blur-xs" 
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-panel relative my-auto max-h-[90vh] sm:max-h-[88vh] w-full max-w-[560px] flex flex-col rounded-2xl sm:rounded-3xl border border-[#e1d7c6] bg-[#fcfaf5] shadow-[0_24px_80px_rgba(3,46,96,.4)] overflow-hidden">
        {/* Sticky Header with Title and Clear Cancellation Button */}
        <div className="p-5 sm:p-6 pb-3 sm:pb-4 bg-[#fcfaf5] border-b border-[#e8dfcf] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="font-display mt-1 text-xl sm:text-2xl md:text-3xl font-bold leading-tight tracking-[-.05em] text-[#032e60]">{title}</h2>
          </div>
          <button 
            data-testid="button-close-modal" 
            onClick={onClose} 
            aria-label="Close dialog" 
            title="Close / Cancel (Esc)"
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#d96f4a] hover:text-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <X size={19} />
          </button>
        </div>

        {/* Scrollable Body with Visible Custom Scrollbar */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}

function ApplicationModal({ 
  service, 
  services, 
  onClose, 
  onComplete 
}: { 
  service: string; 
  services: any[]; 
  onClose: () => void; 
  onComplete: (details: { id?: number; customerId?: string; customerName?: string; mobileNumber?: string; service?: string }) => void;
}) {
  const { showError } = useModal();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if opened from a notification or custom service
  const isNotification = Boolean(
    service && 
    !services.some((s) => s.title.toLowerCase() === service.toLowerCase()) && 
    service !== "General online service enquiry" && 
    service !== "Other"
  );

  const [selectedService, setSelectedService] = useState(() => {
    if (service) return service;
    return services[0]?.title ?? "Other";
  });

  const [isCustom, setIsCustom] = useState(false);
  const [customService, setCustomService] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    
    const finalServiceName = isCustom 
      ? (customService.trim() || "Other Custom Service")
      : selectedService === "Other"
      ? (customService.trim() || "Other Custom Service")
      : selectedService;

    const visitPref = formData.get("visit") ? `Preferred visit: ${formData.get("visit")}` : "";
    const userNotes = ((formData.get("notes") as string) || "").trim();
    const notifNote = isNotification && selectedService === service ? `[Notification Application: ${service}]` : "";
    const combinedNotes = [notifNote, visitPref, userNotes].filter(Boolean).join("\n");

    const customerName = ((formData.get("name") as string) || "").trim();
    const mobileNumber = ((formData.get("phone") as string) || "").trim();

    const data = {
      customerName,
      mobileNumber,
      serviceId: finalServiceName,
      notes: combinedNotes
    };
    
    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Server returned " + res.status);
      const result = await res.json();
      onComplete({
        id: result.id,
        customerId: result.customerId,
        customerName,
        mobileNumber,
        service: finalServiceName
      });
    } catch (err: any) {
      console.error(err);
      showError("Submission Failed", err.message || "Failed to submit request. Please check your network connection and try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <ModalFrame title="Apply at Airnet" eyebrow="Document & Application Service" onClose={onClose}>
      <p className="mt-3 text-sm leading-6 text-[#657276]">
        Fill in your contact details below. Airnet Computers will verify your documents, guide you through eligibility, and complete your application.
      </p>

      {/* If applying via a notification alert, show a clear badge */}
      {isNotification && (
        <div className="mt-4 rounded-2xl border border-[#b2d5cb] bg-[#eef7f4] p-3.5 flex items-start gap-3 shadow-xs">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[#177d70] text-white shrink-0 mt-0.5">
            <Bell size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#177d70]">
                Applying for Notification Alert
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCustom(true);
                  setCustomService(service);
                }}
                className="text-[11px] font-bold text-[#032e60] hover:text-[#177d70] underline cursor-pointer"
              >
                Customise name
              </button>
            </div>
            <p className="text-xs font-bold text-[#032e60] mt-0.5 leading-snug line-clamp-2">
              {service}
            </p>
          </div>
        </div>
      )}

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[#31495b]">
              Service / Post Name *
            </label>
            <button
              type="button"
              onClick={() => {
                setIsCustom(!isCustom);
                if (!isCustom && !customService) {
                  setCustomService(selectedService !== "Other" ? selectedService : "");
                }
              }}
              className="text-[11px] font-bold text-[#177d70] hover:underline cursor-pointer"
            >
              {isCustom ? "Choose from list" : "✏️ Custom service option"}
            </button>
          </div>

          {!isCustom ? (
            <select
              name="service"
              data-testid="select-application-service"
              value={selectedService}
              onChange={(e) => {
                if (e.target.value === "Other") {
                  setIsCustom(true);
                  setCustomService("");
                } else {
                  setSelectedService(e.target.value);
                }
              }}
              className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-semibold text-[#032e60] outline-none focus:border-[#177d70]"
            >
              {isNotification && (
                <option value={service}>
                  📢 {service}
                </option>
              )}
              {services.map((item) => (
                <option key={item.id} value={item.title}>
                  {item.title}
                </option>
              ))}
              <option value="Other">✏️ Other / Custom Service Name...</option>
            </select>
          ) : (
            <div className="mt-1.5 animate-in fade-in duration-150">
              <input
                name="customService"
                type="text"
                required
                autoFocus
                value={customService}
                onChange={(e) => setCustomService(e.target.value)}
                placeholder="e.g. Police Constable Recruitment, VAO, Caste Certificate..."
                className="h-11 w-full rounded-xl border-2 border-[#177d70] bg-[#fffdf8] px-3.5 text-sm font-semibold text-[#032e60] outline-none placeholder:font-normal placeholder:text-[#929b99] focus:ring-2 focus:ring-[#177d70]/20"
              />
              <p className="mt-1 text-[11px] text-[#71807f]">
                Enter any custom government job post, scholarship, exam, or certificate name.
              </p>
            </div>
          )}
        </div>

        <label className="block text-xs font-bold text-[#31495b]">
          Your Full Name *
          <input
            name="name"
            data-testid="input-application-name"
            required
            placeholder="e.g. Ramesh Patil"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3.5 text-sm font-medium text-[#032e60] outline-none placeholder:text-[#929b99] focus:border-[#177d70]"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold text-[#31495b]">
            Mobile Number (Calling / WhatsApp) *
            <input
              name="phone"
              data-testid="input-application-phone"
              required
              type="tel"
              placeholder="10 digit mobile"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3.5 text-sm font-medium text-[#032e60] outline-none placeholder:text-[#929b99] focus:border-[#177d70]"
            />
          </label>
          <label className="block text-xs font-bold text-[#31495b]">
            Preferred Visit
            <select
              name="visit"
              data-testid="select-application-visit"
              defaultValue="Any weekday"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3 text-sm font-medium text-[#032e60] outline-none focus:border-[#177d70]"
            >
              <option>Any weekday</option>
              <option>Saturday morning</option>
              <option>Urgent / Today</option>
              <option>I’ll call first</option>
            </select>
          </label>
        </div>

        <label className="block text-xs font-bold text-[#31495b]">
          Anything we should know? <span className="font-normal text-[#8b9491]">(optional)</span>
          <textarea
            name="notes"
            data-testid="input-application-note"
            rows={3}
            placeholder="For example: I have all documents and photo ready, need urgent submission..."
            className="mt-1.5 w-full resize-none rounded-xl border border-[#d6cbb9] bg-[#fffdf8] p-3 text-sm font-normal text-[#032e60] outline-none placeholder:text-[#929b99] focus:border-[#177d70]"
          />
        </label>

        <button
          data-testid="button-submit-application"
          disabled={isSubmitting}
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#032e60] px-5 py-3.5 text-sm font-bold text-[#f8f4eb] transition-all hover:bg-[#0b477e] disabled:opacity-70 disabled:cursor-not-allowed shadow-md transform active:scale-98"
        >
          {isSubmitting ? "Submitting application securely..." : "Submit Application Request"}
          {!isSubmitting && <Send size={16} className="text-[#f2b544]" />}
        </button>

        <p className="flex items-center justify-center gap-1.5 text-[10px] text-[#7b8582]">
          <ShieldCheck size={12} className="text-[#177d70]" /> No account needed. Airnet Computers will contact you directly to process your application.
        </p>
      </form>
    </ModalFrame>
  );
}

function NotificationDetailModal({
  notification,
  onClose,
  onApply,
}: {
  notification: any;
  onClose: () => void;
  onApply: (title: string) => void;
}) {
  const parsedLast = parseDateString(notification.lastDate);
  const isExpiringSoon =
    parsedLast &&
    parsedLast.getTime() - new Date().getTime() < 5 * 24 * 60 * 60 * 1000 &&
    parsedLast.getTime() >= new Date().getTime();
  const notifTheme = getNotificationCategoryTheme(notification.category);
  const NotifIcon = notifTheme.icon;

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[65] flex items-center justify-center bg-[#032e60]/75 p-3 sm:p-4 md:p-6 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel relative my-auto max-h-[90vh] sm:max-h-[88vh] w-full max-w-[660px] flex flex-col rounded-2xl sm:rounded-3xl border border-[#ded5c6] bg-[#fcfaf5] shadow-[0_24px_80px_rgba(3,46,96,.4)] overflow-hidden">
        {/* Sticky Header with Badges, Title and Visible Cancellation Button */}
        <div className="p-5 sm:p-6 pb-3 sm:pb-4 bg-[#fcfaf5] border-b border-[#e8dfcf] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-3 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#032e60] text-white">
                {notification.category}
              </span>
              {notification.isFeatured && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider bg-[#f2b544] text-[#032e60] flex items-center gap-1 shadow-2xs">
                  <Star size={11} className="fill-[#032e60]" /> Featured Alert
                </span>
              )}
              {notification.organization && (
                <span className="text-xs font-bold text-[#177d70] bg-[#dcebe5] px-2.5 py-0.5 rounded-full truncate max-w-[200px] sm:max-w-none">
                  {notification.organization}
                </span>
              )}
              {isExpiringSoon && (
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={12} /> Ending Soon!
                </span>
              )}
            </div>
            <h2 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#032e60] leading-snug">
              {notification.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close / Cancel (Esc)"
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#d96f4a] hover:text-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <X size={19} />
          </button>
        </div>

        {/* Scrollable Body with Visible Custom Scrollbar */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 custom-scrollbar">
          {/* Notification Icon Banner Header */}
          <div className={`flex items-center gap-4 rounded-2xl border border-[#ded5c6] ${notifTheme.accent} p-4`}>
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-2 border-[#23405a] bg-[#f7f4eb] shadow-[4px_4px_0_#23405a]">
              <NotifIcon size={26} className="text-[#177d70]" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#d96f4a] block">
                Official Public Notice
              </span>
              <p className="text-xs text-[#032e60] font-bold truncate">
                {notification.organization || "Public Department Notice"}
              </p>
              <p className="text-[11px] text-[#6b797b] truncate mt-0.5">
                Category: <span className="font-semibold text-[#032e60]">{notification.category}</span>
              </p>
            </div>
          </div>

          {/* Key Information Box */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#f3ece0] p-4 rounded-2xl border border-[#e1d5c2] text-xs">
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Total Vacancies</span>
              <span className="font-extrabold text-[#032e60] text-sm">{notification.vacancies || "Multiple Posts"}</span>
            </div>
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Qualification</span>
              <span className="font-extrabold text-[#032e60] text-sm">{notification.qualification || "As per notification"}</span>
            </div>
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Age Limit</span>
              <span className="font-extrabold text-[#032e60] text-sm">{notification.ageLimit || "18 - 35 Years"}</span>
            </div>
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Start Date</span>
              <span className="font-extrabold text-[#032e60] text-sm">{formatDateDMY(notification.startDate)}</span>
            </div>
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Last Date to Apply</span>
              <span className="font-extrabold text-red-600 text-sm">{formatDateDMY(notification.lastDate)}</span>
            </div>
            <div>
              <span className="text-[#7d8b8e] font-bold block text-[10px] uppercase">Application Fee</span>
              <span className="font-extrabold text-[#032e60] text-sm">{notification.applicationFee || "As per rules"}</span>
            </div>
          </div>

          {/* Description / Instructions */}
          {notification.description && (
            <div className="mt-5 space-y-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#7d8b8e]">
                Overview & Details
              </h4>
              <div className="text-sm text-[#4b595b] leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-[#e1d5c2] max-h-56 overflow-y-auto custom-scrollbar">
                {notification.description}
              </div>
            </div>
          )}

          {/* Airnet Service Callout */}
          <div className="mt-5 p-4 rounded-2xl bg-[#e4f0eb] border border-[#c7ddd4] flex items-start gap-3">
            <ShieldCheck size={20} className="text-[#177d70] shrink-0 mt-0.5" />
            <div className="text-xs text-[#3d595c] leading-5">
              <strong className="text-[#032e60] block font-bold">Apply without hassle at Airnet Computers</strong>
              Visit our center with your original documents, marks cards, photo and Aadhaar. We will verify your eligibility, fill the application form accurately, scan documents, make payment, and hand over your printout.
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 sm:p-5 bg-[#fcfaf5] border-t border-[#e8dfcf] flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="px-5 py-2.5 rounded-full border border-[#d6cbb9] bg-white text-[#52616b] hover:bg-[#ede8dc] hover:text-[#032e60] text-xs font-bold transition-colors cursor-pointer"
          >
            Cancel / Close
          </button>
          <button
            onClick={() => {
              onClose();
              onApply(notification.title);
            }}
            className="flex items-center justify-center gap-2 rounded-full bg-[#f2b544] hover:bg-[#ffc968] text-[#032e60] px-6 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all transform active:scale-95 cursor-pointer"
          >
            <span>Apply at Airnet Computers</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function getRegistrationConfirmationMessage(
  app?: {
    customerId?: string;
    customerName?: string;
    mobileNumber?: string;
    service?: string;
  } | null,
  helpline: string = "+91 7892881086"
): string {
  const customerId = app?.customerId || "AN-Pending";
  const customerName = app?.customerName || "Customer";
  const mobileNumber = app?.mobileNumber || "";
  const service = app?.service || "Online Service";

  return `Application Received!
Your application enquiry has been saved and dispatched to Airnet Computers.

Your Customer Reference ID: ${customerId}
Applicant: ${customerName}
Mobile Number: ${mobileNumber}
Service: ${service}.
Status: ● Enquiry Received

Airnet Computers (Md Amjad Ali) will review your enquiry in the Admin panel and call you on ${mobileNumber} to confirm documents and complete your application.

📍 Center Address: Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327
🗺️ Google Maps: https://maps.app.goo.gl/B6R9Jy9GfA1VdMoB8
📞 Helpline: ${helpline}

Thank you for choosing Airnet Computers!`;
}

function SuccessModal({
  application,
  helpline = "+91 7892881086",
  onClose,
  onTrack,
}: {
  application?: {
    id?: number;
    customerId?: string;
    customerName?: string;
    mobileNumber?: string;
    service?: string;
  } | null;
  helpline?: string;
  onClose: () => void;
  onTrack?: (query: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyId = () => {
    if (application?.customerId) {
      navigator.clipboard.writeText(application.customerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const customerId = application?.customerId || "AN-Pending";
  const customerName = application?.customerName || "Customer";
  const mobileNumber = application?.mobileNumber || "";
  const service = application?.service || "Online Service";
  const displayHelpline = helpline || "+91 7892881086";

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-[#032e60]/75 p-3 sm:p-4 md:p-6 backdrop-blur-xs text-left"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel relative my-auto w-full max-w-lg rounded-2xl sm:rounded-3xl border border-[#e1d7c6] bg-[#fcfaf5] text-left shadow-[0_24px_80px_rgba(3,46,96,.4)] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 bg-[#fcfaf5] border-b border-[#e8dfcf] flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 sm:gap-3.5 text-left flex-1 min-w-0">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#dcebe5] shadow-2xs mt-0.5">
              <Check size={24} className="text-[#177d70]" />
            </div>
            <div className="text-left flex-1 min-w-0">
              <h2 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#032e60] text-left">
                Application Submitted Successfully
              </h2>
              <p className="mt-0.5 text-xs text-[#52616b] text-left">
                Your application enquiry has been saved and dispatched to Airnet Computers.
              </p>
            </div>
          </div>
          <button
            data-testid="button-close-success"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close / Cancel (Esc)"
            className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-[#ede8dc] text-[#52616b] hover:bg-[#d96f4a] hover:text-white transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <X size={19} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {/* Customer Details Card */}
          <div className="p-4 bg-[#f0f7f4] border border-[#b2d5cb] rounded-2xl text-left">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#177d70]">
                Customer ID
              </span>
              <button
                type="button"
                onClick={copyId}
                className="text-[11px] font-bold text-[#032e60] hover:text-[#177d70] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Copy size={12} />
                {copied ? "Copied!" : "Copy ID"}
              </button>
            </div>
            <div className="font-mono text-xl sm:text-2xl font-black text-[#032e60] tracking-wider">
              {customerId}
            </div>

            <div className="mt-3 pt-3 border-t border-[#d2e7df] space-y-2 text-left text-xs sm:text-[13px]">
              <div className="flex items-baseline gap-2 text-left">
                <span className="text-[#657276] font-semibold text-left shrink-0">Applicant Name:</span>
                <span className="font-bold text-[#032e60] text-left">{customerName}</span>
              </div>
              <div className="flex items-baseline gap-2 text-left">
                <span className="text-[#657276] font-semibold text-left shrink-0">Mobile Number:</span>
                <span className="font-bold text-[#032e60] font-mono text-left">{mobileNumber}</span>
              </div>
              <div className="flex items-start gap-2 text-left">
                <span className="text-[#657276] font-semibold text-left shrink-0">Service Name:</span>
                <span className="font-bold text-[#032e60] text-left leading-snug">{service}</span>
              </div>
              <div className="flex items-center gap-2 text-left pt-0.5">
                <span className="text-[#657276] font-semibold text-left shrink-0">Status:</span>
                <span className="inline-flex font-extrabold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full text-[10px] text-left">
                  ● Enquiry Received
                </span>
              </div>
            </div>
          </div>

          {/* Follow-up Note */}
          <p className="text-xs sm:text-[13px] leading-relaxed text-[#41535e] text-left">
            Airnet Computers (Md Amjad Ali) will review your enquiry in the Admin panel and call you on{" "}
            <strong className="text-[#032e60] font-bold">{mobileNumber || "your mobile number"}</strong> to confirm documents and complete your application.
          </p>

          {/* Center Address, Maps & Helpline */}
          <div className="p-3.5 bg-white border border-[#e1d7c6] rounded-xl text-xs sm:text-[12.5px] text-[#2c3e50] space-y-2 leading-relaxed">
            <div>
              <span className="font-semibold text-[#032e60]">📍 Center Address:</span> Opp. Congress Office, Near Omer Masjid, Haralayya Chowk, Basavakalyan – 585327
            </div>
            <div>
              <span className="font-semibold text-[#032e60]">🗺️ Google Maps:</span>{" "}
              <a
                href="https://maps.app.goo.gl/boUHFrmjBcsLkwms9"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#177d70] hover:text-[#032e60] underline font-medium break-all"
              >
                https://maps.app.goo.gl/boUHFrmjBcsLkwms9
              </a>
            </div>
            <div>
              <span className="font-semibold text-[#032e60]">📞 Helpline:</span>{" "}
              <a
                href={`tel:${displayHelpline.replace(/\s+/g, "")}`}
                className="text-[#032e60] hover:text-[#177d70] font-bold underline"
              >
                {displayHelpline}
              </a>
            </div>
          </div>

          {/* Thank You Note */}
          <p className="text-center text-xs sm:text-sm font-bold text-[#177d70] pt-1">
            Thank you for choosing Airnet Computers!
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-[#fcfaf5] border-t border-[#e8dfcf] flex flex-col sm:flex-row gap-2.5 shrink-0">
          {onTrack && application?.customerId && (
            <button
              onClick={() => onTrack(application.customerId || "")}
              className="flex-1 flex items-center justify-center gap-2 rounded-full bg-[#f2b544] hover:bg-[#ffc968] px-5 py-2.5 text-xs font-bold text-[#032e60] shadow-sm transition-all cursor-pointer"
            >
              <Clock3 size={15} /> Track Application Status
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-[#032e60] hover:bg-[#0b477e] px-5 py-2.5 text-xs font-bold text-[#f8f4eb] transition-colors cursor-pointer text-center"
          >
            Close / Done
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerTrackerModal({
  initialQuery = "",
  helpline = "+91 7892881086",
  onClose,
}: {
  initialQuery?: string;
  helpline?: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [searched, setSearched] = useState(false);

  const executeLookup = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/tracker/lookup?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery.trim()) {
      executeLookup(initialQuery.trim());
    }
  }, [initialQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    executeLookup(query);
  };

  return (
    <ModalFrame title="Track Your Application" eyebrow="Live Status & Milestones" onClose={onClose}>
      <p className="mt-4 text-sm leading-6 text-[#657276]">
        Enter your <strong>Customer ID</strong> (e.g. <code>AN-12345</code>), <strong>Application / Ack Number</strong>, or 10-digit mobile number to see real-time progress.
      </p>

      <form onSubmit={handleSearch} className="mt-5 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. AN-58492 or Mobile / Ack No."
          required
          autoFocus
          className="flex-1 min-w-0 h-11 rounded-xl border border-[#d6cbb9] bg-[#fffdf8] px-3.5 text-sm font-semibold text-[#032e60] outline-none focus:border-[#177d70]"
        />
        <button
          type="submit"
          disabled={loading}
          className="h-11 px-4 sm:px-5 shrink-0 rounded-xl bg-[#032e60] text-white font-bold text-sm hover:bg-[#0b477e] disabled:opacity-50 transition-colors"
        >
          {loading ? "Checking..." : "Track"}
        </button>
      </form>

      {searched && results !== null && (
        <div className="mt-5 space-y-4 max-h-[55vh] overflow-y-auto pr-1.5 custom-scrollbar">
          {results.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-[#d6cbb9] rounded-xl bg-[#fcfaf5]">
              <p className="text-sm font-bold text-[#032e60]">No application records found</p>
              <p className="text-xs text-[#78878b] mt-1">Please verify your Customer ID or call Airnet Computers at {helpline}.</p>
            </div>
          ) : (
            results.map((task) => {
              return (
                <div key={task.id} className="p-4 rounded-xl border border-[#d6cbb9] bg-white shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <span className="font-mono text-xs font-bold bg-[#032e60] text-white px-2.5 py-0.5 rounded">
                        {task.customerId}
                      </span>
                      <h3 className="text-base font-bold text-[#032e60] mt-1">{task.serviceName}</h3>
                      <p className="text-xs text-gray-500 font-medium">Customer: <strong>{task.customerName}</strong></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={task.applyUrl || "https://www.google.com"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#032e60] hover:bg-[#022349] text-white text-xs font-bold rounded-lg shadow-2xs hover:shadow transition-all shrink-0"
                        title={`Open official portal for ${task.serviceName}`}
                      >
                        <span>Apply</span>
                        <ExternalLink size={13} />
                      </a>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        task.status === "Completed" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" :
                        task.status === "On Hold" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                        "bg-blue-100 text-blue-800 border border-blue-200"
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {task.applicationNumber && (
                    <p className="text-xs text-gray-500">Ref / Ack No: <strong className="font-mono text-gray-700">{task.applicationNumber}</strong></p>
                  )}

                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-blue-700 font-bold">Stage: {task.currentStep}</span>
                      <span className="text-gray-600 font-mono">{task.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                      <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${task.progressPercent}%` }} />
                    </div>
                  </div>

                  {/* Payment & Pending Information */}
                  <div className="flex items-center justify-between text-xs bg-[#f8f4eb] p-2.5 rounded-lg border border-[#e4dcce]">
                    <span className="text-[#657276]">
                      Payment: <strong>{task.paymentType || "Cash"}</strong>
                      {task.amountPaid !== undefined && task.amountPaid > 0 && ` (₹${task.amountPaid} paid)`}
                    </span>
                    {(task.amountPending ?? 0) > 0 ? (
                      <span className="font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-1">
                        Pending Due: ₹{task.amountPending}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                        ✓ No Dues Pending
                      </span>
                    )}
                  </div>

                  {task.status === "Completed" && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        Document Ready for Collection!
                      </div>
                      <p className="text-gray-700">Please collect your Document from our office.</p>
                      <a
                        href="https://maps.app.goo.gl/boUHFrmjBcsLkwms9"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 font-semibold underline mt-1"
                      >
                        <MapPin size={13} /> View Airnet Computers on Google Maps
                      </a>
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="text-xs font-bold text-gray-700">Milestones & Steps:</div>
                    {task.steps?.map((st: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          st.status === "completed" ? "bg-emerald-500 text-white" :
                          st.status === "in-progress" ? "bg-blue-600 text-white ring-2 ring-blue-200" :
                          "bg-gray-200 text-gray-500"
                        }`}>
                          {st.status === "completed" ? "✓" : idx + 1}
                        </div>
                        <span className={st.status === "completed" ? "text-gray-800 font-medium" : st.status === "in-progress" ? "text-blue-700 font-bold" : "text-gray-400"}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </ModalFrame>
  );
}

export default App;
