/**
 * A minimal Prometheus text-exposition-format registry (ticket J1). No dependency on the
 * `prom-client` package: every service's counters/gauges are just numbers this project
 * already tracks in memory, and the exposition format itself is a handful of lines —
 * pulling in a library for that would be more surface area than the problem needs.
 */
export class MetricsRegistry {
  private readonly counters = new Map<string, { help: string; values: Map<string, number> }>();
  private readonly gauges = new Map<string, { help: string; values: Map<string, number> }>();

  private static labelKey(labels: Record<string, string>): string {
    const keys = Object.keys(labels).sort();
    return keys.map((k) => `${k}="${labels[k]}"`).join(",");
  }

  private static formatLabels(key: string): string {
    return key.length > 0 ? `{${key}}` : "";
  }

  counter(name: string, help: string): { inc: (labels?: Record<string, string>, by?: number) => void } {
    if (!this.counters.has(name)) this.counters.set(name, { help, values: new Map() });
    const entry = this.counters.get(name)!;
    return {
      inc: (labels = {}, by = 1) => {
        const key = MetricsRegistry.labelKey(labels);
        entry.values.set(key, (entry.values.get(key) ?? 0) + by);
      },
    };
  }

  gauge(name: string, help: string): { set: (value: number, labels?: Record<string, string>) => void } {
    if (!this.gauges.has(name)) this.gauges.set(name, { help, values: new Map() });
    const entry = this.gauges.get(name)!;
    return {
      set: (value: number, labels = {}) => {
        entry.values.set(MetricsRegistry.labelKey(labels), value);
      },
    };
  }

  /** Renders every tracked series in Prometheus text exposition format. */
  render(): string {
    const lines: string[] = [];
    for (const [name, { help, values }] of this.counters) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);
      for (const [labelKey, value] of values) {
        lines.push(`${name}${MetricsRegistry.formatLabels(labelKey)} ${value}`);
      }
    }
    for (const [name, { help, values }] of this.gauges) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
      for (const [labelKey, value] of values) {
        lines.push(`${name}${MetricsRegistry.formatLabels(labelKey)} ${value}`);
      }
    }
    return lines.join("\n") + "\n";
  }
}
