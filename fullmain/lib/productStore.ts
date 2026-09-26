import { listCampaigns as apiListCampaigns } from "./api";
import { campaignToProduct, type Product } from "./products";

/** All real, listed products (campaigns with metadata set) — replaces the old localStorage/hardcoded catalog entirely. */
export async function getAllProducts(): Promise<Product[]> {
  const page = await apiListCampaigns({ limit: 100 });
  return page.campaigns.map(campaignToProduct);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const page = await apiListCampaigns({ category, limit: 100 });
  return page.campaigns.map(campaignToProduct);
}

/** Products created by a specific seller (their own zkLogin address) — the "My Products" owner dashboard view. */
export async function getProductsBySeller(seller: string): Promise<Product[]> {
  const page = await apiListCampaigns({ seller, limit: 100 });
  return page.campaigns.map(campaignToProduct);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const all = await getAllProducts();
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  );
}
