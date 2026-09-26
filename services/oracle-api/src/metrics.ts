import { MetricsRegistry } from "@kawaipay/shared";

export function registerOracleApiMetrics(registry: MetricsRegistry) {
  return {
    verdictRequests: registry.counter("oracle_api_verdict_requests_total", "POST /v1/oracle/verdict requests, by outcome"),
    paymentsSettled: registry.counter("oracle_api_payments_settled_total", "payments that settled (fresh, not cached)"),
  };
}

export type OracleApiMetrics = ReturnType<typeof registerOracleApiMetrics>;
