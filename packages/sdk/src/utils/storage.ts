/**
 * Get stored ID from localStorage
 */
export function getStoredId(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("newspassid: Unable to access localStorage:", e);
    return null;
  }
}

/**
 * Store ID in localStorage
 */
export function storeId(key: string, id: string): void {
  try {
    localStorage.setItem(key, id);
  } catch (e) {
    console.warn("newspassid: Unable to write to localStorage:", e);
  }
}

/**
 * Clear stored ID
 */
export function clearId(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn("newspassid: Unable to remove from localStorage:", e);
  }
}

/**
 * Helper to get a cookie by name
 */

export function getCookie(name: string): string | null {
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
