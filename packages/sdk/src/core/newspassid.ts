/**
 * NewsPassID main implementation
 */
import { sendToBackend } from "../utils/network";
import { generateId } from "../utils/random";
import { getStoredId, storeId } from "../utils/storage";
import { getGppConsentString } from "./gpp-api";
import type {
  IdPayload,
  NewsPassConfig,
  NewsPassID,
  NewsPassSegmentsReadyDetail,
  SegmentKeyValue,
  SegmentResponse,
} from "./types";

export class NewsPassIDImpl {
  private config: NewsPassConfig;
  private segments: string[] = [];
  private consentString?: string;
  private segmentKeyValue: SegmentKeyValue = {};

  constructor(config: NewsPassConfig) {
    this.config = {
      ...config,
      storageKey: config.storageKey ?? "newspassid",
      injectMetaTags: config.injectMetaTags !== false, // default to true
    };

    console.info(`newspassid initialized with namespace: ${config.namespace}`);
  }

  /**
   * Set or create a NewsPassID
   * @param id Optional ID to use
   * @returns Promise resolving to the ID
   */
  async setID(id?: string, generateNewId?: boolean): Promise<string> {
    const storageKey = this.config.storageKey ?? "newspassid";
    const storedId = getStoredId(storageKey);

    let userId = id ?? storedId;
    if (generateNewId || !userId) {
      userId = this.generateId();
    }

    if (userId !== storedId) {
      storeId(storageKey, userId);

      // Dispatch event to notify that ID has changed
      window.dispatchEvent(
        new CustomEvent("newspassid:change", {
          detail: { id: userId },
        }),
      );
    }

    // Get consent string
    try {
      this.consentString = await getGppConsentString();
      console.info("newspassid: Consent string:", this.consentString);
    } catch (error) {
      console.warn("newspassid: Failed to get GPP consent:", error);
      this.consentString = "";
    }

    // Create payload for backend
    const payload: IdPayload = {
      id: userId,
      timestamp: Date.now(),
      url: window.location.href,
      consentString: this.consentString ?? "",
    };

    try {
      const response = await sendToBackend(this.config.lambdaEndpoint, payload);

      // Set segments from response or use publisher segments if provided
      if (Array.isArray(response.segments)) {
        this.segments = response.segments;
      } else {
        this.segments = [];
      }

      // Convert segments to key-value pairs
      this.segmentKeyValue = this.convertSegmentsToKeyValue(this.segments);

      // Apply segments to page
      this.applySegmentsToPage(this.segments);

      // Inject meta tags if enabled
      if (this.config.injectMetaTags) {
        this.injectSegmentMetaTags();
      }

      // Dispatch event to notify that segments are ready
      window.dispatchEvent(
        new CustomEvent("newspass_segments_ready", {
          detail: {
            segments: this.segments,
            segmentKeyValue: this.segmentKeyValue,
          },
        }),
      );
    } catch (error) {
      console.error("newspassid: Failed to send ID to backend:", error);

      // Inject meta tags if enabled
      if (this.config.injectMetaTags) {
        this.injectSegmentMetaTags();
      }
    }

    return userId;
  }

  /**
   * Get the current NewsPassID
   */
  getID(): string | null {
    const storageKey = this.config.storageKey ?? "newspassid";
    return getStoredId(storageKey);
  }

  /**
   * Get segments associated with this ID
   */
  getSegments(): string[] {
    return [...this.segments];
  }

  /**
   * Clear the stored ID
   */
  clearID(): void {
    try {
      const storageKey = this.config.storageKey ?? "newspassid";
      localStorage.removeItem(storageKey);
      this.segments = [];
      this.segmentKeyValue = {};
      this.removeSegmentMetaTags();
      console.info("newspassid: ID cleared successfully");
    } catch (e) {
      console.warn("newspassid: Unable to remove from localStorage:", e);
    }
  }

  /**
   * Generate a new random ID
   */
  private generateId(): string {
    return generateId(this.config.namespace);
  }

  /**
   * Convert segment array to key-value pairs
   */
  private convertSegmentsToKeyValue(segments: string[]): SegmentKeyValue {
    return segments.reduce<SegmentKeyValue>((acc, segment) => {
      // Convert segment to lowercase and replace non-alphanumeric chars with underscore
      const key = segment.toLowerCase().replace(/[^a-z0-9]/g, "_");
      acc[key] = segment;
      return acc;
    }, {});
  }

  /**
   * Inject segment meta tags into the document head
   */
  private injectSegmentMetaTags(): void {
    // Remove any existing meta tags first
    this.removeSegmentMetaTags();

    // Add new meta tags for each segment
    Object.entries(this.segmentKeyValue).forEach(([key, value]) => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", `newspass_segment_${key}`);
      meta.setAttribute("content", value);
      document.head.appendChild(meta);
    });
  }

  /**
   * Remove all NewsPassID segment meta tags from the document head
   */
  private removeSegmentMetaTags(): void {
    const existingTags = document.head.querySelectorAll(
      'meta[name^="newspass_segment_"]',
    );
    existingTags.forEach((tag) => {
      tag.remove();
    });
  }

  /**
   * Apply segments as key-values for ad targeting
   */
  private applySegmentsToPage(segments: string[]): void {
    // Global data layer for easy access
    window.newspass_segments = segments;
    storeId("npid_segments", segments.join(","));

    /**
     * Add data attribute to the HTML with all segments
     * TODO: Do we want to add this as a data attribute on the body?
     * would it be better to add it as a JSON data structure?
     */
    const body = document.querySelector("body");
    if (body) {
      // Set a single data attribute with JSON string of all segments
      (body as HTMLElement).dataset.newspass_segments =
        JSON.stringify(segments);
    }
  }
}

/**
 * Factory function to create a NewsPassID instance
 */
export function createNewsPassID(config: NewsPassConfig): NewsPassIDImpl {
  return new NewsPassIDImpl(config);
}

export type {
  NewsPassConfig,
  NewsPassID,
  NewsPassSegmentsReadyDetail,
  SegmentResponse,
  SegmentKeyValue,
};
