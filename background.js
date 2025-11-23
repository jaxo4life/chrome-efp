chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toggle-site",
    title: "Disable EFP on this site",
    contexts: ["all"],
  });
});

chrome.tabs.onActivated.addListener(updateMenuTitle);
chrome.tabs.onUpdated.addListener(updateMenuTitle);

function updateMenuTitle() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) return;
    const tab = tabs[0];

    if (!tab.url) return;

    const site = new URL(tab.url).origin;

    chrome.storage.sync.get({ siteSettings: {} }, ({ siteSettings }) => {
      if (siteSettings[site] === undefined) {
        siteSettings[site] = true;
        chrome.storage.sync.set({ siteSettings });
      }
      const disabled = siteSettings[site] === false;

      chrome.contextMenus.update("toggle-site", {
        title: disabled
          ? "Enable EFP on this site"
          : "Disable EFP on this site",
      });
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "toggle-site") return;

  const site = new URL(tab.url).origin;

  chrome.storage.sync.get({ siteSettings: {} }, ({ siteSettings }) => {
    const disabled = siteSettings[site] === false;
    siteSettings[site] = disabled ? true : false;

    chrome.storage.sync.set({ siteSettings }, () => {
      chrome.tabs.reload(tab.id);
    });

    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_BLOCK_MESSAGE",
      text: disabled ? "EFP Enabled on this site" : "EFP Disabled on this site",
    });
  });
});
