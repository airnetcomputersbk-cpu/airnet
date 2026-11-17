// Background service worker for Airnet Pathway Chrome Extension
// Handles cross-origin requests to local Airnet server, bypassing web page CSP & Mixed Content blocks

const API_ENDPOINTS = [
  "http://localhost:5001/api/pathway/customers",
  "http://localhost:5001/api/admin/pathway/customers",
  "http://127.0.0.1:5001/api/pathway/customers",
  "http://127.0.0.1:5001/api/admin/pathway/customers",
];

const DETAIL_BASE_ENDPOINTS = [
  "http://localhost:5001/api/pathway/customer",
  "http://localhost:5001/api/admin/pathway/customer",
  "http://127.0.0.1:5001/api/pathway/customer",
  "http://127.0.0.1:5001/api/admin/pathway/customer",
];

// Helper to fetch from endpoints with automatic fallback
async function fetchWithFallback(endpoints) {
  let lastError = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        return { success: true, data: json, url };
      }
      lastError = new Error(`HTTP ${res.status} from ${url}`);
    } catch (err) {
      lastError = err;
    }
  }
  return { success: false, error: lastError ? lastError.message : "All endpoints failed" };
}

// Global keyboard shortcut listener (Alt+P)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-pathway") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_PATHWAY" }).catch(() => {
        // Fallback injection if content script not yet active
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        }).catch(() => {});
      });
    }
  }
});

// Message listener for content scripts & popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "FETCH_CUSTOMERS") {
    fetchWithFallback(API_ENDPOINTS).then((result) => {
      if (result.success && result.data && Array.isArray(result.data.customers)) {
        sendResponse({
          success: true,
          customers: result.data.customers,
          total: result.data.total || result.data.customers.length,
          endpoint: result.url,
        });
      } else {
        sendResponse({
          success: false,
          customers: [],
          total: 0,
          error: result.error || "Could not retrieve customers from Airnet server",
        });
      }
    }).catch((err) => {
      sendResponse({ success: false, customers: [], error: err.message });
    });
    return true; // Keep message channel open for async response
  }

  if (request.action === "FETCH_CUSTOMER_DETAILS") {
    const id = encodeURIComponent(request.id);
    const detailUrls = DETAIL_BASE_ENDPOINTS.map((base) => `${base}/${id}`);
    fetchWithFallback(detailUrls).then((result) => {
      if (result.success && result.data && result.data.customer) {
        sendResponse({ success: true, customer: result.data.customer });
      } else {
        sendResponse({ success: false, error: result.error || "Customer details not found" });
      }
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (request.action === "CHECK_SERVER") {
    fetchWithFallback(API_ENDPOINTS).then((result) => {
      sendResponse({
        online: result.success,
        total: result.success ? (result.data.total || result.data.customers?.length || 0) : 0,
        endpoint: result.url || null,
        error: result.error || null,
      });
    }).catch((err) => {
      sendResponse({ online: false, total: 0, error: err.message });
    });
    return true;
  }

  if (request.action === "OPEN_POPOUT") {
    chrome.windows.create({
      url: "http://localhost:5000/admin/pathway/popout",
      type: "popup",
      width: 520,
      height: 720,
      top: 100,
      left: 100,
      focused: true,
    }).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      chrome.tabs.create({ url: "http://localhost:5000/admin/pathway/popout" });
      sendResponse({ success: true });
    });
    return true;
  }
});
