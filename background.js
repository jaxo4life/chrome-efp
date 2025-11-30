let siteSettingsCache = {};
let isCacheReady = false;

// 初始化 siteSettingsCache
function initSiteSettingsCache() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ siteSettings: {} }, ({ siteSettings }) => {
      siteSettingsCache = siteSettings;
      isCacheReady = true;
      resolve();
    });
  });
}

// 更新 context menu 标题
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

// 当 storage 改变时更新缓存
chrome.storage.onChanged.addListener((changes) => {
  if (changes.siteSettings) {
    siteSettingsCache = changes.siteSettings.newValue;
  }
});

// 安装/更新时初始化 context menu 和默认站点设置
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
    // 只给“没有值的站点”设置默认值，不覆盖用户
    if (siteSettingsCache[site] === undefined) {
      siteSettingsCache[site] = false;
      changed = true;
    }
  }
  if (changed) {
    chrome.storage.local.set({ siteSettings: siteSettingsCache });
  }
});
// Tabs 激活时更新 context menu
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  if (!isCacheReady) await initSiteSettingsCache();
  chrome.tabs.get(tabId, (tab) => {
    if (!tab || !tab.lastCommittedUrl) return;
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  });
});
// Tabs 更新完成时更新 context menu
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!isCacheReady) await initSiteSettingsCache();
  if (changeInfo.status === "complete" && tab.lastCommittedUrl) {
    updateMenuTitleFromUrl(tab.lastCommittedUrl);
  }
});
// WebNavigation 完成时更新 context menu
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (!isCacheReady) await initSiteSettingsCache();
  if (details.frameId !== 0) return;
  const url = details.url;
  if (!url || url.startsWith("chrome://") || url.startsWith("about:")) return;
  updateMenuTitleFromUrl(url);
});

// context menu 点击事件
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

// 扩展启动时立即初始化缓存 
initSiteSettingsCache();