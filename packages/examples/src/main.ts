import type { NewsPassSegmentsReadyDetail } from "@newspassid-audience/sdk";

// Function to load the NewsPassID script
const script = document.createElement("script");
script.src = `${import.meta.env.VITE_CDN_URL}/newspassid-async.js`;
script.type = "module";
script.async = true;

// Add script to the document
const head = document.head;
head.appendChild(script);

// Publisher configuration
window.NEWSPASS_CONFIG = {
  namespace: "gmg",
  lambdaEndpoint: import.meta.env.VITE_API_URL,
  webhookEndpoint:
    "https://iurctgkecd66ixbevgm6vhppxy0ptojn.lambda-url.us-east-1.on.aws",
};

// DOM elements
const statusEl = document.getElementById("status") as HTMLDivElement;
const resultsEl = document.getElementById("results") as HTMLDivElement;
const getIdBtn = document.getElementById("get-id") as HTMLButtonElement;
const getSegmentsBtn = document.getElementById(
  "get-segments",
) as HTMLButtonElement;
const clearIdBtn = document.getElementById("clear-id") as HTMLButtonElement;
const setIdBtn = document.getElementById("manual-set-id") as HTMLButtonElement;

/**
 * Update status when NewsPassID is ready
 * TODO: This doesn't do anything, we should probably remove the event listener
 */
window.addEventListener("newspass_segments_ready", (event) => {
  statusEl.textContent = "NewsPassID is active and segments are loaded.";

  const { detail } = event as CustomEvent<NewsPassSegmentsReadyDetail>;
  console.info("newspass_segments_ready", detail);
});

// Check every second if NewsPassID is ready
const checkInterval = setInterval(() => {
  if (window.newspassid?.getID) {
    const id = window.newspassid.getID();
    if (id) {
      statusEl.textContent = "NewsPassID is active.";
      resultsEl.textContent = `Current ID: ${id}`;
      clearInterval(checkInterval);
    }
  }
}, 250);

// Button event handlers
getIdBtn.addEventListener("click", () => {
  if (window.newspassid?.getID) {
    const id = window.newspassid.getID();
    resultsEl.textContent = `Current ID: ${id ?? "No ID set"}`;
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

getSegmentsBtn.addEventListener("click", () => {
  if (window.newspassid?.getSegments) {
    const segments = window.newspassid.getSegments();
    resultsEl.textContent = `Segments: ${segments.length ? segments.join(", ") : "No segments"}`;
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

clearIdBtn.addEventListener("click", () => {
  if (window.newspassid?.clearID) {
    window.newspassid.clearID();
    resultsEl.textContent = "ID cleared.";
    statusEl.textContent = "ID cleared. Reload the page to generate a new one.";

    // Refresh ads after clearing ID
    googletag.cmd.push(() => {
      googletag.pubads().refresh();
    });
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

setIdBtn.addEventListener("click", () => {
  if (window.newspassid?.setID) {
    window.newspassid
      .setID(undefined, true)
      .then((id) => {
        resultsEl.textContent = `New ID set: ${id}`;
        updateResults();

        // Refresh ads after setting new ID
        googletag.cmd.push(() => {
          googletag.pubads().refresh();
        });
      })
      .catch((error: unknown) => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        resultsEl.textContent = `Error setting ID: ${error}`;
      });
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

// Helper to update results
function updateResults() {
  if (window.newspassid) {
    const id = window.newspassid.getID();
    const segments = window.newspassid.getSegments();
    resultsEl.textContent = "Current State:\n\n";
    resultsEl.textContent += `ID: ${id ?? "No ID set"}\n`;
    resultsEl.textContent += `Segments: ${segments.length ? segments.join(", ") : "No segments"}`;
  }
}
