import { SuiGraphQLClient } from "@mysten/sui/graphql";

/** An opaque, transport-defined pagination cursor — never parsed, only round-tripped. */
export type EventCursor = string;

export interface RawEvent {
  type: string;
  module: string;
  parsedJson: Record<string, unknown>;
  txDigest: string;
  eventIndex: number;
  timestampMs: string | null;
  checkpoint: number | null;
}

export interface EventPage {
  events: RawEvent[];
  nextCursor: EventCursor | null;
  hasNextPage: boolean;
}

/**
 * Everything the indexer needs from Sui, kept behind one interface (spec section 9):
 * "the RPC surface for events is evolving, so keep all RPC calls behind that interface."
 *
 * This mattered in practice, not just in theory: the JSON-RPC `queryEvents`/`getObject`/
 * `getTransactionBlock` methods the spec anticipated as "the current Sui RPC event query"
 * turned out to already be fully decommissioned on public full nodes (verified directly —
 * every JSON-RPC call returns "Method not found. JSON-RPC on public fullnodes has been
 * deprecated"). The real, working replacement is `SuiGraphQLClient`'s `listEvents`/
 * `getObject`, confirmed against https://graphql.testnet.sui.io/graphql and our own
 * deployed package before writing this. The same `TransportMethods` shape (`listEvents`,
 * `getObject`) is also implemented by `SuiGrpcClient`, so a future move to gRPC is a new
 * EventSource implementation, not a rewrite of any handler.
 */
export interface EventSource {
  /**
   * Events emitted by one module of the kawaipay package, oldest first. There is no
   * single "whole package" filter (only sender / one module / one event type), so the
   * indexer polls per module and merges independently — safe here because no handler
   * needs cross-module ordering (each event only touches its own link/campaign row).
   */
  queryModuleEvents(module: string, cursor: EventCursor | null, limit: number): Promise<EventPage>;
  /** Reads a Campaign<T> object once to learn T (spec section 9, CampaignCreated handler). */
  getObjectCoinType(objectId: string): Promise<string | null>;
}

export class SuiGraphQLEventSource implements EventSource {
  private readonly client: SuiGraphQLClient;

  constructor(
    private readonly packageId: string,
    graphqlUrl: string,
    network: string = "testnet",
  ) {
    this.client = new SuiGraphQLClient({ url: graphqlUrl, network });
  }

  async queryModuleEvents(module: string, cursor: EventCursor | null, limit: number): Promise<EventPage> {
    const result = await this.client.core.listEvents({
      filter: { emitModule: `${this.packageId}::${module}` },
      limit,
      after: cursor ?? undefined,
    });

    return {
      events: result.events.map((e) => ({
        type: e.eventType,
        module: e.module,
        parsedJson: e.json ?? {},
        txDigest: e.transactionDigest,
        eventIndex: e.eventIndex,
        timestampMs: null,
        checkpoint: e.checkpoint ? Number(e.checkpoint) : null,
      })),
      nextCursor: result.events.length > 0 ? result.endCursor : null,
      hasNextPage: result.hasNextPage,
    };
  }

  async getObjectCoinType(objectId: string): Promise<string | null> {
    const { object } = await this.client.core.getObject({ objectId });
    const type = object?.type;
    if (!type) return null;
    const match = type.match(/<(.+)>$/);
    return match ? match[1]! : null;
  }
}
