import { z } from "zod";

/** Section 6: the stats object's validated ranges. */
export const rawStatsSchema = z
  .object({
    windowMs: z.number().int().min(3000).max(8000),
    visibleMs: z.number().int().min(0),
    focusedMs: z.number().int().min(0),
    inViewportMs: z.number().int().min(0),
    contentViewportRatio: z.number().min(0).max(1),
    scrollEvents: z.number().int().min(0).max(5000),
    scrollDepthPct: z.number().int().min(0).max(100),
    scrollSpeedMax: z.number().int().min(0).max(100_000),
    pointerMoves: z.number().int().min(0).max(5000),
    pointerCells: z.number().int().min(0).max(400),
    touchEvents: z.number().int().min(0).max(5000),
    keyEvents: z.number().int().min(0).max(5000),
    tabSwitches: z.number().int().min(0).max(50),
  })
  .refine((s) => s.visibleMs <= s.windowMs, { message: "visibleMs must be <= windowMs" })
  .refine((s) => s.focusedMs <= s.windowMs, { message: "focusedMs must be <= windowMs" })
  .refine((s) => s.inViewportMs <= s.windowMs, { message: "inViewportMs must be <= windowMs" });

/** Section 5: POST /v1/session/start request body. */
export const sessionStartRequestSchema = z.object({
  linkId: z.string().regex(/^0x[0-9a-f]{64}$/),
  client: z.object({
    tz: z.string(),
    viewport: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  }),
});
export type SessionStartRequest = z.infer<typeof sessionStartRequestSchema>;

/** Stats as sent over the wire, before the un-bucketed RawStats validation above is applied. */
const heartbeatStatsSchema = z.object({
  windowMs: z.number().int(),
  visibleMs: z.number().int(),
  focusedMs: z.number().int(),
  inViewportMs: z.number().int(),
  contentViewportRatio: z.number(),
  scrollEvents: z.number().int(),
  scrollDepthPct: z.number().int(),
  scrollSpeedMax: z.number().int(),
  pointerMoves: z.number().int(),
  pointerCells: z.number().int(),
  touchEvents: z.number().int(),
  keyEvents: z.number().int(),
  tabSwitches: z.number().int(),
});

/** Section 5: POST /v1/heartbeat request body. */
export const heartbeatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  token: z.string(),
  stats: heartbeatStatsSchema,
  mac: z.string(),
});
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;

/** Section 11: GET /v1/links/{linkId}/history — path param + query string. */
export const linkIdParamSchema = z.object({
  linkId: z.string().regex(/^0x[0-9a-f]{64}$/),
});
export const linkHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  beforeSeq: z.coerce.number().int().nonnegative().optional(),
});
export type LinkHistoryQuery = z.infer<typeof linkHistoryQuerySchema>;

/** Campaign ("product") display metadata — Postgres-only, never touches the Move contract. */
export const campaignIdParamSchema = z.object({
  campaignId: z.string().regex(/^0x[0-9a-f]{64}$/),
});
export const campaignMetadataRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(60),
    description: z.string().trim().max(2000),
    imageUrl: z.string().url().max(2000),
    /** Base64 Sui personal-message signature over canonicalJson({campaignId, ...the four fields above}), proving the caller controls campaigns.seller for this campaignId. */
    signature: z.string().min(1),
  })
  .strict();
export type CampaignMetadataRequest = z.infer<typeof campaignMetadataRequestSchema>;

/** Section 12: POST /v1/oracle/verdict request body. Extra fields are a 400 (strict). */
export const oracleVerdictRequestSchema = z
  .object({
    ticks: z
      .array(
        z
          .object({
            gapMs: z.number().int().positive(),
            stats: heartbeatStatsSchema,
          })
          .strict(),
      )
      .min(1)
      .max(24),
    ipClass: z.enum(["residential", "datacenter", "tor", "unknown"]),
  })
  .strict();
export type OracleVerdictRequest = z.infer<typeof oracleVerdictRequestSchema>;
