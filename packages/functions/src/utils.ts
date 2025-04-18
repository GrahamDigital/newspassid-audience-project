import { APIGatewayProxyEvent } from "aws-lambda";

/**
 * Get CORS headers for the response
 */
export function getCorsHeaders(
  event: APIGatewayProxyEvent
): Record<string, string> {
  const origin = event.headers?.origin || "*";
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
 * Validate ID format
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  // ID should be in format: namespace-id
  const parts = id.split("-");
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Get namespace from ID
 */
export function getNamespaceFromId(id: string): string {
  return id.split("-")[0];
}
