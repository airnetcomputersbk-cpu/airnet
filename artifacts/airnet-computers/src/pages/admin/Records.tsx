import { useState, useEffect, useDeferredValue } from "react";
import { Search, Plus, Trash2, IndianRupee, Download, Eye, Pencil, X, Filter, RefreshCw, Wallet, AlertCircle, CheckCircle2, Route } from "lucide-react";
import { useModal } from "../../context/ModalContext";
import { getCachedData, setCachedData } from "../../lib/dataCache";
import { useLiveSync } from "../../hooks/useLiveSync";
import { usePathway } from "../../context/PathwayContext";
import { formatDateDMY, formatDateTimeDMY } from "../../lib/dateUtils";

type RecordEntry = {
  id: number;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  serviceId: string;
  amountCharged: number;
  amountPaid: number;
  amountPending: number;
  paymentMethod: string;
  applicationStatus: string;
  notes: string;
  createdAt: string;
  source: "tracker" | "enquiry";
};

export default function Records() {
  const { showSuccess, showError, confirmDelete } = useModal();
  const { openPathway } = usePathway();
  
  // High performance SWR Cache: render cached ledger records in 0ms without blank screen flicker
  const [records, setRecords] = useState<RecordEntry[]>(() => {
    return getCachedData<RecordEntry[]>("admin_records_v3") || [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !getCachedData<RecordEntry[]>("admin_records_v3");
  });
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filters
  const [filterPendingStatus, setFilterPendingStatus] = useState("All");
  const [filterPayment, setFilterPayment] = useState("All");

  // Modals
  const [viewingRecord, setViewingRecord] = useState<RecordEntry | null>(null);
  const [editingRecord, setEditingRecord] = useState<RecordEntry | null>(null);

  const [formData, setFormData] = useState({
    customerName: "",
    mobileNumber: "",
    serviceId: "",
    amountCharged: "",
    amountPaid: "",
    amountPending: "0",
    paymentMethod: "Cash",
    notes: ""
  });

  const fetchRecords = async (silent = false) => {
    if (!silent && records.length === 0) {
      setLoading(true);
    }
    try {
      // Fetch details of customers from Track New Application Task, enquiries, and records
      const [trackerRes, enquiriesRes, recordsRes] = await Promise.all([
        fetch("/api/admin/tracker"),
        fetch("/api/admin/enquiries"),
        fetch("/api/admin/records")
      ]);

      const list: RecordEntry[] = [];
      const seenCustomerIds = new Set<string>();

      if (trackerRes.ok) {
        const tasks = await trackerRes.json();
        tasks.forEach((t: any) => {
          if (t.customerId) seenCustomerIds.add(t.customerId);
          const paid = Number(t.amountPaid) || 0;
          const pending = Number(t.amountPending) || 0;
          list.push({
            id: t.id,
            customerId: t.customerId || "AN-TRACKER",
            customerName: t.customerName,
            mobileNumber: t.mobileNumber || "",
            serviceId: t.serviceName || "General Service",
            amountPaid: paid,
            amountPending: pending,
            amountCharged: paid + pending,
            paymentMethod: t.paymentType || "Cash",
            applicationStatus: t.status || "In Progress",
            notes: t.notes || "",
            createdAt: t.createdAt,
            source: "tracker"
          });
        });
      }

      if (enquiriesRes.ok) {
        const enquiries = await enquiriesRes.json();
        enquiries.forEach((e: any) => {
          // If this customer ID isn't already present from tracker, add it
          if (!seenCustomerIds.has(e.customerId)) {
            if (e.customerId) seenCustomerIds.add(e.customerId);
            const charged = Number(e.amountCharged) || 0;
            const isPending = e.paymentMethod === "Pending" || e.paymentMethod === "Pending / Udhar" || e.paymentMethod === "Pending / Pay Later";
            const paid = e.amountPaid !== undefined && e.amountPaid !== null ? Number(e.amountPaid) || 0 : (isPending ? 0 : charged);
            const pending = e.amountPending !== undefined && e.amountPending !== null ? Number(e.amountPending) || 0 : Math.max(0, charged - paid);
            list.push({
              id: e.id,
              customerId: e.customerId || "AN-MIGRATED",
              customerName: e.customerName,
              mobileNumber: e.mobileNumber || "",
              serviceId: e.serviceId || "General Enquiry",
              amountPaid: paid,
              amountPending: pending,
              amountCharged: charged || (paid + pending),
              paymentMethod: e.paymentMethod || "Cash",
              applicationStatus: e.applicationStatus || "Completed",
              notes: e.notes || "",
              createdAt: e.createdAt,
              source: "enquiry"
            });
          }
        });
      }

      if (recordsRes && recordsRes.ok) {
        const recordsData = await recordsRes.json();
        recordsData.forEach((r: any) => {
          const custId = r.customerId || `AN-REC-${r.id}`;
          if (!seenCustomerIds.has(custId)) {
            seenCustomerIds.add(custId);
            const charged = Number(r.amountCharged) || 0;
            const paid = Number(r.amountPaid) || 0;
            const pending = Number(r.amountPending) || Math.max(0, charged - paid);
            list.push({
              id: r.id,
              customerId: custId,
              customerName: r.customerName || "Customer",
              mobileNumber: r.mobileNumber || "",
              serviceId: r.serviceProvided || "General Service",
              amountPaid: paid,
              amountPending: pending,
              amountCharged: charged || (paid + pending),
              paymentMethod: r.paymentMethod || "Cash",
              applicationStatus: "Completed",
              notes: r.notes || "",
              createdAt: r.createdAt,
              source: "enquiry"
            });
          }
        });
      }

      // Sort by newest created first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(list);
      setCachedData("admin_records_v3", list);
    } catch (err) {
      console.error("Failed to load records:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords(records.length > 0);
  }, []);

  // Live Multi-Device Sync on tracker or enquiries updates
  useLiveSync("tracker", () => fetchRecords(true));
  useLiveSync("enquiries", () => fetchRecords(true));
  useLiveSync("records", () => fetchRecords(true));

  // Escape key listener for easy modal cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddModal) setShowAddModal(false);
        else if (viewingRecord) setViewingRecord(null);
        else if (editingRecord) setEditingRecord(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddModal, viewingRecord, editingRecord]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const charged = Number(formData.amountCharged) || ((Number(formData.amountPaid) || 0) + (Number(formData.amountPending) || 0));
      const paid = Number(formData.amountPaid) || 0;
      const pending = Math.max(0, charged - paid);

      // Create directly in application tracker so details and payment stay in sync
      const res = await fetch("/api/admin/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.customerName,
          mobileNumber: formData.mobileNumber,
          serviceName: formData.serviceId,
          paymentType: formData.paymentMethod,
          amountCharged: charged,
          amountPaid: paid,
          amountPending: pending,
          notes: formData.notes,
          status: "Completed"
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setFormData({ customerName: "", mobileNumber: "", serviceId: "", amountCharged: "", amountPaid: "", amountPending: "0", paymentMethod: "Cash", notes: "" });
        fetchRecords();
        showSuccess("Record Added", `Customer ledger entry for "${formData.customerName}" added successfully.`);
      } else {
        showError("Creation Failed", "Failed to add ledger record. Please verify input fields.");
      }
    } catch (err: any) {
      console.error(err);
      showError("Creation Error", err.message || "Error adding record. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    try {
      const charged = Number(editingRecord.amountCharged) || ((Number(editingRecord.amountPaid) || 0) + (Number(editingRecord.amountPending) || 0));
      const paid = Number(editingRecord.amountPaid) || 0;
      const pending = Number(editingRecord.amountPending) || 0;

      if (editingRecord.source === "tracker") {
        const res = await fetch(`/api/admin/tracker/${editingRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: editingRecord.customerName,
            mobileNumber: editingRecord.mobileNumber,
            serviceName: editingRecord.serviceId,
            paymentType: editingRecord.paymentMethod,
            amountCharged: charged,
            amountPaid: paid,
            amountPending: pending,
            notes: editingRecord.notes
          })
        });
        if (res.ok) {
          setRecords(current => current.map(r => r.id === editingRecord.id && r.source === "tracker" ? { ...editingRecord, amountCharged: charged, amountPaid: paid, amountPending: pending } : r));
          setEditingRecord(null);
          showSuccess("Record Updated", `Customer ledger entry for "${editingRecord.customerName}" updated successfully.`);
        } else {
          showError("Update Failed", "Failed to update record in application tracker.");
        }
      } else {
        const res = await fetch(`/api/admin/enquiries/${editingRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerName: editingRecord.customerName,
            mobileNumber: editingRecord.mobileNumber,
            amountCharged: charged,
            amountPaid: paid,
            amountPending: pending,
            paymentMethod: editingRecord.paymentMethod,
            notes: editingRecord.notes
          })
        });
        if (res.ok) {
          setRecords(current => current.map(r => r.id === editingRecord.id && r.source === "enquiry" ? { ...editingRecord, amountCharged: charged, amountPaid: paid, amountPending: pending } : r));
          setEditingRecord(null);
          showSuccess("Record Updated", `Customer ledger entry for "${editingRecord.customerName}" updated successfully.`);
        } else {
          showError("Update Failed", "Failed to update record in enquiry ledger.");
        }
      }
    } catch (err: any) {
      console.error(err);
      showError("Update Error", err.message || "Failed to update record.");
      fetchRecords();
    }
  };

  const handleDelete = async (rec: RecordEntry) => {
    await confirmDelete({
      title: "Delete Customer Record?",
      message: "Are you sure you want to delete this customer record? This action may not be reversible.",
      itemName: rec.customerName,
      onConfirm: async () => {
        const res = rec.source === "tracker"
          ? await fetch(`/api/admin/tracker/${rec.id}`, { method: "DELETE" })
          : await fetch(`/api/admin/enquiries/${rec.id}`, { method: "DELETE" });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete record");
        }
        setRecords(current => {
          const updated = current.filter(r => !(r.id === rec.id && r.source === rec.source));
          setCachedData("admin_records_v3", updated);
          return updated;
        });
      }
    });
  };

  const exportToCSV = () => {
    const headers = ["SL No", "Customer ID", "Date", "Customer Name", "Mobile", "Service", "Amount Charged (INR)", "Paid Amount (INR)", "Due Amount (INR)", "Payment Type", "Notes"];
    const rows = filteredRecords.map((r, i) => [
      filteredRecords.length - i,
      r.customerId || "AN-MIGRATED",
      formatDateDMY(r.createdAt),
      `"${r.customerName}"`,
      r.mobileNumber,
      `"${r.serviceId || 'General'}"`,
      r.amountCharged ?? ((r.amountPaid ?? 0) + (r.amountPending ?? 0)),
      r.amountPaid ?? 0,
      r.amountPending ?? 0,
      r.paymentMethod || "Cash",
      `"${(r.notes || "").replace(/"/g, '""').replace(/\n/g, ' ')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    const today = formatDateDMY(new Date());
    link.setAttribute("href", url);
    link.setAttribute("download", `Airnet-Ledger-${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deferredSearch = useDeferredValue(search);

  const filteredRecords = records.filter(r => {
    const q = deferredSearch.toLowerCase();
    const matchesSearch = !q ||
                          r.customerName.toLowerCase().includes(q) || 
                          r.customerId?.toLowerCase().includes(q) || 
                          r.mobileNumber?.includes(q) ||
                          r.serviceId?.toLowerCase().includes(q) ||
                          r.notes?.toLowerCase().includes(q);

    const matchesPendingStatus = 
      filterPendingStatus === "All" ||
      (filterPendingStatus === "Pending" && (r.amountPending ?? 0) > 0) ||
      (filterPendingStatus === "Paid" && (r.amountPending ?? 0) === 0);

    const matchesPayment = filterPayment === "All" || r.paymentMethod === filterPayment;

    return matchesSearch && matchesPendingStatus && matchesPayment;
  });

  const totalCharged = records.reduce((sum, r) => sum + (Number(r.amountCharged) || ((Number(r.amountPaid) || 0) + (Number(r.amountPending) || 0))), 0);
  const totalPaid = records.reduce((sum, r) => sum + (Number(r.amountPaid) || 0), 0);
  const totalPending = records.reduce((sum, r) => sum + (Number(r.amountPending) || 0), 0);
  const pendingCount = records.filter(r => (Number(r.amountPending) || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#032e60] flex items-center gap-3">
            <Wallet className="text-[#177d70]" size={32} />
            Ledger Records
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Unified ledger view of all customer records fetched directly from Track New Application Task and enquiries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchRecords()}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-medium text-sm transition-all shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#177d70] text-white rounded-lg hover:bg-[#116257] transition-colors font-bold text-sm shadow-sm"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#032e60] text-white rounded-lg hover:bg-[#021f40] transition-colors font-bold text-sm shadow-sm"
          >
            <Plus size={16} />
            <span>Add Record</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Customer Records</div>
            <div className="text-2xl font-bold text-[#032e60] mt-1">{records.length}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{filteredRecords.length} shown with filters</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 grid place-items-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Total Amount Charged</div>
            <div className="text-2xl font-bold text-blue-700 mt-1">₹{totalCharged.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Total billed to customers</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-700 grid place-items-center">
            <IndianRupee size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Total Paid Amount</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">₹{totalPaid.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Total collected across records</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 grid place-items-center">
            <IndianRupee size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Total Due Amount</div>
            <div className="text-2xl font-bold text-amber-600 mt-1">₹{totalPending.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{pendingCount} customer{pendingCount === 1 ? "" : "s"} with dues</div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 grid place-items-center">
            <AlertCircle size={22} />
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search Customer ID (AN-...), Name, Mobile, Service..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#177d70] bg-gray-50/50"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-500">Pending:</span>
            <select 
              value={filterPendingStatus} 
              onChange={(e) => setFilterPendingStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#177d70]"
            >
              <option value="All">All Records</option>
              <option value="Pending">Has Pending Due (&gt; ₹0)</option>
              <option value="Paid">Fully Paid (Nil Due)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Payment:</span>
            <select 
              value={filterPayment} 
              onChange={(e) => setFilterPayment(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#177d70]"
            >
              <option value="All">All Payment Types</option>
              <option value="Cash">Cash</option>
              <option value="UPI / QR">UPI / QR</option>
              <option value="Card">Card</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Pending / Pay Later">Pending / Pay Later</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
              <th className="p-4 font-semibold">SL No.</th>
              <th className="p-4 font-semibold">Customer ID</th>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Customer Info</th>
              <th className="p-4 font-semibold">Service</th>
              <th className="p-4 font-semibold text-blue-900">Amount Charged</th>
              <th className="p-4 font-semibold text-emerald-800">Paid Amount</th>
              <th className="p-4 font-semibold text-amber-900">Due Amount</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-gray-500">
                  <RefreshCw className="animate-spin mx-auto mb-2 text-[#177d70]" size={22} />
                  Loading customer records from Track New Application Task...
                </td>
              </tr>
            ) : filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-10 text-center text-gray-500">
                  No records found matching your filters.
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec, index) => {
                const charged = rec.amountCharged ?? ((rec.amountPaid ?? 0) + (rec.amountPending ?? 0));
                const paid = rec.amountPaid ?? 0;
                const due = rec.amountPending ?? Math.max(0, charged - paid);

                return (
                  <tr key={`${rec.source}-${rec.id}`} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-gray-500 font-medium text-sm">{filteredRecords.length - index}</td>
                    <td className="p-4">
                      <span className="font-mono font-bold text-[#032e60] bg-blue-50 px-2 py-0.5 rounded text-xs">
                        {rec.customerId || "AN-MIGRATED"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-700 text-sm whitespace-nowrap font-semibold font-mono">
                      {formatDateDMY(rec.createdAt)}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[#032e60] text-sm">{rec.customerName}</div>
                      <div className="text-xs text-gray-500">{rec.mobileNumber || "—"}</div>
                    </td>
                    <td className="p-4 text-gray-800 font-medium text-sm max-w-xs truncate">
                      {rec.serviceId || "General Service"}
                    </td>
                    {/* Amount Charged Column */}
                    <td className="p-4">
                      <div className="font-bold text-gray-900 font-mono text-base">₹{charged}</div>
                      <div className="text-[11px] text-gray-400 font-medium">Total Billed</div>
                    </td>
                    {/* Paid Amount Column */}
                    <td className="p-4">
                      <div className="font-bold text-emerald-700 font-mono text-base">₹{paid}</div>
                      <div className="text-xs text-gray-500 font-medium capitalize">{rec.paymentMethod || "Cash"}</div>
                    </td>
                    {/* Due Amount Column */}
                    <td className="p-4">
                      {due > 0 ? (
                        <span className="font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 shadow-xs">
                          ₹{due} Due
                        </span>
                      ) : (
                        <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md text-xs inline-flex items-center">
                          ✓ Cleared
                        </span>
                      )}
                    </td>
                  {/* Action Column */}
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button 
                        onClick={() => openPathway({
                          id: `rec-${rec.id}`,
                          customerId: rec.customerId,
                          customerName: rec.customerName,
                          mobileNumber: rec.mobileNumber,
                          serviceName: rec.serviceId,
                          applicationStatus: rec.applicationStatus || "Completed",
                          amountCharged: rec.amountCharged,
                          amountPaid: rec.amountPaid,
                          amountPending: rec.amountPending,
                          notes: rec.notes,
                          createdAt: rec.createdAt,
                          source: "record"
                        })} 
                        className="text-cyan-700 hover:text-cyan-900 p-1.5 hover:bg-cyan-50 rounded-lg transition-colors flex items-center gap-1 font-semibold text-xs cursor-pointer" 
                        title="Open Pathway Floating Window"
                      >
                        <Route size={16} className="text-cyan-600" />
                        <span className="hidden sm:inline text-[11px]">Pathway</span>
                      </button>
                      <button 
                        onClick={() => setViewingRecord(rec)} 
                        className="text-gray-500 hover:text-gray-700 p-1.5 hover:bg-gray-100 rounded-lg transition-colors" 
                        title="View Details"
                      >
                        <Eye size={17} />
                      </button>
                      <button 
                        onClick={() => setEditingRecord(rec)} 
                        className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded-lg transition-colors" 
                        title="Edit Record"
                      >
                        <Pencil size={17} />
                      </button>
                      <button 
                        onClick={() => handleDelete(rec)} 
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Delete Record"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        </table>
      </div>

      {/* Add Manual Record Modal */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#032e60] flex items-center gap-2">
                  <Plus size={20} className="text-[#177d70]" />
                  Add Customer Record
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Creates record and adds customer into Application Tracker</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                title="Cancel / Close (Esc)"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. Ramesh" 
                    value={formData.customerName} 
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number *</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="e.g. 9876543210" 
                    value={formData.mobileNumber} 
                    onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Provided *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Passport, PAN Card, Certificate..." 
                  value={formData.serviceId} 
                  onChange={(e) => setFormData({...formData, serviceId: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                />
              </div>

              {/* Payment Details Section */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1.5">
                    <IndianRupee size={14} className="text-amber-600" />
                    Payment Details
                  </span>
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
                          paymentMethod: "Pending / Pay Later" 
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
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Amount Charged (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">₹</span>
                      <input 
                        required 
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
                        className="w-full pl-7 pr-3 py-2 text-sm font-mono font-semibold border border-gray-300 rounded-lg bg-white text-emerald-800 focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                      />
                    </div>
                  </div>
                </div>

                {/* Auto-calculated Due Amount display */}
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Type</label>
                  <select 
                    value={formData.paymentMethod} 
                    onChange={(e) => {
                      const method = e.target.value;
                      if (method === "Pending / Pay Later") {
                        setFormData({
                          ...formData,
                          paymentMethod: method,
                          amountPaid: "0",
                          amountPending: formData.amountCharged || "0",
                        });
                      } else {
                        const paid = formData.amountPaid === "0" && formData.amountCharged ? formData.amountCharged : formData.amountPaid;
                        const due = Math.max(0, (Number(formData.amountCharged) || 0) - (Number(paid) || 0));
                        setFormData({
                          ...formData,
                          paymentMethod: method,
                          amountPaid: paid,
                          amountPending: String(due),
                        });
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes (optional)</label>
                <textarea 
                  rows={2} 
                  placeholder="Application number, remarks, etc." 
                  value={formData.notes} 
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none"
                />
              </div>
            </div>
              
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  disabled={isSaving} 
                  onClick={() => setShowAddModal(false)} 
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="px-5 py-2 bg-[#177d70] text-white rounded-lg hover:bg-[#116257] font-bold text-sm shadow-sm cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Record Modal */}
      {viewingRecord && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setViewingRecord(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#032e60] flex items-center gap-2">
                  <Eye size={20} className="text-[#177d70]" />
                  Record Details
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{viewingRecord.customerId || "AN-MIGRATED"} — {viewingRecord.customerName}</p>
              </div>
              <button 
                onClick={() => setViewingRecord(null)} 
                title="Close / Cancel (Esc)"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Customer ID</p>
                  <p className="font-mono font-bold text-base text-[#177d70] mt-0.5">{viewingRecord.customerId || "AN-MIGRATED"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Date Logged</p>
                  <p className="font-medium text-gray-800 mt-0.5">{formatDateTimeDMY(viewingRecord.createdAt)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Customer Name</p>
                  <p className="font-bold text-gray-900 mt-0.5">{viewingRecord.customerName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold uppercase">Mobile Number</p>
                  <p className="font-medium text-gray-800 mt-0.5">{viewingRecord.mobileNumber || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Service</p>
                <p className="font-semibold text-gray-800 mt-0.5">{viewingRecord.serviceId || "General Service"}</p>
              </div>

              {/* Payment Details Box */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200">
                <div className="text-xs font-bold text-[#032e60] uppercase mb-2 flex items-center gap-1.5">
                  <IndianRupee size={13} className="text-amber-600" />
                  Payment Breakdown
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[11px] text-gray-500 block">Amount Charged</span>
                    <span className="font-mono font-bold text-gray-900 text-base">₹{viewingRecord.amountCharged ?? ((viewingRecord.amountPaid ?? 0) + (viewingRecord.amountPending ?? 0))}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Paid Amount</span>
                    <span className="font-mono font-bold text-emerald-700 text-base">₹{viewingRecord.amountPaid ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-900 font-semibold block">Due Amount</span>
                    {(viewingRecord.amountPending ?? 0) > 0 ? (
                      <span className="font-mono font-bold text-amber-900 bg-amber-200 px-2 py-0.5 rounded text-xs inline-block mt-0.5">
                        ₹{viewingRecord.amountPending} Due
                      </span>
                    ) : (
                      <span className="font-mono text-emerald-800 text-xs font-semibold bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded inline-block mt-0.5">
                        ✓ Nil Due
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block">Payment Type</span>
                    <span className="font-semibold text-gray-800 capitalize mt-0.5 block">{viewingRecord.paymentMethod || "Cash"}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Notes / Remarks</p>
                <p className="font-medium whitespace-pre-wrap bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-700 mt-1">
                  {viewingRecord.notes || "No notes provided."}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase">Application Status</p>
                <span className="inline-block mt-1 font-semibold text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-800">
                  {viewingRecord.applicationStatus}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
              <button 
                type="button" 
                onClick={() => setViewingRecord(null)} 
                className="px-5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingRecord(null); }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-[#032e60] flex items-center gap-2">
                  <Pencil size={18} className="text-blue-600" />
                  Edit Customer Record
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{editingRecord.customerId || "AN-Record"} — {editingRecord.customerName}</p>
              </div>
              <button 
                onClick={() => setEditingRecord(null)} 
                title="Cancel / Close (Esc)"
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20}/>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Name *</label>
                  <input 
                    required 
                    type="text" 
                    value={editingRecord.customerName} 
                    onChange={(e) => setEditingRecord({...editingRecord, customerName: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number</label>
                  <input 
                    type="tel" 
                    value={editingRecord.mobileNumber} 
                    onChange={(e) => setEditingRecord({...editingRecord, mobileNumber: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Provided</label>
                <input 
                  type="text" 
                  value={editingRecord.serviceId} 
                  onChange={(e) => setEditingRecord({...editingRecord, serviceId: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                />
              </div>

              {/* Payment Details Section */}
              <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#032e60] uppercase tracking-wider flex items-center gap-1">
                    <IndianRupee size={13} className="text-amber-600" />
                    Payment Details
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const charged = editingRecord.amountCharged ?? ((editingRecord.amountPaid ?? 0) + (editingRecord.amountPending ?? 0));
                        setEditingRecord({ ...editingRecord, amountCharged: charged, amountPaid: charged, amountPending: 0 });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-emerald-300 rounded text-emerald-700 hover:bg-emerald-50 font-medium"
                    >
                      Full Paid
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const charged = editingRecord.amountCharged ?? ((editingRecord.amountPaid ?? 0) + (editingRecord.amountPending ?? 0));
                        setEditingRecord({ ...editingRecord, amountCharged: charged, amountPaid: 0, amountPending: charged, paymentMethod: "Pending / Pay Later" });
                      }}
                      className="text-[10px] px-2 py-0.5 bg-white border border-amber-300 rounded text-amber-800 hover:bg-amber-50 font-medium"
                    >
                      Full Due
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Amount Charged (₹)</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={editingRecord.amountCharged ?? ((editingRecord.amountPaid ?? 0) + (editingRecord.amountPending ?? 0))} 
                      onChange={(e) => {
                        const charged = Number(e.target.value) || 0;
                        const paid = editingRecord.amountPaid ?? 0;
                        const due = Math.max(0, charged - paid);
                        setEditingRecord({ ...editingRecord, amountCharged: charged, amountPending: due });
                      }} 
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs font-mono font-semibold bg-white" 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Amount Paid (₹)</label>
                    <input 
                      required 
                      type="number" 
                      min="0" 
                      value={editingRecord.amountPaid ?? 0} 
                      onChange={(e) => {
                        const paid = Number(e.target.value) || 0;
                        const charged = editingRecord.amountCharged ?? ((editingRecord.amountPaid ?? 0) + (editingRecord.amountPending ?? 0));
                        const due = Math.max(0, charged - paid);
                        setEditingRecord({ ...editingRecord, amountPaid: paid, amountPending: due });
                      }} 
                      className="w-full border border-gray-300 rounded-lg p-2 text-xs font-mono font-semibold bg-white text-emerald-800" 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-amber-200 text-xs">
                  <span className="text-gray-500">Due Amount (Auto-calculated):</span>
                  {(editingRecord.amountPending ?? 0) > 0 ? (
                    <span className="font-mono font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded text-xs">
                      ₹{editingRecord.amountPending} Due
                    </span>
                  ) : (
                    <span className="font-mono font-semibold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded text-xs">
                      ✓ Cleared (Nil Due)
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Payment Type</label>
                  <select 
                    value={editingRecord.paymentMethod || "Cash"} 
                    onChange={(e) => setEditingRecord({...editingRecord, paymentMethod: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg p-2 text-xs bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI / QR">UPI / QR (GPay, PhonePe, Paytm)</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Pending / Pay Later">Pending / Pay Later</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Remarks</label>
                <textarea 
                  rows={2} 
                  value={editingRecord.notes || ""} 
                  onChange={(e) => setEditingRecord({...editingRecord, notes: e.target.value})} 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#177d70] focus:outline-none" 
                />
              </div>

              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-2.5 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setEditingRecord(null)} 
                  className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-[#032e60] text-white rounded-lg hover:bg-[#021f40] font-bold text-sm shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
