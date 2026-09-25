"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  restoreEphemeralSession,
  fetchUserSalt,
  deriveAddress,
  fetchZkProof,
  saveZkLoginSession,
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
        // Extract JWT from URL hash or query params depending on provider
        // Google/Twitch return id_token in the hash fragment (#id_token=...)
        // Apple returns in query params (form_post)
        const hash = window.location.hash.substring(1);
        const query = window.location.search.substring(1);
        const params = new URLSearchParams(hash || query);
        const jwt = params.get("id_token");

        if (!jwt) {
          throw new Error(
            "No id_token found in callback URL. OAuth may have failed or been cancelled."
          );
        }

        // Restore the ephemeral session we stored before redirecting
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
        const proof = await fetchZkProof(jwt, ephemeral, salt);

        // Save the full session — keypair is stored as secret key string
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
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    }

    handleCallback();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm p-8 text-center space-y-4">
        {status !== "error" ? (
          <>
            <svg
              className="w-10 h-10 animate-spin text-blue-500 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            <p className="text-white font-medium">{statusMessages[status]}</p>
            <div className="flex justify-center gap-1">
              {(["extracting", "fetching_salt", "generating_proof", "done"] as Status[]).map(
                (s) => (
                  <div
                    key={s}
                    className={`h-1.5 w-8 rounded-full transition-colors ${
                      ["extracting", "fetching_salt", "generating_proof", "done"].indexOf(s) <=
                      ["extracting", "fetching_salt", "generating_proof", "done"].indexOf(status)
                        ? "bg-blue-500"
                        : "bg-gray-700"
                    }`}
                  />
                )
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-red-400 text-4xl">✕</div>
            <p className="text-white font-medium">Login failed</p>
            <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded-lg px-4 py-3">
              {error}
            </p>
            <button
              onClick={() => router.push("/login")}
              className="mt-4 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </main>
  );
}
