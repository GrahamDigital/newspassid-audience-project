/**
 * Type definitions for NewsPassID
 */

// IAB GPP API Types
export interface GPPData {
  gppString: string;
  applicableSections?: number[];
  gppVersion?: string;
  sectionExist?: Record<string, boolean>;
}

export type GPPCallback = (data: GPPData | null, success: boolean) => void;

export interface GPPPingResponse {
  gppVersion: string;
  cmpStatus: "loaded" | "stub" | string;
  cmpDisplayStatus: "visible" | "hidden" | "disabled" | string;
  supportedAPIs: string[];
  cmpId?: number;
  cmpVersion?: number;
  signalStatus?: "ready" | "not ready" | string;
}

export interface GPP {
  (command: "ping", callback: (pingData: GPPPingResponse) => void): void;
  (command: "getGPPData", callback: GPPCallback): void;
  (command: string, callback: GPPCallback, parameter?: unknown): void;
  queue?: [string, GPPCallback, unknown?][];
  events?: [string, GPPCallback, unknown?][];
}

// NewsPassID specific types
export interface NewsPassConfig {
  /** Publisher namespace for the ID (e.g., 'your-publisher') */
  namespace: string;
  /** URL endpoint for the NewsPassID backend service */
  lambdaEndpoint: string;
  /** Custom storage key for localStorage (default: 'newspassid') */
  storageKey?: string;
  /** Whether to inject segment meta tags in the head (default: true) */
  injectMetaTags?: boolean;
}

export interface IdPayload {
  /** The NewsPassID */
  id: string;
  /** Unix timestamp of the request */
  timestamp: number;
  /** Current page URL */
  url: string;
  /** User consent string (required) */
  consentString: string;
  /** Previous NewsPassID for mapping (optional) */
  previousId?: string;
  /** Custom publisher segment IDs (optional) */
  publisherSegments?: string[];
}

export interface SegmentResponse {
  id: string;
  segments: string[];
  success: boolean;
}

// Segment types
export type SegmentKeyValue = Record<string, string>;

// Main NewsPassID interface
export interface NewsPassID {
  setID(id?: string, publisherSegments?: string[]): Promise<string>;
  getID(): string | null;
  getSegments(): string[];
  getSegmentsAsKeyValue(): SegmentKeyValue;
  clearID(): void;
}

// Extend Window interface
declare global {
  interface Window {
    __gpp?: GPP;
    newspassid?: NewsPassID;
    newspassid_q?: [string, ...unknown[]][];
    newspass_segments?: string[];
    NEWSPASS_CONFIG?: NewsPassConfig;
    createNewsPassID?: (config: NewsPassConfig) => NewsPassID;
    newspass_initialized?: boolean;
    googletag?: {
      pubads: () => {
        setTargeting: (key: string, value: string | string[]) => void;
        refresh: () => void;
      };
    };
    pbjs?: {
      setTargetingForGPTAsync: (targeting: Record<string, unknown>) => void;
    };
    NewsPassID?: {
      createNewsPassID: (config: NewsPassConfig) => NewsPassID;
    };
  }
}
