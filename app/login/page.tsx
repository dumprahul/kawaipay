"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildOAuthUrl, createEphemeralSession } from "@/lib/zklogin";

const providers = [
  {
    id: "google" as const,
    label: "Continue with Google",
    bg: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  },
  {
    id: "twitch" as const,
    label: "Continue with Twitch",
    bg: "bg-purple-600 hover:bg-purple-700 text-white",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" />
      </svg>
    ),
  },
  {
    id: "apple" as const,
    label: "Continue with Apple",
    bg: "bg-black hover:bg-gray-900 text-white",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.54 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
      </svg>
    ),
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(provider: "google" | "apple" | "twitch") {
    setLoading(provider);
    setError(null);

    try {
      const session = await createEphemeralSession();
      const url = buildOAuthUrl(provider, session.nonce);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start login");
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Sign in</h1>
          <p className="text-gray-400 text-sm">
            Powered by zkLogin — no wallet or seed phrase needed
          </p>
        </div>

        <div className="space-y-3">
          {providers.filter(p =>
          p.id === "google" ? !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID !== "your_google_client_id_here" :
          p.id === "apple" ? !!process.env.NEXT_PUBLIC_APPLE_CLIENT_ID && process.env.NEXT_PUBLIC_APPLE_CLIENT_ID !== "your_apple_client_id_here" :
          !!process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID && process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID !== "your_twitch_client_id_here"
        ).map((p) => (
            <button
              key={p.id}
              onClick={() => handleLogin(p.id)}
              disabled={loading !== null}
              className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 ${p.bg}`}
            >
              {loading === p.id ? (
                <svg
                  className="w-5 h-5 animate-spin"
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
              ) : (
                p.icon
              )}
              {p.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-950 border border-red-800 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <p className="text-center text-gray-600 text-xs">
          Your Sui address is derived from your OAuth identity.
          <br />
          No personal data is stored on-chain.
        </p>
      </div>
    </main>
  );
}
