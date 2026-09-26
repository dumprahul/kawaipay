import type { CampaignRecord } from "./api";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  rating: number;
  reviewCount: number;
  description: string;
  tags: string[];
  inStock: boolean;
  affiliateEligible: boolean;
  rewardPerFiveSeconds: number; // USDC, per 5s of verified attention
  images: string[];
  seller: string;
  // Decorative-only, no backend concept — always undefined from real data; kept optional
  // so the existing display components (which already handle their absence) still compile.
  originalPrice?: number;
  trending?: boolean;
  brand?: string;
  material?: string;
}

export const CATEGORIES = [
  "Fashion",
  "Beauty",
  "Electronics",
  "Lifestyle",
  "Home",
  "Wellness",
  "Books",
];

const USDC_DECIMALS = 1_000_000;

/** Maps a real on-chain-backed campaign record into the shape every product component already expects. */
export function campaignToProduct(c: CampaignRecord): Product {
  return {
    id: c.campaignId,
    name: c.title ?? "Untitled product",
    category: c.category ?? "Uncategorized",
    price: c.priceUsd ?? 0,
    rating: 0,
    reviewCount: 0,
    description: c.description ?? "",
    tags: [],
    inStock: c.active,
    affiliateEligible: true,
    rewardPerFiveSeconds: (c.ratePerSecond * 5) / USDC_DECIMALS,
    images: c.imageUrl ? [c.imageUrl] : [],
    seller: c.seller,
  };
}
