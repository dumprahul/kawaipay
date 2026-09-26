"use client";

import { useState } from "react";
import { buildOAuthUrl, createEphemeralSession } from "@/lib/zklogin";

type Role = "buyer" | "creator" | "owner";

const ROLES: { id: Role; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "buyer",
    label: "Buyer",
    description: "Discover and purchase products",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
  {
    id: "creator",
    label: "Creator",
    description: "Share products and earn SUI rewards",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.82V18a1 1 0 01-1.447.894L15 17M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
  },
  {
    id: "owner",
    label: "Product Owner",
    description: "List products and manage your store",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

interface LoginModalProps {
  onClose: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    if (!selectedRole) return;
    setLoading(true);
    setError(null);
    try {
      const session = await createEphemeralSession();
      // Store role so callback can redirect appropriately
      sessionStorage.setItem("kawaii_role", selectedRole);
      const url = buildOAuthUrl("google", session.nonce);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start login");
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[var(--espresso)]/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[var(--cream)] rounded-2xl shadow-2xl border border-[var(--sand)] overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[var(--sand)]">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-[var(--muted-brown)] hover:text-[var(--espresso)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h2 className="text-2xl font-bold text-[var(--espresso)] tracking-tight">Welcome to KawaiiPay</h2>
          <p className="mt-1 text-sm text-[var(--muted-brown)]">
            Powered by zkLogin — no wallet or seed phrase needed
          </p>
        </div>

        <div className="px-8 py-6 space-y-6">
          {/* Role selection */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-brown)] mb-3">
              I am a…
            </p>
            <div className="space-y-2">
              {ROLES.map((role) => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left ${
                    selectedRole === role.id
                      ? "border-[var(--espresso)] bg-[var(--ivory)] text-[var(--espresso)]"
                      : "border-[var(--sand)] bg-[var(--ivory)] text-[var(--muted-brown)] hover:border-[var(--brown)] hover:text-[var(--espresso)]"
                  }`}
                >
                  <span className={`shrink-0 ${selectedRole === role.id ? "text-[var(--espresso)]" : "text-[var(--muted-brown)]"}`}>
                    {role.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{role.label}</p>
                    <p className="text-xs opacity-70 mt-0.5">{role.description}</p>
                  </div>
                  {selectedRole === role.id && (
                    <span className="ml-auto shrink-0">
                      <svg className="w-4 h-4 text-[var(--espresso)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Google sign-in */}
          <button
            onClick={handleGoogleLogin}
            disabled={!selectedRole || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--espresso)] text-[var(--cream)] text-sm font-medium hover:bg-[var(--brown)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#fff" opacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#fff" opacity="0.7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#fff" opacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#fff" opacity="0.8" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          {error && (
            <p className="text-red-700 text-xs text-center bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          <p className="text-center text-[var(--muted-brown)] text-xs leading-relaxed">
            Your Sui address is derived from your OAuth identity.<br />
            No personal data is stored on-chain.
          </p>
        </div>
      </div>
    </div>
  );
}
