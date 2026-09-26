import type { Pool } from "pg";
import { emitAlert, type MetricsRegistry } from "@kawaipay/shared";
import { findActiveLinkIds, computeLinkRiskSignals } from "./analysis.js";
import { combineRuleResults, evaluateRules, type RuleResult } from "./rules.js";

export interface SentinelMetrics {
  linksEvaluated: ReturnType<MetricsRegistry["counter"]>;
  flagsRaised: ReturnType<MetricsRegistry["counter"]>;
  linksOnHold: ReturnType<MetricsRegistry["gauge"]>;
}

export function registerSentinelMetrics(registry: MetricsRegistry): SentinelMetrics {
  return {
    linksEvaluated: registry.counter("sentinel_links_evaluated_total", "links the sentinel has evaluated"),
    flagsRaised: registry.counter("sentinel_flags_raised_total", "new risk_flags rows inserted, by rule"),
    linksOnHold: registry.gauge("sentinel_links_on_hold", "links currently held (link_risk.hold = true)"),
  };
}

/** Upserts link_risk to the freshly-computed state — self-healing: a link with no firing rules is reset to clean. */
async function applyRiskDecision(pg: Pool, linkId: string, weightMultiplier: number, hold: boolean): Promise<void> {
  await pg.query(
    `INSERT INTO link_risk (link_id, weight_multiplier, hold, updated_at) VALUES ($1, $2, $3, now())
     ON CONFLICT (link_id) DO UPDATE SET weight_multiplier = EXCLUDED.weight_multiplier, hold = EXCLUDED.hold, updated_at = now()`,
    [linkId, weightMultiplier, hold],
  );
}

/** Records a new flag only if there isn't already an unresolved one for the same (link, rule) — avoids re-flagging every cycle for a persistent condition. */
async function recordFlagIfNew(pg: Pool, linkId: string, result: RuleResult): Promise<boolean> {
  const { rows } = await pg.query(`SELECT 1 FROM risk_flags WHERE link_id = $1 AND rule = $2 AND resolved_at IS NULL`, [linkId, result.rule]);
  if (rows.length > 0) return false;
  await pg.query(`INSERT INTO risk_flags (link_id, rule, level, evidence) VALUES ($1, $2, $3, $4)`, [
    linkId,
    result.rule,
    result.level,
    JSON.stringify(result.evidence),
  ]);
  return true;
}

export interface SentinelCycleSummary {
  evaluated: number;
  newFlags: number;
  linksOnHold: number;
}

/**
 * One sentinel cycle (ticket H1): re-evaluate every link with recent activity against
 * the fraud rules, persist the resulting risk state to `link_risk` — which the gateway
 * already reads on every heartbeat via `getLinkMirror` (services/gateway/src/mirror.ts),
 * so this alone is enough to affect real-time scoring, no other service needs to change —
 * and record any newly-firing rule to `risk_flags` for human review.
 */
export async function runSentinelCycle(
  pg: Pool,
  opts: { lookbackMs: number; nowMs: number },
  metrics?: SentinelMetrics,
): Promise<SentinelCycleSummary> {
  const linkIds = await findActiveLinkIds(pg, opts.lookbackMs, opts.nowMs);
  let newFlags = 0;
  let linksOnHold = 0;

  for (const linkId of linkIds) {
    const signals = await computeLinkRiskSignals(pg, linkId, opts.lookbackMs, opts.nowMs);
    const results = evaluateRules(signals);
    const decision = combineRuleResults(results);
    await applyRiskDecision(pg, linkId, decision.weightMultiplier, decision.hold);
    metrics?.linksEvaluated.inc();

    for (const result of results) {
      const isNew = await recordFlagIfNew(pg, linkId, result);
      if (isNew) {
        newFlags++;
        metrics?.flagsRaised.inc({ rule: result.rule });
        if (result.suggestedHold) {
          emitAlert("sentinel", "critical", result.rule, `link ${linkId} put on hold`, { linkId, evidence: result.evidence });
        }
      }
    }
    if (decision.hold) linksOnHold++;
  }

  metrics?.linksOnHold.set(linksOnHold);
  return { evaluated: linkIds.length, newFlags, linksOnHold };
}
