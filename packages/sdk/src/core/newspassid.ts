/**
 * NewsPassID main implementation
 */
import { NewsPassID, NewsPassConfig, IdPayload, SegmentKeyValue } from './types';
import { getGppConsentString } from './gpp-api';
import { getStoredId, storeId } from '../utils/storage';
import { generateId } from '../utils/random';
import { sendToBackend } from '../utils/network';

class NewsPassIDImpl implements NewsPassID {
  private config: NewsPassConfig;
  private segments: string[] = [];
  private consentString?: string;
  private segmentKeyValue: SegmentKeyValue = {};
  
  constructor(config: NewsPassConfig) {
    this.config = {
      ...config,
      storageKey: config.storageKey || 'newspassid',
      injectMetaTags: config.injectMetaTags !== false // default to true
    };
    
    console.log(`newspassid initialized with namespace: ${config.namespace}`);
  }

  /**
   * Set or create a NewsPassID
   * @param id Optional ID to use
   * @param publisherSegments Optional array of publisher segment IDs
   * @returns Promise resolving to the ID
   */
  async setID(id?: string, publisherSegments?: string[]): Promise<string> {
    const storedId = getStoredId(this.config.storageKey!);
    const useId = id || storedId || this.generateId();
    
    if (useId !== storedId) {
      storeId(this.config.storageKey!, useId);
      
      // Dispatch event to notify that ID has changed
      window.dispatchEvent(new CustomEvent('newspassid:change', {
        detail: { id: useId }
      }));
    }
    
    // Get consent string
    try {
      this.consentString = await getGppConsentString();
    } catch (error) {
      console.warn('newspassid: Failed to get GPP consent:', error);
      this.consentString = '';
    }
    
    // Create payload for backend
    const payload: IdPayload = {
      id: useId,
      timestamp: Date.now(),
      url: window.location.href,
      consentString: this.consentString || '',
      previousId: (id && storedId && id !== storedId) ? storedId : undefined,
      publisherSegments
    };
    
    try {
      const response = await sendToBackend(this.config.lambdaEndpoint, payload);
      
      // Set segments from response or use publisher segments if provided
      if (response && response.segments) {
        this.segments = response.segments;
      } else if (publisherSegments) {
        this.segments = publisherSegments;
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
      window.dispatchEvent(new CustomEvent('newspass_segments_ready', {
        detail: { segments: this.segments, segmentKeyValue: this.segmentKeyValue }
      }));
    } catch (error) {
      console.error('newspassid: Failed to send ID to backend:', error);
      
      // Use publisher segments if provided, even if backend call fails
      if (publisherSegments) {
        this.segments = publisherSegments;
        this.segmentKeyValue = this.convertSegmentsToKeyValue(publisherSegments);
        this.applySegmentsToPage(publisherSegments);
        
        // Inject meta tags if enabled
        if (this.config.injectMetaTags) {
          this.injectSegmentMetaTags();
        }
      }
    }
    
    return useId;
  }

  /**
   * Get the current NewsPassID
   */
  getID(): string | null {
    return getStoredId(this.config.storageKey!);
  }

  /**
   * Get segments associated with this ID
   */
  getSegments(): string[] {
    return [...this.segments];
  }

  /**
   * Get segments as key-value pairs
   */
  getSegmentsAsKeyValue(): SegmentKeyValue {
    return { ...this.segmentKeyValue };
  }

  /**
   * Clear the stored ID
   */
  clearID(): void {
    try {
      localStorage.removeItem(this.config.storageKey!);
      this.segments = [];
      this.segmentKeyValue = {};
      this.removeSegmentMetaTags();
      console.log('newspassid: ID cleared successfully');
    } catch (e) {
      console.warn('newspassid: Unable to remove from localStorage:', e);
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
    return segments.reduce((acc, segment) => {
      // Convert segment to lowercase and replace non-alphanumeric chars with underscore
      const key = segment.toLowerCase().replace(/[^a-z0-9]/g, '_');
      acc[key] = segment;
      return acc;
    }, {} as SegmentKeyValue);
  }

  /**
   * Inject segment meta tags into the document head
   */
  private injectSegmentMetaTags(): void {
    // Remove any existing meta tags first
    this.removeSegmentMetaTags();

    // Add new meta tags for each segment
    Object.entries(this.segmentKeyValue).forEach(([key, value]) => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', `newspass_segment_${key}`);
      meta.setAttribute('content', value);
      document.head.appendChild(meta);
    });
  }

  /**
   * Remove all NewsPassID segment meta tags from the document head
   */
  private removeSegmentMetaTags(): void {
    const existingTags = document.head.querySelectorAll('meta[name^="newspass_segment_"]');
    existingTags.forEach(tag => tag.remove());
  }

  /**
   * Apply segments as key-values for ad targeting
   */
  private applySegmentsToPage(segments: string[]): void {
    // Global data layer for easy access
    window.newspass_segments = segments;
    
    // For Google Ad Manager (GAM)
    if (window.googletag && window.googletag.pubads) {
      // Set all segments as a single array to a single key
      window.googletag.pubads().setTargeting('npid_segments', segments);
      
      // Refresh ads to apply new targeting
      window.googletag.pubads().refresh();
    }
    
    // For Prebid.js
    if (window.pbjs) {
      try {
        // Set targeting for prebid
        window.pbjs.setTargetingForGPTAsync({
          npid_segments: segments
        });
      } catch (e) {
        console.warn('newspassid: Error setting Prebid targeting:', e);
      }
    }
    
    // Add data attribute to the HTML with all segments
    const body = document.querySelector('body');
    if (body) {
      // Set a single data attribute with JSON string of all segments
      (body as HTMLElement).dataset.newspass_segments = JSON.stringify(segments);
    }
  }
}

/**
 * Factory function to create a NewsPassID instance
 */
export function createNewsPassID(config: NewsPassConfig): NewsPassID {
  return new NewsPassIDImpl(config);
}

export default {
  createNewsPassID
};
