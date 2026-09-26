export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  description: string;
  tags: string[];
  inStock: boolean;
  trending?: boolean;
  featured?: boolean;
  affiliateEligible: boolean;
  rewardPerFiveSeconds: number; // in SUI
  images: string[];
  material?: string;
  brand?: string;
}

export const CATEGORIES = [
  "Fashion",
  "Beauty",
  "Electronics",
  "Lifestyle",
  "Home",
  "Wellness",
  "Books",
  "Trending",
];

export const PRODUCTS: Product[] = [
  {
    id: "solace-headphones",
    name: "Solace Wireless Headphones",
    category: "Electronics",
    price: 189,
    originalPrice: 240,
    rating: 4.8,
    reviewCount: 312,
    description:
      "Over-ear wireless headphones with 40-hour battery life, adaptive noise cancellation, and a warm, natural sound profile. Crafted with sustainable materials and a minimal aesthetic.",
    tags: ["wireless", "noise-cancelling", "premium"],
    inStock: true,
    featured: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0012,
    images: [
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=600&q=80",
      "https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=600&q=80",
      "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=600&q=80",
    ],
    brand: "Solace Audio",
    material: "Recycled aluminium, memory foam",
  },
  {
    id: "terra-diffuser",
    name: "Terra Ceramic Diffuser",
    category: "Home",
    price: 68,
    rating: 4.9,
    reviewCount: 187,
    description:
      "Handcrafted ceramic ultrasonic diffuser with a warm matte finish. Runs whisper-quiet for up to 8 hours and distributes essential oils evenly throughout any space.",
    tags: ["home", "wellness", "ceramic"],
    inStock: true,
    featured: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0006,
    images: [
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80",
      "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
      "https://images.unsplash.com/photo-1600612253971-1e9c768ab5c3?w=600&q=80",
    ],
    brand: "Terra Living",
    material: "Ceramic, BPA-free plastic",
  },
  {
    id: "lumi-serum",
    name: "Lumi Skin Serum",
    category: "Beauty",
    price: 48,
    originalPrice: 62,
    rating: 4.7,
    reviewCount: 543,
    description:
      "A lightweight vitamin C and niacinamide serum that visibly brightens and evens skin tone over 4 weeks. Fragrance-free, dermatologist-tested.",
    tags: ["skincare", "vitamin-c", "brightening"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0005,
    images: [
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80",
      "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&q=80",
      "https://images.unsplash.com/photo-1601049676869-702ea24cfd58?w=600&q=80",
    ],
    brand: "Lumi Skincare",
    material: "15% Vitamin C, 5% Niacinamide",
  },
  {
    id: "noma-tote",
    name: "Noma Everyday Tote",
    category: "Fashion",
    price: 95,
    rating: 4.6,
    reviewCount: 228,
    description:
      "A structured canvas tote with full grain leather handles and a hidden magnetic closure. Large enough for a 15-inch laptop with room for essentials.",
    tags: ["bag", "everyday", "canvas"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0008,
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&q=80",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
      "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=600&q=80",
    ],
    brand: "Noma Studio",
    material: "Waxed canvas, full grain leather",
  },
  {
    id: "aster-lamp",
    name: "Aster Desk Lamp",
    category: "Home",
    price: 142,
    rating: 4.8,
    reviewCount: 94,
    description:
      "Warm-spectrum LED desk lamp with touch dimming, three colour temperatures, and a sand-cast aluminium arm. Designed to reduce eye strain during long sessions.",
    tags: ["lighting", "desk", "LED"],
    inStock: true,
    featured: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.001,
    images: [
      "https://plus.unsplash.com/premium_photo-1736771712027-41ac471f0570?w=600&q=80",
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80",
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80",
    ],
    brand: "Aster Works",
    material: "Sand-cast aluminium",
  },
  {
    id: "sora-shoes",
    name: "Sora Running Shoes",
    category: "Fashion",
    price: 128,
    originalPrice: 158,
    rating: 4.5,
    reviewCount: 401,
    description:
      "Minimalist running shoes built on a bio-foam midsole with a breathable knit upper. Neutral colourway designed to pair with anything.",
    tags: ["running", "minimal", "footwear"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0009,
    images: [
      "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=600&q=80",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80",
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80",
    ],
    brand: "Sora Footwear",
    material: "Recycled knit, bio-foam",
  },
  {
    id: "mellow-coffee",
    name: "Mellow Coffee Set",
    category: "Lifestyle",
    price: 74,
    rating: 4.9,
    reviewCount: 156,
    description:
      "A pour-over coffee set including a gooseneck kettle, ceramic dripper, and two hand-thrown mugs. Everything you need for a slow morning ritual.",
    tags: ["coffee", "pour-over", "ceramic"],
    inStock: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0007,
    images: [
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
      "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80",
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80",
    ],
    brand: "Mellow Roasters",
    material: "Ceramic, stainless steel",
  },
  {
    id: "atelier-journal",
    name: "Atelier Journal",
    category: "Lifestyle",
    price: 36,
    rating: 4.7,
    reviewCount: 289,
    description:
      "180gsm cream Tomoe River paper in a linen-wrapped hardcover. Lays completely flat when open. 192 pages, thread-sewn binding.",
    tags: ["journal", "stationery", "writing"],
    inStock: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0003,
    images: [
      "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&q=80",
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&q=80",
      "https://images.unsplash.com/photo-1572635196184-84e35138cf62?w=600&q=80",
    ],
    brand: "Atelier Papers",
    material: "180gsm Tomoe River paper, linen",
  },
  {
    id: "halo-speaker",
    name: "Halo Portable Speaker",
    category: "Electronics",
    price: 112,
    rating: 4.6,
    reviewCount: 178,
    description:
      "360-degree portable speaker in a cast concrete housing. IPX6 waterproof, 24-hour battery, and a warm, room-filling sound. Minimal controls, maximal audio.",
    tags: ["speaker", "portable", "bluetooth"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0009,
    images: [
      "https://images.unsplash.com/photo-1512446816042-444d641267d4?w=600&q=80",
      "https://images.unsplash.com/photo-1558537348-c0f8e733989d?w=600&q=80",
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80",
    ],
    brand: "Halo Sound",
    material: "Cast concrete, aluminium grille",
  },
  {
    id: "forma-sunglasses",
    name: "Forma Sunglasses",
    category: "Fashion",
    price: 158,
    rating: 4.8,
    reviewCount: 203,
    description:
      "Acetate frames with polarised mineral glass lenses. UV400 protection. A considered frame geometry designed to suit a wide range of faces.",
    tags: ["sunglasses", "eyewear", "polarised"],
    inStock: true,
    featured: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0011,
    images: [
      "https://images.unsplash.com/photo-1577803645773-f96470509666?w=600&q=80",
      "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=600&q=80",
      "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600&q=80",
    ],
    brand: "Forma Eyewear",
    material: "Italian acetate, mineral glass",
  },
  {
    id: "carto-shipping-box",
    name: "Carto Gift Box Set",
    category: "Lifestyle",
    price: 28,
    rating: 4.5,
    reviewCount: 142,
    description:
      "A curated set of premium kraft gift boxes in graduated sizes. Sturdy, elegant, and reusable. Perfect for gifting or home organisation.",
    tags: ["gifting", "packaging", "lifestyle"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0003,
    images: [
      "https://media.istockphoto.com/id/183027527/photo/cardboard-boxes.webp?a=1&b=1&s=612x612&w=0&k=20&c=KG-u8mPW1Rd5M1H907Ee71HJGtRyggeU8P7L2NiJRRU=",
      "https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=600&q=80",
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    ],
    brand: "Carto Studio",
    material: "FSC-certified kraft board",
  },
  {
    id: "haven-watch",
    name: "Haven Field Watch",
    category: "Fashion",
    price: 215,
    rating: 4.7,
    reviewCount: 98,
    description:
      "A clean-dial field watch on a full-grain tan leather strap. Sapphire crystal glass, 50m water resistance, and a Swiss quartz movement.",
    tags: ["watch", "accessories", "leather"],
    inStock: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0014,
    images: [
      "https://images.unsplash.com/photo-1610006329898-2a4f12019450?w=600&q=80",
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80",
      "https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=600&q=80",
    ],
    brand: "Haven Timepieces",
    material: "Stainless steel, full-grain leather",
  },
  {
    id: "roam-duffle",
    name: "Roam Leather Duffle",
    category: "Fashion",
    price: 275,
    originalPrice: 320,
    rating: 4.8,
    reviewCount: 67,
    description:
      "A full-grain brown leather duffle with brass hardware and a removable shoulder strap. Structured enough for a weekend, refined enough for carry-on.",
    tags: ["bag", "travel", "leather"],
    inStock: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0016,
    images: [
      "https://images.unsplash.com/photo-1769147572181-b550bd3bb357?w=600&q=80",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
    ],
    brand: "Roam Goods",
    material: "Full-grain vegetable-tanned leather",
  },
  {
    id: "nourish-pantry",
    name: "Nourish Pantry Bundle",
    category: "Lifestyle",
    price: 54,
    rating: 4.6,
    reviewCount: 211,
    description:
      "A curated pantry bundle of whole grains, quinoa, farro, and heritage pasta in sealed glass jars. Grown organically, sourced directly from small farms.",
    tags: ["food", "pantry", "organic"],
    inStock: true,
    trending: true,
    affiliateEligible: true,
    rewardPerFiveSeconds: 0.0005,
    images: [
      "https://plus.unsplash.com/premium_photo-1705086325608-433cfd1aa8b0?w=600&q=80",
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&q=80",
    ],
    brand: "Nourish Collective",
    material: "Organic, non-GMO",
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter(
    (p) => p.category.toLowerCase() === category.toLowerCase()
  );
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.tags.some((t) => t.includes(q)) ||
      p.description.toLowerCase().includes(q)
  );
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.featured);
}

export function getTrendingProducts(): Product[] {
  return PRODUCTS.filter((p) => p.trending);
}
