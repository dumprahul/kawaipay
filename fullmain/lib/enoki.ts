import { EnokiFlow } from "@mysten/enoki";

// Enoki replaces our previous DIY zkLogin pipeline (own prover + salt calls against
// Mysten's shared public dev prover), which was rate-limited and, once past the rate
// limit, could return a proof that failed Groth16 verification on-chain. Enoki hosts
// the prover/salt infra behind a paid, reliable API key instead.
const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY!;

export type EnokiSuiNetwork = "mainnet" | "testnet" | "devnet";

export const ENOKI_NETWORK: EnokiSuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as EnokiSuiNetwork) || "testnet";

let flow: EnokiFlow | null = null;

// EnokiFlow reads/writes browser storage on construction — must only ever be created
// client-side, and only once (it owns the reactive $zkLoginState/$zkLoginSession atoms
// that every login-aware component reads from).
export function getEnokiFlow(): EnokiFlow {
  if (typeof window === "undefined") {
    throw new Error("getEnokiFlow() must only be called in the browser");
  }
  if (!flow) {
    flow = new EnokiFlow({ apiKey: ENOKI_API_KEY });
  }
  return flow;
}
