// Airnet Pathway Chrome Extension - Content Script
// Injected into any website (e.g. Seva Sindhu, Nadakacheri, Aadhaar, PAN portals)
// Mirror of Admin Pathway Design: Hero header, Tabs (Stage Pathway, Application Details, Notes & Scratchpad, Documents)
// Accurate copying options, Auto-fill, Resizable window with persistence.

(function () {
  if (window.__AIRNET_PATHWAY_EXT_LOADED__) {
    const root = document.getElementById("airnet-pathway-embed-root");
    if (root) {
      root.style.display = root.style.display === "none" ? "block" : "none";
    }
    return;
  }
  window.__AIRNET_PATHWAY_EXT_LOADED__ = true;

  // Storage Keys
  const STORAGE_KEY = "airnet_pathway_window_prefs";
  const NOTES_STORAGE_KEY = "airnet_pathway_user_notes";
  const DISABLED_DOMAINS_KEY = "airnet_pathway_disabled_domains";
  const PILL_VISIBLE_KEY = "airnet_pathway_pill_visible";

  // Power & Visibility States
  let isTurnedOff = false;
  let isLauncherPillEnabled = true;

  // Window Preferences
  let windowPrefs = {
    width: 490,
    height: 680,
    top: 20,
    right: 20,
    left: null,
    isRightSide: true,
    isMinimized: false,
    activeCustomerId: null,
    activeViewTab: "details", // "flow" | "details" | "notes" | "documents"
  };

  // Notes State
  let notesState = {
    generalNote: "",
    customerNotes: {}, // [customerId]: string
    activeTab: "customer", // "customer" | "general"
  };

  // Data & UI State
  let customers = [];
  let filteredCustomers = [];
  let activeCustomer = null;
  let searchQuery = "";
  let isLoading = true;
  let connectionError = null;
  let isResizing = false;
  let isDragging = false;
  let connectedEndpoint = "";

  // 1. Create Root Host Container & Shadow DOM
  const hostContainer = document.createElement("div");
  hostContainer.id = "airnet-pathway-embed-root";
  hostContainer.style.all = "initial";
  hostContainer.style.position = "fixed";
  hostContainer.style.zIndex = "2147483647"; // Always topmost
  hostContainer.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  hostContainer.style.display = "block";

  const shadow = hostContainer.attachShadow({ mode: "open" });

  // 2. Storage Helpers
  function loadPreferences() {
    try {
      const currentHost = window.location.hostname;
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY, NOTES_STORAGE_KEY, DISABLED_DOMAINS_KEY, PILL_VISIBLE_KEY], (res) => {
          if (res) {
            if (res[STORAGE_KEY]) {
              windowPrefs = { ...windowPrefs, ...res[STORAGE_KEY] };
              applyWindowPositionAndSize();
            }
            if (res[NOTES_STORAGE_KEY]) {
              notesState = { ...notesState, ...res[NOTES_STORAGE_KEY] };
            }

            // Check if user turned off Pathway on this website
            const disabledList = res[DISABLED_DOMAINS_KEY] || [];
            if (disabledList.includes(currentHost)) {
              isTurnedOff = true;
              hostContainer.style.display = "none";
              launcher.style.display = "none";
            } else {
              isTurnedOff = false;
            }

            // Check corner launcher pill preference
            if (res[PILL_VISIBLE_KEY] === false) {
              isLauncherPillEnabled = false;
              launcher.style.display = "none";
            } else {
              isLauncherPillEnabled = true;
              if (!isTurnedOff) {
                launcher.style.display = "flex";
              }
            }
          }
          syncNotesToUI();
        });
      } else {
        const localPrefs = localStorage.getItem(STORAGE_KEY);
        if (localPrefs) {
          windowPrefs = { ...windowPrefs, ...JSON.parse(localPrefs) };
          applyWindowPositionAndSize();
        }
        const localNotes = localStorage.getItem(NOTES_STORAGE_KEY);
        if (localNotes) {
          notesState = { ...notesState, ...JSON.parse(localNotes) };
        }
        syncNotesToUI();
      }
    } catch (e) {}
  }

  function savePreferences() {
    try {
      if (activeCustomer) {
        windowPrefs.activeCustomerId = activeCustomer.id;
      }
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY]: windowPrefs });
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(windowPrefs));
    } catch (e) {}
  }

  function saveNotes() {
    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [NOTES_STORAGE_KEY]: notesState });
      }
      localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notesState));
    } catch (e) {}
  }

  function getCurrentNoteText() {
    if (notesState.activeTab === "general") {
      return notesState.generalNote || "";
    }
    const custKey = activeCustomer ? (activeCustomer.customerId || activeCustomer.id) : "general";
    if (!notesState.customerNotes) notesState.customerNotes = {};
    return notesState.customerNotes[custKey] || "";
  }

  function setCurrentNoteText(text) {
    if (notesState.activeTab === "general") {
      notesState.generalNote = text;
    } else {
      const custKey = activeCustomer ? (activeCustomer.customerId || activeCustomer.id) : "general";
      if (!notesState.customerNotes) notesState.customerNotes = {};
      notesState.customerNotes[custKey] = text;
    }
    saveNotes();
  }

  function getStatsText(text) {
    const chars = (text || "").length;
    const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
    return `${words} word${words === 1 ? "" : "s"} • ${chars} char${chars === 1 ? "" : "s"}`;
  }

  function syncNotesToUI() {
    const textarea = shadow.getElementById("notes-textarea");
    const stats = shadow.getElementById("notes-stats");
    const saveBadge = shadow.getElementById("notes-save-status");
    if (textarea) {
      const currentVal = getCurrentNoteText();
      if (textarea.value !== currentVal) {
        textarea.value = currentVal;
      }
      if (stats) stats.textContent = getStatsText(currentVal);
      if (saveBadge) saveBadge.textContent = "Saved";
    }
  }

  function applyWindowPositionAndSize() {
    const card = shadow.querySelector(".pathway-card");
    if (!card) return;

    const maxW = Math.min(window.innerWidth - 20, 1400);
    const maxH = Math.min(window.innerHeight - 20, 1100);

    const safeW = Math.max(340, Math.min(windowPrefs.width || 490, maxW));
    const safeH = Math.max(400, Math.min(windowPrefs.height || 680, maxH));

    card.style.width = safeW + "px";
    card.style.height = safeH + "px";

    if (windowPrefs.left !== null && !windowPrefs.isRightSide) {
      hostContainer.style.left = Math.max(10, Math.min(windowPrefs.left, window.innerWidth - safeW - 10)) + "px";
      hostContainer.style.right = "auto";
    } else {
      hostContainer.style.right = Math.max(10, Math.min(windowPrefs.right || 20, window.innerWidth - safeW - 10)) + "px";
      hostContainer.style.left = "auto";
    }

    hostContainer.style.top = Math.max(10, Math.min(windowPrefs.top || 20, window.innerHeight - safeH - 10)) + "px";
  }

  // 3. Inject Styles matching Admin Pathway Design
  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    .pathway-card {
      width: 490px;
      height: 680px;
      min-width: 340px;
      min-height: 400px;
      max-width: calc(100vw - 20px);
      max-height: calc(100vh - 20px);
      background: #ffffff;
      color: #0f172a;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(2, 46, 96, 0.45), 0 0 0 1px rgba(30, 75, 117, 0.22);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
      font-size: 13px;
      line-height: 1.45;
      user-select: text;
    }

    /* 8-Direction Resize Handles */
    .resize-handle { position: absolute; z-index: 50; touch-action: none; }
    .resize-handle-r { top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; }
    .resize-handle-l { top: 0; left: 0; width: 8px; height: 100%; cursor: ew-resize; }
    .resize-handle-b { bottom: 0; left: 0; width: 100%; height: 8px; cursor: ns-resize; }
    .resize-handle-t { top: 0; left: 0; width: 100%; height: 8px; cursor: ns-resize; }
    .resize-handle-se {
      bottom: 0; right: 0; width: 18px; height: 18px; cursor: nwse-resize;
      display: flex; align-items: flex-end; justify-content: flex-end; padding: 2px;
    }
    .resize-handle-sw { bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; }
    .resize-handle-ne { top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; }
    .resize-handle-nw { top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; }

    .corner-grip {
      width: 10px; height: 10px;
      background: linear-gradient(135deg, transparent 40%, #94a3b8 40%, #94a3b8 55%, transparent 55%, transparent 75%, #94a3b8 75%, #94a3b8 90%, transparent 90%);
      opacity: 0.6; transition: opacity 0.15s;
    }
    .resize-handle-se:hover .corner-grip { opacity: 1; filter: drop-shadow(0 0 1px #2563eb); }

    /* Header Bar (Admin Style) */
    .header {
      background: linear-gradient(135deg, #022349 0%, #032e60 55%, #044085 100%);
      color: #ffffff;
      padding: 9px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }
    .header:active { cursor: grabbing; }

    .header-left {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: -0.2px;
    }
    .header-logo {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: linear-gradient(135deg, #06b6d4, #2563eb);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .badge-dossier {
      font-size: 10px;
      background: rgba(6, 182, 212, 0.25);
      color: #67e8f9;
      border: 1px solid rgba(103, 232, 249, 0.4);
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge-size {
      font-size: 9px;
      background: rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: monospace;
    }

    .btn-group {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .btn-icon {
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.15s, color 0.15s, transform 0.1s;
    }
    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.28);
      color: #ffffff;
      transform: scale(1.04);
    }
    .btn-icon:active { transform: scale(0.96); }
    .btn-icon.close:hover {
      background: #dc2626;
      border-color: #ef4444;
      color: #ffffff;
    }
    .btn-icon.power {
      color: #fca5a5;
    }
    .btn-icon.power:hover {
      background: #dc2626;
      border-color: #ef4444;
      color: #ffffff;
    }

    /* Size Preset Bar */
    .size-preset-bar {
      background: #0f172a;
      color: #cbd5e1;
      padding: 4px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      border-bottom: 1px solid #1e293b;
      user-select: none;
    }
    .size-preset-btns { display: flex; gap: 4px; }
    .size-btn {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #94a3b8;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.15s;
    }
    .size-btn:hover { background: #2563eb; color: #ffffff; }
    .size-btn.active { background: #0284c7; color: #ffffff; }

    /* Search & Selector Bar */
    .search-panel {
      padding: 8px 10px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex-shrink: 0;
    }
    .search-input-wrap {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .search-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
      background: #ffffff;
      color: #0f172a;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
    .nav-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #475569;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .nav-btn:hover:not(:disabled) { background: #2563eb; color: #ffffff; border-color: #2563eb; }
    .nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .customer-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      background: #ffffff;
      color: #0f172a;
      outline: none;
    }

    /* ========================================================= */
    /* HERO HEADER: Customer Name, ID, Mobile, Status, Meter    */
    /* (Matches Admin Pathway Hero Exactly)                     */
    /* ========================================================= */
    .hero-panel {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 10px 12px;
      shrink: 0;
    }
    .hero-top-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .hero-cust-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.2px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .hero-badges-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .hero-id-badge {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      border-radius: 5px;
      padding: 1px 6px;
      font-size: 10.5px;
      font-family: monospace;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .hero-service-badge {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #dbeafe;
      border-radius: 5px;
      padding: 1px 7px;
      font-size: 11px;
      font-weight: 600;
    }
    .hero-phone-wrap {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-family: monospace;
      color: #334155;
    }
    .wa-link {
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      border-radius: 4px;
      padding: 0 4px;
      font-size: 10px;
      font-weight: 700;
      text-decoration: none;
    }
    .wa-link:hover { background: #d1fae5; }

    .status-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 9999px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .status-in-progress { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .status-completed { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .status-pending { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .status-rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

    .hero-meter-box {
      text-align: right;
      flex-shrink: 0;
    }
    .hero-meter-percent {
      font-size: 18px;
      font-weight: 800;
      color: #032e60;
      line-height: 1;
    }
    .hero-progress-track {
      width: 100%;
      height: 5px;
      background: #e2e8f0;
      border-radius: 9999px;
      overflow: hidden;
      margin-top: 8px;
    }
    .hero-progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #2563eb, #06b6d4, #10b981);
      border-radius: 9999px;
      transition: width 0.3s ease;
    }

    .hero-stage-banner {
      margin-top: 6px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hero-stage-label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 9.5px; }
    .hero-stage-value { font-weight: 700; color: #0f172a; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ========================================================= */
    /* ADMIN-STYLE TAB NAVIGATION (flow | details | notes | docs)*/
    /* ========================================================= */
    .tabs-navbar {
      display: flex;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 0 10px;
      gap: 4px;
      flex-shrink: 0;
      user-select: none;
    }
    .tab-btn {
      padding: 8px 10px;
      border: none;
      background: transparent;
      color: #64748b;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .tab-btn:hover { color: #0f172a; }
    .tab-btn.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
    }
    .tab-count-badge {
      font-size: 9.5px;
      background: #f1f5f9;
      color: #475569;
      padding: 1px 5px;
      border-radius: 9999px;
      font-weight: 700;
    }
    .tab-btn.active .tab-count-badge {
      background: #dbeafe;
      color: #1d4ed8;
    }

    /* Content Area */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
    }

    /* Cards */
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Copy Button */
    .copy-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #334155;
      border-radius: 5px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.15s;
    }
    .copy-btn:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }
    .copy-btn.copied {
      background: #059669 !important;
      border-color: #34d399 !important;
      color: #ffffff !important;
    }

    /* Details Grid */
    .details-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .detail-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .detail-card-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
      display: block;
    }
    .detail-card-val {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }

    /* Fee Breakdown Box */
    .fee-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      text-align: center;
      margin-top: 6px;
    }
    .fee-col {
      padding: 6px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .fee-col.paid { background: #ecfdf5; border-color: #a7f3d0; }
    .fee-col.pending { background: #fffbeb; border-color: #fde68a; }

    /* Quick Fill Bar */
    .quick-fill-bar {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }
    .quick-fill-btn {
      flex: 1;
      background: #022349;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 7px 10px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s, transform 0.1s;
    }
    .quick-fill-btn:hover { background: #044085; transform: translateY(-1px); }

    /* Stage Pathway Steps (Admin Style) */
    .pipeline-wrap {
      position: relative;
      padding-left: 18px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .pipeline-line {
      position: absolute;
      left: 13px;
      top: 10px;
      bottom: 10px;
      width: 2px;
      background: #e2e8f0;
      z-index: 1;
    }
    .step-card {
      position: relative;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 12px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      z-index: 2;
    }
    .step-card.completed { border-color: #bbf7d0; background: #ffffff; }
    .step-card.in-progress { border-color: #93c5fd; background: #eff6ff; box-shadow: 0 0 0 1px #bfdbfe; }
    .step-bullet {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #cbd5e1;
      color: #ffffff;
      font-size: 10px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
      flex-shrink: 0;
    }
    .step-bullet.completed { background: #10b981; }
    .step-bullet.in-progress { background: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,0.25); }

    /* Notes & Scratchpad (Admin Style) */
    .notes-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .notes-tabs { display: flex; gap: 4px; }
    .notes-tab-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #475569;
      border-radius: 5px;
      padding: 2px 8px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .notes-tab-btn.active {
      background: #022349;
      color: #ffffff;
      border-color: #022349;
    }
    .notes-toolbar { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .note-tool-btn {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      color: #334155;
      border-radius: 4px;
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
    }
    .note-tool-btn:hover { background: #e2e8f0; color: #0f172a; }
    .notes-textarea {
      width: 100%;
      min-height: 110px;
      max-height: 320px;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      line-height: 1.5;
      color: #0f172a;
      background: #fcfdfe;
      resize: vertical;
      outline: none;
    }
    .notes-textarea:focus {
      background: #ffffff;
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
    }
    .copy-notes-btn {
      background: linear-gradient(135deg, #022349 0%, #032e60 100%);
      color: #ffffff;
      border: 1px solid #38bdf8;
      border-radius: 6px;
      padding: 5px 12px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }
    .copy-notes-btn:hover { background: #044085; transform: translateY(-1px); }
    .copy-notes-btn.copied { background: #059669 !important; border-color: #34d399 !important; }

    /* Document Item */
    .doc-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 5px;
      font-size: 11.5px;
      font-weight: 500;
      color: #1e293b;
    }

    /* Minimized Pill */
    .minimized-pill {
      background: linear-gradient(135deg, #022349 0%, #032e60 100%);
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px rgba(2, 46, 96, 0.45);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      border: 1px solid #38bdf8;
      font-weight: 700;
      font-size: 12px;
      transition: transform 0.15s;
    }
    .minimized-pill:hover { transform: scale(1.05); }
    .minimized-pill .pill-power-off {
      margin-left: 4px;
      font-size: 11px;
      padding: 1px 5px;
      border-radius: 4px;
      opacity: 0.7;
      background: rgba(255, 255, 255, 0.12);
      color: #fca5a5;
      transition: all 0.15s;
    }
    .minimized-pill .pill-power-off:hover {
      background: #dc2626;
      opacity: 1;
      color: #ffffff;
    }

    /* Toast */
    .toast {
      position: absolute;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 999;
      white-space: nowrap;
    }
    .toast.show { opacity: 1; }

    .offline-banner {
      padding: 16px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-radius: 10px;
      color: #9f1239;
      font-size: 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    .retry-btn {
      background: #e11d48;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      cursor: pointer;
    }
    .spinner {
      border: 3px solid rgba(37, 99, 235, 0.15);
      border-top: 3px solid #2563eb;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  `;
  shadow.appendChild(style);

  const container = document.createElement("div");
  shadow.appendChild(container);

  // 4. Toast Notification
  function showToast(msg) {
    let t = shadow.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      shadow.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2000);
  }

  // Global Page Toast (visible even when Pathway container is hidden/turned off)
  function showPageToast(msg) {
    let pt = document.getElementById("airnet-pathway-global-toast");
    if (!pt) {
      pt = document.createElement("div");
      pt.id = "airnet-pathway-global-toast";
      pt.style.position = "fixed";
      pt.style.bottom = "24px";
      pt.style.right = "24px";
      pt.style.zIndex = "2147483647";
      pt.style.backgroundColor = "#022349";
      pt.style.color = "#ffffff";
      pt.style.padding = "10px 16px";
      pt.style.borderRadius = "8px";
      pt.style.fontSize = "12px";
      pt.style.fontWeight = "600";
      pt.style.boxShadow = "0 10px 30px rgba(0, 0, 0, 0.45)";
      pt.style.border = "1px solid #38bdf8";
      pt.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      pt.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      pt.style.pointerEvents = "none";
      document.body.appendChild(pt);
    }
    pt.textContent = msg;
    pt.style.opacity = "1";
    pt.style.transform = "translateY(0)";
    setTimeout(() => {
      if (pt) {
        pt.style.opacity = "0";
        pt.style.transform = "translateY(10px)";
        setTimeout(() => {
          if (pt && pt.parentNode) pt.parentNode.removeChild(pt);
        }, 300);
      }
    }, 2800);
  }

  // Turn OFF / ON Controls
  function turnOffPathway(notify = true) {
    isTurnedOff = true;
    hostContainer.style.display = "none";
    launcher.style.display = "none";

    const currentHost = window.location.hostname;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([DISABLED_DOMAINS_KEY], (res) => {
        let list = res[DISABLED_DOMAINS_KEY] || [];
        if (!list.includes(currentHost)) {
          list.push(currentHost);
          chrome.storage.local.set({ [DISABLED_DOMAINS_KEY]: list });
        }
      });
    }

    if (notify) {
      showPageToast("🚀 Airnet Pathway: Turned OFF on this website. Re-enable from toolbar icon or Alt+P.");
    }
  }

  function turnOnPathway(notify = true) {
    isTurnedOff = false;
    if (isLauncherPillEnabled) {
      launcher.style.display = "flex";
    }
    hostContainer.style.display = "block";

    const currentHost = window.location.hostname;
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([DISABLED_DOMAINS_KEY], (res) => {
        let list = (res[DISABLED_DOMAINS_KEY] || []).filter((h) => h !== currentHost);
        chrome.storage.local.set({ [DISABLED_DOMAINS_KEY]: list });
      });
    }

    if (customers.length === 0) {
      fetchCustomers();
    }

    if (notify) {
      showPageToast("🚀 Airnet Pathway: Turned ON on this website.");
    }
  }

  // 5. Accurate Clipboard Helper
  function copyText(val, label) {
    if (!val && val !== "") return;
    const str = String(val);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(() => {
        showToast("Copied " + label + "!");
      }).catch(() => fallbackCopy(str, label));
    } else {
      fallbackCopy(str, label);
    }
  }

  function fallbackCopy(str, label) {
    const ta = document.createElement("textarea");
    ta.value = str;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Copied " + label + "!");
    } catch (e) {
      showToast("Failed to copy");
    }
    document.body.removeChild(ta);
  }

  // Dedicated Note Copy
  function copyNotesAccurately() {
    const textarea = shadow.getElementById("notes-textarea");
    if (!textarea) return;

    let textToCopy = "";
    const isSelection = textarea.selectionStart !== textarea.selectionEnd;
    if (isSelection) {
      textToCopy = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
    } else {
      textToCopy = textarea.value;
    }

    if (!textToCopy || textToCopy.trim().length === 0) {
      showToast("Note is empty. Type some notes first!");
      return;
    }

    const copyBtn = shadow.getElementById("btn-copy-notes");
    const onCopied = () => {
      if (copyBtn) {
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = `<span>✓ Copied Accurately!</span>`;
        setTimeout(() => {
          if (copyBtn) {
            copyBtn.classList.remove("copied");
            copyBtn.innerHTML = `<span>📋 Copy Notes Accurately</span>`;
          }
        }, 2000);
      }
      const label = isSelection ? `Selected snippet (${textToCopy.length} chars)` : `Notes (${textToCopy.length} chars)`;
      showToast(`Copied ${label} accurately to clipboard!`);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(onCopied).catch(() => {
        fallbackCopy(textToCopy, "Notes");
        onCopied();
      });
    } else {
      fallbackCopy(textToCopy, "Notes");
      onCopied();
    }
  }

  // 6. Fetch Customers from Local Server via Extension Background Worker (bypass CSP/Mixed Content)
  async function fetchCustomers() {
    isLoading = true;
    connectionError = null;
    render();

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: "FETCH_CUSTOMERS" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("[Airnet Pathway Ext] Background message failed, trying direct fetch:", chrome.runtime.lastError.message);
          fetchDirectly();
          return;
        }

        if (response && response.success && Array.isArray(response.customers)) {
          handleCustomersLoaded(response.customers, response.endpoint || "Extension Background Worker");
        } else {
          fetchDirectly(response?.error);
        }
      });
    } else {
      fetchDirectly();
    }
  }

  async function fetchDirectly(priorError = null) {
    const candidateUrls = [
      "http://localhost:5001/api/pathway/customers",
      "http://localhost:5001/api/admin/pathway/customers",
      "http://127.0.0.1:5001/api/pathway/customers",
    ];

    let lastErr = priorError;
    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.customers)) {
            handleCustomersLoaded(data.customers, url);
            return;
          }
        }
        lastErr = `HTTP ${res.status}`;
      } catch (err) {
        lastErr = err.message || "Network Error";
      }
    }

    isLoading = false;
    connectionError = lastErr || "Could not reach Airnet server on port 5001";
    render();
  }

  function handleCustomersLoaded(items, source) {
    customers = items;
    connectedEndpoint = source;
    isLoading = false;
    connectionError = null;

    applyFilter();

    if (windowPrefs.activeCustomerId) {
      const match = customers.find((c) => c.id === windowPrefs.activeCustomerId || c.customerId === windowPrefs.activeCustomerId);
      if (match) {
        activeCustomer = match;
      } else if (customers.length > 0) {
        activeCustomer = customers[0];
      }
    } else if (customers.length > 0) {
      activeCustomer = customers[0];
    }

    render();
  }

  function applyFilter() {
    if (!searchQuery.trim()) {
      filteredCustomers = customers;
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    filteredCustomers = customers.filter((c) => {
      return (
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.mobileNumber && c.mobileNumber.includes(q)) ||
        (c.customerId && c.customerId.toLowerCase().includes(q)) ||
        (c.serviceName && c.serviceName.toLowerCase().includes(q)) ||
        (c.applicationNumber && c.applicationNumber.toLowerCase().includes(q))
      );
    });
  }

  // 7. Auto-Fill Helper for Web Forms
  function autoFillCurrentPage() {
    if (!activeCustomer) {
      showToast("No customer selected to fill");
      return;
    }

    let filledCount = 0;
    const inputs = document.querySelectorAll("input, textarea, select");

    const matchers = [
      { keys: ["applicantname", "applicant_name", "customername", "name", "candidate_name", "txtapplicantname"], val: activeCustomer.customerName },
      { keys: ["mobile", "mobilenumber", "phone", "phonenumber", "contact", "txtmobile", "txtapplicantmobile"], val: activeCustomer.mobileNumber },
      { keys: ["acknumber", "acknowledgement", "applicationno", "application_number", "appno", "appl_no"], val: activeCustomer.applicationNumber },
    ];

    inputs.forEach((input) => {
      const name = (input.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const id = (input.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const placeholder = (input.placeholder || "").toLowerCase().replace(/[^a-z0-9]/g, "");

      for (const m of matchers) {
        if (!m.val) continue;
        const matches = m.keys.some((k) => name.includes(k) || id.includes(k) || placeholder.includes(k));
        if (matches && !input.value) {
          input.value = m.val;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
          break;
        }
      }
    });

    if (filledCount > 0) {
      showToast(`Filled ${filledCount} field(s) on current page!`);
    } else {
      copyAllDetails();
    }
  }

  function copyAllDetails() {
    if (!activeCustomer) return;
    const text = [
      `Name: ${activeCustomer.customerName || "-"}`,
      `Mobile: ${activeCustomer.mobileNumber || "-"}`,
      `Customer ID: ${activeCustomer.customerId || "-"}`,
      `Service: ${activeCustomer.serviceName || "-"}`,
      `App / Ack No: ${activeCustomer.applicationNumber || "-"}`,
      `Status: ${activeCustomer.applicationStatus || "-"}`,
      `Current Step: ${activeCustomer.currentStep || "-"}`,
      `Notes: ${activeCustomer.notes || "-"}`,
    ].join("\n");

    copyText(text, "All Customer Form Fields");
  }

  function setPresetSize(width, height) {
    windowPrefs.width = width;
    windowPrefs.height = height;
    applyWindowPositionAndSize();
    savePreferences();
    updateSizeDisplay();
  }

  function updateSizeDisplay() {
    const badge = shadow.getElementById("size-display-badge");
    const card = shadow.querySelector(".pathway-card");
    if (badge && card) {
      badge.textContent = `${card.offsetWidth} × ${card.offsetHeight}px`;
    }
  }

  // 8. Main Render Function (Matches Admin Pathway Design)
  function render() {
    if (windowPrefs.isMinimized) {
      container.innerHTML = `
        <div class="minimized-pill" id="btn-restore" title="Click to expand Airnet Pathway Dossier">
          <span>🚀 Pathway</span>
          <span style="font-weight: 400; color: #7dd3fc;">•</span>
          <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${activeCustomer ? activeCustomer.customerName : "Select Customer"}
          </span>
          <span style="font-size: 10px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 4px;">Expand</span>
          <span class="pill-power-off" id="btn-minimized-power-off" title="Turn OFF Pathway on this website">⏻</span>
        </div>
      `;
      const pill = shadow.getElementById("btn-restore");
      if (pill) {
        pill.onclick = (e) => {
          if (e.target.id === "btn-minimized-power-off" || e.target.closest("#btn-minimized-power-off")) {
            e.stopPropagation();
            turnOffPathway(true);
            return;
          }
          windowPrefs.isMinimized = false;
          savePreferences();
          render();
        };
      }
      return;
    }

    const currentIndex = filteredCustomers.findIndex((c) => activeCustomer && c.id === activeCustomer.id);
    const activeNoteText = getCurrentNoteText();
    const activeCustName = activeCustomer ? (activeCustomer.customerName ? activeCustomer.customerName.split(' ')[0] : 'Customer') : 'Customer';
    const activeTab = windowPrefs.activeViewTab || "details";

    container.innerHTML = `
      <div class="pathway-card">
        <!-- 8 Resize Handles -->
        <div class="resize-handle resize-handle-t" data-direction="n"></div>
        <div class="resize-handle resize-handle-b" data-direction="s"></div>
        <div class="resize-handle resize-handle-r" data-direction="e"></div>
        <div class="resize-handle resize-handle-l" data-direction="w"></div>
        <div class="resize-handle resize-handle-ne" data-direction="ne"></div>
        <div class="resize-handle resize-handle-nw" data-direction="nw"></div>
        <div class="resize-handle resize-handle-se" data-direction="se" title="Drag to adjust window size">
          <div class="corner-grip"></div>
        </div>
        <div class="resize-handle resize-handle-sw" data-direction="sw"></div>

        <!-- 1. Header Bar (Admin Style) -->
        <div class="header" id="drag-header">
          <div class="header-left">
            <div class="header-logo">🚀</div>
            <div>
              <span style="font-weight: 800; font-size: 13px;">Airnet Pathway</span>
              <span class="badge-dossier" style="margin-left: 4px;">Dossier</span>
              <span class="badge-size" id="size-display-badge">${windowPrefs.width} × ${windowPrefs.height}px</span>
            </div>
          </div>
          <div class="btn-group">
            <button class="btn-icon" id="btn-switch-side" title="Switch Side (Left ↔ Right)">⇄</button>
            <button class="btn-icon" id="btn-popout" title="Open in Standalone Popout Window">↗</button>
            <button class="btn-icon" id="btn-refresh" title="Refresh Live Data from Airnet">↻</button>
            <button class="btn-icon" id="btn-minimize" title="Minimize to Floating Pill">−</button>
            <button class="btn-icon close" id="btn-close" title="Close window (reopen from launcher or Alt+P)">✕</button>
            <button class="btn-icon power" id="btn-power-off" title="Turn OFF Pathway & Launcher on this website">⏻</button>
          </div>
        </div>

        <!-- 2. Quick Size Toolbar -->
        <div class="size-preset-bar">
          <span style="font-weight: 600; color: #94a3b8;">Window Size:</span>
          <div class="size-preset-btns">
            <button class="size-btn ${windowPrefs.width === 380 ? "active" : ""}" id="preset-compact">📱 380×520</button>
            <button class="size-btn ${windowPrefs.width === 490 ? "active" : ""}" id="preset-normal">💻 490×680</button>
            <button class="size-btn ${windowPrefs.width === 680 ? "active" : ""}" id="preset-wide">🖥️ 680×760</button>
            <button class="size-btn" id="preset-max" title="Fit to full viewport height">⛶ Fit Height</button>
          </div>
        </div>

        <!-- 3. Search & Customer Selector Bar -->
        <div class="search-panel">
          <div class="search-input-wrap">
            <input 
              type="text" 
              class="search-input" 
              id="search-input" 
              placeholder="Search name, phone, ID, or service..." 
              value="${searchQuery}" 
            />
            <button class="nav-btn" id="btn-prev-cust" title="Previous customer" ${currentIndex <= 0 ? "disabled" : ""}>◀</button>
            <button class="nav-btn" id="btn-next-cust" title="Next customer" ${currentIndex < 0 || currentIndex >= filteredCustomers.length - 1 ? "disabled" : ""}>▶</button>
          </div>
          <select class="customer-select" id="customer-select">
            ${
              isLoading
                ? '<option value="">Loading customer dossiers from Airnet server...</option>'
                : connectionError
                ? '<option value="">⚠️ Airnet Server Offline (Click Refresh)</option>'
                : filteredCustomers.length === 0
                ? '<option value="">No matching customers found</option>'
                : filteredCustomers.map((c) => `
                    <option value="${c.id}" ${activeCustomer && activeCustomer.id === c.id ? "selected" : ""}>
                      ${c.customerName} (${c.customerId || "ID"}) - ${c.serviceName}
                    </option>
                  `).join("")
            }
          </select>
        </div>

        <!-- 4. Hero Header: Customer Profile & Processing Meter (Admin Style) -->
        ${
          activeCustomer
            ? `
              <div class="hero-panel">
                <div class="hero-top-row">
                  <div>
                    <div class="hero-cust-name">
                      <span>${activeCustomer.customerName}</span>
                      <button class="copy-btn" data-copy="${activeCustomer.customerName || ""}" data-name="Name" title="Copy Name">Copy</button>
                    </div>

                    <div class="hero-badges-row">
                      <span class="hero-id-badge">
                        <span>ID: ${activeCustomer.customerId || "-"}</span>
                        <button class="copy-btn" style="padding: 0 4px; font-size: 9px;" data-copy="${activeCustomer.customerId || ""}" data-name="Customer ID">Copy</button>
                      </span>

                      <span class="status-badge ${
                        activeCustomer.applicationStatus === 'Completed' ? 'status-completed' :
                        activeCustomer.applicationStatus === 'In Progress' ? 'status-in-progress' :
                        activeCustomer.applicationStatus === 'Rejected' ? 'status-rejected' : 'status-pending'
                      }">
                        ${activeCustomer.applicationStatus || 'In Progress'}
                      </span>
                    </div>

                    <div class="hero-badges-row">
                      <span class="hero-service-badge">
                        ${activeCustomer.serviceName || "General Service"}
                      </span>

                      ${
                        activeCustomer.mobileNumber
                          ? `
                            <span class="hero-phone-wrap">
                              <span>📞 ${activeCustomer.mobileNumber}</span>
                              <button class="copy-btn" style="padding: 0 4px; font-size: 9px;" data-copy="${activeCustomer.mobileNumber}" data-name="Phone">Copy</button>
                              <a href="https://wa.me/91${activeCustomer.mobileNumber.replace(/\D/g, '')}" target="_blank" class="wa-link" title="Open WhatsApp Chat">WA</a>
                            </span>
                          `
                          : ""
                      }
                    </div>
                  </div>

                  <div class="hero-meter-box">
                    <span style="font-size: 10px; color: #64748b; font-weight: 600; display: block;">Processing</span>
                    <span class="hero-meter-percent">${activeCustomer.progressPercent || 0}%</span>
                  </div>
                </div>

                <div class="hero-progress-track">
                  <div class="hero-progress-bar" style="width: ${activeCustomer.progressPercent || 0}%;"></div>
                </div>

                <div class="hero-stage-banner">
                  <span class="hero-stage-label">Current Stage:</span>
                  <span class="hero-stage-value">${activeCustomer.currentStep || "Application Received"}</span>
                </div>
              </div>
            `
            : ""
        }

        <!-- 5. Admin-Style Navigation Tabs -->
        <div class="tabs-navbar">
          <button class="tab-btn ${activeTab === 'details' ? 'active' : ''}" id="tab-nav-details">
            <span>📋 Details</span>
          </button>
          <button class="tab-btn ${activeTab === 'flow' ? 'active' : ''}" id="tab-nav-flow">
            <span>🛤️ Stage Pathway</span>
            ${
              activeCustomer && activeCustomer.steps && activeCustomer.steps.length > 0
                ? `<span class="tab-count-badge">${activeCustomer.steps.length}</span>`
                : ""
            }
          </button>
          <button class="tab-btn ${activeTab === 'notes' ? 'active' : ''}" id="tab-nav-notes">
            <span>📝 Notes</span>
            <span class="tab-count-badge" id="notes-save-status">Saved</span>
          </button>
          <button class="tab-btn ${activeTab === 'documents' ? 'active' : ''}" id="tab-nav-documents">
            <span>📁 Documents</span>
            ${
              activeCustomer && activeCustomer.documents && activeCustomer.documents.length > 0
                ? `<span class="tab-count-badge">${activeCustomer.documents.length}</span>`
                : ""
            }
          </button>
        </div>

        <!-- 6. Scrollable Content Area -->
        <div class="content">
          ${
            isLoading
              ? `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 260px; gap: 12px; color: #475569;">
                  <div class="spinner"></div>
                  <div style="font-weight: 600; font-size: 13px;">Connecting to Airnet local server...</div>
                  <div style="font-size: 11px; color: #94a3b8;">Loading live customer workflow dossiers</div>
                </div>
              `
              : connectionError
              ? `
                <div class="offline-banner">
                  <div style="font-size: 20px;">⚠️</div>
                  <div style="font-weight: 700; font-size: 13px;">Airnet Local Server Unreachable</div>
                  <div style="font-size: 11.5px; line-height: 1.4; color: #881337;">
                    ${connectionError}<br/>
                    Please ensure the Airnet backend is running on <strong>http://localhost:5001</strong>.
                  </div>
                  <button class="retry-btn" id="btn-retry">↻ Retry Connection</button>
                </div>
              `
              : activeCustomer
              ? `
                <!-- ============================================== -->
                <!-- TAB 1: APPLICATION DETAILS                     -->
                <!-- ============================================== -->
                ${
                  activeTab === "details"
                    ? `
                      <div class="details-grid">
                        <!-- Ack / Application No with 1-click Copy -->
                        <div class="detail-card">
                          <span class="detail-card-label">App / Ack Number</span>
                          <div class="detail-card-val">
                            <span class="font-mono" style="color: #0369a1; font-weight: 800; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              ${activeCustomer.applicationNumber || "Pending Generation"}
                            </span>
                            ${
                              activeCustomer.applicationNumber
                                ? `<button class="copy-btn" data-copy="${activeCustomer.applicationNumber}" data-name="Application Number" style="background: #e0f2fe; color: #0369a1; border-color: #7dd3fc;">Copy</button>`
                                : ""
                            }
                          </div>
                        </div>

                        <!-- Official Portal URL -->
                        <div class="detail-card">
                          <span class="detail-card-label">Official Portal</span>
                          <div class="detail-card-val">
                            ${
                              activeCustomer.applyUrl
                                ? `
                                  <a href="${activeCustomer.applyUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                                    <span>Open Portal</span> ↗
                                  </a>
                                `
                                : `<span style="color: #94a3b8; font-weight: 500;">Direct Dept</span>`
                            }
                          </div>
                        </div>

                        <!-- Assigned Staff -->
                        <div class="detail-card">
                          <span class="detail-card-label">Assigned Staff</span>
                          <div class="detail-card-val">
                            <span>${activeCustomer.assignedStaff || "Admin Operator"}</span>
                          </div>
                        </div>

                        <!-- Priority & Target Date -->
                        <div class="detail-card">
                          <span class="detail-card-label">Priority & Target</span>
                          <div class="detail-card-val">
                            <span style="font-size: 11px; padding: 1px 6px; border-radius: 4px; ${
                              activeCustomer.priority === 'Urgent' ? 'background: #fee2e2; color: #b91c1c; font-weight: 700;' : 'background: #f1f5f9; color: #475569;'
                            }">
                              ${activeCustomer.priority || "Normal"}
                            </span>
                            ${
                              activeCustomer.targetDate
                                ? `<span class="font-mono" style="font-size: 10.5px; color: #64748b;">${activeCustomer.targetDate}</span>`
                                : ""
                            }
                          </div>
                        </div>
                      </div>

                      <!-- Payment & Fee Breakdown (Admin Style) -->
                      <div class="card">
                        <div class="card-title">
                          <span>💰 Payment & Fee Breakdown</span>
                          <span style="font-size: 10px; color: #059669; font-weight: 600;">● Ledger Sync</span>
                        </div>
                        <div class="fee-grid">
                          <div class="fee-col">
                            <span style="font-size: 9.5px; color: #64748b; font-weight: 600; display: block;">Total Charged</span>
                            <span style="font-size: 13px; font-weight: 800; color: #0f172a;">
                              ₹${activeCustomer.amountCharged ?? ((activeCustomer.amountPaid || 0) + (activeCustomer.amountPending || 0))}
                            </span>
                          </div>
                          <div class="fee-col paid">
                            <span style="font-size: 9.5px; color: #047857; font-weight: 600; display: block;">Paid Amount</span>
                            <span style="font-size: 13px; font-weight: 800; color: #059669;">
                              ₹${activeCustomer.amountPaid || 0}
                            </span>
                          </div>
                          <div class="fee-col pending">
                            <span style="font-size: 9.5px; color: #b45309; font-weight: 600; display: block;">Pending</span>
                            <span style="font-size: 13px; font-weight: 800; color: #d97706;">
                              ₹${activeCustomer.amountPending || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Customer / Service Notes (Admin Style) -->
                      ${
                        activeCustomer.notes
                          ? `
                            <div class="card" style="background: #fffbeb; border-color: #fde68a;">
                              <div class="card-title" style="color: #92400e;">
                                <span>📌 Customer / Service Notes</span>
                              </div>
                              <p style="font-size: 11.5px; color: #78350f; line-height: 1.5; white-space: pre-wrap;">${activeCustomer.notes}</p>
                            </div>
                          `
                          : ""
                      }

                      <!-- Quick Action Copy & Form Fill Bar -->
                      <div class="quick-fill-bar">
                        <button class="quick-fill-btn" id="btn-copy-all" title="Copies name, mobile, ID, ack number, service, and status to clipboard">
                          📋 Copy All Form Fields
                        </button>
                        <button class="quick-fill-btn" id="btn-auto-fill" style="background: #0284c7;" title="Automatically matches and fills form fields on the active webpage">
                          ⚡ Fill Current Page Form
                        </button>
                      </div>
                    `
                    : ""
                }

                <!-- ============================================== -->
                <!-- TAB 2: STAGE PATHWAY (Processing Pipeline)    -->
                <!-- ============================================== -->
                ${
                  activeTab === "flow"
                    ? `
                      <div class="card">
                        <div class="card-title">
                          <span>Application Processing Pipeline</span>
                          <span style="font-size: 10px; color: #64748b; font-weight: 600;">
                            ${
                              activeCustomer.steps
                                ? activeCustomer.steps.filter((s) => s.status === "completed").length
                                : 0
                            } of ${activeCustomer.steps ? activeCustomer.steps.length : 0} Completed
                          </span>
                        </div>

                        ${
                          activeCustomer.steps && activeCustomer.steps.length > 0
                            ? `
                              <div class="pipeline-wrap">
                                <div class="pipeline-line"></div>
                                ${activeCustomer.steps.map((st, i) => {
                                  const isComp = st.status === "completed";
                                  const isInProg = st.status === "in-progress";
                                  return `
                                    <div class="step-card ${isComp ? 'completed' : isInProg ? 'in-progress' : ''}">
                                      <div class="step-bullet ${isComp ? 'completed' : isInProg ? 'in-progress' : ''}">
                                        ${isComp ? '✓' : i + 1}
                                      </div>
                                      <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                                          <span style="font-weight: 700; font-size: 12px; color: ${isComp ? '#065f46' : isInProg ? '#1e40af' : '#334155'};">
                                            ${st.title || st.stepName || `Step ${i + 1}`}
                                          </span>
                                          <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; padding: 1px 5px; border-radius: 4px; ${
                                            isComp ? 'background: #dcfce7; color: #15803d;' : isInProg ? 'background: #dbeafe; color: #1d4ed8;' : 'background: #f1f5f9; color: #64748b;'
                                          }">
                                            ${st.status}
                                          </span>
                                        </div>
                                        ${st.note ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px; background: #f8fafc; padding: 3px 6px; border-radius: 4px;">${st.note}</div>` : ""}
                                        ${st.completedAt ? `<div style="font-size: 9.5px; color: #94a3b8; font-family: monospace; margin-top: 3px;">Completed: ${new Date(st.completedAt).toLocaleDateString("en-IN")}</div>` : ""}
                                      </div>
                                    </div>
                                  `;
                                }).join("")}
                              </div>
                            `
                            : `<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11.5px;">No stage steps defined for this customer service.</div>`
                        }
                      </div>
                    `
                    : ""
                }

                <!-- ============================================== -->
                <!-- TAB 3: NOTES & SCRATCHPAD (Admin Style)        -->
                <!-- ============================================== -->
                ${
                  activeTab === "notes"
                    ? `
                      <div class="card notes-card">
                        <div class="card-title">
                          <div style="display: flex; align-items: center; gap: 6px;">
                            <span>📝 Notes & Scratchpad</span>
                          </div>
                          <div class="notes-tabs">
                            <button class="notes-tab-btn ${notesState.activeTab === 'customer' ? 'active' : ''}" id="tab-cust-notes" title="Personal notes for this customer">
                              ${activeCustName} Note
                            </button>
                            <button class="notes-tab-btn ${notesState.activeTab === 'general' ? 'active' : ''}" id="tab-gen-notes" title="General scratchpad across all tabs">
                              Scratchpad
                            </button>
                          </div>
                        </div>

                        <div class="notes-toolbar">
                          <button class="note-tool-btn" id="btn-insert-cust-info" title="Insert customer name, ID, phone, and app number into note">
                            + Customer Info
                          </button>
                          <button class="note-tool-btn" id="btn-insert-timestamp" title="Insert current date & time">
                            + Timestamp
                          </button>
                          <button class="note-tool-btn" id="btn-clear-notes" title="Clear current note" style="color: #991b1b; margin-left: auto;">
                            ✕ Clear
                          </button>
                        </div>

                        <div style="position: relative; width: 100%;">
                          <textarea 
                            class="notes-textarea" 
                            id="notes-textarea" 
                            placeholder="${
                              notesState.activeTab === 'customer'
                                ? `Write notes for ${activeCustomer.customerName} (e.g. pending documents, fee details, application notes, reference IDs)... Automatically saved.`
                                : 'Write quick scratchpad notes, tokens, temporary IDs, links, or text to paste across tabs... Automatically saved.'
                            }"
                            rows="5"
                          >${activeNoteText}</textarea>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                          <span style="font-size: 10.5px; color: #64748b; font-family: monospace;" id="notes-stats">
                            ${getStatsText(activeNoteText)}
                          </span>
                          <button class="copy-notes-btn" id="btn-copy-notes" title="Copy entire note (or highlighted selection) accurately to clipboard">
                            <span>📋 Copy Notes Accurately</span>
                          </button>
                        </div>
                      </div>
                    `
                    : ""
                }

                <!-- ============================================== -->
                <!-- TAB 4: ATTACHED DOCUMENTS                      -->
                <!-- ============================================== -->
                ${
                  activeTab === "documents"
                    ? `
                      <div class="card">
                        <div class="card-title">
                          <span>Attached Customer Documents</span>
                          <span style="font-size: 10px; color: #64748b; font-weight: 600;">
                            ${activeCustomer.documents ? activeCustomer.documents.length : 0} Files
                          </span>
                        </div>

                        ${
                          activeCustomer.documents && activeCustomer.documents.length > 0
                            ? activeCustomer.documents.map((doc) => `
                              <div class="doc-link">
                                <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                                  <span style="font-size: 14px;">📄</span>
                                  <div style="min-width: 0;">
                                    <div style="font-weight: 700; color: #0f172a; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                      ${doc.fileName}
                                    </div>
                                    <div style="font-size: 10px; color: #64748b; font-family: monospace;">
                                      ${doc.category || "Document"} ${doc.fileSize ? `• ${Math.round(doc.fileSize / 1024)} KB` : ""}
                                    </div>
                                  </div>
                                </div>
                                <span style="font-size: 10px; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 1px 6px; border-radius: 4px;">
                                  Google Drive
                                </span>
                              </div>
                            `).join("")
                            : `<div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 11.5px;">No uploaded documents linked to this customer ID yet.</div>`
                        }
                      </div>
                    `
                    : ""
                }
              `
              : `
                <div style="text-align: center; padding: 40px 10px; color: #64748b;">
                  <div style="font-size: 24px; margin-bottom: 6px;">📂</div>
                  <div style="font-weight: 700; font-size: 13px; color: #334155;">No Customer Selected</div>
                  <div style="font-size: 11.5px; margin-top: 4px; color: #64748b;">Choose a customer from the dropdown above to view customer details, stage pipeline, notes, and documents.</div>
                </div>
              `
          }
        </div>
      </div>
    `;

    bindEvents();
    applyWindowPositionAndSize();
  }

  // 9. Event Binding
  function bindEvents() {
    // Window Controls
    const btnClose = shadow.getElementById("btn-close");
    if (btnClose) btnClose.onclick = () => { hostContainer.style.display = "none"; };

    const btnPowerOff = shadow.getElementById("btn-power-off");
    if (btnPowerOff) {
      btnPowerOff.onclick = (e) => {
        e.stopPropagation();
        turnOffPathway(true);
      };
    }

    const btnMinimize = shadow.getElementById("btn-minimize");
    if (btnMinimize) {
      btnMinimize.onclick = () => {
        windowPrefs.isMinimized = true;
        savePreferences();
        render();
      };
    }

    const btnRefresh = shadow.getElementById("btn-refresh");
    if (btnRefresh) btnRefresh.onclick = () => { fetchCustomers(); };

    const btnRetry = shadow.getElementById("btn-retry");
    if (btnRetry) btnRetry.onclick = () => { fetchCustomers(); };

    const btnSwitchSide = shadow.getElementById("btn-switch-side");
    if (btnSwitchSide) {
      btnSwitchSide.onclick = () => {
        windowPrefs.isRightSide = !windowPrefs.isRightSide;
        if (windowPrefs.isRightSide) {
          windowPrefs.right = 20;
          windowPrefs.left = null;
        } else {
          windowPrefs.left = 20;
          windowPrefs.right = null;
        }
        applyWindowPositionAndSize();
        savePreferences();
      };
    }

    const btnPopout = shadow.getElementById("btn-popout");
    if (btnPopout) {
      btnPopout.onclick = () => {
        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ action: "OPEN_POPOUT" });
        } else {
          window.open("http://localhost:5000/admin/pathway/popout", "AirnetPathwayPopout", "width=520,height=720");
        }
      };
    }

    // Size Preset Buttons
    const btnCompact = shadow.getElementById("preset-compact");
    if (btnCompact) btnCompact.onclick = () => setPresetSize(380, 520);

    const btnNormal = shadow.getElementById("preset-normal");
    if (btnNormal) btnNormal.onclick = () => setPresetSize(490, 680);

    const btnWide = shadow.getElementById("preset-wide");
    if (btnWide) btnWide.onclick = () => setPresetSize(680, 760);

    const btnMax = shadow.getElementById("preset-max");
    if (btnMax) {
      btnMax.onclick = () => {
        const fullH = Math.min(window.innerHeight - 30, 980);
        setPresetSize(windowPrefs.width || 520, fullH);
      };
    }

    // Tab Navigation
    const tabDetails = shadow.getElementById("tab-nav-details");
    if (tabDetails) {
      tabDetails.onclick = () => {
        windowPrefs.activeViewTab = "details";
        savePreferences();
        render();
      };
    }

    const tabFlow = shadow.getElementById("tab-nav-flow");
    if (tabFlow) {
      tabFlow.onclick = () => {
        windowPrefs.activeViewTab = "flow";
        savePreferences();
        render();
      };
    }

    const tabNotes = shadow.getElementById("tab-nav-notes");
    if (tabNotes) {
      tabNotes.onclick = () => {
        windowPrefs.activeViewTab = "notes";
        savePreferences();
        render();
      };
    }

    const tabDocs = shadow.getElementById("tab-nav-documents");
    if (tabDocs) {
      tabDocs.onclick = () => {
        windowPrefs.activeViewTab = "documents";
        savePreferences();
        render();
      };
    }

    // Search Input
    const searchInput = shadow.getElementById("search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        searchQuery = e.target.value;
        applyFilter();
        const sel = shadow.getElementById("customer-select");
        if (sel) {
          sel.innerHTML = filteredCustomers.length === 0
            ? '<option value="">No matching customers found</option>'
            : filteredCustomers.map((c) => `
                <option value="${c.id}" ${activeCustomer && activeCustomer.id === c.id ? "selected" : ""}>
                  ${c.customerName} (${c.customerId || "ID"}) - ${c.serviceName}
                </option>
              `).join("");
        }
      };
    }

    // Customer Dropdown Select
    const custSelect = shadow.getElementById("customer-select");
    if (custSelect) {
      custSelect.onchange = (e) => {
        const id = e.target.value;
        const found = customers.find((c) => c.id === id);
        if (found) {
          activeCustomer = found;
          windowPrefs.activeCustomerId = found.id;
          savePreferences();
          render();
        }
      };
    }

    // Next / Prev Customer Buttons
    const btnPrev = shadow.getElementById("btn-prev-cust");
    if (btnPrev) {
      btnPrev.onclick = () => {
        const idx = filteredCustomers.findIndex((c) => activeCustomer && c.id === activeCustomer.id);
        if (idx > 0) {
          activeCustomer = filteredCustomers[idx - 1];
          windowPrefs.activeCustomerId = activeCustomer.id;
          savePreferences();
          render();
        }
      };
    }

    const btnNext = shadow.getElementById("btn-next-cust");
    if (btnNext) {
      btnNext.onclick = () => {
        const idx = filteredCustomers.findIndex((c) => activeCustomer && c.id === activeCustomer.id);
        if (idx >= 0 && idx < filteredCustomers.length - 1) {
          activeCustomer = filteredCustomers[idx + 1];
          windowPrefs.activeCustomerId = activeCustomer.id;
          savePreferences();
          render();
        }
      };
    }

    // Copy Buttons for Customer Profile fields
    shadow.querySelectorAll(".copy-btn[data-copy]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const text = btn.getAttribute("data-copy");
        const name = btn.getAttribute("data-name") || "Value";
        copyText(text, name);
      };
    });

    const btnCopyAll = shadow.getElementById("btn-copy-all");
    if (btnCopyAll) btnCopyAll.onclick = copyAllDetails;

    const btnAutoFill = shadow.getElementById("btn-auto-fill");
    if (btnAutoFill) btnAutoFill.onclick = autoFillCurrentPage;

    // Notes Section Event Handlers
    const textarea = shadow.getElementById("notes-textarea");
    const stats = shadow.getElementById("notes-stats");
    const saveBadge = shadow.getElementById("notes-save-status");
    let saveTimeout = null;

    if (textarea) {
      textarea.oninput = (e) => {
        const text = e.target.value;
        if (stats) stats.textContent = getStatsText(text);
        if (saveBadge) saveBadge.textContent = "Writing...";

        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          setCurrentNoteText(text);
          if (saveBadge) saveBadge.textContent = "Saved";
        }, 300);
      };

      textarea.onblur = () => {
        setCurrentNoteText(textarea.value);
        if (saveBadge) saveBadge.textContent = "Saved";
      };
    }

    const tabCust = shadow.getElementById("tab-cust-notes");
    if (tabCust) {
      tabCust.onclick = () => {
        if (notesState.activeTab !== "customer") {
          notesState.activeTab = "customer";
          saveNotes();
          render();
        }
      };
    }

    const tabGen = shadow.getElementById("tab-gen-notes");
    if (tabGen) {
      tabGen.onclick = () => {
        if (notesState.activeTab !== "general") {
          notesState.activeTab = "general";
          saveNotes();
          render();
        }
      };
    }

    const btnInsertCust = shadow.getElementById("btn-insert-cust-info");
    if (btnInsertCust && activeCustomer && textarea) {
      btnInsertCust.onclick = () => {
        const snippet = [
          `--- Customer Details ---`,
          `Name: ${activeCustomer.customerName || "-"}`,
          `Mobile: ${activeCustomer.mobileNumber || "-"}`,
          `Customer ID: ${activeCustomer.customerId || "-"}`,
          `Service: ${activeCustomer.serviceName || "-"}`,
          `App/Ack No: ${activeCustomer.applicationNumber || "-"}`,
          `Status: ${activeCustomer.applicationStatus || "-"}`,
          `------------------------`,
          ``
        ].join("\n");
        insertTextIntoTextarea(textarea, snippet);
      };
    }

    const btnInsertTime = shadow.getElementById("btn-insert-timestamp");
    if (btnInsertTime && textarea) {
      btnInsertTime.onclick = () => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const stamp = `[${dateStr} ${timeStr}] `;
        insertTextIntoTextarea(textarea, stamp);
      };
    }

    const btnClearNotes = shadow.getElementById("btn-clear-notes");
    if (btnClearNotes && textarea) {
      btnClearNotes.onclick = () => {
        if (!textarea.value || textarea.value.trim().length === 0) return;
        if (window.confirm("Clear this note?")) {
          textarea.value = "";
          setCurrentNoteText("");
          if (stats) stats.textContent = getStatsText("");
          if (saveBadge) saveBadge.textContent = "Cleared";
          showToast("Notes cleared");
        }
      };
    }

    const btnCopyNotes = shadow.getElementById("btn-copy-notes");
    if (btnCopyNotes) {
      btnCopyNotes.onclick = copyNotesAccurately;
    }

    initDragHandler();
    initResizeHandlers();
  }

  function insertTextIntoTextarea(ta, textToInsert) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const current = ta.value;

    if (start !== undefined && end !== undefined && start >= 0) {
      ta.value = current.substring(0, start) + textToInsert + current.substring(end);
      ta.selectionStart = ta.selectionEnd = start + textToInsert.length;
    } else {
      ta.value = current ? current + "\n" + textToInsert : textToInsert;
    }

    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function initDragHandler() {
    const header = shadow.getElementById("drag-header");
    if (!header) return;

    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.onpointerdown = (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("select") || e.target.closest("textarea")) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = hostContainer.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      try { header.setPointerCapture(e.pointerId); } catch (err) {}

      header.onpointermove = (ev) => {
        if (!isDragging) return;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        const card = shadow.querySelector(".pathway-card");
        const cardW = card ? card.offsetWidth : 490;
        const cardH = card ? card.offsetHeight : 680;

        const newLeft = Math.max(10, Math.min(initialLeft + dx, window.innerWidth - cardW - 10));
        const newTop = Math.max(10, Math.min(initialTop + dy, window.innerHeight - cardH - 10));

        hostContainer.style.left = newLeft + "px";
        hostContainer.style.top = newTop + "px";
        hostContainer.style.right = "auto";

        windowPrefs.left = newLeft;
        windowPrefs.top = newTop;
        windowPrefs.isRightSide = false;
      };

      header.onpointerup = (ev) => {
        if (!isDragging) return;
        isDragging = false;
        header.onpointermove = null;
        header.onpointerup = null;
        try { header.releasePointerCapture(ev.pointerId); } catch (err) {}
        savePreferences();
      };
    };
  }

  function initResizeHandlers() {
    const card = shadow.querySelector(".pathway-card");
    if (!card) return;

    const handles = shadow.querySelectorAll(".resize-handle");
    handles.forEach((handle) => {
      handle.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        const direction = handle.getAttribute("data-direction") || "se";

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = card.offsetWidth;
        const startHeight = card.offsetHeight;
        const rect = hostContainer.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        try { handle.setPointerCapture(e.pointerId); } catch (err) {}

        const onPointerMove = (ev) => {
          if (!isResizing) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;

          let newWidth = startWidth;
          let newHeight = startHeight;
          let newLeft = startLeft;
          let newTop = startTop;

          const minW = 340;
          const minH = 400;
          const maxW = Math.min(window.innerWidth - 20, 1400);
          const maxH = Math.min(window.innerHeight - 20, 1100);

          if (direction.includes("e")) {
            newWidth = Math.max(minW, Math.min(startWidth + dx, maxW));
          } else if (direction.includes("w")) {
            newWidth = Math.max(minW, Math.min(startWidth - dx, maxW));
            newLeft = startLeft + (startWidth - newWidth);
          }

          if (direction.includes("s")) {
            newHeight = Math.max(minH, Math.min(startHeight + dy, maxH));
          } else if (direction.includes("n")) {
            newHeight = Math.max(minH, Math.min(startHeight - dy, maxH));
            newTop = startTop + (startHeight - newHeight);
          }

          card.style.width = newWidth + "px";
          card.style.height = newHeight + "px";

          if (direction.includes("w")) {
            hostContainer.style.left = newLeft + "px";
            hostContainer.style.right = "auto";
            windowPrefs.left = newLeft;
            windowPrefs.isRightSide = false;
          }
          if (direction.includes("n")) {
            hostContainer.style.top = newTop + "px";
            windowPrefs.top = newTop;
          }

          windowPrefs.width = newWidth;
          windowPrefs.height = newHeight;

          updateSizeDisplay();
        };

        const onPointerUp = (ev) => {
          if (!isResizing) return;
          isResizing = false;
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          try { handle.releasePointerCapture(ev.pointerId); } catch (err) {}
          savePreferences();
          updateSizeDisplay();
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
      };
    });
  }

  // Floating Corner Quick-Launcher Icon Button
  const launcher = document.createElement("div");
  launcher.id = "airnet-pathway-quick-launcher";
  launcher.title = "Airnet Pathway Dossier (Alt+P)";
  launcher.style.position = "fixed";
  launcher.style.bottom = "20px";
  launcher.style.right = "20px";
  launcher.style.zIndex = "2147483646";
  launcher.style.backgroundColor = "#022349";
  launcher.style.color = "#ffffff";
  launcher.style.borderRadius = "9999px";
  launcher.style.padding = "8px 12px 8px 14px";
  launcher.style.fontSize = "12px";
  launcher.style.fontWeight = "700";
  launcher.style.boxShadow = "0 8px 24px rgba(2, 35, 73, 0.4)";
  launcher.style.border = "1px solid #38bdf8";
  launcher.style.cursor = "pointer";
  launcher.style.userSelect = "none";
  launcher.style.display = "flex";
  launcher.style.alignItems = "center";
  launcher.style.gap = "6px";
  launcher.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  launcher.style.transition = "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)";

  launcher.innerHTML = `
    <span style="font-size: 14px;">🚀</span>
    <span>Pathway</span>
    <span id="launcher-turn-off-btn" title="Turn OFF Pathway on this website" style="display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.14); margin-left: 2px; font-size: 10px; color: #fca5a5; transition: all 0.15s;">⏻</span>
  `;

  launcher.onmouseenter = () => {
    launcher.style.transform = "scale(1.04)";
    launcher.style.backgroundColor = "#032e60";
  };
  launcher.onmouseleave = () => {
    launcher.style.transform = "scale(1)";
    launcher.style.backgroundColor = "#022349";
  };

  launcher.onclick = (e) => {
    if (e.target.id === "launcher-turn-off-btn" || e.target.closest("#launcher-turn-off-btn")) {
      e.stopPropagation();
      turnOffPathway(true);
      return;
    }
    hostContainer.style.display = hostContainer.style.display === "none" ? "block" : "none";
    if (hostContainer.style.display === "block") {
      if (customers.length === 0) fetchCustomers();
    }
  };

  const launcherOffBtn = launcher.querySelector("#launcher-turn-off-btn");
  if (launcherOffBtn) {
    launcherOffBtn.onmouseenter = (e) => {
      e.stopPropagation();
      launcherOffBtn.style.backgroundColor = "#dc2626";
      launcherOffBtn.style.color = "#ffffff";
    };
    launcherOffBtn.onmouseleave = (e) => {
      e.stopPropagation();
      launcherOffBtn.style.backgroundColor = "rgba(255,255,255,0.14)";
      launcherOffBtn.style.color = "#fca5a5";
    };
  }

  function mount() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", mount);
      return;
    }
    document.body.appendChild(launcher);
    document.body.appendChild(hostContainer);
    loadPreferences();
    fetchCustomers();
  }
  mount();

  window.addEventListener("keydown", (e) => {
    if (e.altKey && (e.key === "p" || e.key === "P")) {
      e.preventDefault();
      if (isTurnedOff) {
        turnOnPathway(true);
      } else {
        hostContainer.style.display = hostContainer.style.display === "none" ? "block" : "none";
        if (hostContainer.style.display === "block" && customers.length === 0) {
          fetchCustomers();
        }
      }
    }
  });

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "GET_PATHWAY_STATUS") {
        sendResponse({
          isTurnedOff: isTurnedOff,
          isLauncherVisible: launcher.style.display !== "none" && !isTurnedOff,
          isOpen: hostContainer.style.display !== "none",
          hostname: window.location.hostname,
        });
        return;
      }

      if (request.action === "TURN_OFF_PATHWAY") {
        turnOffPathway(false);
        sendResponse({ status: "ok", isTurnedOff: true });
        return;
      }

      if (request.action === "TURN_ON_PATHWAY") {
        turnOnPathway(false);
        sendResponse({ status: "ok", isTurnedOff: false });
        return;
      }

      if (request.action === "SET_LAUNCHER_VISIBLE") {
        isLauncherPillEnabled = !!request.visible;
        if (!isTurnedOff) {
          launcher.style.display = isLauncherPillEnabled ? "flex" : "none";
        }
        sendResponse({ status: "ok", visible: isLauncherPillEnabled });
        return;
      }

      if (request.action === "TOGGLE_PATHWAY") {
        if (isTurnedOff) {
          turnOnPathway(false);
        } else {
          hostContainer.style.display = hostContainer.style.display === "none" ? "block" : "none";
          if (hostContainer.style.display === "block" && customers.length === 0) {
            fetchCustomers();
          }
        }
        sendResponse({ status: "ok", isOpen: hostContainer.style.display !== "none" });
        return;
      }
    });
  }
})();
