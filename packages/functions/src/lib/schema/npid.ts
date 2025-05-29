import { z } from "zod";

export const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  url: z.string(),
  consentString: z.string(),
  previousId: z.string().optional(),
  publisherSegments: z.array(z.string()).optional(),
});

export const SegmentRecordSchema = z.array(
  z.object({
    segments: z.string(),
    expire_timestamp: z.string(),
  }),
);

export type LogRecord = z.infer<typeof logRecordSchema>;
export type SegmentRecord = z.infer<typeof SegmentRecordSchema>;
