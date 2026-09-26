// Thin client for the real kawaipay backend (gateway + oracle-api), replacing every
// localStorage/hardcoded stand-in in lib/products.ts and lib/productStore.ts.

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8080";

export interface CampaignRecord {
  campaignId: string;
  seller: string;
  ratePerSecond: number;
  active: boolean;
  title: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
}

export interface CampaignListPage {
  campaigns: CampaignRecord[];
  nextBeforeCreatedAt: string | null;
}

export interface CampaignMetadataInput {
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
}

export interface SettlementHistoryEntry {
  seq: number;
  amount: number;
  secondsVerified: number;
  logRoot: string;
  logBlobId: string | null;
  txDigest: string;
  checkpoint: number;
  settledAt: string;
}

export interface LinkHistoryPage {
  linkId: string;
  settlements: SettlementHistoryEntry[];
  nextBeforeSeq: number | null;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? res.statusText);
  }
  return res.json();
}

/** Real product catalog — replaces the hardcoded PRODUCTS array. Only shows campaigns whose seller has set metadata. */
export async function listCampaigns(opts: { category?: string; seller?: string; limit?: number } = {}): Promise<CampaignListPage> {
  const params = new URLSearchParams();
  if (opts.category) params.set("category", opts.category);
  if (opts.seller) params.set("seller", opts.seller);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return request(`/v1/campaigns${qs ? `?${qs}` : ""}`);
}

export async function getCampaign(campaignId: string): Promise<CampaignRecord | null> {
  try {
    return await request(`/v1/campaigns/${campaignId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface CampaignLinkSummary {
  linkId: string;
  creator: string;
  frozen: boolean;
  budgetRemaining: number;
  totalPaid: number;
  earnedTotal: number;
  settledTotal: number;
}

/** Every link created against a campaign, with its real accrual state — for the owner's analytics view. */
export async function listCampaignLinks(campaignId: string): Promise<CampaignLinkSummary[]> {
  const { links } = await request<{ links: CampaignLinkSummary[] }>(`/v1/campaigns/${campaignId}/links`);
  return links;
}

/** Sets a campaign's product listing (title/category/description/image/price) — Postgres only. Requires a real Sui personal-message signature from the campaign's on-chain seller. */
export async function setCampaignMetadata(campaignId: string, fields: CampaignMetadataInput, signature: string): Promise<CampaignRecord> {
  return request(`/v1/campaigns/${campaignId}/metadata`, {
    method: "PUT",
    body: JSON.stringify({ ...fields, signature }),
  });
}

/** Real settlement history for a link — replaces the mocked analytics numbers. */
export async function getLinkHistory(linkId: string, opts: { limit?: number } = {}): Promise<LinkHistoryPage | null> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  try {
    return await request(`/v1/links/${linkId}/history${qs ? `?${qs}` : ""}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface SessionStartResult {
  tracking: boolean;
  sessionId?: string;
  secret?: string;
  token?: string;
  heartbeatIntervalMs?: number;
  sessionTtlMs?: number;
  reason?: string;
}

/** Starts a tracked attention session for a given link — the entry point the embedded tracker calls. */
export async function startSession(linkId: string): Promise<SessionStartResult> {
  return request(`/v1/session/start`, {
    method: "POST",
    body: JSON.stringify({
      linkId,
      client: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone, viewport: [window.innerWidth, window.innerHeight] },
    }),
  });
}

export interface HeartbeatBody {
  sessionId: string;
  seq: number;
  token: string;
  stats: Record<string, number>;
  mac: string;
}

export interface HeartbeatResult {
  ok: boolean;
  nextSeq?: number;
  nextToken?: string;
  reason?: string;
}

export async function sendHeartbeat(body: HeartbeatBody): Promise<HeartbeatResult> {
  return request(`/v1/heartbeat`, { method: "POST", body: JSON.stringify(body) });
}

export { ApiError };
