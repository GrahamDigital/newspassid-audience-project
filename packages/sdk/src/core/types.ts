// Add type alias for NewsPassID based on NewsPassIDImpl
import type { NewsPassIDImpl as NewsPassIDImplClass } from "./newspassid";

/**
 * Type definitions for NewsPassID
 */

/**
 * Creates a type that offers autocomplete for specific string literals
 * while still allowing any string.
 *
 * @template Literals - A union of string literal types for which autocomplete suggestions are desired.
 *
 * @example
 * type ButtonSize = StringWithAutocomplete<'small' | 'medium' | 'large'>;
 *
 * const s1: ButtonSize = 'medium'; // Autocomplete suggests 'small', 'medium', 'large'
 * const s2: ButtonSize = 'custom-size'; // Allowed
 * const s3: ButtonSize = 123; // Error: Type 'number' is not assignable to type 'ButtonSize'.
 */
export type StringWithAutocomplete<Literals extends string> =
  | Literals
  | (string & {});

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
  cmpStatus: StringWithAutocomplete<"loaded" | "stub">;
  cmpDisplayStatus: StringWithAutocomplete<"visible" | "hidden" | "disabled">;
  supportedAPIs: string[];
  cmpId?: number;
  cmpVersion?: number;
  signalStatus?: StringWithAutocomplete<"ready" | "not ready">;
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
}

export interface SegmentResponse {
  id: string;
  segments: string[];
  success: boolean;
}

// Segment types
export type SegmentKeyValue = Record<string, string>;

// Custom event types
export interface NewsPassSegmentsReadyDetail {
  segments: string[];
  segmentKeyValue: SegmentKeyValue;
}

export type NewsPassID = NewsPassIDImplClass;

// Extend Window interface
declare global {
  interface Window {
    __gpp?: GPP;
    newspassid?: NewsPassID;
    newspass_segments?: string[];
    NEWSPASS_CONFIG?: NewsPassConfig;
    createNewsPassID?: (config: NewsPassConfig) => NewsPassID;
    newspass_initialized?: boolean;
    pbjs?: {
      setTargetingForGPTAsync: (targeting: Record<string, unknown>) => void;
    };
    NewsPassID?: {
      createNewsPassID: (config: NewsPassConfig) => NewsPassID;
    };
  }
}
