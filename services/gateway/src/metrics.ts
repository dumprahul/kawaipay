import { MetricsRegistry } from "@kawaipay/shared";

export function registerGatewayMetrics(registry: MetricsRegistry) {
  return {
    sessionsStarted: registry.counter("gateway_sessions_started_total", "sessions started, by tracking outcome"),
    heartbeats: registry.counter("gateway_heartbeats_total", "heartbeats received, by outcome"),
  };
}

export type GatewayMetrics = ReturnType<typeof registerGatewayMetrics>;
