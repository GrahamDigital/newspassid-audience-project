import { z } from "zod";

const BrazeMauDataPointSchema = z.object({
  time: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Time must be in YYYY-MM-DD format"),
  mau: z.number().min(0, "MAU must be a non-negative number"),
});

export const BrazeMauResponseSchema = z.object({
  data: z.array(BrazeMauDataPointSchema),
  message: z.string(),
});

export type BrazeMauDataPoint = z.infer<typeof BrazeMauDataPointSchema>;
export type BrazeMauResponse = z.infer<typeof BrazeMauResponseSchema>;
