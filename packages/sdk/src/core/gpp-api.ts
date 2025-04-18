/**
 * IAB GPP API integration
 */
// import { GPPData } from "./types";

/**
 * Get consent string using the IAB GPP JavaScript API
 */
export async function getGppConsentString(): Promise<string | undefined> {
  try {
    // Check if the GPP API is available
    if (typeof window.__gpp === "function") {
      // Use GPP API to get the consent string
      // Return a promise to handle the async nature of the GPP API
      const gppString = await new Promise<string | undefined>((resolve) => {
        try {
          window.__gpp?.("getGPPData", (data, success) => {
            if (success && data?.gppString) {
              resolve(data.gppString);
            } else {
              // Try fallback method
              const fallbackString = getGppConsentFromCookie();
              resolve(fallbackString);
            }
          });
        } catch (error) {
          console.warn("newspassid: Error calling GPP API:", error);
          // Try fallback method
          const fallbackString = getGppConsentFromCookie();
          resolve(fallbackString);
        }
      });
      return gppString;
    } else {
      // Fallback to cookies if the GPP API is not available
      return getGppConsentFromCookie();
    }
  } catch (e) {
    console.warn("newspassid: Error getting GPP consent:", e);
    // Try fallback method
    return getGppConsentFromCookie();
  }
}

/**
 * Fallback method to get GPP consent string from cookie
 */
export function getGppConsentFromCookie(): string | undefined {
  try {
    // Check if document.cookie exists and is not empty
    if (!document.cookie || document.cookie.trim() === "") {
      return undefined;
    }

    // Try to get GPP cookie
    const gppCookie = getCookie("gpp");
    if (!gppCookie) {
      // Also try common alternative cookie names
      const uspCookie = getCookie("usprivacy");
      const tcfCookie = getCookie("euconsent-v2");

      return uspCookie ?? tcfCookie ?? undefined;
    }

    // Return the GPP string
    return gppCookie;
  } catch (e) {
    console.warn("newspassid: Error getting GPP consent from cookie:", e);
    return undefined;
  }
}

/**
 * Sets the usprivacy cookie.
 * @param value - The value to set for the usprivacy cookie (e.g., "1YNN").
 * @param days - Number of days until the cookie expires. Defaults to 365.
 */
export function setUsPrivacyCookie(value: string, days = 365): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    "usprivacy=" +
    encodeURIComponent(value) +
    "; expires=" +
    expires +
    "; path=/; SameSite=Lax";
}

/**
 * Helper to get a cookie by name
 */
function getCookie(name: string): string | null {
  try {
    if (!document.cookie || document.cookie.trim() === "") {
      return null;
    }

    const match = new RegExp("(^| )" + name + "=([^;]+)").exec(document.cookie);
    return match ? match[2] : null;
  } catch (e) {
    console.warn(`newspassid: Error getting cookie "${name}":`, e);
    return null;
  }
}
