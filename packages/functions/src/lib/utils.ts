import type { APIGatewayProxyEvent } from "aws-lambda";
import { z } from "zod";

/**
 * Get CORS headers for the response
 */
export function getCorsHeaders(
  event: APIGatewayProxyEvent,
): Record<string, string> {
  const origin = event.headers.origin ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Create an error response
 */
export function errorResponse(statusCode: number, message: string) {
  return {
    statusCode,
    headers: getCorsHeaders({} as APIGatewayProxyEvent),
    body: JSON.stringify({
      success: false,
      error: message,
    }),
  };
}

/**
 * Validate ID format: <publisher>-<uuid>
 */
const publisherUuidRegex =
  /^[a-zA-Z0-9]+-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const publisherUuidSchema = z.string().regex(publisherUuidRegex);

/**
 * Validate ID format
 */
export function isValidId(id: string): boolean {
  return publisherUuidSchema.safeParse(id).success;
}

/**
 * Get namespace from ID
 */
export function getNamespaceFromId(id: string): string {
  return id.split("-")[0];
}
