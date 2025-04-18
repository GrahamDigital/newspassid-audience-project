/**
 * ID generation utilities
 */
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new random ID with namespace using UUID v4
 * @param namespace - The namespace to prefix the ID with
 * @returns A string in the format 'namespace-uuid'
 */
export function generateId(namespace: string): string {
  return `${namespace}-${uuidv4()}`;
}
