import { MetricsRegistry } from "@kawaipay/shared";

export function registerLogWriterMetrics(registry: MetricsRegistry) {
  return {
    logsWritten: registry.counter("logwriter_logs_written_total", "logs successfully written and recorded"),
    rootMismatches: registry.counter("logwriter_root_mismatches_total", "recomputed root did not match batch_items.log_root"),
    uploadFailures: registry.counter("logwriter_upload_failures_total", "uploads that exhausted retries without succeeding"),
  };
}

export type LogWriterMetrics = ReturnType<typeof registerLogWriterMetrics>;
