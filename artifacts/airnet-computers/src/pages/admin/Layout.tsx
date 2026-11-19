import { Link, Route, Switch, useLocation } from "wouter";
import { useEffect, useState, lazy, Suspense } from "react";
import { 
  Settings, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  Menu, 
  X, 
  Calendar, 
  Clock, 
  FolderArchive,
  LayoutDashboard,
  ClipboardList,
  Activity,
  Briefcase,
  Bell,
  FileSpreadsheet,
  BarChart3,
  CalendarClock,
  DatabaseBackup,
  Landmark,
  Route as RouteIcon
} from "lucide-react";
import PathwaySystemTray from "../../components/PathwaySystemTray";
import ErrorBoundary from "../../components/ErrorBoundary";

const Dashboard = lazy(() => import("./Dashboard"));
const AdminLogin = lazy(() => import("./Login"));
const Services = lazy(() => import("./Services"));
const GovernmentServices = lazy(() => import("./GovernmentServices"));
const Enquiries = lazy(() => import("./Enquiries"));
const Records = lazy(() => import("./Records"));
const Documents = lazy(() => import("./Documents"));
const Reports = lazy(() => import("./Reports"));
const DailyReports = lazy(() => import("./DailyReports"));
const Backup = lazy(() => import("./Backup"));
const ApplicationTracker = lazy(() => import("./ApplicationTracker"));
const NotificationsAdmin = lazy(() => import("./NotificationsAdmin"));
const AdminSettings = lazy(() => import("./Settings"));
const AISuggestions = lazy(() => import("./AISuggestions"));
const Pathway = lazy(() => import("./Pathway"));

function ModuleLoadingFallback() {
  return (
    <div className="h-64 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-medium text-slate-500">Loading module...</span>
    </div>
  );
}

export default function AdminLayout() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Real-time live date and time ticker (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = currentDateTime.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const formattedTime = currentDateTime.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/admin/me", { headers })
      .then((res) => res.json())
      .then((data) => setIsAuthenticated(!!data.authenticated))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
    }
    await fetch("/api/admin/logout", { method: "POST" });
    setIsAuthenticated(false);
    setLocation("/");
  };

  if (isAuthenticated === null) return <div className="h-screen grid place-items-center bg-[#f5f7fb]">Loading...</div>;
  
  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="h-screen grid place-items-center bg-[#061e38]"><div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
        <AdminLogin onLogin={() => setIsAuthenticated(true)} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#f5f7fb] text-[#111827] print:h-auto print:bg-white overflow-hidden">
      {/* Mobile Top Header */}
        <div className="md:hidden flex items-center justify-between bg-[#032e60] text-white p-3 border-b border-[#1e4b75] shrink-0 print:hidden z-30">
          <div className="flex items-center gap-2 font-bold text-sm">
            <img src="/logo.png" alt="Airnet Logo" className="w-6 h-6 rounded-lg object-contain bg-white p-0.5" />
            <span>Airnet Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg text-xs font-mono">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>{formattedTime}</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Admin Sidebar Navigation */}
        <aside
          className={`w-[300px] shrink-0 bg-[#032e60] text-white flex flex-col print:hidden overflow-y-auto custom-scrollbar z-50 fixed md:static inset-y-0 left-0 transition-transform duration-200 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <div className="p-5 font-bold text-lg tracking-tight border-b border-[#1e4b75] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Airnet Logo" className="w-7 h-7 rounded-lg object-contain bg-white p-0.5" />
              <span>Airnet Admin</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-white/70 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 p-3 space-y-1.5">
            {/* 1. Dashboard */}
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
                location === "/admin/dashboard" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Dashboard</span>
            </Link>

            {/* Pathway - Live Floating Desktop Dossier */}
            <Link
              href="/admin/pathway"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
                location === "/admin/pathway" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <RouteIcon className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Pathway</span>
              </div>
              <span className="text-[10px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                Float
              </span>
            </Link>

            {/* 2. My Enquiry List */}
            <Link
              href="/admin/enquiries"
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
                location === "/admin/enquiries" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
              }`}
            >
              <ClipboardList className="w-4 h-4 text-amber-400 shrink-0" />
              <span>My Enquiry List</span>
            </Link>

          {/* 3. Application Tracker */}
          <Link
            href="/admin/tracker"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/tracker" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Application Tracker</span>
            </div>
            <span className="text-[10px] bg-blue-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Live</span>
          </Link>

          {/* 4. Manage Services */}
          <Link
            href="/admin/services"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
              location === "/admin/services" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <Briefcase className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Manage Services</span>
          </Link>

          {/* 4b. Government Services */}
          <Link
            href="/admin/government-services"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/government-services" || location === "/admin/services-gov"
                ? "bg-[#2563eb] text-white font-semibold"
                : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Landmark className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Government Services</span>
            </div>
            <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Gov</span>
          </Link>

          {/* 5. Notifications */}
          <Link
            href="/admin/notifications"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/notifications" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>Notifications</span>
            </div>
            <span className="text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Alerts</span>
          </Link>

          {/* 6. Record */}
          <Link
            href="/admin/records"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
              location === "/admin/records" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-400 shrink-0" />
            <span>Record</span>
          </Link>

          {/* 7. Documents (Google Drive Integration) */}
          <Link
            href="/admin/documents"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/documents" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderArchive className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Documents</span>
            </div>
            <span className="text-[10px] bg-indigo-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Drive</span>
          </Link>

          {/* 8. Reports */}
          <Link
            href="/admin/reports"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center gap-2.5 ${
              location === "/admin/reports" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-gray-200"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Reports</span>
          </Link>

          {/* 9. Reminder (Renamed from Reminders & Daily Reports) */}
          <Link
            href="/admin/daily-reports"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/daily-reports" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-blue-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-4 h-4 text-pink-400 shrink-0" />
              <span>Reminder</span>
            </div>
            <span className="text-[10px] bg-cyan-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Daily</span>
          </Link>

          {/* 10. Backup (Renamed from Data Backup & Management) */}
          <Link
            href="/admin/backup"
            onClick={() => setMobileMenuOpen(false)}
            className={`block px-3.5 py-2 rounded-xl transition-colors flex items-center justify-between ${
              location === "/admin/backup" ? "bg-[#2563eb] text-white font-semibold" : "hover:bg-[#1a4473] text-orange-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <DatabaseBackup className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Backup</span>
            </div>
            <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">Backup</span>
          </Link>
        </nav>

        {/* Non-sticky Bottom Profile Section with Logo, Settings, and Logout */}
        <div className="mt-auto p-3 border-t border-[#1e4b75] bg-[#022349]/95">
          {/* Profile Identity Card */}
          <Link
            href="/admin/settings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer mb-2"
            title="Open Admin Settings (airnetcomputersbk@gmail.com)"
          >
            <div className="relative shrink-0">
              <img
                src="/logo.png"
                alt="Airnet Admin Profile Logo"
                className="w-10 h-10 rounded-full object-contain bg-white p-1 border-2 border-blue-400 shadow-md group-hover:border-blue-300 transition-all"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#022349] rounded-full" title="Administrator Online" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white group-hover:text-blue-200 transition-colors truncate">
                  Airnet Admin
                </span>
                <span className="text-[9px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-1 py-0.2 rounded font-semibold uppercase">
                  Master
                </span>
              </div>
              <div className="text-[11px] text-blue-200/80 truncate font-mono" title="airnetcomputersbk@gmail.com">
                airnetcomputersbk@gmail.com
              </div>
            </div>

            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          {/* Action Buttons: Admin Settings & Logout */}
          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-white/10">
            <Link
              href="/admin/settings"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                location === "/admin/settings"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white/5 hover:bg-white/10 text-blue-100 hover:text-white"
              }`}
              title="Admin Settings & Security"
            >
              <Settings className="w-3.5 h-3.5 text-blue-300" />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-white/5 hover:bg-red-600/90 text-red-200 hover:text-white text-xs font-semibold transition-all border border-transparent hover:border-red-400/40 cursor-pointer"
              title="Logout from Admin Panel"
            >
              <LogOut className="w-3.5 h-3.5 text-red-300" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area with Persistent Live Top Bar */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar with Live Date & Time + Pathway System Tray */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 print:hidden shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-xs uppercase tracking-wider text-[#032e60]">
                Airnet Computers
              </span>
            </div>
            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              Administrative Control Center
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Pathway Docked System Tray */}
            <PathwaySystemTray />

            {/* Real-time Live Date and Time Clock */}
            <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-2xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="font-semibold">{formattedDate}</span>
              </div>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5 text-xs">
                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-mono font-bold text-slate-900">{formattedTime}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 print:p-2 print:overflow-visible custom-scrollbar">
          <ErrorBoundary fallbackTitle="Admin Module Error">
            <Suspense fallback={<ModuleLoadingFallback />}>
              <Switch>
                <Route path="/admin/dashboard" component={Dashboard} />
                <Route path="/admin/pathway" component={Pathway} />
                <Route path="/admin/tracker" component={ApplicationTracker} />
                <Route path="/admin/services" component={Services} />
                <Route path="/admin/government-services" component={GovernmentServices} />
                <Route path="/admin/services-gov" component={GovernmentServices} />
                <Route path="/admin/enquiries" component={Enquiries} />
                <Route path="/admin/records" component={Records} />
                <Route path="/admin/documents" component={Documents} />
                <Route path="/admin/reports" component={Reports} />
                <Route path="/admin/daily-reports" component={DailyReports} />
                <Route path="/admin/backup" component={Backup} />
                <Route path="/admin/notifications" component={NotificationsAdmin} />
                <Route path="/admin/settings" component={AdminSettings} />
                <Route path="/admin/ai-suggestions" component={AISuggestions} />
                <Route path="/admin/*">
                  <div className="text-2xl font-bold">Coming Soon</div>
                </Route>
              </Switch>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
