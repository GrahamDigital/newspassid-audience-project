// Function to load the NewsPassID script
// Create script element
const script = document.createElement("script");
script.src = ["production", "dev"].includes(import.meta.env.VITE_STAGE)
  ? `${import.meta.env.VITE_CDN_URL}/newspassid-async.js`
  : "http://localhost:3000/newspassid-async.js";
script.type = "module";
script.async = true;

// Add script to the document
const head = document.head;
head.appendChild(script);

// Publisher configuration
window.NEWSPASS_CONFIG = {
  namespace: "gmg",
  lambdaEndpoint: ["production", "dev"].includes(import.meta.env.VITE_STAGE)
    ? import.meta.env.VITE_API_URL
    : `${import.meta.env.VITE_API_URL}newspassid`,
};

// Initialize the queue and NewsPassID global object
window.NewsPassIDQ = window.NewsPassIDQ ?? [];

// DOM elements
const statusEl = document.getElementById("status") as HTMLDivElement;
const resultsEl = document.getElementById("results") as HTMLDivElement;
const getIdBtn = document.getElementById("get-id") as HTMLButtonElement;
const getSegmentsBtn = document.getElementById(
  "get-segments",
) as HTMLButtonElement;
const clearIdBtn = document.getElementById("clear-id") as HTMLButtonElement;
const setIdBtn = document.getElementById("manual-set-id") as HTMLButtonElement;

// Update status when NewsPassID is ready
window.addEventListener("newspassSegmentsReady", function () {
  statusEl.textContent = "NewsPassID is active and segments are loaded.";
  updateResults();
  // window.googletag = window.googletag ?? { cmd: [] };

  // Refresh ads when segments are ready
  googletag.cmd.push(function () {
    googletag.pubads().refresh();
  });
});

// Check every second if NewsPassID is ready
const checkInterval = setInterval(function () {
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
getIdBtn.addEventListener("click", function () {
  if (window.newspassid?.getID) {
    const id = window.newspassid.getID();
    resultsEl.textContent = `Current ID: ${id ?? "No ID set"}`;
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

getSegmentsBtn.addEventListener("click", function () {
  if (window.newspassid?.getSegments) {
    const segments = window.newspassid.getSegments();
    resultsEl.textContent = `Segments: ${segments.length ? segments.join(", ") : "No segments"}`;
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

clearIdBtn.addEventListener("click", function () {
  if (window.newspassid?.clearID) {
    window.newspassid.clearID();
    resultsEl.textContent = "ID cleared.";
    statusEl.textContent = "ID cleared. Reload the page to generate a new one.";

    // Refresh ads after clearing ID
    googletag.cmd.push(function () {
      googletag.pubads().refresh();
    });
  } else {
    resultsEl.textContent = "NewsPassID not ready yet.";
  }
});

setIdBtn.addEventListener("click", function () {
  if (window.newspassid?.setID) {
    window.newspassid
      .setID(undefined, undefined, true)
      .then(function (id) {
        resultsEl.textContent = `New ID set: ${id}`;
        updateResults();

        // Refresh ads after setting new ID
        googletag.cmd.push(function () {
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
