import { useState, useEffect, useDeferredValue } from "react";
import { useLocation } from "wouter";
import { Check, Clock, XCircle, Search, Eye, Pencil, Trash2, X, BookPlus, IndianRupee, User, Filter, Share2, ArrowRight, Route, MessageCircle } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useLiveSync } from "../../hooks/useLiveSync";
import { usePathway } from "../../context/PathwayContext";
import { AdminWhatsAppModal } from "../../components/AdminWhatsAppModal";
import { NotificationApplication } from "../../lib/whatsapp-templates";
import { formatDateDMY, formatDateTimeDMY } from "../../lib/dateUtils";

type Enquiry = {
  id: number;
  customerId?: string;
  customerName: string;
  mobileNumber: string;
  serviceId: string;
  serviceTitle?: string;
  applyUrl?: string;
  applicationStatus: string;
  amountCharged?: number;
  amountPaid?: number;
  amountPending?: number;
  paymentMethod?: string;
  notes: string;
  createdAt: string;
  progressPercent?: number;
  currentStep?: string;
  steps?: any[];
};

export default function Enquiries() {
  const [, setLocation] = useLocation();
  const { showSuccess, showError, showInfo, confirm, confirmDelete } = useModal();
  const { openPathway } = usePathway();
  
  // High performance SWR Cache: render cached records in 0ms without blank screen flicker
  const [enquiries, setEnquiries] = useState<Enquiry[]>(() => {
    return getCachedData<Enquiry[]>("admin_enquiries") || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedData<Enquiry[]>("admin_enquiries");
  });
  const [govServices, setGovServices] = useState<Array<{ id: number; name: string; url: string; iconKey: string }>>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string | null>(null);
  
  // Modals state
  const [viewingEnquiry, setViewingEnquiry] = useState<Enquiry | null>(null);
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [recordingEnquiry, setRecordingEnquiry] = useState<Enquiry | null>(null);
  const [recordAmountCharged, setRecordAmountCharged] = useState("");
  const [recordAmountPaid, setRecordAmountPaid] = useState("");
  const [recordPaymentMethod, setRecordPaymentMethod] = useState("Cash");
  const [recordNotes, setRecordNotes] = useState("");

  // Admin WhatsApp Modal state
  const [whatsAppModal, setWhatsAppModal] = useState<{
    isOpen: boolean;
    status: "Accepted" | "Rejected" | "On Hold" | null;
    application: NotificationApplication | null;
  }>({
    isOpen: false,
    status: null,
    application: null,
  });

  const fetchEnquiries = async (silent = false) => {
    if (!silent && enquiries.length === 0) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/admin/enquiries");
      if (res.ok) {
        const data = await res.json();
        setEnquiries(data);
        setCachedData("admin_enquiries", data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGovServices = async () => {
    try {
      const res = await fetch("/api/government-services");
      if (res.ok) {
        const data = await res.json();
        setGovServices(data);
      }
    } catch (err) {
      console.error("Failed to load government services in enquiries:", err);
    }
  };

  useEffect(() => {
    fetchEnquiries(enquiries.length > 0);
    fetchGovServices();
  }, []);

  // Multi-Device Instant Real-Time Synchronization via Server-Sent Events (SSE)
  useLiveSync("enquiries", () => {
    fetchEnquiries(true);
  });

  // Escape key listener for easy modal cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (recordingEnquiry) setRecordingEnquiry(null);
        else if (viewingEnquiry) setViewingEnquiry(null);
        else if (editingEnquiry) setEditingEnquiry(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [recordingEnquiry, viewingEnquiry, editingEnquiry]);

  const openRecordModal = (enq: Enquiry) => {
    setRecordingEnquiry(enq);
    const charged = enq.amountCharged ? String(enq.amountCharged) : "";
    setRecordAmountCharged(charged);
    const paid = enq.amountPaid !== undefined && enq.amountPaid !== null 
      ? String(enq.amountPaid) 
      : (enq.paymentMethod === "Pending" ? "0" : charged);
    setRecordAmountPaid(paid);
    setRecordPaymentMethod(enq.paymentMethod || "Cash");
    setRecordNotes(enq.notes || "");
  };

  const handleStatusChange = async (enq: Enquiry, newStatus: string) => {
    if (newStatus === enq.applicationStatus) return;

    // 1. Rejected: Update status to Rejected and open Admin WhatsApp Notification modal
    if (newStatus === "Rejected") {
      setEnquiries(current => current.map(e => e.id === enq.id ? { ...e, applicationStatus: "Rejected" } : e));
      try {
        const res = await fetch(`/api/admin/enquiries/${enq.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationStatus: "Rejected" })
        });
        if (!res.ok) throw new Error("Failed to reject enquiry");

        setWhatsAppModal({
          isOpen: true,
          status: "Rejected",
          application: {
            customerId: enq.customerId || `AN-${enq.id}`,
            customerName: enq.customerName,
            mobileNumber: enq.mobileNumber,
            serviceName: getServiceLabel(enq),
          }
        });
      } catch (err: any) {
        console.error(err);
        showError("Rejection Failed", err.message || "Failed to update status to Rejected.");
        fetchEnquiries(); // revert on failure
      }
      return;
    }

    // 2. Accepted: Update status to Accepted, automatically move customer application to Application Tracker and open Admin WhatsApp Notification modal
    if (newStatus === "Accepted") {
      // Optimistically remove from My Enquiry List
      setEnquiries(current => {
        const updated = current.filter(e => e.id !== enq.id);
        setCachedData("admin_enquiries", updated);
        return updated;
      });

      try {
        const res = await fetch(`/api/admin/enquiries/${enq.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationStatus: "Accepted" })
        });
        if (!res.ok) throw new Error("Failed to accept enquiry");
        const data = await res.json();
        
        await fetchEnquiries(); // Refresh enquiries list with latest data from server

        const trackingId = data.trackingId || enq.customerId || `AN-${enq.id}`;
        const serviceLabel = data.serviceTitle || getServiceLabel(enq);

        // Open Admin WhatsApp Modal for Accepted application
        setWhatsAppModal({
          isOpen: true,
          status: "Accepted",
          application: {
            customerId: trackingId,
            customerName: enq.customerName,
            mobileNumber: enq.mobileNumber,
            serviceName: serviceLabel,
          }
        });
      } catch (err: any) {
        console.error(err);
        showError("Status Update Failed", err.message || "Failed to accept enquiry.");
        fetchEnquiries(); // revert on failure
      }
      return;
    }

    // 3. On Hold: Update status to On Hold and open Admin WhatsApp Notification modal
    if (newStatus === "On Hold") {
      setEnquiries(current => current.map(e => e.id === enq.id ? { ...e, applicationStatus: "On Hold" } : e));
      try {
        const res = await fetch(`/api/admin/enquiries/${enq.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationStatus: "On Hold" })
        });
        if (!res.ok) throw new Error("Failed to update status to On Hold");

        // Open Admin WhatsApp Modal for On Hold application
        setWhatsAppModal({
          isOpen: true,
          status: "On Hold",
          application: {
            customerId: enq.customerId || `AN-${enq.id}`,
            customerName: enq.customerName,
            mobileNumber: enq.mobileNumber,
            serviceName: getServiceLabel(enq),
          }
        });
      } catch (err: any) {
        console.error(err);
        showError("Status Update Failed", err.message || "Failed to put enquiry On Hold.");
        fetchEnquiries(); // revert on failure
      }
      return;
    }

    // Fallback for other statuses (e.g. New, Completed)
    setEnquiries(current => current.map(e => e.id === enq.id ? { ...e, applicationStatus: newStatus } : e));
    try {
      await fetch(`/api/admin/enquiries/${enq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationStatus: newStatus })
      });
    } catch (err) {
      console.error(err);
      fetchEnquiries();
    }
  };
  
  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingEnquiry) return;
    try {
      const charged = Number(recordAmountCharged) || 0;
      const paid = Number(recordAmountPaid) || 0;
      const due = Math.max(0, charged - paid);

      const res = await fetch(`/api/admin/enquiries/${recordingEnquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCharged: charged,
          amountPaid: paid,
          amountPending: due,
          paymentMethod: recordPaymentMethod,
          applicationStatus: "Completed",
          notes: recordNotes || recordingEnquiry.notes || undefined,
          syncToTracker: true,
        })
      });

      if (!res.ok) throw new Error("Failed to create record");

      // Optimistic update
      setEnquiries(current => current.map(enq => enq.id === recordingEnquiry.id ? { 
        ...enq, 
        applicationStatus: "Completed",
        amountCharged: charged,
        amountPaid: paid,
        amountPending: due,
        paymentMethod: recordPaymentMethod,
      } : enq));

      setRecordingEnquiry(null);
      setRecordAmountCharged("");
      setRecordAmountPaid("");
      setRecordPaymentMethod("Cash");
      setRecordNotes("");
      showSuccess(
        "Record Added to Ledger",
        "Successfully added to ledger & application tracker with payment details!"
      );
      fetchEnquiries();
    } catch (err: any) {
      console.error(err);
      showError("Record Save Error", err.message || "Error saving record.");
    }
  };

  const handleDelete = async (enq: Enquiry) => {
    await confirmDelete({
      title: "Delete Customer Enquiry?",
      message: "Are you sure you want to delete this enquiry? This action may not be reversible.",
      itemName: enq.customerName ? `enquiry for "${enq.customerName}"` : "this enquiry",
      onConfirm: async () => {
        const res = await fetch(`/api/admin/enquiries/${enq.id}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete enquiry");
        }
        setEnquiries(current => {
          const updated = current.filter(e => e.id !== enq.id);
          setCachedData("admin_enquiries", updated);
          return updated;
        });
      }
    });
  };

  const handleEditSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEnquiry) return;
    
    // Optimistic UI update
    const updatedEnquiry = { ...editingEnquiry };
    setEnquiries(current => current.map(enq => enq.id === editingEnquiry.id ? updatedEnquiry : enq));
    setEditingEnquiry(null);

    try {
      const res = await fetch(`/api/admin/enquiries/${editingEnquiry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: editingEnquiry.customerName,
          mobileNumber: editingEnquiry.mobileNumber,
          notes: editingEnquiry.notes
        })
      });
      if (!res.ok) throw new Error("Failed to save changes");
      showSuccess("Enquiry Updated", `Customer details for "${editingEnquiry.customerName}" updated successfully.`);
    } catch (err: any) {
      console.error(err);
      showError("Update Failed", err.message || "Failed to save changes.");
      fetchEnquiries(); // revert on failure
    }
  };

  const getServiceLabel = (enq: Enquiry | null) => {
    if (!enq) return "";
    if (enq.serviceTitle) return enq.serviceTitle;
    if (enq.notes) {
      const match = enq.notes.match(/Requested Service:\s*([^\n\r]+)/);
      if (match && match[1]) return match[1].trim();
    }
    if (enq.serviceId) return enq.serviceId;
    return "Custom / Online Service";
  };

  const getServiceApplyUrl = (serviceName: string) => {
    if (!serviceName) return "https://www.google.com";
    const clean = serviceName.trim().toLowerCase();
    const match = govServices.find(g => {
      const gName = g.name.toLowerCase();
      return gName === clean || gName.includes(clean) || clean.includes(gName);
    });
    return match ? match.url : "https://www.google.com";
  };

  const getCustomerQueryCount = (enq: Enquiry) => {
    return enquiries.filter(e => 
      (enq.mobileNumber && e.mobileNumber === enq.mobileNumber) || 
      e.customerName.toLowerCase() === enq.customerName.toLowerCase()
    ).length;
  };

  const getCustomerQueries = (enq: Enquiry) => {
    return enquiries.filter(e => 
      (enq.mobileNumber && e.mobileNumber === enq.mobileNumber) || 
      e.customerName.toLowerCase() === enq.customerName.toLowerCase()
    );
  };

  const counts = {
    all: enquiries.length,
    new: enquiries.filter(e => e.applicationStatus === "New").length,
    accepted: enquiries.filter(e => e.applicationStatus === "Accepted").length,
    onHold: enquiries.filter(e => e.applicationStatus === "On Hold").length,
    completed: enquiries.filter(e => e.applicationStatus === "Completed").length,
  };

  const deferredSearch = useDeferredValue(search);

  const filteredEnquiries = enquiries.filter(enq => {
    const matchesCustomer = !selectedCustomerFilter || 
      enq.mobileNumber === selectedCustomerFilter || 
      enq.customerName.toLowerCase() === selectedCustomerFilter.toLowerCase();

    const q = deferredSearch.toLowerCase();
    const matchesSearch = 
      !q ||
      enq.customerName.toLowerCase().includes(q) || 
      enq.mobileNumber.includes(q) ||
      (enq.customerId && enq.customerId.toLowerCase().includes(q)) ||
      enq.serviceId?.toLowerCase().includes(q) ||
      getServiceLabel(enq).toLowerCase().includes(q) ||
      enq.notes?.toLowerCase().includes(q);

    const matchesStatus = 
      statusFilter === "All" || 
      enq.applicationStatus.toLowerCase() === statusFilter.toLowerCase();

    return matchesCustomer && matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-[#032e60]">My Enquiry List</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage customer enquiries, filter by particular user, and track live application progress.</p>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by name, phone..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2563eb]"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setStatusFilter("All")}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === "All" 
              ? "bg-[#032e60] text-white shadow-sm" 
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          All ({counts.all})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("New")}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === "New" 
              ? "bg-blue-600 text-white shadow-sm" 
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          New ({counts.new})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("Accepted")}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === "Accepted" 
              ? "bg-emerald-600 text-white shadow-sm" 
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Accepted ({counts.accepted})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("On Hold")}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === "On Hold" 
              ? "bg-amber-600 text-white shadow-sm" 
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          On Hold ({counts.onHold})
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("Completed")}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            statusFilter === "Completed" 
              ? "bg-green-700 text-white shadow-sm" 
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          Completed ({counts.completed})
        </button>
      </div>

      {/* Active Customer Filter Banner */}
      {selectedCustomerFilter && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 shadow-2xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <User size={15} className="text-[#032e60]" />
            <span>
              Showing all <strong>{filteredEnquiries.length} {filteredEnquiries.length === 1 ? 'query' : 'queries'}</strong> made by customer <strong>"{selectedCustomerFilter}"</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCustomerFilter(null)}
            className="px-2.5 py-1 bg-white border border-blue-300 hover:bg-blue-100 text-[#032e60] font-bold rounded-lg transition-colors flex items-center gap-1 text-[11px]"
          >
            <X size={12} /> Show All Customers
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Customer Details</th>
              <th className="p-4 font-medium">Service Needed</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">Loading enquiries...</td>
              </tr>
            ) : filteredEnquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">No enquiries found.</td>
              </tr>
            ) : (
              filteredEnquiries.map((enq) => {
                const userQueryCount = getCustomerQueryCount(enq);

                return (
                  <tr key={enq.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4 text-gray-600 whitespace-nowrap text-xs font-medium">
                      {formatDateDMY(enq.createdAt)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerFilter(enq.mobileNumber || enq.customerName)}
                          className="font-bold text-[#032e60] hover:text-[#2563eb] hover:underline text-left cursor-pointer transition-colors"
                          title={`Click to view all queries made by ${enq.customerName}`}
                        >
                          {enq.customerName}
                        </button>
                        {userQueryCount > 1 && (
                          <span
                            onClick={() => setSelectedCustomerFilter(enq.mobileNumber || enq.customerName)}
                            className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 cursor-pointer hover:bg-blue-200"
                            title="Click to view all queries by this user"
                          >
                            {userQueryCount} queries
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">{enq.mobileNumber}</div>
                      {enq.customerId && (
                        <span className="text-[10px] font-mono text-gray-400 block">{enq.customerId}</span>
                      )}
                    </td>
                    <td className="p-4 text-gray-800 font-medium max-w-xs">
                      <div className="font-semibold text-[#032e60] text-xs">{getServiceLabel(enq)}</div>
                      {!enq.serviceId && (
                        <span className="inline-block mt-0.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Customer Request
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="relative inline-block">
                        <select
                          value={enq.applicationStatus}
                          onChange={(e) => handleStatusChange(enq, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer outline-none transition-all shadow-sm ${
                            enq.applicationStatus === 'Accepted'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              : enq.applicationStatus === 'On Hold'
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : enq.applicationStatus === 'Rejected'
                              ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                              : enq.applicationStatus === 'Completed'
                              ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100'
                              : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100'
                          }`}
                        >
                          {enq.applicationStatus === 'New' && <option value="New">● New</option>}
                          <option value="Accepted">Accept</option>
                          <option value="On Hold">⏸ On Hold</option>
                          <option value="Rejected">✕ Rejected</option>
                          {enq.applicationStatus === 'Completed' && <option value="Completed">✓ Completed</option>}
                        </select>
                      </div>
                    </td>
                    <td className="p-4 text-right flex justify-end gap-1">
                      <button 
                        onClick={() => openPathway({
                          id: `enq-${enq.id}`,
                          enquiryId: enq.id,
                          customerId: enq.customerId || `AN-ENQ-${enq.id}`,
                          customerName: enq.customerName,
                          mobileNumber: enq.mobileNumber,
                          serviceName: enq.serviceTitle || enq.serviceId,
                          applicationStatus: enq.applicationStatus,
                          currentStep: enq.currentStep || "Enquiry Processing",
                          progressPercent: enq.progressPercent ?? 20,
                          steps: enq.steps || [
                            { id: "1", title: "Enquiry Received", status: "completed" },
                            { id: "2", title: "Processing Service", status: "in-progress" },
                            { id: "3", title: "Final Delivery", status: "pending" }
                          ],
                          amountCharged: enq.amountCharged,
                          amountPaid: enq.amountPaid,
                          amountPending: enq.amountPending,
                          notes: enq.notes,
                          createdAt: enq.createdAt,
                          source: "enquiry"
                        })} 
                        className="text-cyan-700 hover:text-cyan-900 p-2 hover:bg-cyan-50 rounded-lg transition-colors cursor-pointer" 
                        title="Open Pathway Floating Window"
                      >
                        <Route size={18}/>
                      </button>
                      <button onClick={() => openRecordModal(enq)} className="text-emerald-600 hover:text-emerald-800 p-2" title="Add to Ledger"><BookPlus size={18}/></button>
                      <button
                        type="button"
                        onClick={() => {
                          const mappedStatus: "Accepted" | "Rejected" | "On Hold" = 
                            enq.applicationStatus === "Rejected" ? "Rejected" :
                            enq.applicationStatus === "On Hold" ? "On Hold" : "Accepted";
                          setWhatsAppModal({
                            isOpen: true,
                            status: mappedStatus,
                            application: {
                              customerId: enq.customerId || `AN-${enq.id}`,
                              customerName: enq.customerName,
                              mobileNumber: enq.mobileNumber,
                              serviceName: getServiceLabel(enq),
                            }
                          });
                        }}
                        className="text-emerald-600 hover:text-emerald-800 p-2 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Send WhatsApp Notification"
                      >
                        <MessageCircle size={18} />
                      </button>
                      <button onClick={() => setViewingEnquiry(enq)} className="text-gray-500 hover:text-gray-700 p-2" title="View Details"><Eye size={18}/></button>
                      <button onClick={() => setEditingEnquiry(enq)} className="text-blue-600 hover:text-blue-800 p-2" title="Edit"><Pencil size={18}/></button>
                      <button onClick={() => handleDelete(enq)} className="text-red-600 hover:text-red-800 p-2 cursor-pointer" title="Delete"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Record to Ledger Modal */}
      {recordingEnquiry && (() => {
        const chargedVal = Number(recordAmountCharged) || 0;
        const paidVal = Number(recordAmountPaid) || 0;
        const dueVal = Math.max(0, chargedVal - paidVal);

        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setRecordingEnquiry(null); }}
          >
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
                <div className="flex items-center gap-2.5 text-[#177d70]">
                  <div className="p-2 bg-emerald-50 rounded-xl">
                    <BookPlus size={22} className="text-[#177d70]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">Save to Records</h2>
                    <p className="text-xs text-gray-500">Log transaction & complete ledger entry</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRecordingEnquiry(null)} 
                  title="Cancel / Close (Esc)"
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  <X size={20}/>
                </button>
              </div>

              <form onSubmit={handleRecordSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 sm:p-6 space-y-3.5 overflow-y-auto flex-1 custom-scrollbar">
                {/* Payment Calculation Box */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1.5">
                      <IndianRupee size={14} className="text-amber-600" />
                      Payment Details
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRecordAmountPaid(recordAmountCharged);
                        }}
                        className="text-[10px] px-2 py-0.5 bg-white border border-emerald-300 text-emerald-700 rounded-md font-semibold hover:bg-emerald-50 transition-colors"
                      >
                        Full Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecordAmountPaid("0");
                          setRecordPaymentMethod("Pending / Pay Later");
                        }}
                        className="text-[10px] px-2 py-0.5 bg-white border border-amber-300 text-amber-800 rounded-md font-semibold hover:bg-amber-50 transition-colors"
                      >
                        Full Due
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Amount Charged (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                        <input 
                          required 
                          autoFocus 
                          type="number" 
                          min="0" 
                          placeholder="0"
                          value={recordAmountCharged} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setRecordAmountCharged(val);
                            // If paid was empty or matched previous charged, keep it updated
                            if (recordAmountPaid === "" || recordAmountPaid === recordAmountCharged) {
                              setRecordAmountPaid(val);
                            }
                          }} 
                          className="w-full pl-7 pr-3 py-2 text-sm font-mono font-semibold border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Amount Paid (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xs">₹</span>
                        <input 
                          required 
                          type="number" 
                          min="0" 
                          placeholder="0"
                          value={recordAmountPaid} 
                          onChange={(e) => setRecordAmountPaid(e.target.value)} 
                          className="w-full pl-7 pr-3 py-2 text-sm font-mono font-semibold border border-gray-300 rounded-lg bg-white text-emerald-800 focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Auto Calculated Due Amount */}
                  <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-amber-200">
                    <div className="text-xs">
                      <span className="text-gray-500 font-medium block">Calculated Due Amount</span>
                      <span className="text-[11px] text-gray-400">Charged (₹{chargedVal}) − Paid (₹{paidVal})</span>
                    </div>
                    <div className="text-right">
                      {dueVal > 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md text-xs">
                          ₹{dueVal} Due
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-md text-xs">
                          ✓ Cleared (₹0)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                  <select 
                    value={recordPaymentMethod} 
                    onChange={(e) => {
                      const method = e.target.value;
                      setRecordPaymentMethod(method);
                      if (method === "Pending / Pay Later") {
                        setRecordAmountPaid("0");
                      } else if (recordAmountPaid === "0" && recordAmountCharged) {
                        setRecordAmountPaid(recordAmountCharged);
                      }
                    }} 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#177d70] focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI / QR">UPI / QR (GPay, PhonePe, Paytm)</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Pending / Pay Later">Pending / Pay Later</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Remarks (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Acknowledgment number, bill note"
                    value={recordNotes}
                    onChange={(e) => setRecordNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#177d70] focus:outline-none"
                  />
                </div>

                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setRecordingEnquiry(null)} 
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-[#177d70] text-white rounded-lg hover:bg-[#116257] font-bold text-sm shadow-sm transition-all cursor-pointer"
                  >
                    Save to Ledger & Records
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* View Modal */}
      {viewingEnquiry && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingEnquiry(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#032e60]">Enquiry Details</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{viewingEnquiry.customerId || "AN-New"} — {viewingEnquiry.customerName}</p>
              </div>
              <button 
                onClick={() => setViewingEnquiry(null)} 
                title="Close / Cancel (Esc)"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div>
                <p className="text-sm text-gray-500">Service Needed</p>
                <p className="font-semibold text-[#032e60]">{getServiceLabel(viewingEnquiry)}</p>
              </div>
              <div><p className="text-sm text-gray-500">Customer Name</p><p className="font-medium">{viewingEnquiry.customerName}</p></div>
              <div><p className="text-sm text-gray-500">Mobile Number</p><p className="font-medium">{viewingEnquiry.mobileNumber}</p></div>
              <div><p className="text-sm text-gray-500">Date Submitted</p><p className="font-medium">{formatDateTimeDMY(viewingEnquiry.createdAt)}</p></div>
              <div><p className="text-sm text-gray-500">Notes / References</p><p className="font-medium whitespace-pre-wrap">{viewingEnquiry.notes || "No notes provided."}</p></div>
              <div><p className="text-sm text-gray-500">Status</p><p className="font-medium font-bold text-[#032e60]">{viewingEnquiry.applicationStatus}</p></div>
              
              {/* Live Application Progress */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[#032e60]">
                  <span>Live Application Progress</span>
                  <span className="font-mono text-blue-700 font-bold">
                    {viewingEnquiry.progressPercent ?? (viewingEnquiry.applicationStatus === "Completed" ? 100 : viewingEnquiry.applicationStatus === "Accepted" ? 40 : 15)}%
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-2 overflow-hidden border border-blue-200">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${viewingEnquiry.progressPercent ?? (viewingEnquiry.applicationStatus === "Completed" ? 100 : viewingEnquiry.applicationStatus === "Accepted" ? 40 : 15)}%` }} 
                  />
                </div>
                <p className="text-xs text-gray-600 font-medium">Stage: <strong className="text-blue-900">{viewingEnquiry.currentStep || "Enquiry Received"}</strong></p>
              </div>

              {/* All Queries Made by This Customer */}
              {(() => {
                const userAllQueries = getCustomerQueries(viewingEnquiry);
                return (
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#032e60] flex items-center gap-1.5">
                        <User size={13} className="text-[#2563eb]" />
                        All Queries Made by This Customer ({userAllQueries.length} total)
                      </h3>
                      {userAllQueries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerFilter(viewingEnquiry.mobileNumber || viewingEnquiry.customerName);
                            setViewingEnquiry(null);
                          }}
                          className="text-[11px] text-blue-700 hover:underline font-bold"
                        >
                          Filter in table →
                        </button>
                      )}
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {userAllQueries.map((q) => {
                        const qProgress = q.progressPercent ?? (q.applicationStatus === "Completed" ? 100 : q.applicationStatus === "Accepted" ? 40 : 15);
                        return (
                          <div key={q.id} className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${q.id === viewingEnquiry.id ? "bg-blue-50/60 border-blue-300" : "bg-gray-50 border-gray-200"}`}>
                            <div>
                              <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                {getServiceLabel(q)}
                                {q.id === viewingEnquiry.id && (
                                  <span className="text-[9px] bg-blue-600 text-white font-bold px-1 rounded">Current</span>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {formatDateDMY(q.createdAt)} · {q.customerId || `AN-${q.id}`}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                q.applicationStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                                q.applicationStatus === 'Accepted' ? 'bg-emerald-100 text-emerald-800' :
                                q.applicationStatus === 'On Hold' ? 'bg-amber-100 text-amber-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {q.applicationStatus} ({qProgress}%)
                              </span>
                              <span className="text-[10px] text-gray-500 block mt-0.5 truncate max-w-[130px]">{q.currentStep || "Processing"}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(viewingEnquiry.amountCharged !== undefined || viewingEnquiry.amountPaid !== undefined) && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1">
                    <IndianRupee size={13} className="text-amber-600" /> Payment Summary
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div>
                      <span className="text-gray-500 block">Charged</span>
                      <strong className="text-gray-800 font-mono text-sm">₹{viewingEnquiry.amountCharged ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Paid ({viewingEnquiry.paymentMethod || "Cash"})</span>
                      <strong className="text-emerald-700 font-mono text-sm">₹{viewingEnquiry.amountPaid ?? 0}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Due</span>
                      {(viewingEnquiry.amountPending ?? 0) > 0 ? (
                        <span className="text-amber-900 font-mono font-bold text-xs bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                          ₹{viewingEnquiry.amountPending} Due
                        </span>
                      ) : (
                        <span className="text-emerald-800 font-mono font-bold text-xs bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                          ✓ Cleared
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center shrink-0">
              {viewingEnquiry.applicationStatus !== "Accepted" && viewingEnquiry.applicationStatus !== "Completed" ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingEnquiry;
                    setViewingEnquiry(null);
                    handleStatusChange(target, "Accepted");
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Check size={14} /> Accept
                </button>
              ) : <div />}
              <button 
                type="button" 
                onClick={() => setViewingEnquiry(null)} 
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingEnquiry && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingEnquiry(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#032e60]">Edit Enquiry</h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{editingEnquiry.customerId || "AN-New"} — {editingEnquiry.customerName}</p>
              </div>
              <button 
                onClick={() => setEditingEnquiry(null)} 
                title="Cancel / Close (Esc)"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleEditSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Customer Name</label>
                  <input required type="text" value={editingEnquiry.customerName} onChange={(e) => setEditingEnquiry({...editingEnquiry, customerName: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Mobile Number</label>
                  <input required type="tel" value={editingEnquiry.mobileNumber} onChange={(e) => setEditingEnquiry({...editingEnquiry, mobileNumber: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-[#2563eb]" />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Notes / References</label>
                  <textarea rows={4} value={editingEnquiry.notes} onChange={(e) => setEditingEnquiry({...editingEnquiry, notes: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-[#2563eb]" />
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
                <button type="button" onClick={() => setEditingEnquiry(null)} className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100 text-sm font-semibold cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#032e60] text-white rounded-lg hover:bg-[#021f40] text-sm font-semibold cursor-pointer shadow-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin WhatsApp Notification Modal */}
      <AdminWhatsAppModal
        isOpen={whatsAppModal.isOpen}
        status={whatsAppModal.status}
        application={whatsAppModal.application}
        onClose={() => setWhatsAppModal({ isOpen: false, status: null, application: null })}
        onTrackerNavigate={() => {
          setWhatsAppModal({ isOpen: false, status: null, application: null });
          setLocation("/admin/tracker");
        }}
      />
    </div>
  );
}
