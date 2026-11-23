import React, { useState, useEffect } from "react";
import {
  Route,
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
  Clock,
  FolderOpen,
  RefreshCw,
  FileText,
  Bookmark,
  Sparkles
} from "lucide-react";
import { usePathway, PathwayCustomer } from "../../context/PathwayContext";
import { formatDateTimeDMY } from "../../lib/dateUtils";

export function PathwayPopoutView({ onRestore }: { onRestore?: () => void }) {
  const {
    activeCustomer,
    customers,
    isLoading,
    selectCustomer,
    refreshPathwayData,
  } = usePathway();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"flow" | "details" | "notes" | "documents">("flow");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Notes & Scratchpad State
  const [noteTab, setNoteTab] = useState<"customer" | "general">("customer");
  const [generalNote, setGeneralNote] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("airnet_pathway_user_notes");
      if (saved) return JSON.parse(saved).generalNote || "";
    } catch (e) {}
    return "";
  });
  const [customerNotes, setCustomerNotes] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("airnet_pathway_user_notes");
      if (saved) return JSON.parse(saved).customerNotes || {};
    } catch (e) {}
    return {};
  });

  const activeCustKey = activeCustomer ? (activeCustomer.customerId || activeCustomer.id) : "general";
  const currentNoteText = noteTab === "general" ? generalNote : (customerNotes[activeCustKey] || "");

  const handleNoteChange = (text: string) => {
    if (noteTab === "general") {
      setGeneralNote(text);
      try {
        const saved = JSON.parse(localStorage.getItem("airnet_pathway_user_notes") || "{}");
        localStorage.setItem("airnet_pathway_user_notes", JSON.stringify({ ...saved, generalNote: text }));
      } catch (e) {}
    } else {
      const updated = { ...customerNotes, [activeCustKey]: text };
      setCustomerNotes(updated);
      try {
        const saved = JSON.parse(localStorage.getItem("airnet_pathway_user_notes") || "{}");
        localStorage.setItem("airnet_pathway_user_notes", JSON.stringify({ ...saved, customerNotes: updated }));
      } catch (e) {}
    }
  };

  const handleCopy = (text: string, field: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

  const embedOrigin = typeof window !== "undefined" && window.location.port !== "5000" ? window.location.origin : "http://localhost:5001";
  const bookmarkletCode = `javascript:(function(){var s=document.createElement('script');s.src='${embedOrigin}/api/pathway/embed.js?t='+Date.now();document.body.appendChild(s);})();`;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none text-slate-800">
      {/* Popout Header */}
      <header className="bg-gradient-to-r from-[#022349] via-[#032e60] to-[#044085] text-white p-3 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
            <Route className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <span>Airnet Pathway</span>
              <span className="text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 px-1.5 py-0.2 rounded">
                Popout Companion
              </span>
            </h1>
            <p className="text-[10px] text-blue-200/80">
              Floating dossier for external websites & government portals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onRestore && (
            <button
              type="button"
              onClick={onRestore}
              className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              title="Dock back to main Airnet window"
            >
              Dock Back
            </button>
          )}
          <button
            type="button"
            onClick={refreshPathwayData}
            disabled={isLoading}
            className="p-1.5 text-cyan-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Refresh Data from Airnet Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Customer Quick Selector & Search */}
      <div className="p-3 bg-white border-b border-slate-200 shrink-0 space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer name, phone, or ID..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-800"
          />
        </div>

        <select
          value={activeCustomer?.id || ""}
          onChange={(e) => {
            const found = customers.find((c) => String(c.id) === e.target.value);
            if (found) selectCustomer(found);
          }}
          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
        >
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.customerName} ({c.customerId || "ID"}) - {c.serviceName}
            </option>
          ))}
        </select>
      </div>

      {/* Customer Quick Identity Card */}
      {activeCustomer ? (
        <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50/50 border-b border-blue-100 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm text-slate-900 truncate">
                  {activeCustomer.customerName}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(activeCustomer.customerName, "name")}
                  className="text-slate-400 hover:text-slate-600 p-0.5"
                  title="Copy Customer Name"
                >
                  {copiedField === "name" ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 flex-wrap">
                <span className="font-semibold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded text-[11px]">
                  {activeCustomer.serviceName}
                </span>
                {activeCustomer.mobileNumber && (
                  <span className="flex items-center gap-1 font-mono text-slate-700 text-[11px]">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span>{activeCustomer.mobileNumber}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(activeCustomer.mobileNumber, "phone")}
                      className="text-slate-400 hover:text-slate-600"
                      title="Copy Phone"
                    >
                      {copiedField === "phone" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    </button>
                    <a
                      href={`https://wa.me/91${activeCustomer.mobileNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:text-emerald-700"
                      title="WhatsApp"
                    >
                      <MessageCircle size={12} />
                    </a>
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                activeCustomer.applicationStatus === "Completed"
                  ? "bg-emerald-100 text-emerald-800"
                  : activeCustomer.applicationStatus === "In Progress"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-100 text-blue-800"
              }`}>
                {activeCustomer.applicationStatus || "In Progress"}
              </span>
              <div className="text-xs font-extrabold text-[#032e60] mt-1">
                {activeCustomer.progressPercent ?? 30}%
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-slate-500 bg-white border-b border-slate-200">
          No customer selected. Please select a customer above.
        </div>
      )}

      {/* Internal Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("flow")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "flow" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Stage Pipeline</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "details" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Details & Form Fields</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "notes" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Notes & Scratchpad</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("documents")}
          className={`pb-2 text-xs font-bold transition-colors border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === "documents" ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500"
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Documents</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {activeCustomer ? (
          <>
            {activeTab === "flow" && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Application Milestones
                </div>
                {activeCustomer.steps && activeCustomer.steps.length > 0 ? (
                  activeCustomer.steps.map((s, idx) => (
                    <div key={s.id || idx} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-start gap-2 text-xs">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white shrink-0 mt-0.5 ${
                        s.status === "completed" ? "bg-emerald-500" : s.status === "in-progress" ? "bg-blue-600" : "bg-slate-300 text-slate-600"
                      }`}>
                        {s.status === "completed" ? "✓" : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-900">{s.title}</div>
                        {s.note && <div className="text-[11px] text-slate-500 mt-0.5">{s.note}</div>}
                      </div>
                      <span className="text-[10px] text-slate-500 capitalize">{s.status}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">No milestones recorded.</div>
                )}
              </div>
            )}

            {activeTab === "details" && (
              <div className="space-y-2">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Customer ID</span>
                    <div className="flex items-center gap-1 font-mono font-semibold">
                      <span>{activeCustomer.customerId || "-"}</span>
                      <button onClick={() => handleCopy(activeCustomer.customerId || "", "ID")} className="text-slate-400 hover:text-slate-600">
                        {copiedField === "ID" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Application Number</span>
                    <div className="flex items-center gap-1 font-mono font-semibold">
                      <span>{activeCustomer.applicationNumber || "None"}</span>
                      {activeCustomer.applicationNumber && (
                        <button onClick={() => handleCopy(activeCustomer.applicationNumber || "", "AppNo")} className="text-slate-400 hover:text-slate-600">
                          {copiedField === "AppNo" ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="text-slate-500">Official Portal Link</span>
                    {activeCustomer.applyUrl ? (
                      <a href={activeCustomer.applyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 font-medium">
                        <span>Open Portal</span>
                        <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-slate-400">Direct Department</span>
                    )}
                  </div>

                  {activeCustomer.notes && (
                    <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-[11px]">
                      <strong>Notes:</strong> {activeCustomer.notes}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const summary = [
                        "CUSTOMER APPLICATION DATA",
                        `Name: ${activeCustomer.customerName}`,
                        `Phone: ${activeCustomer.mobileNumber}`,
                        `Customer ID: ${activeCustomer.customerId}`,
                        `Service: ${activeCustomer.serviceName}`,
                        `Application No: ${activeCustomer.applicationNumber || "-"}`,
                        `Status: ${activeCustomer.applicationStatus}`,
                        activeCustomer.notes ? `Notes: ${activeCustomer.notes}` : "",
                      ].filter(Boolean).join("\n");
                      handleCopy(summary, "all");
                    }}
                    className="w-full mt-2 py-2 bg-[#022349] hover:bg-[#032e60] text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    {copiedField === "all" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    <span>{copiedField === "all" ? "Copied All Form Fields!" : "Copy All Form Fields to Clipboard"}</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">📝 Notes & Scratchpad</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                        Auto-Saved
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setNoteTab("customer")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                          noteTab === "customer" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {activeCustomer.customerName.split(" ")[0]} Note
                      </button>
                      <button
                        type="button"
                        onClick={() => setNoteTab("general")}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all cursor-pointer ${
                          noteTab === "general" ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Scratchpad
                      </button>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const snippet = `[Customer Info]\nName: ${activeCustomer.customerName}\nMobile: ${activeCustomer.mobileNumber}\nApp No: ${activeCustomer.applicationNumber || "-"}\nService: ${activeCustomer.serviceName}\n---\n`;
                        handleNoteChange(currentNoteText ? `${currentNoteText}\n${snippet}` : snippet);
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                    >
                      + Customer Info
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const timeStamp = `[${formatDateTimeDMY(now)}] `;
                        handleNoteChange(currentNoteText ? `${currentNoteText} ${timeStamp}` : timeStamp);
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                    >
                      + Timestamp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Clear this note?")) {
                          handleNoteChange("");
                        }
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 text-red-600 hover:bg-red-50 rounded cursor-pointer ml-auto"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={6}
                    value={currentNoteText}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder={
                      noteTab === "customer"
                        ? `Write specific notes, application notes, or pending items for ${activeCustomer.customerName}...`
                        : "Write quick notes, reference numbers, or clipboard text here across all tabs..."
                    }
                    className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/50 resize-y"
                  />

                  {/* Copy Button & Stats */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {currentNoteText.length} chars • {currentNoteText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentNoteText, "note")}
                      disabled={!currentNoteText}
                      className="px-3 py-1.5 bg-[#022349] hover:bg-[#032e60] disabled:opacity-40 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                    >
                      {copiedField === "note" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedField === "note" ? "Copied Accurately!" : "Copy Notes Accurately"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Uploaded Customer Files
                </div>
                {activeCustomer.documents && activeCustomer.documents.length > 0 ? (
                  activeCustomer.documents.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/api/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{doc.fileName}</span>
                      </div>
                      <span className="text-[10px] text-blue-600 font-bold shrink-0">Open ↗</span>
                    </a>
                  ))
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">No documents found.</div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Bottom Bookmarklet Quick Access Footer */}
      <footer className="p-2.5 bg-slate-200 border-t border-slate-300 text-[11px] text-slate-600 flex items-center justify-between shrink-0">
        <span>💡 Use on any website:</span>
        <a
          href={bookmarkletCode}
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard.writeText(bookmarkletCode);
            handleCopy(bookmarkletCode, "bmark");
          }}
          className="text-blue-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
          title="Click to copy bookmarklet code or drag to your bookmarks bar"
        >
          <Bookmark size={11} />
          <span>{copiedField === "bmark" ? "Copied Bookmarklet!" : "Copy Bookmarklet Link"}</span>
        </a>
      </footer>
    </div>
  );
}

export default function PathwayPopout() {
  return <PathwayPopoutView />;
}
