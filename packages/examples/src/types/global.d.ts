import type { NewsPassConfig, NewsPassID } from "@newspassid-audience/sdk";

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
type StringWithAutocomplete<Literals extends string> = Literals | (string & {});

// IAB GPP API Types
interface GPPData {
  gppString: string;
  applicableSections?: number[];
  gppVersion?: string;
  sectionExist?: Record<string, boolean>;
}

type GPPCallback = (data: GPPData | null, success: boolean) => void;

interface GPPPingResponse {
  gppVersion: string;
  cmpStatus: StringWithAutocomplete<"loaded" | "stub">;
  cmpDisplayStatus: StringWithAutocomplete<"visible" | "hidden" | "disabled">;
  supportedAPIs: string[];
  cmpId?: number;
  cmpVersion?: number;
  signalStatus?: StringWithAutocomplete<"ready" | "not ready">;
}

interface GPP {
  (command: "ping", callback: (pingData: GPPPingResponse) => void): void;
  (command: "getGPPData", callback: GPPCallback): void;
  (command: string, callback: GPPCallback, parameter?: unknown): void;
  queue?: [string, GPPCallback, unknown?][];
  events?: [string, GPPCallback, unknown?][];
}

// Extend Window interface
declare global {
  interface Window {
    __gpp?: GPP;
    createNewsPassID?: (config: NewsPassConfig) => NewsPassID;
    newspassid?: NewsPassID;
    newspass_segments?: string[];
    NEWSPASS_CONFIG?: NewsPassConfig;
    newspass_initialized?: boolean;
    pbjs?: {
      setTargetingForGPTAsync: (targeting: Record<string, unknown>) => void;
    };
    NewsPassID?: {
      createNewsPassID: (config: NewsPassConfig) => NewsPassID;
    };
  }
}

// export {};
