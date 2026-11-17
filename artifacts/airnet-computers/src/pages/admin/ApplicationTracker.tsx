import { useState, useEffect, useDeferredValue } from "react";
import {
  Search,
  Plus,
  Eye,
  Pencil,
  Trash2,
  X,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Share2,
  Calendar,
  User,
  Phone,
  FileText,
  Sparkles,
  ChevronRight,
  Copy,
  ExternalLink,
  Check,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  IndianRupee,
  Wallet,
  CreditCard,
  Route
} from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useLiveSync } from "../../hooks/useLiveSync";
import { usePathway } from "../../context/PathwayContext";

export type ApplicationStep = {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending" | "rejected";
  completedAt?: string | null;
  note?: string;
};

export type ApplicationTask = {
  id: number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceName: string;
  applyUrl?: string;
  applicationNumber?: string;
  currentStep: string;
  status: "In Progress" | "Completed" | "On Hold" | "Pending" | "Rejected";
  progressPercent: number;
  steps: ApplicationStep[];
  priority: "Low" | "Normal" | "Urgent";
  targetDate?: string;
  assignedStaff?: string;
  paymentType?: string;
  amountCharged?: number;
  amountPaid?: number;
  amountPending?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const STEP_TEMPLATES: Record<string, string[]> = {
  "Standard Service (5 Steps)": [
    "Application & Documents Received",
    "Document Verification & Data Validation",
    "Submitted to Official Portal / Dept",
    "Approval & Certificate Generation",
    "Ready for Delivery / Delivered"
  ],
  "Passport Application": [
    "Documents Collected & Scrutiny Done",
    "Online Form Submission & Fee Paid",
    "Appointment Scheduled at PSK / POPSK",
    "Police Verification & Clearance",
    "Passport Printed & Dispatched",
    "Passport Received & Handed to Customer"
  ],
  "PAN Card Application": [
    "Proof of Identity & Address Verified",
    "Application Uploaded & Acknowledgment Generated",
    "Document Verification by NSDL / UTIITSL",
    "e-PAN Generated & Sent via Email",
    "Physical Card Printed & Delivered"
  ],
  "Aadhaar Card Services": [
    "Enrolment / Update Form Filled",
    "Biometrics & Demographic Data Uploaded",
    "Backend Verification by UIDAI",
    "Updated Aadhaar Card Downloaded & Printed"
  ],
  "Govt Job / Exam Application": [
    "Eligibility & Qualification Checked",
    "Photos, Signature & Documents Resized",
    "Online Application Form Submitted",
    "Exam Fee Paid & Receipt Generated",
    "Hall Ticket / Admit Card Tracked"
  ],
  "Income / Caste / Residence Certificate": [
    "Application & Affidavit Prepared",
    "Submitted on Seva Sindhu / State Portal",
    "Revenue Inspector / VA Verification",
    "Tahsildar Digital Signature & Approval",
    "Original Certificate Printed & Laminated"
  ]
};

export default function ApplicationTracker() {
  const { showSuccess, showError, showWarning, confirmDelete } = useModal();
  
  const { openPathway } = usePathway();

  // High performance SWR Cache: render cached tracker tasks in 0ms without blank screen flicker
  const [tasks, setTasks] = useState<ApplicationTask[]>(() => {
    return getCachedData<ApplicationTask[]>("admin_tracker") || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedData<ApplicationTask[]>("admin_tracker");
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTrackingTask, setActiveTrackingTask] = useState<ApplicationTask | null>(null);
  const [editingTask, setEditingTask] = useState<ApplicationTask | null>(null);
  const [completedNotificationTask, setCompletedNotificationTask] = useState<ApplicationTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Available services & existing customers for quick selection
  const [servicesList, setServicesList] = useState<string[]>([]);
  const [govServices, setGovServices] = useState<Array<{ id: number; name: string; url: string; iconKey: string }>>([]);
  const [recentCustomers, setRecentCustomers] = useState<Array<{ customerId: string; customerName: string; mobileNumber: string }>>([]);

  // Helper to format today's date as YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Form Data for New Application
  const [selectedTemplate, setSelectedTemplate] = useState("Standard Service (5 Steps)");
  const [helplinePhone, setHelplinePhone] = useState("+91 7892881086");
  const [formData, setFormData] = useState({
    customerId: "",
    customerName: "",
    mobileNumber: "",
    serviceName: "",
    applyUrl: "",
    applicationNumber: "",
    priority: "Normal" as "Low" | "Normal" | "Urgent",
    targetDate: getTodayDateString(),
    assignedStaff: "",
    paymentType: "Cash",
    amountCharged: "",
    amountPaid: "",
    amountPending: "",
    notes: "",
    initialStatus: "In Progress" as "In Progress" | "Pending",
  });

  const fetchTasks = async (silent = false) => {
    if (!silent && tasks.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/admin/tracker");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
        setCachedData("admin_tracker", data);
      }
    } catch (err) {
      console.error("Failed to load application tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  // Multi-Device Instant Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("tracker", () => {
    fetchTasks(true);
  });

  const fetchMetadata = async () => {
    try {
      const [govServicesRes, enquiriesRes, infoRes] = await Promise.all([
        fetch("/api/government-services"),
        fetch("/api/admin/enquiries"),
        fetch("/api/business-info"),
      ]);
      if (govServicesRes.ok) {
        const sData = await govServicesRes.json();
        setGovServices(sData);
        setServicesList(sData.map((s: any) => s.name));
      }
      if (infoRes.ok) {
        const info = await infoRes.json();
        if (info.helpline || info.mobileNumber) {
          setHelplinePhone(info.helpline || info.mobileNumber);
        }
      }
      if (enquiriesRes.ok) {
        const eData = await enquiriesRes.json();
        const map = new Map<string, { customerId: string; customerName: string; mobileNumber: string }>();
        eData.forEach((e: any) => {
          if (e.customerId && !map.has(e.customerId)) {
            map.set(e.customerId, {
              customerId: e.customerId,
              customerName: e.customerName,
              mobileNumber: e.mobileNumber
            });
          }
        });
        setRecentCustomers(Array.from(map.values()).slice(0, 20));
      }
    } catch (err) {
      console.error("Failed to load metadata:", err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchMetadata();
  }, []);

  // Escape key listener for easy modal cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (completedNotificationTask) setCompletedNotificationTask(null);
        else if (editingTask) setEditingTask(null);
        else if (activeTrackingTask) setActiveTrackingTask(null);
        else if (showAddModal) setShowAddModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completedNotificationTask, editingTask, activeTrackingTask, showAddModal]);

  const generateCustomerId = () => {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    return `AN-${randomDigits}`;
  };

  const openNewTaskModal = () => {
    const defaultServiceName = servicesList[0] || (govServices[0]?.name ?? "Aadhaar");
    const matchedGov = govServices.find(g => g.name.toLowerCase() === defaultServiceName.toLowerCase());
    setFormData({
      customerId: generateCustomerId(),
      customerName: "",
      mobileNumber: "",
      serviceName: defaultServiceName,
      applyUrl: matchedGov ? matchedGov.url : "",
      applicationNumber: "",
      priority: "Normal",
      targetDate: getTodayDateString(),
      assignedStaff: "Airnet Desk",
      paymentType: "Cash",
      amountCharged: "",
      amountPaid: "",
      amountPending: "",
      notes: "",
      initialStatus: "In Progress"
    });
    setSelectedTemplate("Standard Service (5 Steps)");
    setShowAddModal(true);
  };

  const handleSelectExistingCustomer = (c: { customerId: string; customerName: string; mobileNumber: string }) => {
    setFormData(prev => ({
      ...prev,
      customerId: c.customerId,
      customerName: c.customerName,
      mobileNumber: c.mobileNumber
    }));
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.mobileNumber || !formData.serviceName) {
      showWarning("Missing Details", "Please fill in Customer Name, Mobile Number, and Service.");
      return;
    }

    setIsSubmitting(true);
    try {
      const templateSteps = STEP_TEMPLATES[selectedTemplate] || STEP_TEMPLATES["Standard Service (5 Steps)"];
      const steps: ApplicationStep[] = templateSteps.map((title, idx) => ({
        id: `step-${idx + 1}`,
        title,
        status: idx === 0 ? "completed" : idx === 1 ? "in-progress" : "pending",
        completedAt: idx === 0 ? new Date().toISOString() : null,
        note: idx === 0 ? "Application initiated" : ""
      }));

      const progressPercent = Math.round((1 / steps.length) * 100);
      const currentStep = steps[1]?.title || steps[0].title;

      const charged = Number(formData.amountCharged) || ((Number(formData.amountPaid) || 0) + (Number(formData.amountPending) || 0));
      const paid = Number(formData.amountPaid) || 0;
      const pending = Math.max(0, charged - paid);

      const matchedGov = govServices.find(g => g.name.toLowerCase() === formData.serviceName.trim().toLowerCase());
      const effectiveApplyUrl = formData.applyUrl || (matchedGov ? matchedGov.url : "");

      const res = await fetch("/api/admin/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId || generateCustomerId(),
          customerName: formData.customerName,
          mobileNumber: formData.mobileNumber,
          serviceName: formData.serviceName,
          applyUrl: effectiveApplyUrl,
          applicationNumber: formData.applicationNumber,
          priority: formData.priority,
          targetDate: formData.targetDate,
          assignedStaff: formData.assignedStaff,
          paymentType: formData.paymentType || "Cash",
          amountCharged: charged,
          amountPaid: paid,
          amountPending: pending,
          notes: formData.notes,
          status: formData.initialStatus,
          steps,
          currentStep,
          progressPercent
        })
      });

      if (res.ok) {
        const newTask = await res.json();
        const updatedTasksList = [newTask, ...tasks];
        setTasks(updatedTasksList);
        setCachedData("admin_tracker", updatedTasksList);
        setShowAddModal(false);
        showSuccess(
          "Application Task Created",
          `Live application tracking initiated for "${formData.customerName}".`
        );
      } else {
        showError("Creation Failed", "Failed to create application task. Please check server status.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Creation Error", err.message || "Error creating application task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStepStatus = async (
    task: ApplicationTask,
    stepIndex: number,
    newStatus: "completed" | "in-progress" | "pending" | "rejected",
    customNote?: string
  ) => {
    const updatedSteps = task.steps.map((step, idx) => {
      if (idx === stepIndex) {
        return {
          ...step,
          status: newStatus,
          completedAt: newStatus === "completed" ? (step.completedAt || new Date().toISOString()) : null,
          note: customNote !== undefined ? customNote : step.note
        };
      }
      return step;
    });

    // Auto-calculate progress
    const completedCount = updatedSteps.filter(s => s.status === "completed").length;
    const progressPercent = Math.round((completedCount / updatedSteps.length) * 100);

    // Determine current active step
    let currentStep = task.currentStep;
    const active = updatedSteps.find(s => s.status === "in-progress") || updatedSteps.find(s => s.status === "pending") || updatedSteps[updatedSteps.length - 1];
    if (active) currentStep = active.title;

    // Determine task status
    let status: ApplicationTask["status"] = task.status;
    if (progressPercent === 100) {
      status = "Completed";
    } else if (updatedSteps.some(s => s.status === "rejected")) {
      status = "On Hold";
    } else {
      status = "In Progress";
    }

    const updatedTask = {
      ...task,
      steps: updatedSteps,
      progressPercent,
      currentStep,
      status
    };

    // Optimistic update
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? updatedTask : t);
      setCachedData("admin_tracker", updated);
      return updated;
    });
    if (activeTrackingTask && activeTrackingTask.id === task.id) {
      setActiveTrackingTask(updatedTask);
    }

    // When status becomes Completed, send message to user via WhatsApp & display completion dialog
    const becameCompleted = (status === "Completed" && task.status !== "Completed") || (progressPercent === 100 && task.progressPercent < 100);
    if (becameCompleted) {
      sendWhatsAppUpdate(updatedTask);
      setCompletedNotificationTask(updatedTask);
    }

    try {
      await fetch(`/api/admin/tracker/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps: updatedSteps,
          progressPercent,
          currentStep,
          status
        })
      });
    } catch (err) {
      console.error("Failed to update step:", err);
      fetchTasks();
    }
  };

  const handleAddCustomStep = async (task: ApplicationTask, newTitle: string) => {
    if (!newTitle.trim()) return;
    const newStep: ApplicationStep = {
      id: `step-${Date.now()}`,
      title: newTitle.trim(),
      status: "pending",
      completedAt: null,
      note: ""
    };
    const updatedSteps = [...task.steps, newStep];
    const completedCount = updatedSteps.filter(s => s.status === "completed").length;
    const progressPercent = Math.round((completedCount / updatedSteps.length) * 100);

    const updatedTask = {
      ...task,
      steps: updatedSteps,
      progressPercent
    };

    setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    if (activeTrackingTask && activeTrackingTask.id === task.id) {
      setActiveTrackingTask(updatedTask);
    }

    await fetch(`/api/admin/tracker/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ steps: updatedSteps, progressPercent })
    });
  };

  const handleDeleteTask = async (task: ApplicationTask) => {
    await confirmDelete({
      title: "Delete Application?",
      message: "Are you sure you want to delete this tracked application? This action may not be reversible.",
      itemName: `${task.customerName} (${task.serviceName})`,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/tracker/${task.id}`, { method: "DELETE" });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete tracked application.");
        }
        setTasks(prev => {
          const updated = prev.filter(t => t.id !== task.id);
          setCachedData("admin_tracker", updated);
          return updated;
        });
        if (activeTrackingTask?.id === task.id) setActiveTrackingTask(null);
      }
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    try {
      const charged = Number(editingTask.amountCharged) || ((Number(editingTask.amountPaid) || 0) + (Number(editingTask.amountPending) || 0));
      const paid = Number(editingTask.amountPaid) || 0;
      const pending = Number(editingTask.amountPending) || 0;

      const res = await fetch(`/api/admin/tracker/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editingTask,
          amountCharged: charged,
          amountPaid: paid,
          amountPending: pending,
        })
      });
      if (res.ok) {
        const saved = await res.json();
        const prevTask = tasks.find(t => t.id === saved.id);
        const becameCompleted = (saved.status === "Completed" && prevTask?.status !== "Completed") || (saved.progressPercent === 100 && (prevTask?.progressPercent ?? 0) < 100);

        setTasks(prev => {
          const updated = prev.map(t => t.id === saved.id ? saved : t);
          setCachedData("admin_tracker", updated);
          return updated;
        });
        if (activeTrackingTask?.id === saved.id) setActiveTrackingTask(saved);
        setEditingTask(null);

        showSuccess(
          "Application Updated",
          `Application for "${saved.customerName}" has been updated.`
        );

        if (becameCompleted) {
          sendWhatsAppUpdate(saved);
          setCompletedNotificationTask(saved);
        }
      } else {
        showError("Update Failed", "Failed to update application details.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Update Error", err.message || "Failed to update application details.");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getRawWhatsAppMessage = (task: ApplicationTask) => {
    const isCompleted = task.status === "Completed" || task.progressPercent === 100;
    const paymentInfo = (task.amountPending && task.amountPending > 0)
      ? `💰 *Payment:* Paid: ₹${task.amountPaid ?? 0} | Balance Due: ₹${task.amountPending}\n⚠️ *Pending Amount to Pay:* ₹${task.amountPending}\n`
      : (task.amountPaid && task.amountPaid > 0)
      ? `💰 *Payment:* Paid in Full (₹${task.amountPaid})\n`
      : "";

    if (isCompleted) {
      return `*AIRNET COMPUTERS - Application Status Update*
Dear Customer,
👤 *Customer ID:* ${task.customerId}
📋 *Customer Name:* ${task.customerName}
🛠️ *Service:* ${task.serviceName}
${task.applicationNumber ? `🔖 *Ref/Ack No:* ${task.applicationNumber}\n` : ""}📍 *Current Step:* ${task.currentStep}
📊 *Progress:* 100% [Completed]
${paymentInfo}
🎉 *Document Ready for Collection!*
Please visit our office to collect your document.
📍 *Location:* Airnet Computers, Haralayya Chowk, Basavakalyan
🗺️ *Google Maps:* https://maps.app.goo.gl/B6R9Jy9GfA1VdMoB8
📞 *Helpline:* ${helplinePhone}

Thank you for choosing Airnet Computers!`;
    }

    return `*AIRNET COMPUTERS - Application Status Update*
Dear Customer,
👤 *Customer ID:* ${task.customerId}
📋 *Customer Name:* ${task.customerName}
🛠️ *Service:* ${task.serviceName}
${task.applicationNumber ? `🔖 *Ref/Ack No:* ${task.applicationNumber}\n` : ""}📍 *Current Step:* ${task.currentStep}
📊 *Progress:* ${task.progressPercent}% [${task.status}]
${task.targetDate ? `📅 *Est. Ready Date:* ${task.targetDate}\n` : ""}${paymentInfo}ℹ️ Your application is currently being processed.
For any queries, reply to this message or call ${helplinePhone}.

Thank you for choosing Airnet Computers!`;
  };

  const generateWhatsAppMessage = (task: ApplicationTask) => {
    return encodeURIComponent(getRawWhatsAppMessage(task));
  };

  const sendWhatsAppUpdate = (task: ApplicationTask) => {
    const cleanPhone = task.mobileNumber.replace(/\D/g, "");
    const url = `https://wa.me/91${cleanPhone}?text=${generateWhatsAppMessage(task)}`;
    window.open(url, "_blank");
  };

  const deferredSearch = useDeferredValue(search);

  // Filter tasks (non-blocking concurrent filter)
  const filteredTasks = tasks.filter(t => {
    const q = deferredSearch.toLowerCase();
    const matchesSearch =
      !q ||
      t.customerId.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.mobileNumber.includes(q) ||
      t.serviceName.toLowerCase().includes(q) ||
      (t.applicationNumber && t.applicationNumber.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "All" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "All" || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Calculate Metrics
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter(t => t.status === "In Progress").length;
  const completedCount = tasks.filter(t => t.status === "Completed").length;
  const onHoldCount = tasks.filter(t => t.status === "On Hold" || t.status === "Pending").length;
  const totalPendingAmount = tasks.reduce((sum, t) => sum + (Number(t.amountPending) || 0), 0);
  const tasksWithPendingCount = tasks.filter(t => (Number(t.amountPending) || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#032e60] flex items-center gap-3">
            <ShieldCheck className="text-blue-600" size={32} />
            Application Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track real-time multi-step progress, document status, and milestones for customer tasks with Customer IDs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTasks()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            onClick={openNewTaskModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563eb] text-white hover:bg-blue-700 font-semibold text-sm transition-all shadow-sm"
          >
            <Plus size={18} />
            New Application Task
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Tracked</div>
            <div className="text-2xl font-bold text-[#032e60] mt-1">{totalTasks}</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
            <FolderOpen size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">In Progress</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">{inProgressCount}</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Completed</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{completedCount}</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pending / On Hold</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">{onHoldCount}</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
            <AlertCircle size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Amount</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">₹{totalPendingAmount.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{tasksWithPendingCount} customer{tasksWithPendingCount === 1 ? "" : "s"} due</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
            <IndianRupee size={22} />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <input
            type="text"
            placeholder="Search by Customer ID (AN-...), Name, Mobile, Service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="Normal">Normal</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Tasks List / Cards */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <RefreshCw className="animate-spin mx-auto mb-3 text-blue-600" size={24} />
          Loading application tracker records...
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheck className="mx-auto mb-3 text-gray-300" size={48} />
          <h3 className="text-lg font-bold text-gray-700">No Application Tasks Found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {search || statusFilter !== "All"
              ? "No tasks match your filter criteria. Try clearing search filters."
              : "No customer tasks are currently being tracked. Click 'New Application Task' to start tracking progress with Customer IDs."}
          </p>
          <button
            onClick={openNewTaskModal}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Create First Tracked Task
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map((task) => {
            const completedStepsCount = task.steps.filter(s => s.status === "completed").length;
            const totalStepsCount = task.steps.length;

            return (
              <div
                key={task.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Customer ID Pill */}
                    <div className="flex items-center gap-1.5 bg-[#032e60] text-white px-3 py-1 rounded-md text-xs font-bold font-mono tracking-wide">
                      <span>{task.customerId}</span>
                      <button
                        onClick={() => copyToClipboard(task.customerId, `cid-${task.id}`)}
                        className="hover:text-blue-200"
                        title="Copy Customer ID"
                      >
                        {copiedId === `cid-${task.id}` ? <Check size={12} className="text-green-300" /> : <Copy size={12} />}
                      </button>
                    </div>

                    <span className="font-bold text-gray-900 text-base">{task.customerName}</span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone size={12} />
                      {task.mobileNumber}
                    </span>

                    {task.priority === "Urgent" && (
                      <span className="bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        Urgent
                      </span>
                    )}

                    {(task.amountPending ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                        <IndianRupee size={12} className="text-amber-600" />
                        ₹{task.amountPending} Pending
                      </span>
                    ) : (task.amountPaid ?? 0) > 0 ? (
                      <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <Check size={11} className="text-emerald-600" />
                        ₹{task.amountPaid} Paid ({task.paymentType || "Cash"})
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Status Pill */}
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        task.status === "Completed"
                          ? "bg-emerald-100 text-emerald-800"
                          : task.status === "In Progress"
                          ? "bg-blue-100 text-blue-800"
                          : task.status === "On Hold"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {task.status}
                    </span>

                    {/* Pathway Floating Window Launcher */}
                    <button
                      type="button"
                      onClick={() => openPathway(task)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs hover:shadow transition-all cursor-pointer"
                      title="Open Customer Pathway Dossier in Floating Desktop Window"
                    >
                      <Route size={13} />
                      <span>Pathway</span>
                    </button>

                    {/* Official Portal Apply Button */}
                    <a
                      href={task.applyUrl || "https://www.google.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#032e60] hover:bg-[#022349] text-white text-xs font-bold rounded-lg shadow-2xs hover:shadow transition-colors"
                      title={`Open official portal for ${task.serviceName}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Apply</span>
                      <ExternalLink size={13} />
                    </a>

                    {/* WhatsApp Update Link */}
                    <a
                      href={`https://wa.me/91${task.mobileNumber.replace(/\D/g, "")}?text=${generateWhatsAppMessage(task)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-emerald-200 transition-colors"
                      title="Send WhatsApp Status to Customer"
                    >
                      <Share2 size={15} />
                    </a>

                    <button
                      onClick={() => setEditingTask(task)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Details"
                    >
                      <Pencil size={15} />
                    </button>

                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Service, Ack Number, Deadline & Payment Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold block">Service / Task</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-semibold text-gray-800">{task.serviceName}</span>
                      <a
                        href={task.applyUrl || "https://www.google.com"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#032e60] hover:bg-[#022349] text-white text-[11px] font-semibold rounded shadow-2xs hover:shadow transition-colors shrink-0"
                        title={`Open official portal for ${task.serviceName}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Apply</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold block">Ref / Ack Number</span>
                    <span className="font-mono text-gray-700">{task.applicationNumber || "— Not Assigned —"}</span>
                  </div>

                  <div>
                    <span className="text-xs text-gray-400 uppercase font-semibold block">Target Deadline</span>
                    <span className="text-gray-700 flex items-center gap-1">
                      <Calendar size={13} className="text-gray-400" />
                      {task.targetDate || "Open Timeline"}
                    </span>
                  </div>

                  <div className="bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 flex flex-col justify-center">
                    <span className="text-[11px] text-gray-500 uppercase font-semibold block flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <IndianRupee size={11} className="text-gray-400" /> Payment & Balance
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium capitalize">{task.paymentType || "Cash"}</span>
                    </span>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-gray-600">
                        Charged: <strong className="text-gray-900 font-mono">₹{task.amountCharged ?? ((task.amountPaid ?? 0) + (task.amountPending ?? 0))}</strong> | Paid: <strong className="text-emerald-700 font-mono">₹{task.amountPaid ?? 0}</strong>
                      </span>
                      {(task.amountPending ?? 0) > 0 ? (
                        <span className="font-mono font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded flex items-center gap-0.5">
                          ₹{task.amountPending} Due
                        </span>
                      ) : (
                        <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          ✓ Cleared
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Bar & Current Stage */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      Current Stage: <span className="text-blue-700 font-bold">{task.currentStep}</span>
                    </span>
                    <span className="font-bold text-gray-600">
                      {completedStepsCount} of {totalStepsCount} steps ({task.progressPercent}%)
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        task.status === "Completed"
                          ? "bg-emerald-500"
                          : task.status === "On Hold"
                          ? "bg-amber-500"
                          : "bg-blue-600"
                      }`}
                      style={{ width: `${task.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Horizontal Step Dots preview */}
                <div className="flex items-center justify-between pt-1 overflow-x-auto gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    {task.steps.map((st, i) => (
                      <div key={st.id || i} className="flex items-center gap-2 flex-1">
                        <div
                          className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold shrink-0 ${
                            st.status === "completed"
                              ? "bg-emerald-500 text-white"
                              : st.status === "in-progress"
                              ? "bg-blue-600 text-white ring-2 ring-blue-200"
                              : st.status === "rejected"
                              ? "bg-red-500 text-white"
                              : "bg-gray-100 text-gray-400 border border-gray-200"
                          }`}
                          title={`${st.title}: ${st.status}`}
                        >
                          {st.status === "completed" ? <Check size={11} /> : i + 1}
                        </div>
                        {i < task.steps.length - 1 && (
                          <div
                            className={`h-0.5 flex-1 ${
                              task.steps[i + 1].status === "completed" || st.status === "completed"
                                ? "bg-emerald-300"
                                : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveTrackingTask(task)}
                    className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                  >
                    Manage Steps & Progress
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: MANAGE STEPS & PROGRESS TIMELINE ================= */}
      {activeTrackingTask && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setActiveTrackingTask(null); }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 bg-[#032e60] text-white flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded text-xs font-bold">
                    {activeTrackingTask.customerId}
                  </span>
                  <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/80">
                    {activeTrackingTask.serviceName}
                  </span>
                </div>
                <h2 className="text-2xl font-bold">{activeTrackingTask.customerName}</h2>
                <div className="text-xs text-blue-200 flex items-center gap-3 mt-1">
                  <span>Phone: {activeTrackingTask.mobileNumber}</span>
                  {activeTrackingTask.applicationNumber && (
                    <span>Ref/Ack: {activeTrackingTask.applicationNumber}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={activeTrackingTask.applyUrl || "https://www.google.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                  title={`Open official portal for ${activeTrackingTask.serviceName}`}
                >
                  <span>Apply</span>
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => setActiveTrackingTask(null)}
                  title="Close / Cancel (Esc)"
                  className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Overall Progress Summary Bar in Modal */}
            <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall Progress</div>
                <div className="text-xl font-bold text-gray-800">
                  {activeTrackingTask.progressPercent}% — {activeTrackingTask.status}
                </div>
              </div>
              <div className="w-48 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-300 ${
                    activeTrackingTask.status === "Completed"
                      ? "bg-emerald-500"
                      : activeTrackingTask.status === "On Hold"
                      ? "bg-amber-500"
                      : "bg-blue-600"
                  }`}
                  style={{ width: `${activeTrackingTask.progressPercent}%` }}
                />
              </div>
            </div>

            {/* Payment & Pending Info in Modal */}
            <div className="bg-amber-50/70 px-6 py-3 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  <Wallet size={14} className="text-gray-500" />
                  Payment Type: <strong className="text-gray-900">{activeTrackingTask.paymentType || "Cash"}</strong>
                </span>
                <span className="text-gray-600 font-medium">
                  Amount Charged: <strong className="text-gray-900 font-mono">₹{activeTrackingTask.amountCharged ?? ((activeTrackingTask.amountPaid ?? 0) + (activeTrackingTask.amountPending ?? 0))}</strong>
                </span>
                <span className="text-gray-600 font-medium">
                  Amount Paid: <strong className="text-emerald-700 font-mono">₹{activeTrackingTask.amountPaid ?? 0}</strong>
                </span>
                <span className="text-gray-600 flex items-center gap-1.5 font-medium">
                  Due Amount:{" "}
                  <strong className={`font-mono px-2 py-0.5 rounded font-bold ${
                    (activeTrackingTask.amountPending ?? 0) > 0
                      ? "bg-amber-200 text-amber-900 border border-amber-300"
                      : "bg-emerald-100 text-emerald-800"
                  }`}>
                    ₹{activeTrackingTask.amountPending ?? 0}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingTask(activeTrackingTask);
                  setActiveTrackingTask(null);
                }}
                className="text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                <Pencil size={12} />
                Update Payment / Balance
              </button>
            </div>

            {/* Steps Timeline Content with Visible Scrollbar */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Progress Steps Checklist</h3>
                <span className="text-xs text-gray-400">Click actions below each step to advance progress</span>
              </div>

              <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {activeTrackingTask.steps.map((step, idx) => {
                  const isDone = step.status === "completed";
                  const isInProgress = step.status === "in-progress";
                  const isRejected = step.status === "rejected";

                  return (
                    <div key={step.id || idx} className="relative pl-10">
                      {/* Step Status Icon on Timeline */}
                      <div
                        className={`absolute left-1.5 top-1.5 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                          isDone
                            ? "bg-emerald-500 text-white ring-4 ring-white"
                            : isInProgress
                            ? "bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse"
                            : isRejected
                            ? "bg-red-500 text-white ring-4 ring-red-100"
                            : "bg-gray-200 text-gray-500 ring-4 ring-white"
                        }`}
                      >
                        {isDone ? <Check size={12} /> : idx + 1}
                      </div>

                      {/* Step Body Card */}
                      <div
                        className={`p-4 rounded-xl border transition-all ${
                          isInProgress
                            ? "border-blue-300 bg-blue-50/50"
                            : isDone
                            ? "border-emerald-200 bg-emerald-50/30"
                            : isRejected
                            ? "border-red-200 bg-red-50/40"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <h4
                            className={`font-bold text-sm ${
                              isDone
                                ? "text-emerald-900"
                                : isInProgress
                                ? "text-blue-900"
                                : isRejected
                                ? "text-red-900"
                                : "text-gray-700"
                            }`}
                          >
                            {step.title}
                          </h4>

                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              isDone
                                ? "bg-emerald-100 text-emerald-800"
                                : isInProgress
                                ? "bg-blue-100 text-blue-800"
                                : isRejected
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>

                        {/* Note & Timestamp */}
                        {step.completedAt && (
                          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock size={11} />
                            Completed on: {new Date(step.completedAt).toLocaleString()}
                          </div>
                        )}

                        {step.note && (
                          <div className="text-xs text-gray-600 bg-white/70 p-2 rounded mt-2 border border-gray-100">
                            📝 {step.note}
                          </div>
                        )}

                        {/* Action buttons for this step */}
                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleUpdateStepStatus(activeTrackingTask, idx, "completed")}
                            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
                              isDone
                                ? "bg-emerald-600 text-white"
                                : "bg-white border border-gray-300 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
                            }`}
                          >
                            <Check size={12} />
                            Mark Completed
                          </button>

                          <button
                            onClick={() => handleUpdateStepStatus(activeTrackingTask, idx, "in-progress")}
                            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
                              isInProgress
                                ? "bg-blue-600 text-white"
                                : "bg-white border border-gray-300 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                            }`}
                          >
                            <Clock size={12} />
                            In Progress
                          </button>

                          <button
                            onClick={() => handleUpdateStepStatus(activeTrackingTask, idx, "pending")}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                          >
                            Reset Pending
                          </button>

                          <button
                            onClick={() => {
                              const note = prompt("Enter issue / reason for hold:", step.note || "");
                              if (note !== null) {
                                handleUpdateStepStatus(activeTrackingTask, idx, "rejected", note);
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-semibold rounded bg-white border border-red-200 text-red-600 hover:bg-red-50"
                          >
                            Flag Issue / Hold
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Custom Step Section */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    const stepName = prompt("Enter new step name (e.g., 'Biometric Verification at Seva Kendra'):");
                    if (stepName) handleAddCustomStep(activeTrackingTask, stepName);
                  }}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 text-sm font-semibold hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/30 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Add Custom Milestone / Step
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <a
                href={`https://wa.me/91${activeTrackingTask.mobileNumber.replace(/\D/g, "")}?text=${generateWhatsAppMessage(activeTrackingTask)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Share2 size={14} />
                Send WhatsApp Update
              </a>

              <button
                onClick={() => setActiveTrackingTask(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE NEW APPLICATION TASK ================= */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-[#032e60] text-white shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-300" />
                Track New Application Task
              </h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                title="Close / Cancel (Esc)"
                className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              {/* Customer ID Box */}
              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-100 flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-blue-900 uppercase tracking-wider block">Customer ID</label>
                  <input
                    type="text"
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="font-mono font-bold text-blue-900 bg-transparent text-base focus:outline-none"
                    placeholder="AN-10001"
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, customerId: generateCustomerId() })}
                  className="text-xs bg-white text-blue-700 border border-blue-200 px-2.5 py-1 rounded font-semibold hover:bg-blue-100"
                >
                  Generate New ID
                </button>
              </div>

              {/* Quick autofill from existing customers */}
              {recentCustomers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">
                    Or pick an existing customer:
                  </label>
                  <select
                    onChange={(e) => {
                      const found = recentCustomers.find(c => c.customerId === e.target.value);
                      if (found) handleSelectExistingCustomer(found);
                    }}
                    defaultValue=""
                    className="w-full text-xs border border-gray-200 rounded-lg p-2 bg-gray-50 text-gray-700"
                  >
                    <option value="" disabled>-- Select Existing Customer --</option>
                    {recentCustomers.map(c => (
                      <option key={c.customerId} value={c.customerId}>
                        {c.customerId} - {c.customerName} ({c.mobileNumber})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer Name & Mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Customer Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Service Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Service / Task Name *</label>
                <div className="flex gap-2">
                  <select
                    value={formData.serviceName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const matched = govServices.find(g => g.name.toLowerCase() === val.trim().toLowerCase());
                      setFormData({ 
                        ...formData, 
                        serviceName: val,
                        applyUrl: matched ? matched.url : formData.applyUrl
                      });
                      // auto pick template if matches
                      if (val.toLowerCase().includes("passport")) setSelectedTemplate("Passport Application");
                      else if (val.toLowerCase().includes("pan")) setSelectedTemplate("PAN Card Application");
                      else if (val.toLowerCase().includes("aadhaar")) setSelectedTemplate("Aadhaar Card Services");
                      else if (val.toLowerCase().includes("job") || val.toLowerCase().includes("scholarship")) setSelectedTemplate("Govt Job / Exam Application");
                      else if (val.toLowerCase().includes("certificate")) setSelectedTemplate("Income / Caste / Residence Certificate");
                    }}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {servicesList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="Other Service">Other / Custom Service</option>
                  </select>
                </div>
              </div>

              {formData.serviceName === "Other Service" && (
                <div>
                  <input
                    type="text"
                    placeholder="Enter custom service title..."
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                  />
                </div>
              )}

              {/* Official Portal Apply URL Preview */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1 flex items-center justify-between">
                  <span>Official Application Portal URL</span>
                  <span className="text-[10px] text-blue-600 font-medium">Auto-synced from Government Services</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="Auto-synced from Government Services"
                    value={formData.applyUrl}
                    onChange={(e) => setFormData({ ...formData, applyUrl: e.target.value })}
                    className="w-full p-2.5 text-sm font-mono border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-gray-50/50"
                  />
                  {formData.applyUrl && (
                    <a
                      href={formData.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-[#032e60] text-white rounded-lg hover:bg-[#022349] flex items-center gap-1.5 text-xs font-semibold shrink-0"
                      title="Open Application Portal in New Tab"
                    >
                      <span>Apply</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              {/* Steps Template Picker */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <label className="text-xs font-bold text-gray-700 block mb-1 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-blue-600" />
                  Select Progress Milestones Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg bg-white"
                >
                  {Object.keys(STEP_TEMPLATES).map(tmpl => (
                    <option key={tmpl} value={tmpl}>{tmpl}</option>
                  ))}
                </select>

                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div className="font-semibold text-gray-600">Template Steps:</div>
                  <ol className="list-decimal list-inside pl-1 text-[11px] text-gray-500 space-y-0.5">
                    {(STEP_TEMPLATES[selectedTemplate] || []).map((stepTitle, idx) => (
                      <li key={idx}>{stepTitle}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Reference Number & Target Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Application / Ack No. (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ACK-2026-90412"
                    value={formData.applicationNumber}
                    onChange={(e) => setFormData({ ...formData, applicationNumber: e.target.value })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Target Completion Date</label>
                  <input
                    type="date"
                    value={formData.targetDate}
                    onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Priority & Staff */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Assigned Staff</label>
                  <input
                    type="text"
                    placeholder="e.g. Airnet Desk / Amjad"
                    value={formData.assignedStaff}
                    onChange={(e) => setFormData({ ...formData, assignedStaff: e.target.value })}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee size={15} className="text-amber-600" />
                    Payment Details (in Rupees)
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const charged = formData.amountCharged || "0";
                        setFormData({ ...formData, amountPaid: charged, amountPending: "0" });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-md font-semibold hover:bg-emerald-50"
                    >
                      Full Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const charged = formData.amountCharged || "0";
                        setFormData({ 
                          ...formData, 
                          amountPaid: "0", 
                          amountPending: charged,
                          paymentType: "Pending / Pay Later" 
                        });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-amber-300 text-amber-800 rounded-md font-semibold hover:bg-amber-50"
                    >
                      Full Due
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Amount Charged (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.amountCharged}
                        onChange={(e) => {
                          const charged = e.target.value;
                          const paid = formData.amountPaid === "" || formData.amountPaid === formData.amountCharged 
                            ? charged 
                            : formData.amountPaid;
                          const due = Math.max(0, (Number(charged) || 0) - (Number(paid) || 0));
                          setFormData({
                            ...formData,
                            amountCharged: charged,
                            amountPaid: paid,
                            amountPending: String(due),
                          });
                        }}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-mono font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">
                      Amount Paid (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={formData.amountPaid}
                        onChange={(e) => {
                          const paid = e.target.value;
                          const charged = Number(formData.amountCharged) || 0;
                          const due = Math.max(0, charged - (Number(paid) || 0));
                          setFormData({
                            ...formData,
                            amountPaid: paid,
                            amountPending: String(due),
                          });
                        }}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white font-mono font-semibold text-emerald-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Calculated Due Amount */}
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200">
                  <div className="text-xs">
                    <span className="text-gray-500 font-medium block">Calculated Due Amount</span>
                    <span className="text-[11px] text-gray-400">Charged (₹{Number(formData.amountCharged) || 0}) − Paid (₹{Number(formData.amountPaid) || 0})</span>
                  </div>
                  <div className="text-right">
                    {(Number(formData.amountPending) || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md text-xs">
                        ₹{formData.amountPending} Due
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-md text-xs">
                        ✓ Nil Due (Cleared)
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Payment Type</label>
                  <select
                    value={formData.paymentType}
                    onChange={(e) => {
                      const method = e.target.value;
                      if (method === "Pending / Pay Later") {
                        setFormData({
                          ...formData,
                          paymentType: method,
                          amountPaid: "0",
                          amountPending: formData.amountCharged || "0",
                        });
                      } else {
                        const paid = formData.amountPaid === "0" && formData.amountCharged ? formData.amountCharged : formData.amountPaid;
                        const due = Math.max(0, (Number(formData.amountCharged) || 0) - (Number(paid) || 0));
                        setFormData({
                          ...formData,
                          paymentType: method,
                          amountPaid: paid,
                          amountPending: String(due),
                        });
                      }
                    }}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI / QR">UPI / QR (GPay, PhonePe, Paytm)</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Pending / Pay Later">Pending / Pay Later</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, missing documents, customer remarks..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Start Tracking Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT TASK METADATA ================= */}
      {editingTask && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingTask(null); }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Edit Task Information</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{editingTask.customerId} — {editingTask.customerName}</p>
              </div>
              <button 
                onClick={() => setEditingTask(null)} 
                title="Cancel / Close (Esc)"
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Customer ID</label>
                  <input
                    type="text"
                    value={editingTask.customerId}
                    onChange={(e) => setEditingTask({ ...editingTask, customerId: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Status</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as any })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Customer Name</label>
                <input
                  type="text"
                  value={editingTask.customerName}
                  onChange={(e) => setEditingTask({ ...editingTask, customerName: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={editingTask.mobileNumber}
                    onChange={(e) => setEditingTask({ ...editingTask, mobileNumber: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Service Name</label>
                <input
                  type="text"
                  value={editingTask.serviceName}
                  onChange={(e) => {
                    const val = e.target.value;
                    const matched = govServices.find(g => g.name.toLowerCase() === val.trim().toLowerCase());
                    setEditingTask({
                      ...editingTask,
                      serviceName: val,
                      applyUrl: matched ? matched.url : editingTask.applyUrl
                    });
                  }}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1 flex items-center justify-between">
                  <span>Official Application Portal URL</span>
                  <span className="text-[10px] text-blue-600 font-medium">Synced from Government Services</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={editingTask.applyUrl || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, applyUrl: e.target.value })}
                    placeholder="https://... (or https://www.google.com)"
                    className="w-full p-2 text-sm font-mono border border-gray-200 rounded-lg"
                  />
                  {editingTask.applyUrl && (
                    <a
                      href={editingTask.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-[#032e60] text-white rounded-lg hover:bg-[#022349] flex items-center gap-1 text-xs font-semibold shrink-0"
                      title="Open Official Portal"
                    >
                      <span>Apply</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Application / Ack No.</label>
                  <input
                    type="text"
                    value={editingTask.applicationNumber || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, applicationNumber: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Target Date</label>
                  <input
                    type="date"
                    value={editingTask.targetDate || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, targetDate: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee size={13} className="text-amber-600" />
                    Payment Details (in Rupees)
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const charged = editingTask.amountCharged ?? ((editingTask.amountPaid ?? 0) + (editingTask.amountPending ?? 0));
                        setEditingTask({ ...editingTask, amountCharged: charged, amountPaid: charged, amountPending: 0 });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-emerald-300 rounded text-emerald-700 hover:bg-emerald-50 font-medium"
                    >
                      Full Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const charged = editingTask.amountCharged ?? ((editingTask.amountPaid ?? 0) + (editingTask.amountPending ?? 0));
                        setEditingTask({ ...editingTask, amountCharged: charged, amountPaid: 0, amountPending: charged, paymentType: "Pending / Pay Later" });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-amber-300 rounded text-amber-800 hover:bg-amber-50 font-medium"
                    >
                      Full Due
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">Amount Charged (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTask.amountCharged ?? ((editingTask.amountPaid ?? 0) + (editingTask.amountPending ?? 0))}
                      onChange={(e) => {
                        const charged = Number(e.target.value) || 0;
                        const paid = editingTask.amountPaid ?? 0;
                        const due = Math.max(0, charged - paid);
                        setEditingTask({ ...editingTask, amountCharged: charged, amountPending: due });
                      }}
                      className="w-full p-2 text-xs border border-gray-200 rounded-lg font-mono font-semibold bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">Amount Paid (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={editingTask.amountPaid ?? 0}
                      onChange={(e) => {
                        const paid = Number(e.target.value) || 0;
                        const charged = editingTask.amountCharged ?? ((editingTask.amountPaid ?? 0) + (editingTask.amountPending ?? 0));
                        const due = Math.max(0, charged - paid);
                        setEditingTask({ ...editingTask, amountPaid: paid, amountPending: due });
                      }}
                      className="w-full p-2 text-xs border border-gray-200 rounded-lg font-mono font-semibold text-emerald-800 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 text-xs">
                  <span className="text-gray-500 font-medium">Due Amount (Auto-calculated):</span>
                  {(editingTask.amountPending ?? 0) > 0 ? (
                    <span className="font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-xs">
                      ₹{editingTask.amountPending} Due
                    </span>
                  ) : (
                    <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                      ✓ Cleared (Nil Due)
                    </span>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-600 block mb-1">Payment Type</label>
                  <select
                    value={editingTask.paymentType || "Cash"}
                    onChange={(e) => setEditingTask({ ...editingTask, paymentType: e.target.value })}
                    className="w-full p-2 text-xs border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI / QR">UPI / QR (GPay, PhonePe, Paytm)</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Pending / Pay Later">Pending / Pay Later</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingTask.notes || ""}
                  onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg"
                />
              </div>

              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 cursor-pointer shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= COMPLETED STATUS NOTIFICATION MODAL ================= */}
      {completedNotificationTask && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setCompletedNotificationTask(null); }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Application Completed!</h3>
                  <p className="text-xs text-emerald-100">Status updated to 100% [Completed]</p>
                </div>
              </div>
              <button
                onClick={() => setCompletedNotificationTask(null)}
                title="Close / Cancel (Esc)"
                className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar-emerald">
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs">
                <div>
                  <p className="font-bold text-emerald-950">{completedNotificationTask.customerName} ({completedNotificationTask.customerId})</p>
                  <p className="text-emerald-700 font-mono mt-0.5">Mobile: +91 {completedNotificationTask.mobileNumber}</p>
                </div>
                <span className="bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full text-[11px]">
                  100% Completed
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Message Sent to Customer:
                </label>
                <pre className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 font-sans whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto custom-scrollbar">
                  {getRawWhatsAppMessage(completedNotificationTask)}
                </pre>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  onClick={() => sendWhatsAppUpdate(completedNotificationTask)}
                  className="w-full sm:flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <Share2 size={16} />
                  Send WhatsApp Message
                </button>
                <button
                  onClick={() => copyToClipboard(getRawWhatsAppMessage(completedNotificationTask), "completed-msg")}
                  className="w-full sm:w-auto py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors border border-gray-300 cursor-pointer"
                >
                  {copiedId === "completed-msg" ? (
                    <>
                      <Check size={16} className="text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copy Text
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setCompletedNotificationTask(null)}
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Close / Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
