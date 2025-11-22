const toggle = document.getElementById("toggle");

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  toggle.checked = enabled;
});

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked });
});

const helpIcon = document.getElementById("help");
const tooltip = document.getElementById("tooltip");

helpIcon.addEventListener("click", () => {
  tooltip.style.display = tooltip.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", (e) => {
  if (!helpIcon.contains(e.target) && !tooltip.contains(e.target)) {
    tooltip.style.display = "none";
  }
});
