import { type Product, PRODUCTS } from "./products";

const STORAGE_KEY = "kawaii_owner_products";

export function getOwnerProducts(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOwnerProduct(product: Product): void {
  const existing = getOwnerProducts();
  // Replace if same id, otherwise append
  const idx = existing.findIndex((p) => p.id === product.id);
  if (idx >= 0) existing[idx] = product;
  else existing.push(product);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function getAllProducts(): Product[] {
  return [...PRODUCTS, ...getOwnerProducts()];
}
