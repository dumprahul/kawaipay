import { SuiGraphQLClient } from "@mysten/sui/graphql";
import type { AuthProvider } from "@mysten/enoki";
import { jwtDecode } from "jwt-decode";
import { getEnokiFlow, ENOKI_NETWORK } from "./enoki";

const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";
const GRAPHQL_URL = `https://graphql.${SUI_NETWORK}.sui.io/graphql`;

export const suiClient = new SuiGraphQLClient({ url: GRAPHQL_URL, network: SUI_NETWORK });

// Enoki's AuthProvider type has no "apple" entry (unlike our original design's
// Google/Apple/Twitch), so the Apple option is dropped from creator/owner login.
export type ZkLoginProvider = Extract<AuthProvider, "google" | "twitch">;

export interface ZkLoginSession {
  address: string;
  provider: AuthProvider;
}

// Always the origin the app is actually running on — never a fixed env var. A hardcoded
// NEXT_PUBLIC_REDIRECT_URI bakes in one origin at build time, so deploying the exact same
// build to a different domain (or running it locally) sends the OAuth redirect to the
// wrong place. Google/Twitch just need every origin you actually use registered as an
// authorized redirect URI — they don't care how the URL was constructed.
function getRedirectUri(): string {
  return `${window.location.origin}/login/callback`;
}

// Step 1 — kick off the OAuth redirect. Enoki generates and stores the ephemeral
// keypair/nonce/maxEpoch internally; we just need the resulting authorization URL.
export async function startZkLogin(provider: ZkLoginProvider): Promise<string> {
  const flow = getEnokiFlow();
  return flow.createAuthorizationURL({
    provider,
    clientId:
      provider === "google"
        ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
        : process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
    redirectUrl: getRedirectUri(),
    network: ENOKI_NETWORK,
  });
}

// Step 2 — called from the OAuth callback page. Enoki reads the id_token out of
// window.location.hash itself, verifies it, fetches salt + proof from its own hosted
// infra, and persists everything.
export async function completeZkLogin(): Promise<void> {
  const flow = getEnokiFlow();
  await flow.handleAuthCallback();
  // handleAuthCallback resolves the JWT/session but getSession() is what actually
  // fetches+caches the ZK proof — call it now so the first "List Product"/"Share &
  // Earn" action doesn't have to eat that latency on top of its own tx build+submit.
  await flow.getSession();
}

// Read the current zkLogin session (address + provider), if any. Always async: Enoki's
// internal state is restored from encrypted storage on construction, and we must wait
// for that restore to finish before trusting $zkLoginState.
export async function loadZkLoginSession(): Promise<ZkLoginSession | null> {
  if (typeof window === "undefined") return null;
  const flow = getEnokiFlow();
  const session = await flow.getSession();
  if (!session) return null;
  const { address, provider } = flow.$zkLoginState.get();
  if (!address || !provider) return null;
  return { address, provider };
}

export function clearZkLoginSession() {
  if (typeof window === "undefined") return;
  void getEnokiFlow().logout();
}

// Step 3 — sign transaction bytes with the logged-in creator/owner's zkLogin identity.
// EnokiKeypair (a real Signer) assembles the complete zkLogin signature internally —
// no manual genAddressSeed/getZkLoginSignature assembly needed anymore.
export async function buildZkLoginSignature(
  _session: ZkLoginSession,
  transactionBytes: Uint8Array
): Promise<string> {
  const keypair = await getEnokiFlow().getKeypair({ network: ENOKI_NETWORK });
  const { signature } = await keypair.signTransaction(transactionBytes);
  return signature;
}

// Step 3b — same, for a personal message (used by the campaign-metadata PUT, whose
// verifier is scheme-agnostic and accepts a zkLogin signature just like an Ed25519 one).
export async function buildZkLoginPersonalMessageSignature(
  _session: ZkLoginSession,
  message: Uint8Array
): Promise<string> {
  const keypair = await getEnokiFlow().getKeypair({ network: ENOKI_NETWORK });
  const { signature } = await keypair.signPersonalMessage(message);
  return signature;
}

// Plain Google OAuth for buyers — no nonce/zkLogin, just email + name
export function buildBuyerOAuthUrl(): string {
  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce: Math.random().toString(36).slice(2), // throwaway nonce — not used for zkLogin
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface BuyerSession {
  email: string;
  name: string;
  picture?: string;
  sub: string;
}

export function saveBuyerSession(session: BuyerSession) {
  sessionStorage.setItem("buyer_session", JSON.stringify(session));
}

export function loadBuyerSession(): BuyerSession | null {
  const raw = sessionStorage.getItem("buyer_session");
  return raw ? JSON.parse(raw) : null;
}

export function clearBuyerSession() {
  sessionStorage.removeItem("buyer_session");
}

// Used only by the buyer OAuth path in the callback page (jwtDecode re-exported so that
// page doesn't need its own direct dependency on jwt-decode for this one call).
export { jwtDecode };
