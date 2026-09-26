export interface LinkRiskSignals {
  linkId: string;
  totalTicks: number;
  rejectRate: number; // fraction of recent ticks verdict='reject'
  botSignatureRate: number; // fraction of recent ticks flagged STATS_REPEATING or GAP_TOO_REGULAR
  sessionCount: number; // distinct sessions active in the window
  dominantSourceRatio: number; // fraction of those sessions sharing the single most common ip_hash
}

export interface RuleResult {
  rule: string;
  level: 1 | 2 | 3;
  evidence: Record<string, unknown>;
  suggestedHold?: boolean;
  suggestedWeightMultiplier?: number;
}

// Below these sample sizes there isn't enough signal to judge a link fairly — a link with
// 3 ticks that all happen to be rejects isn't evidence of anything.
const MIN_SAMPLE_TICKS = 20;
const MIN_SAMPLE_SESSIONS = 5;

const REJECT_RATE_THRESHOLD = 0.6;
const BOT_SIGNATURE_THRESHOLD = 0.5;
const SOURCE_CONCENTRATION_THRESHOLD = 0.8;

/**
 * The fraud rules (ticket H1, spec section 10). Pure and stateless — every run
 * recomputes fresh evidence from a window of recent activity, so a link that was
 * flagged can recover automatically once its behavior actually changes, rather than
 * needing a manual unflag. That's a deliberate trade-off: it self-heals from transient
 * blips, but a determined bad actor who keeps triggering a rule stays flagged for as
 * long as they keep triggering it — there's no escalating/sticky penalty here, only
 * "is this still true right now."
 */
export function evaluateRules(signals: LinkRiskSignals): RuleResult[] {
  const results: RuleResult[] = [];

  if (signals.totalTicks >= MIN_SAMPLE_TICKS) {
    if (signals.botSignatureRate >= BOT_SIGNATURE_THRESHOLD) {
      results.push({
        rule: "BOT_SIGNATURE",
        level: 3,
        evidence: { botSignatureRate: signals.botSignatureRate, totalTicks: signals.totalTicks, threshold: BOT_SIGNATURE_THRESHOLD },
        suggestedHold: true,
      });
    }
    if (signals.rejectRate >= REJECT_RATE_THRESHOLD) {
      results.push({
        rule: "REJECT_RATE_HIGH",
        level: 2,
        evidence: { rejectRate: signals.rejectRate, totalTicks: signals.totalTicks, threshold: REJECT_RATE_THRESHOLD },
        suggestedWeightMultiplier: 0.5,
      });
    }
  }

  if (signals.sessionCount >= MIN_SAMPLE_SESSIONS && signals.dominantSourceRatio >= SOURCE_CONCENTRATION_THRESHOLD) {
    results.push({
      rule: "SOURCE_CONCENTRATION",
      level: 2,
      evidence: { dominantSourceRatio: signals.dominantSourceRatio, sessionCount: signals.sessionCount, threshold: SOURCE_CONCENTRATION_THRESHOLD },
      suggestedWeightMultiplier: 0.5,
    });
  }

  return results;
}

export interface RiskDecision {
  hold: boolean;
  weightMultiplier: number;
}

/** Combines every fired rule into the single link_risk row state (worst case wins). */
export function combineRuleResults(results: RuleResult[]): RiskDecision {
  const hold = results.some((r) => r.suggestedHold === true);
  const multipliers = results.map((r) => r.suggestedWeightMultiplier).filter((m): m is number => m !== undefined);
  const weightMultiplier = multipliers.length > 0 ? Math.min(...multipliers) : 1.0;
  return { hold, weightMultiplier };
}
