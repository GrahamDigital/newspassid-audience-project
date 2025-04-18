/**
 * Network utility functions
 */
import { IdPayload, SegmentResponse } from '../core/types';

/**
 * Send ID payload to backend service
 */
export async function sendToBackend(
  endpoint: string,
  payload: IdPayload
): Promise<SegmentResponse> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    return await response.json() as SegmentResponse;
  } catch (error) {
    console.error('newspassid: Error sending to backend:', error);
    throw error;
  }
}
