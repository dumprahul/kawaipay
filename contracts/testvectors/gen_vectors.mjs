import crypto from "node:crypto";

function u64le(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}
function uleb128(n) {
  const bytes = [];
  let v = n;
  while (true) {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
    if (v === 0) break;
  }
  return Buffer.from(bytes);
}
function bcsAttestation(a) {
  return Buffer.concat([
    a.campaignId, a.linkId,
    u64le(a.seq), u64le(a.secondsVerified), u64le(a.amount),
    uleb128(a.logRoot.length), a.logRoot,
    u64le(a.expiresAtMs),
  ]);
}

const DOMAIN = Buffer.from("KAWAIPAY_PAYOUT_V1", "utf8");
function hex32(seed) {
  return crypto.createHash("sha256").update(seed).digest();
}

// The REAL, deterministic object IDs produced by the fixed setup sequence in
// payout_tests.move (probed once via std::debug::print, see zzz_id_probe_tests.move).
const CAMPAIGN_ID = Buffer.from("01c5e4703d8ab941c77c53ac590c7764b9e6f197cd1bb6692613a1d3df9a2564", "hex");
const LINK_ID = Buffer.from("75c3360eb19fd2c20fbba5e2da8cf1a39cdb1ee913af3802ba330b852e459e05", "hex");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const pubJwk = publicKey.export({ format: "jwk" });
const privJwk = privateKey.export({ format: "jwk" });
const pubkeyBytes = Buffer.from(pubJwk.x, "base64url");
const privSeedBytes = Buffer.from(privJwk.d, "base64url");
function sign(message) { return crypto.sign(null, message, privateKey); }

const logRoot = hex32("log-root-1");
const FAR_FUTURE_MS = 4102444800000; // year 2100, i.e. "never expires" in these tests

const scenarios = {
  happyPath:        { seq: 0, secondsVerified: 60, amount: 1000,   logRoot, expiresAtMs: FAR_FUTURE_MS },
  seqOne:            { seq: 1, secondsVerified: 60, amount: 1000,   logRoot, expiresAtMs: FAR_FUTURE_MS },
  expired:           { seq: 0, secondsVerified: 60, amount: 1000,   logRoot, expiresAtMs: 1000 },
  rateExceeded:      { seq: 0, secondsVerified: 60, amount: 999999, logRoot, expiresAtMs: FAR_FUTURE_MS },
  settleCapExceeded: { seq: 0, secondsVerified: 60, amount: 50000,  logRoot, expiresAtMs: FAR_FUTURE_MS },
  epochCapExceeded:  { seq: 0, secondsVerified: 60, amount: 1000,   logRoot, expiresAtMs: FAR_FUTURE_MS },
  budgetExceeded:    { seq: 0, secondsVerified: 60, amount: 1000,   logRoot, expiresAtMs: FAR_FUTURE_MS },
  zeroAmount:        { seq: 0, secondsVerified: 60, amount: 0,      logRoot, expiresAtMs: FAR_FUTURE_MS },
};

const out = { pubkeyHex: pubkeyBytes.toString("hex"), privSeedHex: privSeedBytes.toString("hex"), vectors: {} };
for (const [name, s] of Object.entries(scenarios)) {
  const message = Buffer.concat([DOMAIN, bcsAttestation({
    campaignId: CAMPAIGN_ID, linkId: LINK_ID, seq: s.seq, secondsVerified: s.secondsVerified,
    amount: s.amount, logRoot: s.logRoot, expiresAtMs: s.expiresAtMs,
  })]);
  out.vectors[name] = {
    seq: s.seq, secondsVerified: s.secondsVerified, amount: s.amount,
    logRootHex: s.logRoot.toString("hex"), expiresAtMs: s.expiresAtMs,
    messageHex: message.toString("hex"), signatureHex: sign(message).toString("hex"),
  };
}

// Wrong-signer vector: a second keypair signs the exact happy-path message.
const other = crypto.generateKeyPairSync("ed25519");
const happyMessage = Buffer.from(out.vectors.happyPath.messageHex, "hex");
out.wrongSignerSignatureHex = crypto.sign(null, happyMessage, other.privateKey).toString("hex");

// Bad log_root vector: sign a message with a DIFFERENT 32-byte log_root than what
// gets passed to settle (so the reconstructed message won't match the signature).
const differentLogRoot = hex32("log-root-DIFFERENT");
out.tamperedLogRootHex = differentLogRoot.toString("hex");

console.log(JSON.stringify(out, null, 2));
