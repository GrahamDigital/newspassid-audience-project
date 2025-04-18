/**
 * IAB GPP API integration
 */
import { GPPData } from './types';

/**
 * Get consent string using the IAB GPP JavaScript API
 */
export async function getGppConsentString(): Promise<string | undefined> {
  try {
    // Check if the GPP API is available
    if (typeof window.__gpp === 'function') {
      // Use GPP API to get the consent string
      // Return a promise to handle the async nature of the GPP API
      return new Promise<string | undefined>((resolve) => {
        window.__gpp!('getGPPData', (data, success) => {
          if (success && data && data.gppString) {
            resolve(data.gppString);
          } else {
            // Try fallback method
            const fallbackString = getGppConsentFromCookie();
            resolve(fallbackString);
          }
        });
      });
    } else {
      // Fallback to cookies if the GPP API is not available
      return getGppConsentFromCookie();
    }
  } catch (e) {
    console.warn('newspassid: Error getting GPP consent:', e);
    // Try fallback method
    return getGppConsentFromCookie();
  }
}

/**
 * Fallback method to get GPP consent string from cookie
 */
export function getGppConsentFromCookie(): string | undefined {
  try {
    // Try to get GPP cookie
    const gppCookie = getCookie('gpp');
    if (!gppCookie) {
      // Also try common alternative cookie names
      const uspCookie = getCookie('usprivacy');
      const tcfCookie = getCookie('euconsent-v2');
      
      return uspCookie || tcfCookie || undefined;
    }
    
    // Return the GPP string
    return gppCookie;
  } catch (e) {
    console.warn('newspassid: Error getting GPP consent from cookie:', e);
    return undefined;
  }
}

/**
 * Helper to get a cookie by name
 */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}
