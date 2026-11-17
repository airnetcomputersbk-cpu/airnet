# Airnet Pathway - Universal Floating Screen Chrome Extension

Access and use the Airnet Pathway Customer Dossier directly on **ANY WEBSITE OR TAB** (such as Seva Sindhu, Nadakacheri, Income Tax, PAN card portal, DigiLocker, etc.).

---

## 🚀 Quick Setup in Chrome / Edge (1 Minute)

1. Open your browser and navigate to: `chrome://extensions` (or `edge://extensions` in Microsoft Edge).
2. In the top-right corner, toggle **"Developer mode"** to **ON**.
3. If you previously loaded the extension, click the **Reload (↻)** icon on the **Airnet Pathway** card.
   - If loading for the first time, click **"Load unpacked"** (top-left) and select this folder:
     ```
     D:\1-Project\site\Website\extensions\pathway-chrome-extension
     ```
4. The extension icon will appear in your browser extension toolbar! Pin it for quick access.

---

## ⏻ Turning Off Pathway Screen (New Feature)

You have full control over when and where the Pathway screen and launcher appear. You can turn it off completely on specific websites or globally:

### 1. From the Pathway Window Header
- Click the red **Power button (`⏻`)** in the top-right corner of the Pathway window.
- This immediately hides both the floating window and the corner launcher pill on the current website, and remembers your choice.

### 2. From the Bottom-Right Corner Launcher Pill
- Hover over the bottom-right **"🚀 Pathway"** pill and click the small **Power icon (`⏻`)**.
- Both the launcher pill and window will be turned off on that website immediately.

### 3. From the Extension Toolbar Popup
- Click the **Airnet Pathway icon** in your browser toolbar.
- The popup displays the current website domain and active power status.
- Click **"Turn OFF Pathway on this Website"** (turns red to green).
- To re-enable, simply click **"Turn ON Pathway on this Website"**.

### 4. Turn Off the Corner Launcher Pill Globally
- Open the extension toolbar popup.
- Uncheck **Corner "🚀 Pathway" button**.
- This completely hides the floating bottom-right button across all websites so your screen stays 100% clean, while still letting you press **`Alt + P`** anytime to summon the Pathway screen!

### 5. How to Turn It Back ON
- **Keyboard Shortcut**: Press **`Alt + P`** on the website at any time. It will automatically re-enable Pathway and open the dossier!
- **Toolbar Icon**: Click the extension icon and click **"Turn ON Pathway on this Website"**.

---

## 📝 Notes & Scratchpad (Accurate Copying)

- **Customer Note**: Automatically saves per-customer notes linked to their Customer ID in `chrome.storage.local`.
- **Scratchpad (General)**: Universal temporary notepad accessible on any tab.
- **+ Customer Info**: Injects a clean customer details snippet directly into your notes.
- **+ Timestamp**: Injects `[DD-Mon-YYYY HH:MM:SS]` into your notes.
- **📋 Copy Notes Accurately**: One-click instant clipboard copy with character and word statistics.

---

## 🌟 Full Feature Set

### 1. Live Customer Data Across Any Tab
- Immediately loads live customer workflow dossiers directly from your Airnet local server (`http://localhost:5001`).
- Bypasses CSP and Mixed-Content blocks on external HTTPS websites.

### 2. Fully Resizable Window (8 Directions & Corner)
- **Edge & Corner Resize**: Drag any edge (top, bottom, left, right) or the bottom-right corner grip to adjust size smoothly.
- **Quick Preset Sizes**:
  - 📱 **380 × 520 px** (Compact mode)
  - 💻 **490 × 680 px** (Standard view)
  - 🖥️ **680 × 760 px** (Wide view)
  - ⛶ **Fit Height** (Full viewport height)
- **Persistence**: Remembers size, position, active tab, and selected customer in `chrome.storage.local`.

### 3. Matched Admin Pathway Design & 4 Tabs
- **Hero Customer Header**: Name copy, Customer ID copy, mobile copy, WhatsApp link, status badge, processing meter, and current stage banner.
- **Tabs**:
  - 📋 **Application Details**: 1-click copy buttons for every field, plus **⚡ Fill Current Page Form** and **📋 Copy All Form Fields**.
  - 🛤️ **Stage Pathway**: Visual stage progression pipeline matching Admin portal.
  - 📝 **Notes & Scratchpad**: Auto-saved notes with accurate 1-click copying.
  - 📁 **Documents**: Uploaded document files linked to the customer.

### 4. Floating Quick Launcher & Keyboard Shortcut
- Corner launcher pill with toggle and turn-off controls.
- Keyboard shortcut **`Alt + P`** everywhere.
- **⇄ Switch Side**: Flips between right and left side of screen.
- **↗ Popout**: Opens Pathway in a standalone popout window.
