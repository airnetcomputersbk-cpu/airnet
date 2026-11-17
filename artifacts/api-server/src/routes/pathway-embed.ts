import { Router } from "express";
import { getPathwayCustomersList, getPathwayCustomerDetails } from "./admin";

export const pathwayEmbedRouter = Router();

// Dedicated unauthenticated endpoints for Chrome Extension, Bookmarklet, and Companion Popouts
pathwayEmbedRouter.get("/customers", async (req, res) => {
  try {
    const customers = await getPathwayCustomersList();
    res.json({
      success: true,
      total: customers.length,
      customers,
    });
  } catch (err: any) {
    console.error("[pathway-embed] Error fetching pathway customers:", err);
    res.status(500).json({ error: "Failed to fetch pathway customer information" });
  }
});

pathwayEmbedRouter.get("/customer/:id", async (req, res) => {
  try {
    const customer = await getPathwayCustomerDetails(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    return res.json({
      success: true,
      customer,
    });
  } catch (err: any) {
    console.error("[pathway-embed] Error fetching pathway customer details:", err);
    return res.status(500).json({ error: "Failed to fetch customer pathway details" });
  }
});

pathwayEmbedRouter.get("/embed.js", (req, res) => {
  const host = req.get("host") || "localhost:5001";
  const protocol = req.protocol || "http";
  const apiBaseUrl = `${protocol}://${host}`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const scriptContent = `
(function() {
  const EXISTING = document.getElementById("airnet-pathway-embed-root");
  if (EXISTING) {
    EXISTING.style.display = EXISTING.style.display === "none" ? "block" : "none";
    return;
  }

  const API_BASE = "${apiBaseUrl}";
  const hostContainer = document.createElement("div");
  hostContainer.id = "airnet-pathway-embed-root";
  hostContainer.style.position = "fixed";
  hostContainer.style.zIndex = "2147483647"; // Maximum CSS z-index
  hostContainer.style.top = "20px";
  hostContainer.style.right = "20px";
  hostContainer.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const shadow = hostContainer.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = \`
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .pathway-card {
      width: 480px;
      max-width: calc(100vw - 30px);
      height: 640px;
      max-height: calc(100vh - 40px);
      min-width: 340px;
      min-height: 380px;
      background: #ffffff;
      color: #0f172a;
      border-radius: 16px;
      box-shadow: 0 20px 40px -10px rgba(2, 46, 96, 0.35), 0 0 0 1px rgba(30, 75, 117, 0.15);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 13px;
      position: relative;
    }
    .resize-handle { position: absolute; z-index: 50; touch-action: none; }
    .resize-handle-r { top: 0; right: 0; width: 8px; height: 100%; cursor: ew-resize; }
    .resize-handle-b { bottom: 0; left: 0; width: 100%; height: 8px; cursor: ns-resize; }
    .resize-handle-se { bottom: 0; right: 0; width: 18px; height: 18px; cursor: nwse-resize; display: flex; align-items: flex-end; justify-content: flex-end; padding: 2px; }
    .corner-grip { width: 10px; height: 10px; background: linear-gradient(135deg, transparent 40%, #94a3b8 40%, #94a3b8 55%, transparent 55%, transparent 75%, #94a3b8 75%, #94a3b8 90%, transparent 90%); opacity: 0.6; }
    .resize-handle-se:hover .corner-grip { opacity: 1; filter: drop-shadow(0 0 1px #2563eb); }
    .size-preset-bar { background: #0f172a; color: #cbd5e1; padding: 4px 10px; display: flex; align-items: center; justify-content: space-between; font-size: 10px; border-bottom: 1px solid #1e293b; user-select: none; }
    .size-btn { background: rgba(255, 255, 255, 0.1); border: none; color: #94a3b8; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; font-weight: 600; }
    .size-btn:hover { background: #2563eb; color: #ffffff; }
    .size-btn.active { background: #0284c7; color: #ffffff; }
    .header {
      background: linear-gradient(135deg, #022349 0%, #032e60 50%, #044085 100%);
      color: #ffffff;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
    }
    .header:active { cursor: grabbing; }
    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: -0.2px;
    }
    .badge-dossier {
      font-size: 10px;
      background: rgba(6, 182, 212, 0.2);
      color: #67e8f9;
      border: 1px solid rgba(103, 232, 249, 0.3);
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .btn-icon {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #e2e8f0;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.15s, color 0.15s;
    }
    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
    }
    .btn-icon.close:hover {
      background: #dc2626;
      color: #ffffff;
    }
    .search-bar {
      padding: 8px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
    }
    .search-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 12px;
      outline: none;
      background: #ffffff;
    }
    .search-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }
    .customer-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 12px;
      background: #ffffff;
      margin-top: 6px;
      outline: none;
    }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #f8fafc;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    }
    .card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .field-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    .field-row:last-child { border-bottom: none; }
    .field-label { color: #64748b; font-weight: 500; }
    .field-val-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .field-value {
      font-weight: 600;
      color: #0f172a;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #475569;
      border-radius: 5px;
      padding: 2px 6px;
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
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-in-progress { background: #fef3c7; color: #b45309; }
    .status-completed { background: #dcfce7; color: #15803d; }
    .status-pending { background: #dbeafe; color: #1d4ed8; }
    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .step-item:last-child { border-bottom: none; }
    .step-bullet {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #94a3b8;
      color: #ffffff;
      font-size: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .step-bullet.done { background: #10b981; }
    .step-bullet.current { background: #2563eb; }
    .doc-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 4px;
      text-decoration: none;
      color: #1e293b;
      font-size: 11px;
      font-weight: 500;
    }
    .doc-link:hover { background: #eff6ff; border-color: #93c5fd; }
    .minimized-pill {
      background: linear-gradient(135deg, #022349 0%, #032e60 100%);
      color: #ffffff;
      padding: 8px 14px;
      border-radius: 9999px;
      box-shadow: 0 10px 25px rgba(2, 46, 96, 0.4);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      user-select: none;
      border: 1px solid #38bdf8;
      font-weight: 700;
      font-size: 12px;
    }
    .toast {
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #ffffff;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 999;
    }
    .toast.show { opacity: 1; }
  \`;
  shadow.appendChild(style);

  const container = document.createElement("div");
  shadow.appendChild(container);

  let customers = [];
  let activeCustomer = null;
  let isMinimized = false;
  let isRightSide = true;

  function showToast(msg) {
    let t = shadow.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      shadow.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 1800);
  }

  function copyText(val, label) {
    if (!val) return;
    navigator.clipboard.writeText(String(val)).then(() => {
      showToast("Copied " + label + "!");
    }).catch(() => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = String(val);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Copied " + label + "!");
    });
  }

  function render() {
    if (isMinimized) {
      container.innerHTML = \`
        <div class="minimized-pill" id="btn-restore" title="Click to expand Airnet Pathway Dossier">
          <span>🚀 Pathway</span>
          <span style="font-weight: 400; color: #7dd3fc;">•</span>
          <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            \${activeCustomer ? activeCustomer.customerName : "Select Customer"}
          </span>
          <span style="font-size: 10px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 4px;">Expand</span>
        </div>
      \`;
      const pill = shadow.getElementById("btn-restore");
      if (pill) {
        pill.onclick = () => {
          isMinimized = false;
          render();
        };
      }
      return;
    }

    container.innerHTML = \`
      <div class="pathway-card">
        <!-- Resize Handles -->
        <div class="resize-handle resize-handle-r" data-direction="e"></div>
        <div class="resize-handle resize-handle-b" data-direction="s"></div>
        <div class="resize-handle resize-handle-se" data-direction="se" title="Drag to adjust window size">
          <div class="corner-grip"></div>
        </div>

        <!-- Title Bar -->
        <div class="header" id="drag-header">
          <div class="header-title">
            <span>🚀 Airnet Pathway</span>
            <span class="badge-dossier">Dossier</span>
          </div>
          <div class="btn-group">
            <button class="btn-icon" id="btn-switch-side" title="Switch Side (Left ↔ Right)">⇄</button>
            <button class="btn-icon" id="btn-refresh" title="Refresh Live Data from Airnet">↻</button>
            <button class="btn-icon" id="btn-minimize" title="Minimize to Floating Pill">−</button>
            <button class="btn-icon close" id="btn-close" title="Close Pathway Overlay">✕</button>
          </div>
        </div>

        <!-- Size Presets -->
        <div class="size-preset-bar">
          <span style="font-weight: 600;">Size:</span>
          <div style="display: flex; gap: 4px;">
            <button class="size-btn" id="preset-compact">380×520</button>
            <button class="size-btn" id="preset-normal">480×640</button>
            <button class="size-btn" id="preset-wide">680×760</button>
            <button class="size-btn" id="preset-fit">Fit Height</button>
          </div>
        </div>

        <!-- Search & Customer Dropdown -->
        <div class="search-bar">
          <div style="flex: 1;">
            <input type="text" class="search-input" id="search-input" placeholder="Search name, phone, or customer ID..." />
            <select class="customer-select" id="customer-select">
              \${
                customers.length === 0
                  ? '<option value="">Connecting to Airnet local server...</option>'
                  : customers.map((c, i) => \`
                      <option value="\${c.id}" \${activeCustomer && activeCustomer.id === c.id ? "selected" : ""}>
                        \${c.customerName} (\${c.customerId || "ID"}) - \${c.serviceName}
                      </option>
                    \`).join("")
              }
            </select>
          </div>
        </div>

        <!-- Scrollable Details -->
        <div class="content">
          \${
            activeCustomer ? \`
              <!-- Customer Profile Card -->
              <div class="card">
                <div class="card-title">Customer Information</div>
                <div class="field-row">
                  <span class="field-label">Name</span>
                  <div class="field-val-wrap">
                    <span class="field-value">\${activeCustomer.customerName || "-"}</span>
                    <button class="copy-btn" data-copy="\${activeCustomer.customerName || ""}" data-name="Name">Copy</button>
                  </div>
                </div>
                <div class="field-row">
                  <span class="field-label">Mobile</span>
                  <div class="field-val-wrap">
                    <span class="field-value">\${activeCustomer.mobileNumber || "-"}</span>
                    <button class="copy-btn" data-copy="\${activeCustomer.mobileNumber || ""}" data-name="Phone">Copy</button>
                    \${activeCustomer.mobileNumber ? \`
                      <a href="https://wa.me/91\${activeCustomer.mobileNumber.replace(/\\D/g, '')}" target="_blank" style="color: #10b981; text-decoration: none; font-weight: bold; font-size: 11px;">WA</a>
                    \` : ""}
                  </div>
                </div>
                <div class="field-row">
                  <span class="field-label">Customer ID</span>
                  <div class="field-val-wrap">
                    <span class="field-value font-mono">\${activeCustomer.customerId || "-"}</span>
                    <button class="copy-btn" data-copy="\${activeCustomer.customerId || ""}" data-name="Customer ID">Copy</button>
                  </div>
                </div>
                <div class="field-row">
                  <span class="field-label">Service</span>
                  <div class="field-val-wrap">
                    <span class="field-value" style="color: #2563eb;">\${activeCustomer.serviceName || "-"}</span>
                    <button class="copy-btn" data-copy="\${activeCustomer.serviceName || ""}" data-name="Service">Copy</button>
                  </div>
                </div>
                <div class="field-row">
                  <span class="field-label">App Number</span>
                  <div class="field-val-wrap">
                    <span class="field-value font-mono">\${activeCustomer.applicationNumber || "None"}</span>
                    \${activeCustomer.applicationNumber ? \`<button class="copy-btn" data-copy="\${activeCustomer.applicationNumber}" data-name="App Number">Copy</button>\` : ""}
                  </div>
                </div>
                <div class="field-row">
                  <span class="field-label">Status</span>
                  <span class="status-badge \${
                    activeCustomer.applicationStatus === 'Completed' ? 'status-completed' :
                    activeCustomer.applicationStatus === 'In Progress' ? 'status-in-progress' : 'status-pending'
                  }">
                    \${activeCustomer.applicationStatus || 'New'}
                  </span>
                </div>
                \${activeCustomer.notes ? \`
                  <div style="margin-top: 6px; padding: 6px; background: #fffbeb; border-radius: 6px; font-size: 11px; color: #92400e;">
                    <strong>Note:</strong> \${activeCustomer.notes}
                  </div>
                \` : ""}
                <div style="margin-top: 8px; text-align: right;">
                  <button class="copy-btn" id="btn-copy-all" style="background: #022349; color: #ffffff; padding: 4px 10px; font-size: 11px;">
                    📋 Copy All Details
                  </button>
                </div>
              </div>

              <!-- Notes & Scratchpad Card -->
              <div class="card">
                <div class="card-title" style="display: flex; justify-content: space-between; align-items: center;">
                  <span>📝 Notes & Scratchpad</span>
                  <button class="copy-btn" id="btn-copy-embed-notes" style="background: #022349; color: #fff;">
                    📋 Copy Notes Accurately
                  </button>
                </div>
                <textarea id="embed-notes-area" style="width: 100%; min-height: 80px; padding: 8px; font-family: monospace; font-size: 11.5px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical; outline: none; margin-top: 4px;" placeholder="Write notes, application IDs, or references here... Auto-saved."></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 10px; color: #64748b;">
                  <span id="embed-notes-count">0 chars</span>
                  <button class="copy-btn" id="btn-clear-embed-notes" style="font-size: 10px; color: #dc2626;">Clear</button>
                </div>
              </div>

              <!-- Step Pipeline -->
              <div class="card">
                <div class="card-title">Processing Pipeline</div>
                \${
                  activeCustomer.steps && activeCustomer.steps.length > 0 ?
                    activeCustomer.steps.map((s, idx) => \`
                      <div class="step-item">
                        <div class="step-bullet \${s.status === 'completed' ? 'done' : s.status === 'in-progress' ? 'current' : ''}">
                          \${s.status === 'completed' ? '✓' : idx + 1}
                        </div>
                        <div style="flex: 1;">
                          <div style="font-weight: 600; color: #1e293b;">\${s.title}</div>
                          \${s.note ? \`<div style="font-size: 10px; color: #64748b;">\${s.note}</div>\` : ""}
                        </div>
                        <span style="font-size: 10px; color: #64748b; text-transform: capitalize;">\${s.status}</span>
                      </div>
                    \`).join("")
                  : '<div style="color: #94a3b8; font-size: 11px;">No specific milestones recorded.</div>'
                }
              </div>

              <!-- Documents -->
              \${
                activeCustomer.documents && activeCustomer.documents.length > 0 ? \`
                  <div class="card">
                    <div class="card-title">Customer Documents (\${activeCustomer.documents.length})</div>
                    \${activeCustomer.documents.map(d => \`
                      <a class="doc-link" href="\${API_BASE}/api/documents/\${d.id}/download" target="_blank">
                        <span>📄 \${d.fileName}</span>
                        <span style="font-size: 10px; color: #2563eb; font-weight: 600;">Open ↗</span>
                      </a>
                    \`).join("")}
                  </div>
                \` : ""
              }
            \` : \`
              <div style="text-align: center; padding: 30px 10px; color: #64748b;">
                <div style="font-size: 24px; margin-bottom: 6px;">📂</div>
                <div style="font-weight: 600;">No Customer Selected</div>
                <div style="font-size: 11px; margin-top: 4px;">Choose a customer from the dropdown above to view live dossier details.</div>
              </div>
            \`
          }
        </div>
      </div>
    \`;

    setupEvents();
  }

  function setupEvents() {
    const btnClose = shadow.getElementById("btn-close");
    if (btnClose) {
      btnClose.onclick = () => hostContainer.remove();
    }

    const btnMinimize = shadow.getElementById("btn-minimize");
    if (btnMinimize) {
      btnMinimize.onclick = () => {
        isMinimized = true;
        render();
      };
    }

    const btnRefresh = shadow.getElementById("btn-refresh");
    if (btnRefresh) {
      btnRefresh.onclick = () => fetchCustomers();
    }

    const btnSwitchSide = shadow.getElementById("btn-switch-side");
    if (btnSwitchSide) {
      btnSwitchSide.onclick = () => {
        isRightSide = !isRightSide;
        if (isRightSide) {
          hostContainer.style.left = "auto";
          hostContainer.style.right = "20px";
        } else {
          hostContainer.style.right = "auto";
          hostContainer.style.left = "20px";
        }
      };
    }

    const select = shadow.getElementById("customer-select");
    if (select) {
      select.onchange = (e) => {
        const found = customers.find(c => String(c.id) === e.target.value);
        if (found) {
          activeCustomer = found;
          render();
        }
      };
    }

    const searchInput = shadow.getElementById("search-input");
    if (searchInput) {
      searchInput.oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = customers.filter(c =>
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.mobileNumber && c.mobileNumber.includes(q)) ||
          (c.customerId && c.customerId.toLowerCase().includes(q)) ||
          (c.serviceName && c.serviceName.toLowerCase().includes(q))
        );
        if (select) {
          select.innerHTML = filtered.map(c => \`
            <option value="\${c.id}" \${activeCustomer && activeCustomer.id === c.id ? "selected" : ""}>
              \${c.customerName} (\${c.customerId || "ID"}) - \${c.serviceName}
            </option>
          \`).join("");
          if (filtered.length > 0 && (!activeCustomer || !filtered.find(f => f.id === activeCustomer.id))) {
            activeCustomer = filtered[0];
          }
        }
      };
    }

    shadow.querySelectorAll(".copy-btn[data-copy]").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const val = btn.getAttribute("data-copy");
        const name = btn.getAttribute("data-name") || "Value";
        copyText(val, name);
      };
    });

    const btnCopyAll = shadow.getElementById("btn-copy-all");
    if (btnCopyAll && activeCustomer) {
      btnCopyAll.onclick = () => {
        const text = [
          "CUSTOMER DETAILS (Airnet Computers)",
          "Name: " + (activeCustomer.customerName || "-"),
          "Mobile: " + (activeCustomer.mobileNumber || "-"),
          "Customer ID: " + (activeCustomer.customerId || "-"),
          "Service: " + (activeCustomer.serviceName || "-"),
          "Application No: " + (activeCustomer.applicationNumber || "-"),
          "Status: " + (activeCustomer.applicationStatus || "-"),
          activeCustomer.notes ? ("Notes: " + activeCustomer.notes) : ""
        ].filter(Boolean).join("\\n");
        copyText(text, "All Customer Details");
      };
    }

    // Notes Support
    const notesArea = shadow.getElementById("embed-notes-area");
    const notesCount = shadow.getElementById("embed-notes-count");
    const btnCopyEmbedNotes = shadow.getElementById("btn-copy-embed-notes");
    const btnClearEmbedNotes = shadow.getElementById("btn-clear-embed-notes");

    if (notesArea) {
      const savedNote = localStorage.getItem("airnet_pathway_embed_note_" + (activeCustomer ? activeCustomer.id : "gen")) || "";
      notesArea.value = savedNote;
      if (notesCount) notesCount.textContent = savedNote.length + " chars";

      notesArea.oninput = () => {
        const val = notesArea.value;
        if (notesCount) notesCount.textContent = val.length + " chars";
        localStorage.setItem("airnet_pathway_embed_note_" + (activeCustomer ? activeCustomer.id : "gen"), val);
      };
    }

    if (btnCopyEmbedNotes && notesArea) {
      btnCopyEmbedNotes.onclick = () => {
        const text = notesArea.selectionStart !== notesArea.selectionEnd
          ? notesArea.value.substring(notesArea.selectionStart, notesArea.selectionEnd)
          : notesArea.value;
        if (!text) {
          showToast("Notes are empty");
          return;
        }
        copyText(text, "Notes accurately");
        btnCopyEmbedNotes.textContent = "✓ Copied!";
        setTimeout(() => { if (btnCopyEmbedNotes) btnCopyEmbedNotes.textContent = "📋 Copy Notes Accurately"; }, 1800);
      };
    }

    if (btnClearEmbedNotes && notesArea) {
      btnClearEmbedNotes.onclick = () => {
        notesArea.value = "";
        localStorage.removeItem("airnet_pathway_embed_note_" + (activeCustomer ? activeCustomer.id : "gen"));
        if (notesCount) notesCount.textContent = "0 chars";
        showToast("Notes cleared");
      };
    }

    // Drag support
    const header = shadow.getElementById("drag-header");
    if (header) {
      let isDragging = false;
      let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

      header.onpointerdown = (e) => {
        if (e.target.closest("button, select, input")) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = hostContainer.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        hostContainer.style.right = "auto";
        hostContainer.style.left = initialLeft + "px";
        hostContainer.style.top = initialTop + "px";
        header.setPointerCapture(e.pointerId);
      };

      header.onpointermove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        hostContainer.style.left = Math.max(0, Math.min(window.innerWidth - 100, initialLeft + dx)) + "px";
        hostContainer.style.top = Math.max(0, Math.min(window.innerHeight - 50, initialTop + dy)) + "px";
      };

      header.onpointerup = (e) => {
        if (isDragging) {
          isDragging = false;
          try { header.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      };
    }

    // Size preset controls
    const card = shadow.querySelector(".pathway-card");
    const setSize = (w, h) => {
      if (card) {
        card.style.width = w + "px";
        card.style.height = h + "px";
        try { localStorage.setItem("airnet_pathway_embed_size", JSON.stringify({ w, h })); } catch(e) {}
      }
    };
    const btnCompact = shadow.getElementById("preset-compact");
    if (btnCompact) btnCompact.onclick = () => setSize(380, 520);
    const btnNormal = shadow.getElementById("preset-normal");
    if (btnNormal) btnNormal.onclick = () => setSize(480, 640);
    const btnWide = shadow.getElementById("preset-wide");
    if (btnWide) btnWide.onclick = () => setSize(680, 760);
    const btnFit = shadow.getElementById("preset-fit");
    if (btnFit) btnFit.onclick = () => setSize(card ? card.offsetWidth : 480, Math.min(window.innerHeight - 30, 960));

    // Interactive edge & corner resize
    shadow.querySelectorAll(".resize-handle").forEach((handle) => {
      handle.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dir = handle.getAttribute("data-direction") || "se";
        const startX = e.clientX, startY = e.clientY;
        const startW = card.offsetWidth, startH = card.offsetHeight;
        handle.setPointerCapture(e.pointerId);

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (dir.includes("e")) card.style.width = Math.max(340, Math.min(window.innerWidth - 20, startW + dx)) + "px";
          if (dir.includes("s")) card.style.height = Math.max(380, Math.min(window.innerHeight - 20, startH + dy)) + "px";
        };
        const onUp = (ev) => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          try { handle.releasePointerCapture(ev.pointerId); } catch(err) {}
          try { localStorage.setItem("airnet_pathway_embed_size", JSON.stringify({ w: card.offsetWidth, h: card.offsetHeight })); } catch(e) {}
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      };
    });
  }

  async function fetchCustomers() {
    try {
      let res = await fetch(API_BASE + "/api/pathway/customers");
      if (!res.ok) {
        res = await fetch(API_BASE + "/api/admin/pathway/customers", { credentials: "include" });
      }
      if (res.ok) {
        const data = await res.json();
        customers = data.customers || [];
        if (!activeCustomer && customers.length > 0) {
          activeCustomer = customers[0];
        } else if (activeCustomer) {
          const match = customers.find(c => c.id === activeCustomer.id);
          if (match) activeCustomer = match;
        }
      }
    } catch(err) {
      console.warn("[Airnet Pathway Embed] Server connection error:", err);
    }
    render();
  }

  document.body.appendChild(hostContainer);
  fetchCustomers();
})();
  `;

  res.send(scriptContent);
});
