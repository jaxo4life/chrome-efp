let featureEnabled = true;

const AGGRESSIVE_MODE_SITES = ["poap.xyz"];

function isAggressiveModeSite() {
  const hostname = window.location.hostname;
  return AGGRESSIVE_MODE_SITES.some((site) => hostname.includes(site));
}

const useAggressiveMode = isAggressiveModeSite();

const ENS_REGEX = /((?:[\p{L}\p{N}\p{M}\p{S}\u200d\ufe0f-]+\.)+)(eth|box)/giu;
const ETH_ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/;
const GLOBAL_REGEX = new RegExp(
  `${ENS_REGEX.source}|${ETH_ADDRESS_REGEX.source}`,
  "giu"
);

chrome.storage.sync.get({ siteSettings: {} }, ({ siteSettings }) => {
  const site = location.origin;
  if (siteSettings[site] === false) return;

  chrome.storage.sync.get({ enabled: true }, ({ enabled }) => {
    featureEnabled = enabled;
    if (featureEnabled) startObserver();
  });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    featureEnabled = changes.enabled.newValue;
    if (featureEnabled) startObserver();
    else cleanupMarkers();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SHOW_BLOCK_MESSAGE") {
    showBlockedMessage(message.text);
  }
});

function showBlockedMessage(text) {
  const box = document.createElement("div");
  box.textContent = text;
  box.style.position = "fixed";
  box.style.top = "50%";
  box.style.left = "50%";
  box.style.transform = "translate(-50%, -50%)";
  box.style.padding = "16px 32px";
  box.style.background = "linear-gradient(135deg, #4facfe, #00f2fe)";
  box.style.color = "rgba(255, 255, 255, 0.85)";
  box.style.fontSize = "18px";
  box.style.fontWeight = "600";
  box.style.borderRadius = "16px";
  box.style.zIndex = "999999999";
  box.style.backdropFilter = "blur(6px)";
  box.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
  box.style.textAlign = "center";
  box.style.transition = "transform 0.3s ease, opacity 0.3s ease";
  box.style.opacity = "0";

  document.body.appendChild(box);
  requestAnimationFrame(() => {
    box.style.transform = "translate(-50%, -50%) scale(1.05)";
    box.style.opacity = "1";
  });

  setTimeout(() => {
    box.style.transform = "translate(-50%, -50%) scale(0.9)";
    box.style.opacity = "0";
    setTimeout(() => box.remove(), 300);
  }, 2000);
}

function normalizeENS(text) {
  return text.replace(/^[*•\-—·\s]+/, "");
}

let currentIframe = null;
const processedNodes = new WeakSet();

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
        if (!useAggressiveMode) {
          m.addedNodes.forEach((n) => {
            if (
              n.nodeType === Node.TEXT_NODE ||
              n.nodeType === Node.ELEMENT_NODE
            ) {
              processedNodes.delete(n);
            }
          });
        }
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

// ==================== Safe Mode ====================

function getTextInRange(startNode, endNode) {
  let text = "";
  let currentNode = startNode;
  while (currentNode && currentNode !== endNode.nextSibling) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      text += currentNode.textContent;
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      if (!["SCRIPT", "STYLE", "NOSCRIPT"].includes(currentNode.tagName)) {
        text += getTextInRange(
          currentNode.firstChild,
          currentNode.lastChild || currentNode
        );
      }
    }
    currentNode = currentNode.nextSibling;
  }
  return text;
}

function scanVisibleAreaConservative() {
  const viewportHeight = window.innerHeight;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  const nodes = [];
  let node;

  while ((node = walker.nextNode())) {
    if (!isAllowedNode(node)) continue;
    if (processedNodes.has(node)) continue;
    if (!node.parentNode) continue;
    if (node.parentNode.closest(".ens-detected")) continue;

    const rect = node.parentNode.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewportHeight) continue;

    nodes.push(node);
  }

  nodes.forEach(processTextNode);

  for (let i = 0; i < nodes.length - 1; i++) {
    tryProcessCrossNodeMatch(nodes[i], nodes[i + 1]);
  }
}

function tryProcessCrossNodeMatch(node1, node2) {
  const combined = node1.textContent + node2.textContent;
  GLOBAL_REGEX.lastIndex = 0;
  const match = GLOBAL_REGEX.exec(combined);

  if (!match) return;

  const matchText = normalizeENS(match[0]);
  const len1 = node1.textContent.length;

  if (match.index < len1 && match.index + match[0].length > len1) {
    markCrossNodeMatch(node1, node2, match.index, matchText);
    processedNodes.add(node1);
    processedNodes.add(node2);
  }
}

function markCrossNodeMatch(node1, node2, startOffset, text) {
  const parent1 = node1.parentNode;
  const parent2 = node2.parentNode;

  if (!parent1 || !parent2) return;

  const markId = "ens-" + Math.random().toString(36).substr(2, 9);

  const attr1 = parent1.getAttribute("data-ens-start");
  parent1.setAttribute("data-ens-start", (attr1 || "") + " " + markId);
  parent1.classList.add("ens-detected-parent");

  const attr2 = parent2.getAttribute("data-ens-end");
  parent2.setAttribute("data-ens-end", (attr2 || "") + " " + markId);
  parent2.classList.add("ens-detected-parent");

  parent1.dataset[markId] = JSON.stringify({
    value: text,
    type: ENS_REGEX.test(text) ? "ens" : "address",
    markId: markId,
  });
}

function processTextNode(textNode) {
  if (!isAllowedNode(textNode)) return;
  if (processedNodes.has(textNode)) return;

  const text = textNode.textContent;
  const parent = textNode.parentNode;
  if (!parent) return;

  const matches = [];
  GLOBAL_REGEX.lastIndex = 0;
  let match;

  while ((match = GLOBAL_REGEX.exec(text)) !== null) {
    matches.push(match);
  }

  if (matches.length === 0) {
    processedNodes.add(textNode);
    return;
  }

  const frag = document.createDocumentFragment();
  let last = 0;

  matches.forEach((match) => {
    if (match.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, match.index)));
    }

    const span = document.createElement("span");
    span.className = "ens-detected";

    const cleaned = normalizeENS(match[0]);
    span.textContent = cleaned;
    span.dataset.value = cleaned;
    span.dataset.type = ENS_REGEX.test(cleaned) ? "ens" : "address";

    span.style.cursor = "pointer";
    span.style.textDecoration = "underline";
    span.style.textDecorationStyle = "dotted";

    frag.appendChild(span);
    last = match.index + match[0].length;
  });

  if (last < text.length) {
    frag.appendChild(document.createTextNode(text.slice(last)));
  }

  parent.replaceChild(frag, textNode);
  processedNodes.add(textNode);
}

// ==================== Full Mode ====================

function collectTextNodes(parent) {
  const nodes = [];
  let mergedText = "";

  parent.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      nodes.push(child);
      mergedText += child.textContent;
    } else if (
      child.nodeType === Node.ELEMENT_NODE &&
      !child.classList.contains("ens-detected")
    ) {
      if (
        child.childNodes.length === 1 &&
        child.firstChild.nodeType === Node.TEXT_NODE
      ) {
        nodes.push(child.firstChild);
        mergedText += child.textContent;
      }
    }
  });

  return { nodes, text: mergedText };
}

function scanVisibleAreaAggressive() {
  const viewportHeight = window.innerHeight;

  const all = document.querySelectorAll("body *:not(.ens-detected)");

  all.forEach((el) => {
    if (!el.childNodes || el.childNodes.length === 0) return;

    const rect = el.getBoundingClientRect();
    if (rect.bottom < -20 || rect.top > viewportHeight + 20) return;

    const { nodes, text } = collectTextNodes(el);
    if (!nodes.length) return;

    if (GLOBAL_REGEX.test(text)) {
      wrapMergedNodes(nodes, text, el);
    }
  });
}

function wrapMergedNodes(nodes, fullText, parent) {
  const frag = document.createDocumentFragment();
  let lastIndex = 0;

  fullText.replace(GLOBAL_REGEX, (match, _g1, _g2, offset) => {
    if (offset > lastIndex) {
      frag.appendChild(
        document.createTextNode(fullText.slice(lastIndex, offset))
      );
    }

    const cleaned = normalizeENS(match);
    const span = document.createElement("span");
    span.className = "ens-detected";
    span.textContent = cleaned;
    span.dataset.value = cleaned;
    span.dataset.type = ENS_REGEX.test(cleaned) ? "ens" : "address";

    span.style.cursor = "pointer";
    span.style.textDecoration = "underline dotted";

    frag.appendChild(span);
    lastIndex = offset + match.length;
  });

  if (lastIndex < fullText.length) {
    frag.appendChild(document.createTextNode(fullText.slice(lastIndex)));
  }

  parent.replaceChildren(frag);
}

function scanVisibleArea() {
  if (useAggressiveMode) {
    scanVisibleAreaAggressive();
  } else {
    scanVisibleAreaConservative();
  }
}

// ==================== General ====================

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

  if (currentIframe && currentIframe.contains(e.target)) return;
  if (e.target.classList.contains("ens-detected")) return;

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

  if (newX < margin) newX = margin;

  if (newY + height > viewportHeight - margin) {
    newY = y - height - 18;
  }

  if (newY < margin) newY = margin;

  return { x: newX, y: newY };
}

function cleanupMarkers() {
  document.querySelectorAll(".ens-detected").forEach((el) => {
    el.replaceWith(document.createTextNode(el.textContent));
  });

  document.querySelectorAll(".ens-detected-parent").forEach((el) => {
    el.removeAttribute("data-ens-start");
    el.removeAttribute("data-ens-end");
    el.classList.remove("ens-detected-parent");
    Object.keys(el.dataset).forEach((k) => {
      if (k.startsWith("ens-")) delete el.dataset[k];
    });
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
