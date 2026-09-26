"use client";

import { useEffect, useState, useCallback } from "react";
import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit";
import type { IDKitResult, RpContext, IDKitErrorCodes } from "@worldcoin/idkit";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  description: string;
}

interface CreatorLink {
  id: number;
  slug: string;
  campaign_name: string;
  campaign_id: number;
  created_at: string;
}

interface StatusData {
  worldAppId: boolean;
  worldRpId: boolean;
  rpSigningKey: boolean;
  environment: string;
  db: boolean;
  ready: boolean;
}

// ─── Status panel ─────────────────────────────────────────────────────────────

function StatusPanel({ status }: { status: StatusData | null }) {
  if (!status) return null;
  const row = (label: string, ok: boolean | string) => (
    <div key={label} className="flex items-center justify-between text-sm py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-stone-500">{label}</span>
      {typeof ok === "boolean" ? (
        <span className={ok ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
          {ok ? "✓ configured" : "✗ missing"}
        </span>
      ) : (
        <span className="text-stone-700 font-mono text-xs uppercase">{ok}</span>
      )}
    </div>
  );
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Dev Status</p>
      {row("World App ID", status.worldAppId)}
      {row("RP ID", status.worldRpId)}
      {row("RP Signing Key", status.rpSigningKey)}
      {row("Environment", status.environment)}
      {row("Database", status.db)}
      {!status.ready && (
        <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Credentials missing. Copy <code className="font-mono">.env.example</code> → <code className="font-mono">.env.local</code> and fill in values from the{" "}
          <a href="https://developer.worldcoin.org" target="_blank" rel="noreferrer" className="underline">World Developer Portal</a>.
        </p>
      )}
    </div>
  );
}

// ─── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  linkedCampaignIds,
  onCreateLink,
}: {
  campaign: Campaign;
  linkedCampaignIds: Set<number>;
  onCreateLink: (campaign: Campaign) => void;
}) {
  const isLinked = linkedCampaignIds.has(campaign.id);
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-800">{campaign.name}</p>
        <p className="text-sm text-stone-400 mt-0.5">{campaign.description}</p>
      </div>
      {isLinked ? (
        <span className="shrink-0 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
          ✓ Linked
        </span>
      ) : (
        <button
          onClick={() => onCreateLink(campaign)}
          className="shrink-0 text-xs font-semibold bg-stone-900 text-white rounded-full px-4 py-1.5 hover:bg-stone-700 transition-colors"
        >
          Create Creator Link
        </button>
      )}
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast }: { toast: { type: "success" | "error" | "info"; msg: string } }) {
  const cls =
    toast.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : toast.type === "error" ? "bg-red-50 border-red-200 text-red-800"
    : "bg-blue-50 border-blue-200 text-blue-800";
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${cls}`}>{toast.msg}</div>;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [status, setStatus] = useState<StatusData | null>(null);

  // IDKit widget state
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [action, setAction] = useState("");

  // UI feedback
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [preparing, setPreparing] = useState(false);

  // Store verify result between handleVerify and onSuccess
  const [lastVerifyResult, setLastVerifyResult] = useState<{ slug: string; campaignName: string } | null>(null);

  const showToast = (type: "success" | "error" | "info", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 6000);
  };

  const loadData = useCallback(async () => {
    const [c, l, s] = await Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/creator-links").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
    ]);
    setCampaigns(c.campaigns ?? []);
    setLinks(l.links ?? []);
    setStatus(s);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const linkedCampaignIds = new Set(links.map((l) => l.campaign_id));

  // Step 1: fetch RP signature server-side → open IDKit widget
  const handleCreateLink = async (campaign: Campaign) => {
    if (!status?.ready) {
      showToast("error", "Environment not fully configured. Check the Dev Status panel.");
      return;
    }
    if (linkedCampaignIds.has(campaign.id)) {
      showToast("info", `You already have a creator link for ${campaign.name}.`);
      return;
    }
    try {
      setPreparing(true);
      const res = await fetch("/api/rp-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "RP signature failed");

      setRpContext(data.rp_context as RpContext);
      setAction(data.action as string);
      setActiveCampaign(campaign);
      console.log("[rp-signature] rp_context:", JSON.stringify(data.rp_context));
      console.log("[rp-signature] action:", data.action);
      setWidgetOpen(true);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "RP signature generation failed");
    } finally {
      setPreparing(false);
    }
  };

  // Step 2: IDKit calls handleVerify with the proof → send to our backend for verification
  const handleVerify = async (result: IDKitResult): Promise<void> => {
    if (!activeCampaign) throw new Error("No active campaign");

    const res = await fetch("/api/verify-proof", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: activeCampaign.id,
        idkitResult: result,
        signal: "",
      }),
    });

    const data = await res.json() as { slug?: string; campaignName?: string; message?: string; error?: string };

    if (!res.ok) {
      throw new Error(data.message ?? data.error ?? "Verification failed");
    }

    setLastVerifyResult({ slug: data.slug!, campaignName: data.campaignName! });
  };

  // Step 3: IDKit calls onSuccess after handleVerify resolves without throwing
  const onSuccess = (_result: IDKitResult) => {
    setWidgetOpen(false);
    setActiveCampaign(null);
    if (lastVerifyResult) {
      showToast("success", `✓ Creator link created for ${lastVerifyResult.campaignName} → /${lastVerifyResult.slug}`);
      setLastVerifyResult(null);
    }
    loadData();
  };

  const onError = (errorCode: IDKitErrorCodes) => {
    console.error("[IDKit] onError:", errorCode, JSON.stringify(errorCode));
    setWidgetOpen(false);
    setActiveCampaign(null);
    showToast("error", `Verification failed (${JSON.stringify(errorCode)}). No creator link was created.`);
  };

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "app_staging_placeholder") as `app_${string}`;

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center pt-6 pb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-2">
            Proof of Human Sandbox
          </p>
          <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Kawaipay × World ID</h1>
          <p className="text-stone-500 mt-2 text-sm">
            Testing one-human-per-campaign creator participation
          </p>
        </div>

        {/* Dev status */}
        <StatusPanel status={status} />

        {/* Toast */}
        {toast && <Toast toast={toast} />}

        {/* Campaigns */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Campaigns</p>
          <div className="space-y-3">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                linkedCampaignIds={linkedCampaignIds}
                onCreateLink={handleCreateLink}
              />
            ))}
            {campaigns.length === 0 && (
              <p className="text-sm text-stone-400 bg-white border border-stone-200 rounded-xl px-5 py-4">
                Loading campaigns…
              </p>
            )}
          </div>
        </section>

        {/* Creator links */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Your Creator Links</p>
          {links.length === 0 ? (
            <p className="text-sm text-stone-400 bg-white border border-stone-200 rounded-xl px-5 py-4">
              No creator links yet. Verify with World ID above to create one.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="bg-white border border-stone-200 rounded-xl px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-800">✓ {l.campaign_name}</p>
                    <p className="text-xs text-stone-400 font-mono mt-0.5">/{l.slug}</p>
                  </div>
                  <span className="text-xs text-stone-300">
                    {new Date(l.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Test scenarios reference */}
        <section className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">Test Scenarios</p>
          <ol className="text-sm text-stone-600 space-y-1.5 list-decimal list-inside">
            <li>Verify → create link for Campaign A → expect <span className="text-emerald-600 font-medium">SUCCESS</span></li>
            <li>Same identity → Campaign A again → expect <span className="text-red-500 font-medium">REJECTED</span></li>
            <li>Same identity → Campaign B → expect <span className="text-emerald-600 font-medium">SUCCESS</span></li>
            <li>Same identity → Campaign C → expect <span className="text-emerald-600 font-medium">SUCCESS</span></li>
            <li>Different simulator identity → Campaign A → expect <span className="text-emerald-600 font-medium">SUCCESS</span></li>
            <li>Cancel verification → expect no link created</li>
          </ol>
        </section>

      </div>

      {/* World ID Widget — rendered when open */}
      {widgetOpen && rpContext && (
        <IDKitRequestWidget
          app_id={appId}
          action={action}
          rp_context={rpContext}
          preset={proofOfHuman()}
          allow_legacy_proofs={false}
          environment="staging"
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          onError={onError}
          open={widgetOpen}
          onOpenChange={(open) => {
            if (!open) {
              setWidgetOpen(false);
              setActiveCampaign(null);
              if (!lastVerifyResult) {
                showToast("info", "Verification cancelled. No creator link was created.");
              }
            }
          }}
        />
      )}

      {/* Preparing overlay */}
      {preparing && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-8 py-6 text-sm text-stone-600 shadow-xl">
            Preparing World ID verification…
          </div>
        </div>
      )}
    </main>
  );
}
