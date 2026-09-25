"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadZkLoginSession, clearZkLoginSession, suiClient } from "@/lib/zklogin";

export default function DashboardPage() {
  const router = useRouter();
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const session = loadZkLoginSession();
    if (!session) {
      router.push("/login");
      return;
    }
    setAddress(session.address);
    fetchBalance(session.address);
  }, [router]);

  async function fetchBalance(addr: string) {
    try {
      const res = await fetch("https://graphql.testnet.sui.io/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{ address(address: "${addr}") { balance { totalBalance } } }`,
        }),
      });
      const { data } = await res.json();
      const raw = data?.address?.balance?.totalBalance ?? "0";
      const sui = (Number(raw) / 1_000_000_000).toFixed(4);
      setBalance(sui);
    } catch {
      setBalance("0.0000");
    }
  }

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleLogout() {
    clearZkLoginSession();
    router.push("/login");
  }

  if (!address) return null;

  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Sui Address Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
            Your Sui Address
          </p>
          <div className="flex items-center gap-3">
            <code className="text-blue-400 text-sm break-all flex-1">
              {address}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <a
            href={`https://suiscan.xyz/testnet/account/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            View on Suiscan ↗
          </a>
        </div>

        {/* Balance Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-2">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
            Balance
          </p>
          <p className="text-3xl font-bold text-white">
            {balance !== null ? `${balance} SUI` : "Loading..."}
          </p>
          <p className="text-xs text-gray-500">Testnet</p>
        </div>

        {/* How it works */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
            How zkLogin works
          </p>
          <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
            <li>An ephemeral keypair was generated in your browser</li>
            <li>You authenticated with your OAuth provider (Google/Apple/Twitch)</li>
            <li>A zero-knowledge proof was generated — no identity revealed on-chain</li>
            <li>Your Sui address is derived deterministically from your OAuth identity + salt</li>
            <li>The same identity always produces the same address, from any device</li>
          </ol>
        </div>
      </div>
    </main>
  );
}
