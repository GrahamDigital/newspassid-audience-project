/**
 * newspassid Async Loader
 *
 * This script loads asynchronously in the <head> and initializes newspassid
 * without blocking page rendering.
 */

import type { NewsPassConfig } from "../core/types";

// Retrieve configuration from global variable or use default
const NEWSPASS_CONFIG: NewsPassConfig = window.NEWSPASS_CONFIG ?? {
  namespace: "default-publisher",
  // lambdaEndpoint: "https://npid.gmg.io/newspassid",
  lambdaEndpoint: import.meta.env.VITE_API_URL.slice(0, -1),
};

// Initialize the queue and newspassid global object
window.newspassid_q = window.newspassid_q ?? [];

// Function to load the newspassid script
(function () {
  // Create script element
  const script = document.createElement("script");
  script.src =
    import.meta.env.VITE_STAGE === "production"
      ? "https://npid.gmg.io/examples/newspassid.js"
      : import.meta.env.VITE_STAGE === "dev"
        ? "https://npid-dev.gmg.io/examples/newspassid.js"
        : "http://localhost:3000/newspassid.js";
  script.type = "module";
  script.async = true;

  // Set up onload handler to initialize and process queue
  script.onload = function () {
    // Create the real newspassid instance
    let createNewsPassIDFn;

    // Check for both ways the function might be exposed
    if (typeof window.createNewsPassID === "function") {
      createNewsPassIDFn = window.createNewsPassID;
    } else if (
      window.NewsPassID &&
      typeof window.NewsPassID.createNewsPassID === "function"
    ) {
      createNewsPassIDFn = window.NewsPassID.createNewsPassID;
    } else {
      console.error("newspassid: createNewsPassID function not found");
      return;
    }

    const realNewsPassID = createNewsPassIDFn(NEWSPASS_CONFIG);

    // Process any queued commands
    const queue = window.newspassid_q;
    if (!queue) return;

    // Set immediate ID if available from localStorage to prevent flicker
    // This happens immediately without waiting for backend communication
    const storedId = getStoredId();
    if (storedId) {
      // Just set in memory, no API call
      window.newspass_segments = [];
    }

    // Process all commands in the queue
    while (queue.length > 0) {
      const item = queue.shift();
      if (item && item.length > 0) {
        const method = item[0] as keyof typeof realNewsPassID;
        const params = item.slice(1);

        // Execute the method if it exists
        if (typeof realNewsPassID[method] === "function") {
          try {
            // Handle different method types appropriately
            if (method === "setID") {
              void realNewsPassID.setID(params[0] as string | undefined);
            } else if (method === "getID") {
              void realNewsPassID.getID();
            } else if (method === "getSegments") {
              void realNewsPassID.getSegments();
            } else if (method === "getSegmentsAsKeyValue") {
              void realNewsPassID.getSegmentsAsKeyValue();
            } else {
              realNewsPassID.clearID();
            }
          } catch (e) {
            console.error("newspassid: Error executing queued command", e);
          }
        }
      }
    }

    // Replace stub with real implementation
    window.newspassid = realNewsPassID;

    // Call setID by default if not explicitly called before
    // But do this with a slight delay to let the page load first
    if (!window.newspass_initialized) {
      setTimeout(() => {
        void realNewsPassID.setID();
        window.newspass_initialized = true;
      }, 50);
    }
  };

  // Handle script loading failure
  script.onerror = function () {
    console.warn("newspassid: Failed to load script");
  };

  // Helper function to get stored ID from localStorage
  function getStoredId(): string | null {
    try {
      return localStorage.getItem(NEWSPASS_CONFIG.storageKey ?? "newspassid");
    } catch (e) {
      console.error("newspassid: Error getting stored ID", e);
      return null;
    }
  }

  // Add script to the document
  const head = document.head;
  head.appendChild(script);

  // Set a flag to track initialization state
  window.newspass_initialized = false;
})();
