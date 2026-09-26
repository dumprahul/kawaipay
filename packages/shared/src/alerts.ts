export type AlertSeverity = "warning" | "critical";

export interface Alert {
  alert: true;
  severity: AlertSeverity;
  code: string;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
  ts: string;
}

/**
 * Every service's alert-worthy conditions (rate-exceeded sanity checks, log_root
 * mismatches, an indexer that's stopped polling, a link put on hold) go through this one
 * function instead of an ad-hoc `console.error(JSON.stringify(...))` (spec section 13 /
 * ticket J1). The shape is deliberately stable and flat — `alert: true` plus a `severity`
 * — so a log-based alerting backend (CloudWatch, Datadog, etc.) can filter on it without
 * needing a schema per service. There's no real alerting backend to page yet (that's a
 * deployment-time integration, not something to build against nothing), so for now this
 * is the single place that plumbing gets pointed at later.
 */
export function emitAlert(service: string, severity: AlertSeverity, code: string, message: string, meta?: Record<string, unknown>): void {
  const alert: Alert = { alert: true, severity, code, service, message, meta, ts: new Date().toISOString() };
  console.error(JSON.stringify(alert));
}
