module kawaipay::campaign;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;

const E_CAP_MISMATCH: u64 = 1;
const E_BAD_RATE: u64 = 2;

public struct Campaign<phantom T> has key {
    id: UID,
    escrow: Balance<T>,
    rate_per_second: u64,
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
    active: bool,
    open_links: bool,
}

public struct CampaignCap has key, store {
    id: UID,
    campaign_id: ID,
}

public struct CampaignCreated has copy, drop {
    campaign_id: ID,
    seller: address,
    rate_per_second: u64,
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
    open_links: bool,
}

public struct CampaignUpdated has copy, drop {
    campaign_id: ID,
    active: bool,
    rate_per_second: u64,
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
}

fun assert_rate_valid(rate_per_second: u64, max_rate_per_second: u64) {
    assert!(max_rate_per_second > 0 && max_rate_per_second >= rate_per_second, E_BAD_RATE);
}

fun assert_cap<T>(c: &Campaign<T>, cap: &CampaignCap) {
    assert!(cap.campaign_id == object::id(c), E_CAP_MISMATCH);
}

public fun create<T>(
    deposit: Coin<T>,
    rate_per_second: u64,
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
    open_links: bool,
    ctx: &mut TxContext,
): CampaignCap {
    assert_rate_valid(rate_per_second, max_rate_per_second);

    let id = object::new(ctx);
    let campaign_id = object::uid_to_inner(&id);
    let campaign = Campaign<T> {
        id,
        escrow: coin::into_balance(deposit),
        rate_per_second,
        max_rate_per_second,
        per_settle_cap,
        per_link_epoch_cap,
        active: true,
        open_links,
    };

    event::emit(CampaignCreated {
        campaign_id,
        seller: ctx.sender(),
        rate_per_second,
        max_rate_per_second,
        per_settle_cap,
        per_link_epoch_cap,
        open_links,
    });

    transfer::share_object(campaign);
    CampaignCap { id: object::new(ctx), campaign_id }
}

public fun top_up<T>(c: &mut Campaign<T>, coin: Coin<T>) {
    balance::join(&mut c.escrow, coin::into_balance(coin));
}

public fun set_active<T>(c: &mut Campaign<T>, cap: &CampaignCap, active: bool) {
    assert_cap(c, cap);
    c.active = active;
    event::emit(CampaignUpdated {
        campaign_id: object::id(c),
        active: c.active,
        rate_per_second: c.rate_per_second,
        max_rate_per_second: c.max_rate_per_second,
        per_settle_cap: c.per_settle_cap,
        per_link_epoch_cap: c.per_link_epoch_cap,
    });
}

public fun set_params<T>(
    c: &mut Campaign<T>,
    cap: &CampaignCap,
    rate_per_second: u64,
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
) {
    assert_cap(c, cap);
    assert_rate_valid(rate_per_second, max_rate_per_second);
    c.rate_per_second = rate_per_second;
    c.max_rate_per_second = max_rate_per_second;
    c.per_settle_cap = per_settle_cap;
    c.per_link_epoch_cap = per_link_epoch_cap;
    event::emit(CampaignUpdated {
        campaign_id: object::id(c),
        active: c.active,
        rate_per_second: c.rate_per_second,
        max_rate_per_second: c.max_rate_per_second,
        per_settle_cap: c.per_settle_cap,
        per_link_epoch_cap: c.per_link_epoch_cap,
    });
}

public fun withdraw<T>(c: &mut Campaign<T>, cap: &CampaignCap, amount: u64, ctx: &mut TxContext): Coin<T> {
    assert_cap(c, cap);
    coin::from_balance(balance::split(&mut c.escrow, amount), ctx)
}

public(package) fun take<T>(c: &mut Campaign<T>, amount: u64): Balance<T> {
    balance::split(&mut c.escrow, amount)
}

public(package) fun put<T>(c: &mut Campaign<T>, b: Balance<T>) {
    balance::join(&mut c.escrow, b);
}

public fun escrow_value<T>(c: &Campaign<T>): u64 {
    balance::value(&c.escrow)
}

public fun active<T>(c: &Campaign<T>): bool {
    c.active
}

public fun open_links<T>(c: &Campaign<T>): bool {
    c.open_links
}

public fun rate_per_second<T>(c: &Campaign<T>): u64 {
    c.rate_per_second
}

public fun max_rate_per_second<T>(c: &Campaign<T>): u64 {
    c.max_rate_per_second
}

public fun per_settle_cap<T>(c: &Campaign<T>): u64 {
    c.per_settle_cap
}

public fun per_link_epoch_cap<T>(c: &Campaign<T>): u64 {
    c.per_link_epoch_cap
}

public fun campaign_cap_campaign_id(cap: &CampaignCap): ID {
    cap.campaign_id
}
