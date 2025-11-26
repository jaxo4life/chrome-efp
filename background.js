let siteSettingsCache = {};

chrome.storage.sync.get({ siteSettings: {} }, ({ siteSettings }) => {
  siteSettingsCache = siteSettings;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.siteSettings) {
    siteSettingsCache = changes.siteSettings.newValue;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggle-site",
    title: "Disable EFP on this site",
    contexts: ["all"],
  });
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => {
    if (!tab || !tab.lastCommittedUrl) return;
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.lastCommittedUrl) {
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url;

  if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;

  updateMenuTitleFromUrl(url);
});

function updateMenuTitleFromUrl(url) {
  const site = new URL(url).origin;

  if (siteSettingsCache[site] === undefined) {
    siteSettingsCache[site] = true;
    chrome.storage.sync.set({ siteSettings: siteSettingsCache });
  }

  const disabled = siteSettingsCache[site] === false;

  chrome.contextMenus.update("toggle-site", {
    title: disabled ? "Enable EFP on this site" : "Disable EFP on this site",
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "toggle-site") return;

  const site = new URL(tab.url).origin;
  const disabled = siteSettingsCache[site] === false;

  siteSettingsCache[site] = disabled ? true : false;

  chrome.storage.sync.set({ siteSettings: siteSettingsCache }, () => {
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_BLOCK_MESSAGE",
      text: disabled ? "EFP Enabled on this site" : "EFP Disabled on this site",
    });
    setTimeout(() => {
      chrome.tabs.reload(tab.id);
    }, 1000);
  });
});
