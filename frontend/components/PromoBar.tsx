import Link from "next/link";

export default function PromoBar() {
  return (
    <div className="w-full bg-[var(--espresso)] text-[var(--cream)] text-xs py-2.5 text-center tracking-wide">
      Earn while you discover.&nbsp;
      <span className="text-[var(--sand)]">Verified attention. Instant rewards.</span>
      &nbsp;·&nbsp;
      <Link href="/creator" className="underline underline-offset-2 hover:text-white transition-colors">
        Learn how →
      </Link>
    </div>
  );
}
