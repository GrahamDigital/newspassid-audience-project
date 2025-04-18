/**
 * newspassid Async Loader
 *
 * This script loads asynchronously in the <head> and initializes newspassid
 * without blocking page rendering.
 */

import { NewsPassConfig } from '../core/types';

// Retrieve configuration from global variable or use default
const NEWSPASS_CONFIG: NewsPassConfig = (window as any).NEWSPASS_CONFIG || {
  namespace: 'default-publisher',
  lambdaEndpoint: 'https://npid.gmg.io/newspassid',
};

// Initialize the queue and newspassid global object
window.newspassid_q = window.newspassid_q || [];
window.newspassid = window.newspassid || {
  // Stub method that queues calls until the real implementation loads
  setID: function (id?: string): Promise<string> {
    window.newspassid_q!.push(['setID', id]);
    return Promise.resolve(id || '');
  },
  // Other stub methods
  getID: function (): null {
    window.newspassid_q!.push(['getID']);
    return null;
  },
  getSegments: function (): string[] {
    window.newspassid_q!.push(['getSegments']);
    return [];
  },
  getSegmentsAsKeyValue: function (): Record<string, string> {
    window.newspassid_q!.push(['getSegmentsAsKeyValue']);
    return {};
  },
  clearID: function (): void {
    window.newspassid_q!.push(['clearID']);
  },
};

// Function to load the newspassid script
(function () {
  // Create script element
  const script = document.createElement('script');
  script.src = 'http://localhost:3000/dist/newspassid.min.js';
  script.async = true;

  // Set up onload handler to initialize and process queue
  script.onload = function () {
    // Create the real newspassid instance
    let createNewsPassIDFn;

    // Check for both ways the function might be exposed
    if (typeof window.createNewsPassID === 'function') {
      createNewsPassIDFn = window.createNewsPassID;
    } else if (window.NewsPassID && typeof window.NewsPassID.createNewsPassID === 'function') {
      createNewsPassIDFn = window.NewsPassID.createNewsPassID;
    } else {
      console.error('newspassid: createNewsPassID function not found');
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
        if (typeof realNewsPassID[method] === 'function') {
          try {
            (realNewsPassID[method] as Function).apply(realNewsPassID, params);
          } catch (e) {
            console.error('newspassid: Error executing queued command', e);
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
        realNewsPassID.setID();
        window.newspass_initialized = true;
      }, 50);
    }
  };

  // Handle script loading failure
  script.onerror = function () {
    console.warn('newspassid: Failed to load script');
  };

  // Helper function to get stored ID from localStorage
  function getStoredId(): string | null {
    try {
      return localStorage.getItem(NEWSPASS_CONFIG.storageKey || 'newspassid');
    } catch (e) {
      return null;
    }
  }

  // Add script to the document
  const head = document.head || document.getElementsByTagName('head')[0];
  head.appendChild(script);

  // Set a flag to track initialization state
  window.newspass_initialized = false;
})();
