const ENS_REGEX = /([\p{L}\p{N}\p{M}\p{So}\p{Sk}_-]+)\.(eth|xyz|box)/iu;
const ETH_ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/;

let currentIframe = null;

document.addEventListener("mouseup", (event) => {
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) {
      removeIframe();
      return;
    }

    const isENS = ENS_REGEX.test(selectedText);
    const isAddress = ETH_ADDRESS_REGEX.test(selectedText);

    if (isENS || isAddress) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      showProfileCard({
        value: selectedText,
        type: isENS ? "ens" : "address",
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 10,
      });
    } else {
      removeIframe();
    }
  }, 10);
});

function showProfileCard(data) {
  removeIframe();

  const iframe = document.createElement("iframe");
  iframe.id = "ens-profile-iframe";
  iframe.src = window.chrome.runtime.getURL("iframe.html");

  iframe.style.position = "absolute";
  iframe.style.left = `${data.x}px`;
  iframe.style.top = `${data.y}px`;
  iframe.style.width = "420px";
  iframe.style.height = "500px";
  iframe.style.maxHeight = "80vh";
  iframe.style.border = "none";
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow =
    "0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)";
  iframe.style.zIndex = "999999";
  iframe.style.backgroundColor = "white";

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const iframeWidth = 420;
  const iframeHeight = 500;

  let x = data.x;
  let y = data.y;

  if (x + iframeWidth > viewportWidth) {
    x = viewportWidth - iframeWidth - 20;
  }

  if (y + iframeHeight > viewportHeight) {
    y = data.y - iframeHeight - 30;
  }

  iframe.style.left = `${Math.max(10, x)}px`;
  iframe.style.top = `${Math.max(10, y)}px`;

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

window.addEventListener("message", (event) => {
  if (event.data.action === "CLOSE_POPUP") {
    removeIframe();
  }
});

document.addEventListener("click", (event) => {
  if (currentIframe && !currentIframe.contains(event.target)) {
    removeIframe();
  }
});
