import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Search,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  GripVertical,
  AlertTriangle,
  CheckCircle2,
  X,
  Globe,
  Fingerprint,
  CreditCard,
  Plane,
  UserSquare,
  SquareUser,
  ShoppingCart,
  Landmark,
  Activity,
  Factory,
  HeartPulse,
  HardHat,
  Accessibility,
  GraduationCap,
  Bus,
  Map,
  Car,
  ScrollText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useLiveSync } from "../../hooks/useLiveSync";
import { useModal } from "../../context/ModalContext";

export interface GovernmentServiceItem {
  id: number;
  name: string;
  url: string;
  iconKey: string;
  iconType: "builtin" | "favicon";
  faviconUrl?: string | null;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Fingerprint,
  CreditCard,
  Plane,
  UserSquare,
  SquareUser,
  ShoppingCart,
  Landmark,
  Activity,
  Factory,
  HeartPulse,
  HardHat,
  Accessibility,
  GraduationCap,
  Bus,
  Map,
  Car,
  ScrollText,
  Globe,
};

function getDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.hostname;
  } catch {
    return "";
  }
}

function isValidHttpUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function ServiceIconDisplay({
  name,
  url,
  iconKey,
  iconType,
  faviconUrl,
}: {
  name: string;
  url: string;
  iconKey: string;
  iconType: "builtin" | "favicon";
  faviconUrl?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  // Derive favicon URL
  const domain = getDomain(url);
  const effectiveFavicon = faviconUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null);

  if (iconType === "favicon" && effectiveFavicon && !imgError) {
    return (
      <div
        className="w-12 h-12 rounded-xl bg-white border-2 border-[#032e60]/25 flex items-center justify-center p-2 shadow-2xs shrink-0 mx-auto"
        title={name}
      >
        <img
          src={effectiveFavicon}
          alt={name}
          className="w-6 h-6 object-contain"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </div>
    );
  }

  const IconComp = ICON_MAP[iconKey] || Globe;
  return (
    <div
      className="w-12 h-12 rounded-xl bg-white border-2 border-[#032e60]/25 flex items-center justify-center p-2 shadow-2xs shrink-0 text-[#032e60] mx-auto"
      title={name}
    >
      <IconComp className="w-6 h-6" />
    </div>
  );
}

// ----------------------------------------------------
// Sortable Square Box Component (5 per row on desktop)
// ----------------------------------------------------
interface SortableRowProps {
  service: GovernmentServiceItem;
  onEdit: (service: GovernmentServiceItem) => void;
  onDelete: (service: GovernmentServiceItem) => void;
  isDragDisabled?: boolean;
}

function SortableServiceRow({ service, onEdit, onDelete, isDragDisabled }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: service.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col justify-between p-3.5 bg-white border rounded-2xl transition-all duration-200 aspect-square select-none overflow-hidden ${
        isDragging
          ? "opacity-50 scale-105 shadow-2xl border-2 border-blue-500 bg-blue-50/60 z-30 ring-4 ring-blue-500/10"
          : "border-slate-200/90 hover:border-[#032e60]/40 hover:shadow-md"
      }`}
    >
      {/* Top Bar: Grip / Position on Left, Edit & Delete on Right */}
      <div className="flex items-center justify-between w-full shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            {...attributes}
            {...listeners}
            disabled={isDragDisabled}
            className={`touch-none p-1 -m-1 text-slate-400 hover:text-slate-700 rounded transition-colors ${
              isDragDisabled ? "opacity-20 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
            }`}
            aria-label={`Drag to reorder ${service.name}`}
            title={isDragDisabled ? "Reordering disabled during search" : "Drag to reorder"}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            #{service.position}
          </span>
        </div>

        {/* Action Buttons: Edit & Delete (Hover on desktop, visible on mobile) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(service);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
            aria-label={`Edit ${service.name}`}
            title="Edit Service"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(service);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
            aria-label={`Delete ${service.name}`}
            title="Delete Service"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Center Body: Centered Icon + Service Name */}
      <div className="flex flex-col items-center justify-center my-auto text-center px-1 w-full">
        <ServiceIconDisplay
          name={service.name}
          url={service.url}
          iconKey={service.iconKey}
          iconType={service.iconType}
          faviconUrl={service.faviconUrl}
        />
        <h3
          className="font-bold text-slate-900 text-xs sm:text-sm mt-2 line-clamp-2 leading-tight tracking-tight text-center"
          title={service.name}
        >
          {service.name}
        </h3>
      </div>

      {/* Bottom Bar: Full-width Navy Apply Button */}
      <div className="w-full shrink-0 pt-1">
        <a
          href={service.url}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full inline-flex items-center justify-center gap-1.5 bg-[#032e60] hover:bg-[#022349] text-white text-xs font-semibold py-1.5 px-2 rounded-xl transition-all shadow-2xs hover:shadow active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#032e60]/30"
          title={`Open ${service.name} application portal`}
        >
          <span>Apply</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Main Government Services Component
// ----------------------------------------------------
export default function GovernmentServices() {
  const { showError, showSuccess } = useModal();
  const [services, setServices] = useState<GovernmentServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Position saved toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Position saved");
  const toastTimerRef = useRef<any>(null);

  const triggerToast = (msg: string = "Position saved") => {
    setToastMessage(msg);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  // Add / Edit Modal State
  const [modalMode, setModalMode] = useState<"add" | "edit" | null>(null);
  const [activeService, setActiveService] = useState<GovernmentServiceItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete Modal State
  const [serviceToDelete, setServiceToDelete] = useState<GovernmentServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // DND Sensors: Activation distance prevents dragging when clicking buttons
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch Services from API
  const fetchServices = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/admin/government-services");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GovernmentServiceItem[] = await res.json();
      setServices(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Failed to load government services:", err);
      if (!silent) {
        showError("Failed to load services", "Could not retrieve government services from database.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Multi-device SSE sync
  useLiveSync("government_services", () => {
    fetchServices(true);
  });

  // Filtered Services for real-time search
  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q));
  }, [services, search]);

  // Is Search Active
  const isSearchActive = search.trim().length > 0;

  // Drag and Drop Handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (isSearchActive) {
      // Prevent order corruption during active search
      return;
    }

    const oldIndex = services.findIndex((s) => s.id === active.id);
    const newIndex = services.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update order
    const previousOrder = [...services];
    const reordered = arrayMove(services, oldIndex, newIndex).map((s, idx) => ({
      ...s,
      position: idx + 1,
    }));

    setServices(reordered);

    try {
      const targetIds = reordered.map((s) => s.id);
      const res = await fetch("/api/admin/government-services/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save position (Status ${res.status})`);
      }

      triggerToast("Position saved");
    } catch (err: any) {
      console.error("Error saving service order:", err);
      // Rollback to previous confirmed order
      setServices(previousOrder);
      showError("Reorder Failed", "Could not save the new positions to the database.");
    }
  };

  // Open Add Modal
  const openAddModal = () => {
    setModalMode("add");
    setActiveService(null);
    setFormName("");
    setFormUrl("");
    setFormError("");
  };

  // Open Edit Modal
  const openEditModal = (service: GovernmentServiceItem) => {
    setModalMode("edit");
    setActiveService(service);
    setFormName(service.name);
    setFormUrl(service.url);
    setFormError("");
  };

  // Close Add/Edit Modal
  const closeModal = () => {
    if (submitting) return;
    setModalMode(null);
    setActiveService(null);
    setFormName("");
    setFormUrl("");
    setFormError("");
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError("Please enter a service name.");
      return;
    }

    const trimmedUrl = formUrl.trim();
    if (!isValidHttpUrl(trimmedUrl)) {
      setFormError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setSubmitting(true);
    try {
      if (modalMode === "add") {
        const res = await fetch("/api/admin/government-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            url: trimmedUrl,
            iconType: "favicon", // Default to favicon mode for new services
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to add service (Status ${res.status})`);
        }

        const created: GovernmentServiceItem = await res.json();
        setServices((prev) => [...prev, created]);
        closeModal();
        triggerToast("Service added");
      } else if (modalMode === "edit" && activeService) {
        const res = await fetch(`/api/admin/government-services/${activeService.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            url: trimmedUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to update service (Status ${res.status})`);
        }

        const updated: GovernmentServiceItem = await res.json();
        setServices((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        closeModal();
        triggerToast("Service updated");
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/government-services/${serviceToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to delete service (Status ${res.status})`);
      }

      // Refresh list to pick up recalculated positions
      await fetchServices(true);
      setServiceToDelete(null);
      triggerToast("Service deleted");
    } catch (err: any) {
      showError("Delete Failed", err.message || "Could not delete the service.");
    } finally {
      setDeleting(false);
    }
  };

  // Favicon preview calculation for form
  const previewDomain = getDomain(formUrl);
  const isPreviewUrlValid = isValidHttpUrl(formUrl);
  const previewFaviconUrl = isPreviewUrlValid && previewDomain ? `https://www.google.com/s2/favicons?domain=${previewDomain}&sz=64` : null;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* ---------------------------------------------------- */}
      {/* PAGE HEADER */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Subtitle */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#032e60]">
            Government Services
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Access all government portals • Drag to reorder • Click to apply
          </p>
        </div>

        {/* Header Controls: Search + Add Service */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Real-time Search Input */}
          <div className="relative min-w-[240px] sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search services..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#032e60]/20 focus:border-[#032e60] transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Add Service Button */}
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 bg-[#032e60] hover:bg-[#022349] text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow active:scale-[0.98] shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Subtle Divider */}
      <div className="h-px bg-slate-200/80 my-2" />

      {/* Active Search Hint */}
      {isSearchActive && (
        <div className="flex items-center justify-between text-xs bg-blue-50/70 border border-blue-100 text-blue-900 px-3.5 py-2 rounded-xl">
          <span>
            Showing <strong>{filteredServices.length}</strong> of {services.length} services matching &ldquo;{search}&rdquo;
          </span>
          <span className="text-blue-600 font-medium">Reordering disabled during search filter</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* SERVICES LIST */}
      {/* ---------------------------------------------------- */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-[#032e60] animate-spin" />
          <span className="text-xs font-medium text-slate-500">Loading government services...</span>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="py-16 text-center bg-white border border-slate-200 rounded-2xl p-8">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No services found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {isSearchActive
              ? `No government service matches "${search}". Try searching for another term.`
              : "No government services have been added yet."}
          </p>
          {isSearchActive && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="mt-4 text-xs font-semibold text-blue-600 hover:text-blue-800 underline"
            >
              Clear search filter
            </button>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredServices.map((s) => s.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3.5 sm:gap-4.5">
              {filteredServices.map((service) => (
                <SortableServiceRow
                  key={service.id}
                  service={service}
                  onEdit={openEditModal}
                  onDelete={setServiceToDelete}
                  isDragDisabled={isSearchActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* ---------------------------------------------------- */}
      {/* ADD / EDIT MODAL */}
      {/* ---------------------------------------------------- */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {/* Modal Header: Pale Blue Header */}
            <div className="bg-[#eff6ff] border-b border-blue-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 id="modal-title" className="text-base sm:text-lg font-bold text-[#032e60]">
                  {modalMode === "add" ? "Add New Service" : "Edit Service"}
                </h2>
                <p className="text-xs text-slate-500">
                  {modalMode === "add"
                    ? "Enter government portal details to add a service"
                    : "Update the service title or application URL"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 space-y-4">
              {/* Error Alert */}
              {formError && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Service Name Field */}
              <div>
                <label htmlFor="service-name-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="service-name-input"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Aadhaar, Passport, Ration Card"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#032e60]/20 focus:border-[#032e60] transition-all"
                />
              </div>

              {/* Service URL Field */}
              <div>
                <label htmlFor="service-url-input" className="block text-xs font-semibold text-slate-700 mb-1">
                  Service URL <span className="text-rose-500">*</span>
                </label>
                <input
                  id="service-url-input"
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://example.gov.in/"
                  required
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#032e60]/20 focus:border-[#032e60] transition-all font-mono text-xs"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  Must start with http:// or https://
                </span>
              </div>

              {/* Favicon Automatic Preview Box */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#032e60] flex items-center justify-center p-1.5 shadow-2xs shrink-0">
                  {previewFaviconUrl ? (
                    <img
                      src={previewFaviconUrl}
                      alt="Favicon preview"
                      className="w-5 h-5 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Globe className="w-5 h-5 text-[#032e60]" />
                  )}
                </div>
                <div className="text-xs text-slate-600">
                  <div className="font-semibold text-slate-800">Website Favicon Preview</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {previewDomain ? `Domain: ${previewDomain}` : "Enter a valid URL to preview favicon"}
                  </div>
                </div>
              </div>

              {/* Actions: Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-1.5 bg-[#032e60] hover:bg-[#022349] text-white text-xs sm:text-sm font-semibold px-5 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{modalMode === "add" ? "Add Service" : "Save Changes"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ---------------------------------------------------- */}
      {serviceToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !deleting && setServiceToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm overflow-hidden p-6 animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-heading"
            aria-describedby="delete-description"
          >
            {/* Red Alert Icon */}
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Exact Content Heading & Description */}
            <h2 id="delete-heading" className="text-lg font-bold text-slate-900">
              Are you sure?
            </h2>
            <p id="delete-description" className="text-xs sm:text-sm text-slate-500 mt-2">
              This will permanently delete the service. This action cannot be undone.
            </p>

            {/* Targeted Service Name Callout */}
            <div className="mt-3 py-1.5 px-3 bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 truncate border border-slate-200/60">
              {serviceToDelete.name}
            </div>

            {/* Buttons: No, Cancel & Yes, Delete */}
            <div className="grid grid-cols-2 gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                disabled={deleting}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteService}
                disabled={deleting}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* BOTTOM-CENTERED TOAST: "Position saved" */}
      {/* ---------------------------------------------------- */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#032e60] text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 border border-white/10"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
