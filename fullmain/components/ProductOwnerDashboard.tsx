"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { getProductsBySeller } from "@/lib/productStore";
import { CATEGORIES, type Product } from "@/lib/products";
import { loadZkLoginSession, buildZkLoginPersonalMessageSignature } from "@/lib/zklogin";
import { createCampaignOnChain, InsufficientFundsError } from "@/lib/chainTransactions";
import { setCampaignMetadata, waitForCampaign, listCampaignLinks, type CampaignLinkSummary } from "@/lib/api";
import { campaignMetadataSigningMessage } from "@/lib/campaignMetadataMessage";

// ── Helpers ───────────────────────────────────────────────────────────────────

function inputCls(err?: string) {
  return `w-full px-4 py-3 rounded-xl border text-sm text-[var(--espresso)] bg-[var(--ivory)] placeholder:text-[#bbb] outline-none transition-colors ${
    err ? "border-red-300 focus:border-red-400" : "border-[var(--sand)] focus:border-[var(--brown)]"
  }`;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

type Tab = "products" | "analytics";
const USDC_DECIMALS = 1_000_000;

// ── Add Product Modal ─────────────────────────────────────────────────────────

function AddProductModal({
  address,
  onClose,
  onAdded,
}: {
  address: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [escrowBudget, setEscrowBudget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Required";
    if (!description.trim()) e.description = "Required";
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = "Enter a valid price";
    if (!imageUrl.trim()) e.imageUrl = "Required";
    if (!escrowBudget || isNaN(Number(escrowBudget)) || Number(escrowBudget) <= 0) e.escrowBudget = "Enter a valid amount";
    return e;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setChainError(null);

    const session = await loadZkLoginSession();
    if (!session) {
      setChainError("Your session expired — please sign in again.");
      return;
    }

    setLoading(true);
    try {
      const escrowBaseUnits = Math.round(Number(escrowBudget) * USDC_DECIMALS);
      // Matches the original demo heuristic: reward per 5s = escrow / 10000.
      const ratePerSecondBaseUnits = Math.max(1, Math.round(escrowBaseUnits / 10000 / 5));

      setStep("Creating campaign on-chain (signing with your wallet)…");
      const { campaignId } = await createCampaignOnChain(session, { ratePerSecondBaseUnits, escrowBaseUnits });

      setStep("Waiting for the chain indexer to pick up your campaign…");
      await waitForCampaign(campaignId);

      setStep("Saving your product listing…");
      const fields = { title: title.trim(), category, description: description.trim(), imageUrl: imageUrl.trim(), priceUsd: Number(price) };
      const message = campaignMetadataSigningMessage(campaignId, fields);
      const signature = await buildZkLoginPersonalMessageSignature(session, message);
      await setCampaignMetadata(campaignId, fields, signature);

      onAdded();
      onClose();
    } catch (err) {
      if (err instanceof InsufficientFundsError) {
        setChainError(`Not enough USDC in your wallet (${address.slice(0, 8)}…) to fund this escrow. Fund your wallet with testnet USDC first.`);
      } else {
        setChainError(err instanceof Error ? err.message : "Failed to list product");
      }
    } finally {
      setLoading(false);
      setStep(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-[var(--espresso)]/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-[var(--cream)] rounded-2xl shadow-2xl border border-[var(--sand)] overflow-hidden max-h-[90vh] flex flex-col">

        {/* Modal header */}
        <div className="px-8 pt-7 pb-5 border-b border-[var(--sand)] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--espresso)] tracking-tight">List a Product</h2>
            <p className="text-xs text-[var(--muted-brown)] mt-0.5">Creates a real campaign on Sui testnet, funded from your own wallet.</p>
          </div>
          <button onClick={onClose} className="text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">

            {/* Seller ID */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">Seller ID</label>
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--ivory)] border border-[var(--sand)]">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] shrink-0" />
                <code className="text-xs font-mono text-[var(--brown)] truncate">{address}</code>
              </div>
            </div>

            <Field label="Product Title" error={errors.title}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Haven Watch — Minimalist Timepiece" className={inputCls(errors.title)} />
            </Field>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls()}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <Field label="Description" error={errors.description}>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your product — materials, use case, what makes it special…"
                rows={3} className={inputCls(errors.description) + " resize-none"} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Price (USD)" error={errors.price}>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-brown)] text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00" className={inputCls(errors.price) + " pl-7"} />
                </div>
              </Field>
              <Field label="Escrow Budget (USDC)" error={errors.escrowBudget}>
                <div className="relative">
                  <input type="number" min="0" step="0.01" value={escrowBudget} onChange={(e) => setEscrowBudget(e.target.value)}
                    placeholder="0.00" className={inputCls(errors.escrowBudget) + " pr-16"} />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[var(--accent-green)]">USDC</span>
                </div>
              </Field>
            </div>

            <Field label="Image URL" error={errors.imageUrl}>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://images.unsplash.com/…" className={inputCls(errors.imageUrl)} />
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="preview" onError={(e) => (e.currentTarget.style.display = "none")}
                  className="mt-2 w-20 h-20 object-cover rounded-xl border border-[var(--sand)]" />
              )}
            </Field>

            {escrowBudget && Number(escrowBudget) > 0 && (
              <div className="bg-[var(--ivory)] border border-[var(--sand)] rounded-xl px-4 py-3 text-xs text-[var(--muted-brown)]">
                Reward per 5s attention: <span className="font-semibold text-[var(--espresso)]">{(Number(escrowBudget) / 10000).toFixed(6)} USDC</span>
              </div>
            )}

            {chainError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">{chainError}</div>
            )}
            {step && (
              <div className="bg-[var(--ivory)] border border-[var(--sand)] rounded-xl px-4 py-3 text-xs text-[var(--muted-brown)]">{step}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[var(--espresso)] text-white text-sm font-semibold hover:bg-[var(--brown)] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? (
                <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>Listing…</>
              ) : "List Product on Shop →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────

interface ProductAnalytics {
  product: Product;
  links: CampaignLinkSummary[];
  earnedTotal: number;
  settledTotal: number;
  budgetRemaining: number;
}

export function AnalyticsTab({ products }: { products: Product[] }) {
  const [rows, setRows] = useState<ProductAnalytics[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      products.map(async (product) => {
        const links = await listCampaignLinks(product.id);
        const earnedTotal = links.reduce((sum, l) => sum + l.earnedTotal, 0);
        const settledTotal = links.reduce((sum, l) => sum + l.settledTotal, 0);
        const budgetRemaining = links.reduce((sum, l) => sum + l.budgetRemaining, 0);
        return { product, links, earnedTotal, settledTotal, budgetRemaining };
      }),
    ).then((r) => !cancelled && setRows(r));
    return () => {
      cancelled = true;
    };
  }, [products]);

  if (rows === null) return <p className="text-sm text-[var(--muted-brown)] py-10 text-center">Loading real settlement data…</p>;

  const totalEarned = rows.reduce((s, r) => s + r.earnedTotal, 0);
  const totalSettled = rows.reduce((s, r) => s + r.settledTotal, 0);
  const totalBudget = rows.reduce((s, r) => s + r.budgetRemaining, 0);
  const totalLinks = rows.reduce((s, r) => s + r.links.length, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Earned (all-time)", value: `${(totalEarned / USDC_DECIMALS).toFixed(4)}`, sub: "USDC, across all links" },
          { label: "Settled on-chain", value: `${(totalSettled / USDC_DECIMALS).toFixed(4)}`, sub: "USDC actually paid out" },
          { label: "Escrow Remaining", value: `${(totalBudget / USDC_DECIMALS).toFixed(2)}`, sub: `USDC across ${products.length} products` },
          { label: "Active Links", value: String(totalLinks), sub: "created by affiliates" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-[var(--sand)] rounded-2xl p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-[var(--espresso)] tracking-tight">{s.value}</p>
            <p className="text-[11px] text-[var(--muted-brown)] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[var(--sand)] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--sand)]">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">Products Performance (real, from Sui + our backend)</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--sand)]">
              {["Product", "Links", "Earned / Settled", "Escrow Remaining"].map((h) => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-brown)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-[13px] text-[var(--muted-brown)]">No products yet.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={r.product.id} className={`border-b border-[var(--sand)] last:border-0 ${i % 2 === 0 ? "" : "bg-[var(--cream)]/30"}`}>
                  <td className="px-5 py-4 text-[13px] font-medium text-[var(--espresso)]">{r.product.name}</td>
                  <td className="px-5 py-4 text-[13px] text-[var(--muted-brown)]">{r.links.length}</td>
                  <td className="px-5 py-4 text-[13px] font-mono text-[var(--muted-brown)]">
                    {(r.earnedTotal / USDC_DECIMALS).toFixed(4)} / {(r.settledTotal / USDC_DECIMALS).toFixed(4)}
                  </td>
                  <td className="px-5 py-4 text-[13px] font-mono text-[var(--muted-brown)]">{(r.budgetRemaining / USDC_DECIMALS).toFixed(2)} USDC</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function ProductOwnerDashboard({
  address,
  onLogout,
}: {
  address: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("products");
  const [modalOpen, setModalOpen] = useState(false);
  const [ownerProducts, setOwnerProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      setOwnerProducts(await getProductsBySeller(address));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--cream)]">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-1">Product Owner</p>
            <h1 className="text-3xl font-bold text-[var(--espresso)] tracking-tight">
              {tab === "products" ? "My Products" : "Analytics"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted-brown)] bg-[var(--ivory)] border border-[var(--sand)] px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)]" />
              {address.slice(0, 6)}…{address.slice(-6)}
            </span>
            {tab === "products" && (
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--espresso)] text-white text-sm font-medium hover:bg-[var(--brown)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
            )}
            <button onClick={onLogout} className="px-4 py-2 rounded-full border border-[var(--sand)] text-sm text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)] transition-colors">
              Sign out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-[var(--ivory)] border border-[var(--sand)] rounded-xl p-1 w-fit">
          {(["products", "analytics"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                tab === t ? "bg-white shadow-sm text-[var(--espresso)] border border-[var(--sand)]" : "text-[var(--muted-brown)] hover:text-[var(--espresso)]"
              }`}>
              {t === "products" ? "My Products" : "Analytics"}
            </button>
          ))}
        </div>

        {/* ══ PRODUCTS TAB ══ */}
        {tab === "products" && (
          loading ? (
            <p className="text-center text-sm text-[var(--muted-brown)] py-24">Loading your products…</p>
          ) : ownerProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[var(--ivory)] border border-[var(--sand)] flex items-center justify-center">
                <svg className="w-7 h-7 text-[var(--muted-brown)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--espresso)]">No products yet</p>
                <p className="text-sm text-[var(--muted-brown)] mt-1">Click <span className="font-medium">Add Product</span> to list your first product on the shop.</p>
              </div>
              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[var(--espresso)] text-white text-sm font-medium hover:bg-[var(--brown)] transition-colors mt-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Product
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {ownerProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )
        )}

        {/* ══ ANALYTICS TAB ══ */}
        {tab === "analytics" && <AnalyticsTab products={ownerProducts} />}
      </main>

      <Footer />

      {modalOpen && (
        <AddProductModal address={address} onClose={() => setModalOpen(false)} onAdded={refresh} />
      )}
    </div>
  );
}
