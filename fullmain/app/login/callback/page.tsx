"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import {
  restoreEphemeralSession,
  fetchUserSalt,
  deriveAddress,
  fetchZkProof,
  saveZkLoginSession,
  saveBuyerSession,
} from "@/lib/zklogin";

type Status =
  | "extracting"
  | "fetching_salt"
  | "generating_proof"
  | "done"
  | "error";

const statusMessages: Record<Status, string> = {
  extracting: "Reading your identity...",
  fetching_salt: "Fetching your address salt...",
  generating_proof: "Generating zero-knowledge proof (this takes ~3 seconds)...",
  done: "All done! Redirecting...",
  error: "Something went wrong.",
};

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("extracting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        const hash = window.location.hash.substring(1);
        const query = window.location.search.substring(1);
        const params = new URLSearchParams(hash || query);
        const jwt = params.get("id_token");

        if (!jwt) {
          throw new Error(
            "No id_token found in callback URL. OAuth may have failed or been cancelled."
          );
        }

        const role = sessionStorage.getItem("kawaii_role");

        if (role === "buyer") {
          // Buyers: just decode JWT, no Sui/zkLogin needed
          const decoded = jwtDecode<{ email: string; name: string; picture?: string; sub: string }>(jwt);
          saveBuyerSession({
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
            sub: decoded.sub,
          });
          setStatus("done");
          router.push("/dashboard");
          return;
        }

        // Creator / Product Owner: full zkLogin → Sui address
        const ephemeral = restoreEphemeralSession();
        if (!ephemeral) {
          throw new Error(
            "Ephemeral session expired or not found. Please try logging in again."
          );
        }

        setStatus("fetching_salt");
        const salt = await fetchUserSalt(jwt);
        const address = deriveAddress(jwt, salt);

        setStatus("generating_proof");
        let proof;
        let lastErr: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            proof = await fetchZkProof(jwt, ephemeral, salt);
            break;
          } catch (e) {
            lastErr = e;
            const is429 = e instanceof Error && e.message.includes("429");
            if (!is429 || attempt === 2) throw e;
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
        if (!proof) throw lastErr;

        saveZkLoginSession({
          proof,
          address,
          salt,
          jwt,
          maxEpoch: ephemeral.maxEpoch,
          keypairSecret: ephemeral.keypair.getSecretKey(),
        });

        setStatus("done");
        router.push("/dashboard");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const friendly = msg.includes("429") || msg.includes("TooManyRequests")
          ? "The proof server is busy. Please try again in a few seconds."
          : msg.includes("Ephemeral")
          ? "Session expired. Please log in again."
          : msg.includes("id_token")
          ? "Google sign-in was cancelled or failed. Please try again."
          : "Something went wrong during sign-in. Please try again.";
        setError(friendly);
        setStatus("error");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--cream)]">
      <div className="w-full max-w-sm p-8 text-center space-y-4">
        {status !== "error" ? (
          <>
            <svg
              className="w-10 h-10 animate-spin text-[var(--accent-green)] mx-auto"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-[var(--espresso)] font-medium">{statusMessages[status]}</p>
            <div className="flex justify-center gap-1">
              {(["extracting", "fetching_salt", "generating_proof", "done"] as Status[]).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    ["extracting", "fetching_salt", "generating_proof", "done"].indexOf(s) <=
                    ["extracting", "fetching_salt", "generating_proof", "done"].indexOf(status)
                      ? "bg-[var(--accent-green)]"
                      : "bg-[var(--sand)]"
                  }`}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="text-[var(--brown)] text-4xl">✕</div>
            <p className="text-[var(--espresso)] font-medium">Login failed</p>
            <p className="text-[var(--brown)] text-sm bg-[var(--ivory)] border border-[var(--sand)] rounded-lg px-4 py-3">
              {error}
            </p>
            <button
              onClick={() => router.push("/shop")}
              className="mt-4 px-6 py-2 bg-[var(--espresso)] hover:bg-[var(--brown)] text-white rounded-xl text-sm transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </main>
  );
}
