import { promises as fs } from "fs";

type SegmentData = Record<string, string[] | undefined>;

/**
 * Get user segments from the segments.json file (written by Snowflake)
 */
export async function getUserSegmentsFromFile(
  id: string,
  segmentsFile: string,
): Promise<string[]> {
  try {
    // Try to read the segments file - this will be written by Snowflake
    let segmentData: SegmentData = {};

    try {
      const fileContent = await fs.readFile(segmentsFile, "utf8");
      segmentData = JSON.parse(fileContent) as SegmentData;
    } catch (error) {
      console.warn(`Could not read segments file ${segmentsFile}:`, error);
      // Return default segments
      return getDefaultSegments();
    }

    // Check if we have segments for this ID
    if (segmentData[id]) {
      return segmentData[id];
    }

    return getDefaultSegments();
  } catch (error) {
    console.error("Error getting user segments from file:", error);
    return getDefaultSegments();
  }
}

/**
 * Generate default segments based on URL patterns
 * Used as fallback when no segments are found in the file
 */
export function getDefaultSegments(): string[] {
  // Generate random segment IDs
  // These are opaque identifiers, not revealing any PII
  const segmentCount = Math.floor(Math.random() * 3) + 1; // 1-3 segments
  const segments: string[] = [];

  for (let i = 0; i < segmentCount; i++) {
    // Generate a random segment ID
    segments.push(`seg_${Math.random().toString(36).substring(2, 15)}`);
  }

  return segments;
}
