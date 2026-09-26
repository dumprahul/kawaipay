// Mirrors services/gateway/src/campaignMetadata.ts's campaignMetadataSigningMessage +
// packages/shared/src/canonicalJson.ts's canonicalJson EXACTLY (same key set, same
// alphabetical-sort-then-stringify rule) — the backend recomputes this same message from
// the request body and checks the signature against it, so any difference here means
// every metadata update gets rejected with BAD_SIGNATURE.

export interface CampaignMetadataFields {
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  priceUsd: number;
}

export function campaignMetadataSigningMessage(campaignId: string, fields: CampaignMetadataFields): Uint8Array {
  const obj: Record<string, unknown> = {
    campaignId,
    title: fields.title,
    category: fields.category,
    description: fields.description,
    imageUrl: fields.imageUrl,
    priceUsd: fields.priceUsd,
  };
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) sorted[key] = obj[key];
  return new TextEncoder().encode(JSON.stringify(sorted));
}
