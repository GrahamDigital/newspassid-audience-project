/**
 * Tests for GPP API integration
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  getGppConsentFromCookie,
  getGppConsentString,
  setUsPrivacyCookie,
} from "./gpp-api";

// Define types for GPP API
type GppCallback = (
  data: { gppString?: string; applicableSections?: number[] } | null,
  success: boolean,
) => void;

// Mock window.__gpp
const mockGppFn = vi.fn((command: string, callback: GppCallback) => {
  if (command === "getGPPData") {
    callback(
      {
        gppString: "test-gpp-string",
        applicableSections: [1, 2, 3],
      },
      true,
    );
  }
});

Object.defineProperty(window, "__gpp", {
  value: mockGppFn,
  writable: true,
  configurable: true,
});

describe("GPP API", () => {
  let documentCookieGetter: () => string;
  let documentCookieSetter: (value: string) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Store original getter/setter
    const cookieDescriptor = Object.getOwnPropertyDescriptor(
      document,
      "cookie",
    ) ?? {
      get: (): string => "",
      set: () => {
        /* noop */
      },
      configurable: true,
    };

    // Use arrow functions to avoid 'this' binding issues
    // Assert the final result as string to satisfy the function's return type
    documentCookieGetter = (): string =>
      (cookieDescriptor.get?.() ?? "") as string; // <-- Added 'as string' here
    documentCookieSetter = (value: string) => {
      if (cookieDescriptor.set) {
        cookieDescriptor.set(value);
      }
    };

    // Set default cookie value
    Object.defineProperty(document, "cookie", {
      get: () => "gpp=test-cookie-value; other=value",
      set: documentCookieSetter,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original getter/setter
    Object.defineProperty(document, "cookie", {
      get: documentCookieGetter,
      set: documentCookieSetter,
      configurable: true,
    });

    vi.restoreAllMocks();
  });

  test("should get GPP consent string from API", async () => {
    const result = await getGppConsentString();
    expect(result).toBe("test-gpp-string");
    expect(window.__gpp).toHaveBeenCalledWith(
      "getGPPData",
      expect.any(Function),
    );
  });

  test("should get GPP consent string from cookie if API fails", async () => {
    // Mock GPP API to fail
    mockGppFn.mockImplementationOnce((command, callback) => {
      callback(null, false);
    });

    const result = await getGppConsentString();
    expect(result).toBe("test-cookie-value");
  });

  test("should get GPP consent string from cookie if API throws error", async () => {
    // Mock GPP API to throw an error
    mockGppFn.mockImplementationOnce(() => {
      throw new Error("API error");
    });

    const result = await getGppConsentString();
    expect(result).toBe("test-cookie-value");
  });

  test("should get GPP consent string from cookie", () => {
    const result = getGppConsentFromCookie();
    expect(result).toBe("test-cookie-value");
  });

  test("should fall back to alternative cookies if gpp cookie not found", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "usprivacy=test-usp-value; other=value",
      set: documentCookieSetter,
      configurable: true,
    });

    const result = getGppConsentFromCookie();
    expect(result).toBe("test-usp-value");
  });

  test("should fall back to tcf cookie if gpp and usprivacy cookies not found", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "euconsent-v2=test-tcf-value; other=value",
      set: documentCookieSetter,
      configurable: true,
    });

    const result = getGppConsentFromCookie();
    expect(result).toBe("test-tcf-value");
  });

  test("should return undefined if no cookies are found", () => {
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: documentCookieSetter,
      configurable: true,
    });

    const result = getGppConsentFromCookie();
    expect(result).toBeUndefined();
  });

  test("should handle document.cookie access errors", () => {
    Object.defineProperty(document, "cookie", {
      get: () => {
        throw new Error("Cookie access error");
      },
      set: documentCookieSetter,
      configurable: true,
    });

    const result = getGppConsentFromCookie();
    expect(result).toBeUndefined();
  });

  test("should set usprivacy cookie with default expiration", () => {
    let setCookieValue = "";
    Object.defineProperty(document, "cookie", {
      get: () => "gpp=test-cookie-value; other=value",
      set: (value: string) => {
        setCookieValue = value;
      },
      configurable: true,
    });

    setUsPrivacyCookie("1YNN");

    expect(setCookieValue).toContain("usprivacy=1YNN");
    expect(setCookieValue).toContain("path=/");
    expect(setCookieValue).toContain("SameSite=Lax");
    expect(setCookieValue).toContain("expires=");
  });

  test("should set usprivacy cookie with custom expiration", () => {
    let setCookieValue = "";
    Object.defineProperty(document, "cookie", {
      get: () => "gpp=test-cookie-value; other=value",
      set: (value: string) => {
        setCookieValue = value;
      },
      configurable: true,
    });

    const days = 30;
    setUsPrivacyCookie("1YNN", days);

    expect(setCookieValue).toContain("usprivacy=1YNN");
    expect(setCookieValue).toContain("path=/");
    expect(setCookieValue).toContain("SameSite=Lax");
    expect(setCookieValue).toContain("expires=");

    // Verify expiration date is roughly days in the future
    const expiresMatch = /expires=([^;]+)/.exec(setCookieValue);
    expect(expiresMatch).toBeTruthy();
    if (expiresMatch) {
      const expiresDate = new Date(expiresMatch[1]);
      const expectedDate = new Date(Date.now() + days * 864e5);
      // Allow for 1 second difference due to test execution time
      expect(
        Math.abs(expiresDate.getTime() - expectedDate.getTime()),
      ).toBeLessThan(1000);
    }
  });
});
