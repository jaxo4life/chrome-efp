let featureEnabled = true;

chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
  featureEnabled = enabled;
  if (enabled) startObserver();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    featureEnabled = changes.enabled.newValue;
    if (featureEnabled) startObserver();
    else cleanupMarkers();
  }
});

const ENS_REGEX = /([\p{L}\p{N}\p{M}\p{S}\u200d\ufe0f]+)\.(eth|xyz|box)/giu;
const ETH_ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/;
const GLOBAL_REGEX = new RegExp(
  `${ENS_REGEX.source}|${ETH_ADDRESS_REGEX.source}`,
  "giu"
);

function normalizeENS(text) {
  return text.replace(/^[\*\•\-\—\·\s]+/, "");
}

let currentIframe = null;

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

const debouncedScan = debounce(() => {
  if (!featureEnabled) return;
  scanVisibleArea();
}, 200);

function startObserver() {
  scanVisibleArea();

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        debouncedScan();
        break;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  window.addEventListener("scroll", debouncedScan, { passive: true });
  window.addEventListener("resize", debouncedScan, { passive: true });
}

function scanVisibleArea() {
  const viewportHeight = window.innerHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  const nodes = [];
  let node;

  while ((node = walker.nextNode())) {
    if (!isAllowedNode(node)) continue;

    if (!node.parentNode) continue;

    if (node.parentNode.closest(".ens-detected")) continue;

    const rect = node.parentNode.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > viewportHeight) continue;

    if (GLOBAL_REGEX.test(node.textContent)) {
      nodes.push(node);
    }
  }

  nodes.forEach(wrapMatches);
}

function wrapMatches(textNode) {
  if (!isAllowedNode(textNode)) return;

  const text = textNode.textContent;
  const parent = textNode.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  let last = 0;

  text.replace(GLOBAL_REGEX, (match, _g1, _g2, offset) => {
    if (offset > last) {
      frag.appendChild(document.createTextNode(text.slice(last, offset)));
    }

    const span = document.createElement("span");
    span.className = "ens-detected";

    const cleaned = normalizeENS(match);
    span.textContent = cleaned;
    span.dataset.value = cleaned;

    span.dataset.type = ENS_REGEX.test(cleaned) ? "ens" : "address";

    span.style.cursor = "pointer";
    span.style.textDecoration = "underline";
    span.style.textDecorationStyle = "dotted";

    frag.appendChild(span);
    last = offset + match.length;
  });

  if (last < text.length) {
    frag.appendChild(document.createTextNode(text.slice(last)));
  }

  parent.replaceChild(frag, textNode);
}

document.addEventListener("mouseover", (e) => {
  if (!featureEnabled) return;

  const target = e.target;
  if (!target.classList.contains("ens-detected")) return;

  const rect = target.getBoundingClientRect();

  showProfileCard({
    value: target.dataset.value,
    type: target.dataset.type,
    x: rect.left + window.scrollX,
    y: rect.bottom + window.scrollY + 6,
  });
});

document.addEventListener("click", (e) => {
  if (!featureEnabled) return;

  if (currentIframe && currentIframe.contains(e.target)) {
    return;
  }

  if (e.target.classList.contains("ens-detected")) {
    return;
  }

  removeIframe();
});

function showProfileCard(data) {
  removeIframe();

  const iframe = document.createElement("iframe");
  iframe.id = "ens-profile-iframe";
  iframe.src = chrome.runtime.getURL("iframe.html");

  const { x, y } = positionIframe(data.x, data.y);

  iframe.style.position = "absolute";
  iframe.style.width = "420px";
  iframe.style.height = "500px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow =
    "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)";
  iframe.style.zIndex = "999999";
  iframe.style.backgroundColor = "white";
  iframe.style.left = `${x}px`;
  iframe.style.top = `${y}px`;

  document.body.appendChild(iframe);
  currentIframe = iframe;

  iframe.addEventListener("load", () => {
    iframe.contentWindow.postMessage(
      {
        action: "RENDER_PROFILE",
        payload: data,
      },
      "*"
    );
  });
}

function removeIframe() {
  if (currentIframe) {
    currentIframe.remove();
    currentIframe = null;
  }
}

function positionIframe(x, y, width = 420, height = 500) {
  const margin = 12;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let newX = x;
  let newY = y;

  if (newX + width > viewportWidth - margin) {
    newX = viewportWidth - width - margin;
  }

  if (newX < margin) {
    newX = margin;
  }

  if (newY + height > viewportHeight - margin) {
    newY = y - height - 18;
  }

  if (newY < margin) {
    newY = margin;
  }

  return { x: newX, y: newY };
}

function cleanupMarkers() {
  document.querySelectorAll(".ens-detected").forEach((el) => {
    el.replaceWith(document.createTextNode(el.textContent));
  });
  removeIframe();
}

function isAllowedNode(node) {
  if (!node.parentNode) return false;

  const p = node.parentNode;

  if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(p.tagName)) return false;
  if (p.getAttribute("type") === "speculationrules") return false;

  return true;
}
