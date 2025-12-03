let siteSettingsCache = {};
let isCacheReady = false;
let isInitializing = false;

async function initSiteSettingsCache() {
  if (isCacheReady || isInitializing) return;
  isInitializing = true;

  return new Promise((resolve) => {
    chrome.storage.local.get("siteSettings", (data) => {
      const stored = data?.siteSettings;

      if (stored && typeof stored === "object") {
        siteSettingsCache = stored;
      } else {
        siteSettingsCache = {};
      }

      isCacheReady = true;
      isInitializing = false;
      resolve();
    });
  });
}

function safeWriteSiteSettings() {
  if (!isCacheReady) return;

  const keys = Object.keys(siteSettingsCache);
  if (keys.length === 0) {
    chrome.storage.local.remove("siteSettings");
    return;
  }

  chrome.storage.local.set({ siteSettings: { ...siteSettingsCache } });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.siteSettings) {
    const newValue = changes.siteSettings.newValue;
    if (newValue && typeof newValue === "object") {
      siteSettingsCache = newValue;
    }
  }
});

function updateMenuTitleFromUrl(url) {
  if (!isCacheReady) return;

  const site = new URL(url).origin;

  const enabled = siteSettingsCache[site] === true;

  chrome.contextMenus.update("toggle-site", {
    title: enabled ? "Disable EFP on this site" : "Enable EFP on this site",
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await initSiteSettingsCache();

  chrome.contextMenus.create({
    id: "toggle-site",
    title: "Enable EFP on this site",
    contexts: ["page"],
    documentUrlPatterns: ["http://*/*", "https://*/*"],
  });
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!isCacheReady) await initSiteSettingsCache();

  chrome.tabs.get(tabId, (tab) => {
    if (!tab?.lastCommittedUrl) return;
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  });
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isCacheReady) await initSiteSettingsCache();

  if (changeInfo.status === "complete" && tab.lastCommittedUrl) {
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  }
});

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (!isCacheReady) await initSiteSettingsCache();

  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;

  updateMenuTitleFromUrl(url);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "toggle-site" || !isCacheReady) return;

  const site = new URL(tab.url).origin;
  const currentlyEnabled = siteSettingsCache[site] === true;

  if (currentlyEnabled) {
    delete siteSettingsCache[site];
  } else {
    siteSettingsCache[site] = true;
  }

  safeWriteSiteSettings();

  chrome.tabs.sendMessage(tab.id, {
    type: "SHOW_BLOCK_MESSAGE",
    text: currentlyEnabled ? "EFP Disabled on this site" : "EFP Enabled on this site",
  });

  setTimeout(() => chrome.tabs.reload(tab.id), 800);
});

initSiteSettingsCache();
