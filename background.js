let siteSettingsCache = {};
let isCacheReady = false;

function initSiteSettingsCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ siteSettings: {} }, ({ siteSettings }) => {
      siteSettingsCache = siteSettings;
      isCacheReady = true;
      resolve();
    });
  });
}

function updateMenuTitleFromUrl(url) {
  const site = new URL(url).origin;

  if (siteSettingsCache[site] === undefined) {
    siteSettingsCache[site] = true;
    chrome.storage.local.set({ siteSettings: siteSettingsCache });
  }

  const disabled = siteSettingsCache[site] === false;

  chrome.contextMenus.update("toggle-site", {
    title: disabled ? "Enable EFP on this site" : "Disable EFP on this site",
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.siteSettings) {
    siteSettingsCache = changes.siteSettings.newValue;
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  await initSiteSettingsCache();

  chrome.contextMenus.create({
    id: "toggle-site",
    title: "Disable EFP on this site",
    contexts: ["all"],
  });

  const defaultSites = ["https://efp.app", "https://etherscan.io"];
  let changed = false;

  for (const site of defaultSites) {
    if (siteSettingsCache[site] === undefined) {
      siteSettingsCache[site] = false;
      changed = true;
    }
  }

  if (changed) {
    chrome.storage.local.set({ siteSettings: siteSettingsCache });
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!isCacheReady) await initSiteSettingsCache();
  chrome.tabs.get(tabId, (tab) => {
    if (!tab || !tab.lastCommittedUrl) return;
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
  if (info.menuItemId !== "toggle-site") return;

  const site = new URL(tab.url).origin;
  const disabled = siteSettingsCache[site] === false;

  siteSettingsCache[site] = disabled ? true : false;

  chrome.storage.local.set({ siteSettings: siteSettingsCache }, () => {
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_BLOCK_MESSAGE",
      text: disabled ? "EFP Enabled on this site" : "EFP Disabled on this site",
    });
    setTimeout(() => {
      chrome.tabs.reload(tab.id);
    }, 1000);
  });
});

initSiteSettingsCache();
