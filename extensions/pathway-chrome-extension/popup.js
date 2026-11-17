// Airnet Pathway Popup Script
// Supports turning off/on the floating screen & launcher pill per-website and globally

document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const siteDomain = document.getElementById("site-domain");
  const siteStatusPill = document.getElementById("site-status-pill");
  const siteDesc = document.getElementById("site-desc");
  const powerToggleBtn = document.getElementById("power-toggle-btn");
  const powerIcon = document.getElementById("power-icon");
  const powerText = document.getElementById("power-text");
  const toggleScreenBtn = document.getElementById("toggle-screen-btn");
  const popoutBtn = document.getElementById("popout-btn");
  const pillToggleCheck = document.getElementById("pill-toggle-check");

  let activeTabId = null;
  let currentHostname = "Current Website";
  let isTurnedOff = false;

  // 1. Check local server connection
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: "CHECK_SERVER" }, (res) => {
      if (res && res.online) {
        statusBadge.classList.remove("offline");
        statusText.textContent = `${res.total || 0} Online`;
      } else {
        statusBadge.classList.add("offline");
        statusText.textContent = "Offline (5001)";
      }
    });
  }

  // 2. Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    activeTabId = tab.id;
    try {
      const url = new URL(tab.url || "");
      currentHostname = url.hostname || "Webpage";
      siteDomain.textContent = currentHostname;
    } catch (e) {
      siteDomain.textContent = "Current Webpage";
    }

    // Request pathway status from active tab's content script
    chrome.tabs.sendMessage(activeTabId, { action: "GET_PATHWAY_STATUS" }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Content script might not be injected yet or page is a restricted browser URL
        checkStorageFallback();
        return;
      }
      updateUIWithStatus(response);
    });
  }

  function checkStorageFallback() {
    chrome.storage.local.get(["airnet_pathway_disabled_domains", "airnet_pathway_pill_visible"], (res) => {
      const disabledList = res.airnet_pathway_disabled_domains || [];
      const isOff = disabledList.includes(currentHostname);
      const isPillVisible = res.airnet_pathway_pill_visible !== false;
      updateUIWithStatus({
        isTurnedOff: isOff,
        isLauncherVisible: isPillVisible,
        hostname: currentHostname,
      });
    });
  }

  function updateUIWithStatus(status) {
    isTurnedOff = !!status.isTurnedOff;

    if (isTurnedOff) {
      siteStatusPill.className = "site-status-pill off";
      siteStatusPill.textContent = "Turned Off";
      siteDesc.textContent = "Pathway screen & corner launcher are disabled on this site.";

      powerToggleBtn.className = "btn-power-on";
      powerIcon.textContent = "⚡";
      powerText.textContent = "Turn ON Pathway on this Website";
    } else {
      siteStatusPill.className = "site-status-pill on";
      siteStatusPill.textContent = "Active";
      siteDesc.textContent = "Pathway screen & launcher pill are active.";

      powerToggleBtn.className = "btn-power-off";
      powerIcon.textContent = "⏻";
      powerText.textContent = "Turn OFF Pathway on this Website";
    }

    if (pillToggleCheck && status.isLauncherVisible !== undefined) {
      pillToggleCheck.checked = !!status.isLauncherVisible;
    }
  }

  // 3. Power Toggle: Turn OFF / ON
  powerToggleBtn.addEventListener("click", () => {
    if (!activeTabId) return;

    const action = isTurnedOff ? "TURN_ON_PATHWAY" : "TURN_OFF_PATHWAY";
    chrome.tabs.sendMessage(activeTabId, { action }, (res) => {
      if (chrome.runtime.lastError) {
        // Fallback: inject content script with turn-on action
        if (action === "TURN_ON_PATHWAY") {
          chrome.scripting.executeScript({
            target: { tabId: activeTabId },
            files: ["content.js"],
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTabId, { action: "TURN_ON_PATHWAY" });
            }, 200);
          });
        }
      }

      isTurnedOff = !isTurnedOff;
      updateUIWithStatus({
        isTurnedOff,
        isLauncherVisible: !isTurnedOff && pillToggleCheck.checked,
        hostname: currentHostname,
      });

      // Update stored disabled list
      chrome.storage.local.get(["airnet_pathway_disabled_domains"], (data) => {
        let list = data.airnet_pathway_disabled_domains || [];
        if (isTurnedOff) {
          if (!list.includes(currentHostname)) list.push(currentHostname);
        } else {
          list = list.filter((d) => d !== currentHostname);
        }
        chrome.storage.local.set({ airnet_pathway_disabled_domains: list });
      });
    });
  });

  // 4. Toggle Screen View Button
  toggleScreenBtn.addEventListener("click", () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { action: "TOGGLE_PATHWAY" }).catch(() => {
      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ["content.js"],
      });
    });
    window.close();
  });

  // 5. Standalone Popout Window
  popoutBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "OPEN_POPOUT" });
    window.close();
  });

  // 6. Corner Launcher Pill Toggle Checkbox
  if (pillToggleCheck) {
    pillToggleCheck.addEventListener("change", () => {
      const visible = pillToggleCheck.checked;
      chrome.storage.local.set({ airnet_pathway_pill_visible: visible });
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { action: "SET_LAUNCHER_VISIBLE", visible }).catch(() => {});
      }
    });
  }
});
