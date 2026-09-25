import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiGraphQLClient } from "@mysten/sui/graphql";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  jwtToAddress,
  genAddressSeed,
} from "@mysten/sui/zklogin";
import { jwtDecode } from "jwt-decode";

const PROVER_URL =
  process.env.NEXT_PUBLIC_PROVER_URL ||
  "https://prover-dev.mystenlabs.com/v1";
const SALT_SERVICE_URL =
  process.env.NEXT_PUBLIC_SALT_SERVICE_URL ||
  "https://salt.api.mystenlabs.com/get_salt";
const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet";

const GRAPHQL_URL = `https://graphql.${SUI_NETWORK}.sui.io/graphql`;

export const suiClient = new SuiGraphQLClient({ url: GRAPHQL_URL, network: SUI_NETWORK });

export interface EphemeralSession {
  keypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

export interface ZkLoginProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

export interface ZkLoginSession {
  proof: ZkLoginProof;
  address: string;
  salt: string;
  jwt: string;
  maxEpoch: number;
  keypair: Ed25519Keypair;
}

// Step 1 — generate ephemeral keypair + nonce, store in sessionStorage
export async function createEphemeralSession(): Promise<EphemeralSession> {
  // Fetch current epoch via GraphQL
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ epoch { epochId } }" }),
  });
  const { data } = await res.json();
  const maxEpoch = Number(data.epoch.epochId) + 2;

  const keypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(keypair.getPublicKey(), maxEpoch, randomness);

  sessionStorage.setItem(
    "zklogin_ephemeral",
    JSON.stringify({
      keypairSecret: keypair.getSecretKey(),
      randomness,
      nonce,
      maxEpoch,
    })
  );

  return { keypair, randomness, nonce, maxEpoch };
}

// Restore ephemeral session from sessionStorage (used on callback page)
export function restoreEphemeralSession(): EphemeralSession | null {
  const raw = sessionStorage.getItem("zklogin_ephemeral");
  if (!raw) return null;
  const { keypairSecret, randomness, nonce, maxEpoch } = JSON.parse(raw);
  const keypair = Ed25519Keypair.fromSecretKey(keypairSecret);
  return { keypair, randomness, nonce, maxEpoch };
}

// Step 2 — build OAuth redirect URL for each provider
export function buildOAuthUrl(
  provider: "google" | "apple" | "twitch",
  nonce: string
): string {
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;

  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      response_type: "id_token",
      redirect_uri: redirectUri,
      scope: "openid",
      nonce,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  if (provider === "apple") {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: "email",
      response_mode: "form_post",
      response_type: "code id_token",
      nonce,
    });
    return `https://appleid.apple.com/auth/authorize?${params}`;
  }

  if (provider === "twitch") {
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      force_verify: "true",
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid",
      nonce,
    });
    return `https://id.twitch.tv/oauth2/authorize?${params}`;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// Step 3 — fetch user salt via local proxy (avoids CORS from browser)
export async function fetchUserSalt(jwt: string): Promise<string> {
  const res = await fetch("/api/salt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: jwt }),
  });
  if (!res.ok) throw new Error(`Salt service error: ${res.status}`);
  const { salt } = await res.json();
  return salt;
}

// Step 4 — derive Sui address from JWT + salt
export function deriveAddress(jwt: string, salt: string): string {
  return jwtToAddress(jwt, salt, false);
}

// Step 5 — call prover via local proxy (avoids CORS from browser)
export async function fetchZkProof(
  jwt: string,
  ephemeralSession: EphemeralSession,
  salt: string
): Promise<ZkLoginProof> {
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralSession.keypair.getPublicKey()
  );

  const res = await fetch("/api/prover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey,
      maxEpoch: ephemeralSession.maxEpoch.toString(),
      jwtRandomness: ephemeralSession.randomness,
      salt,
      keyClaimName: "sub",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Prover error ${res.status}: ${err}`);
  }

  return res.json();
}

// Step 6 — assemble full zkLogin signature for a transaction
export async function buildZkLoginSignature(
  session: ZkLoginSession,
  transactionBytes: Uint8Array
): Promise<string> {
  const { signature: ephemeralSignature } =
    await session.keypair.signTransaction(transactionBytes);

  const decoded = jwtDecode<{ sub: string; aud: string | string[] }>(
    session.jwt
  );
  const aud = Array.isArray(decoded.aud) ? decoded.aud[0] : decoded.aud;

  const addressSeed = genAddressSeed(
    BigInt(session.salt),
    "sub",
    decoded.sub,
    aud
  ).toString();

  return getZkLoginSignature({
    inputs: {
      ...session.proof,
      addressSeed,
    },
    maxEpoch: session.maxEpoch,
    userSignature: ephemeralSignature,
  });
}

// Save completed zkLogin session to sessionStorage
export function saveZkLoginSession(
  session: Omit<ZkLoginSession, "keypair"> & { keypairSecret: string }
) {
  sessionStorage.setItem("zklogin_session", JSON.stringify(session));
}

// Restore zkLogin session from sessionStorage
export function loadZkLoginSession(): ZkLoginSession | null {
  const raw = sessionStorage.getItem("zklogin_session");
  if (!raw) return null;
  const { keypairSecret, ...rest } = JSON.parse(raw);
  const keypair = Ed25519Keypair.fromSecretKey(keypairSecret);
  return { ...rest, keypair };
}

export function clearZkLoginSession() {
  sessionStorage.removeItem("zklogin_session");
  sessionStorage.removeItem("zklogin_ephemeral");
}
