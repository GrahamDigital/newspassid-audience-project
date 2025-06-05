import { z } from "zod";

export const logRecordSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  url: z.string(),
  consentString: z.string(),
});

export const SegmentRecordSchema = z.array(
  z.object({
    segments: z.string(),
    expire_timestamp: z.string(),
  }),
);

export const ConfigSchema = z.object({
  pageViewThreshold: z.number(),
  alwaysLoadSDKAllowList: z.array(z.string()),
});

export type LogRecord = z.infer<typeof logRecordSchema>;
export type SegmentRecord = z.infer<typeof SegmentRecordSchema>;
export type Config = z.infer<typeof ConfigSchema>;
