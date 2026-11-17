import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Search, Check, FileText } from "lucide-react";
import { useGetServices } from "@workspace/api-client-react";
import { useModal } from "../../context/ModalContext";
import { useLiveSync } from "../../hooks/useLiveSync";

const CATEGORY_THEME_PRESETS: Record<string, { accent: string; icon: string }> = {
  "Identity": { accent: "bg-[#e5f0ea]", icon: "IdCard" },
  "Certificates": { accent: "bg-[#e6faee]", icon: "FileText" },
  "Online Applications": { accent: "bg-[#f5e6e6]", icon: "Briefcase" },
  "Document Services": { accent: "bg-[#e6f0fa]", icon: "BookOpen" },
  "Financial Services": { accent: "bg-[#e6faf6]", icon: "Banknote" },
  "Forms & payments": { accent: "bg-[#f4efe4]", icon: "Receipt" },
};

export default function Services() {
  const { showSuccess, showError, showWarning, confirmDelete } = useModal();
  const [isAdding, setIsAdding] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [search, setSearch] = useState("");

  // Escape key listener for easy modal cancellation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editingService) {
        setEditingService(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingService]);
  
  // Add Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Document Services");
  const [copy, setCopy] = useState("");
  const [price, setPrice] = useState("");
  const [documents, setDocuments] = useState("");
  const [timing, setTiming] = useState("Varies");
  const [submitting, setSubmitting] = useState(false);

  const { data: servicesData, refetch } = useGetServices();
  const services = Array.isArray(servicesData) ? servicesData : [];

  // Live Multi-Device Sync on services changes
  useLiveSync("services", () => {
    refetch();
  });

  const formatRupeesPrice = (raw: string): string => {
    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    const clean = trimmed.replace(/^([₹\s]|rs\.?|inr)+/i, "").trim();
    if (!clean) return "";
    return `₹${clean}`;
  };

  const handleSave = async () => {
    if (!title.trim() || !category.trim() || !price.trim()) {
      showWarning("Missing Details", "Please enter Title, Category, and Price before saving.");
      return;
    }
    const formattedPrice = formatRupeesPrice(price);
    const cleanCategory = category.trim();
    const preset = CATEGORY_THEME_PRESETS[cleanCategory] || { accent: "bg-[#e6f0fa]", icon: "BookOpen" };

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: cleanCategory,
          copy: copy.trim() || "Available at Airnet Computers Online Service Center",
          price: formattedPrice,
          documents: documents.trim() || "Please inquire at desk",
          timing: timing.trim() || "Varies",
          icon: preset.icon,
          accent: preset.accent,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Failed to save service (Status ${res.status})`);
      }

      // Reset form
      const savedTitle = title.trim();
      setTitle("");
      setCategory("Document Services");
      setCopy("");
      setPrice("");
      setDocuments("");
      setTiming("Varies");
      setIsAdding(false);
      refetch();

      // Trigger instant frontend sync
      window.dispatchEvent(new CustomEvent("airnet_services_updated"));
      localStorage.setItem("airnet_services_updated", Date.now().toString());
      showSuccess("Service Created", `Service "${savedTitle}" has been added successfully.`);
    } catch (err: any) {
      console.error("Failed to add service", err);
      showError("Creation Failed", err.message || "Failed to save service. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editingService.id) return;
    const formattedPrice = formatRupeesPrice(editingService.price);
    const cat = editingService.category || "Document Services";
    const preset = CATEGORY_THEME_PRESETS[cat] || { accent: "bg-[#e6f0fa]", icon: "BookOpen" };

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/services/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingService.title,
          category: editingService.category,
          copy: editingService.copy,
          price: formattedPrice,
          documents: editingService.documents,
          timing: editingService.timing || "Varies",
          accent: preset.accent,
          icon: preset.icon,
          isActive: editingService.isActive !== undefined ? editingService.isActive : true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update service");
      }

      const updatedTitle = editingService.title;
      setEditingService(null);
      refetch();

      // Trigger instant frontend sync
      window.dispatchEvent(new CustomEvent("airnet_services_updated"));
      localStorage.setItem("airnet_services_updated", Date.now().toString());
      showSuccess("Service Updated", `Service "${updatedTitle}" updated successfully.`);
    } catch (err: any) {
      console.error("Error updating service:", err);
      showError("Update Failed", err.message || "Failed to update service. Please try again.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (service: any) => {
    await confirmDelete({
      title: "Delete Service?",
      message: "Are you sure you want to delete this service? This action may not be reversible.",
      itemName: service.title,
      onConfirm: async () => {
        const res = await fetch(`/api/admin/services/${service.id}`, {
          method: "DELETE"
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to delete service.");
        }
        refetch();
        // Trigger instant frontend sync
        window.dispatchEvent(new CustomEvent("airnet_services_updated"));
        localStorage.setItem("airnet_services_updated", Date.now().toString());
      }
    });
  };

  const filteredServices = services.filter((s: any) =>
    s.title?.toLowerCase().includes(search.toLowerCase()) ||
    s.category?.toLowerCase().includes(search.toLowerCase()) ||
    s.price?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#032e60]">Manage Services</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create, edit, and organize services displayed to customers on the Airnet Computers website.
          </p>
        </div>
        <button 
          onClick={() => { setIsAdding(true); setEditingService(null); }}
          className="flex items-center gap-2 bg-[#2563eb] text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus size={18} />
          Add Service
        </button>
      </div>

      {/* Add New Service Form */}
      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-[#e5e7eb] animate-in fade-in duration-150">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100">
            <h2 className="text-xl font-bold text-[#032e60] flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              Create New Service
            </h2>
            <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Passport Registration"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option>Document Services</option>
                  <option>Online Applications</option>
                  <option>Financial Services</option>
                  <option>Identity</option>
                  <option>Certificates</option>
                  <option>Forms & payments</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Copy</label>
              <textarea
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={2}
                placeholder="Brief description of what this service covers..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Price / Fee *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-bold text-sm pointer-events-none select-none">
                    ₹
                  </span>
                  <input
                    value={price ? (price.startsWith("₹") ? price.slice(1) : price) : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/^([₹\s]|rs\.?|inr)+/i, "");
                      setPrice(raw ? `₹${raw}` : "");
                    }}
                    type="text"
                    className="w-full border border-gray-300 rounded-lg p-2.5 pl-8 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                    placeholder="e.g. 500 or 150 - 300"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Processing Timing</label>
                <input
                  value={timing}
                  onChange={(e) => setTiming(e.target.value)}
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Immediate, 15-20 days"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Required Documents</label>
                <input
                  value={documents}
                  onChange={(e) => setDocuments(e.target.value)}
                  type="text"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Aadhaar Card, Photo"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#032e60] text-white rounded-lg text-sm font-semibold hover:bg-blue-900 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Service"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search services by title, category, or fee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
          />
        </div>
        <div className="text-xs text-gray-500 font-semibold">
          Showing {filteredServices.length} of {services.length} services
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-white rounded-xl shadow-sm border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-4">Service Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Price / Fee</th>
                <th className="p-4">Est. Timing</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredServices.map((service: any) => (
                <tr key={service.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-[#032e60]">{service.title}</div>
                    {service.copy && (
                      <div className="text-xs text-gray-500 truncate max-w-xs">{service.copy}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium">
                      {service.category}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-gray-800">{service.price}</td>
                  <td className="p-4 text-xs text-gray-600">{service.timing || "Varies"}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <button
                        onClick={() => setEditingService({ ...service })}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                        title="Edit Service"
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        onClick={() => handleDelete(service)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors cursor-pointer"
                        title="Delete Service"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No services matching your search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= MODAL: EDIT SERVICE ================= */}
      {editingService && (
        <div 
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditingService(null); }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 bg-[#032e60] text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Pencil size={18} className="text-blue-300" />
                  Edit Service
                </h2>
                <p className="text-xs text-blue-200 mt-0.5">ID: {editingService.id}</p>
              </div>
              <button
                onClick={() => setEditingService(null)}
                title="Cancel / Close (Esc)"
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body with Visible Scrollbar */}
            <form onSubmit={handleSaveEdit} className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  value={editingService.title || ""}
                  onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-gray-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                <select
                  value={editingService.category || "Document Services"}
                  onChange={(e) => setEditingService({ ...editingService, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option>Document Services</option>
                  <option>Online Applications</option>
                  <option>Financial Services</option>
                  <option>Identity</option>
                  <option>Certificates</option>
                  <option>Forms & payments</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description / Copy</label>
                <textarea
                  rows={3}
                  value={editingService.copy || ""}
                  onChange={(e) => setEditingService({ ...editingService, copy: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Brief description of the service..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Price / Fee *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-700 font-bold text-sm pointer-events-none select-none">
                      ₹
                    </span>
                    <input
                      type="text"
                      required
                      value={editingService.price ? (editingService.price.startsWith("₹") ? editingService.price.slice(1) : editingService.price) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/^([₹\s]|rs\.?|inr)+/i, "");
                        setEditingService({ ...editingService, price: raw ? `₹${raw}` : "" });
                      }}
                      className="w-full border border-gray-300 rounded-lg p-2.5 pl-8 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                      placeholder="e.g. 500 or 150 - 300"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Processing Timing</label>
                  <input
                    type="text"
                    value={editingService.timing || ""}
                    onChange={(e) => setEditingService({ ...editingService, timing: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g. Immediate, 15-20 days"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Documents to Bring</label>
                <textarea
                  rows={2}
                  value={editingService.documents || ""}
                  onChange={(e) => setEditingService({ ...editingService, documents: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Aadhaar Card, Photos, 10th Certificate"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
