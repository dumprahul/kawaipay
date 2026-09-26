"use client";

import { useCallback, useEffect, useState } from "react";
import { IDKitRequestWidget, proofOfHuman } from "@worldcoin/idkit";
import type { IDKitResult, RpContext, IDKitErrorCodes } from "@worldcoin/idkit";
import { getWorldIdStatus, getWorldIdRpSignature, verifyWorldId, ApiError, type WorldIdStatus } from "@/lib/api";

/**
 * A creator's first two payouts need no verification at all — this card only starts
 * mattering once those are used up, at which point the batcher holds every further
 * payout until this succeeds. Verification is valid for 7 days, then this needs
 * running again — real Proof of Humanity, checked against World's own servers, not a
 * client-side flag.
 */
export default function WorldIdVerification({ address }: { address: string }) {
  const [status, setStatus] = useState<WorldIdStatus | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [action, setAction] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justVerifiedUntil, setJustVerifiedUntil] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getWorldIdStatus(address));
    } catch {
      // Status is a nice-to-have — if it fails to load, the verify button still works.
    }
  }, [address]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleStartVerify() {
    setError(null);
    setPreparing(true);
    try {
      const { rp_context, action } = await getWorldIdRpSignature(address);
      setRpContext(rp_context as unknown as RpContext);
      setAction(action);
      setWidgetOpen(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setNotConfigured(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to start World ID verification");
      }
    } finally {
      setPreparing(false);
    }
  }

  const handleVerify = async (result: IDKitResult): Promise<void> => {
    const { verifiedUntil } = await verifyWorldId(address, result);
    setJustVerifiedUntil(verifiedUntil);
  };

  const onSuccess = () => {
    setWidgetOpen(false);
    loadStatus();
  };

  const onError = (errorCode: IDKitErrorCodes) => {
    setWidgetOpen(false);
    setError(`Verification failed (${JSON.stringify(errorCode)}). Try again.`);
  };

  if (notConfigured) return null; // World ID not set up on this deployment yet — don't show a broken button.

  const appId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "app_staging_placeholder") as `app_${string}`;
  const verifiedUntilDisplay = justVerifiedUntil ?? status?.verifiedUntil;

  return (
    <div className="rounded-2xl border border-[var(--sand)] bg-[var(--ivory)] p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status?.verified || justVerifiedUntil ? "bg-[var(--accent-green)]" : "bg-[var(--brown)]"}`} />
          <h3 className="text-sm font-semibold text-[var(--espresso)]">Proof of Humanity — World ID</h3>
        </div>
        <p className="text-xs text-[var(--muted-brown)] mt-1 leading-relaxed">
          {status?.verified || justVerifiedUntil
            ? `Verified — good until ${new Date(verifiedUntilDisplay!).toLocaleDateString()}. Re-verify weekly to keep payouts flowing.`
            : status
              ? `Your first ${status.freePayoutsRemaining > 0 ? status.freePayoutsRemaining : 0} payout${status.freePayoutsRemaining === 1 ? "" : "s"} need no verification. After that, payouts are held until you verify.`
              : "Verify once a week to keep receiving payouts beyond your first couple."}
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>

      <button
        onClick={handleStartVerify}
        disabled={preparing}
        className="shrink-0 px-4 py-2 rounded-full bg-[var(--espresso)] text-[var(--cream)] text-xs font-medium hover:bg-[var(--brown)] transition-colors disabled:opacity-60"
      >
        {preparing ? "Preparing…" : status?.verified ? "Re-verify" : "Verify with World ID"}
      </button>

      {widgetOpen && rpContext && (
        <IDKitRequestWidget
          app_id={appId}
          action={action}
          rp_context={rpContext}
          preset={proofOfHuman()}
          allow_legacy_proofs={false}
          environment={process.env.NEXT_PUBLIC_WORLD_ENVIRONMENT === "production" ? "production" : "staging"}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
          onError={onError}
          open={widgetOpen}
          onOpenChange={(open) => { if (!open) setWidgetOpen(false); }}
        />
      )}
    </div>
  );
}
