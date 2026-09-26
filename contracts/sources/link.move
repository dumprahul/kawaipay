module kawaipay::link;

use kawaipay::campaign::{Self, Campaign, CampaignCap};
use kawaipay::oracle_registry::{AdminCap, FreezeCap};
use sui::balance::{Self, Balance};
use sui::event;

const E_NOT_OPEN: u64 = 1;
const E_CAP_MISMATCH: u64 = 2;
const E_WRONG_CAMPAIGN: u64 = 3;

public struct Link<phantom T> has key {
    id: UID,
    campaign_id: ID,
    creator: address,
    budget: Balance<T>,
    next_seq: u64,
    frozen: bool,
    epoch: u64,
    paid_in_epoch: u64,
    total_paid: u64,
}

public struct LinkCreated has copy, drop {
    link_id: ID,
    campaign_id: ID,
    creator: address,
}

public struct LinkFunded has copy, drop {
    link_id: ID,
    campaign_id: ID,
    amount: u64,
}

public struct LinkReclaimed has copy, drop {
    link_id: ID,
    campaign_id: ID,
    amount: u64,
}

public struct LinkFrozen has copy, drop { link_id: ID }
public struct LinkUnfrozen has copy, drop { link_id: ID }

fun new_link<T>(campaign_id: ID, creator: address, ctx: &mut TxContext): Link<T> {
    let link = Link<T> {
        id: object::new(ctx),
        campaign_id,
        creator,
        budget: balance::zero<T>(),
        next_seq: 0,
        frozen: false,
        epoch: ctx.epoch(),
        paid_in_epoch: 0,
        total_paid: 0,
    };
    event::emit(LinkCreated { link_id: object::id(&link), campaign_id, creator });
    link
}

public fun create<T>(c: &Campaign<T>, ctx: &mut TxContext) {
    assert!(campaign::open_links(c), E_NOT_OPEN);
    let link = new_link<T>(object::id(c), ctx.sender(), ctx);
    transfer::share_object(link);
}

public fun create_for<T>(c: &Campaign<T>, cap: &CampaignCap, creator: address, ctx: &mut TxContext) {
    assert!(campaign::campaign_cap_campaign_id(cap) == object::id(c), E_CAP_MISMATCH);
    let link = new_link<T>(object::id(c), creator, ctx);
    transfer::share_object(link);
}

fun assert_owning_cap<T>(c: &Campaign<T>, cap: &CampaignCap, l: &Link<T>) {
    assert!(campaign::campaign_cap_campaign_id(cap) == object::id(c), E_CAP_MISMATCH);
    assert!(l.campaign_id == object::id(c), E_WRONG_CAMPAIGN);
}

public fun fund<T>(c: &mut Campaign<T>, cap: &CampaignCap, l: &mut Link<T>, amount: u64) {
    assert_owning_cap(c, cap, l);
    let taken = campaign::take(c, amount);
    balance::join(&mut l.budget, taken);
    event::emit(LinkFunded { link_id: object::id(l), campaign_id: l.campaign_id, amount });
}

public fun reclaim<T>(c: &mut Campaign<T>, cap: &CampaignCap, l: &mut Link<T>, amount: u64) {
    assert_owning_cap(c, cap, l);
    let taken = balance::split(&mut l.budget, amount);
    campaign::put(c, taken);
    event::emit(LinkReclaimed { link_id: object::id(l), campaign_id: l.campaign_id, amount });
}

public fun freeze_link<T>(l: &mut Link<T>, _: &FreezeCap) {
    l.frozen = true;
    event::emit(LinkFrozen { link_id: object::id(l) });
}

public fun unfreeze_link<T>(l: &mut Link<T>, _: &AdminCap) {
    l.frozen = false;
    event::emit(LinkUnfrozen { link_id: object::id(l) });
}

public fun campaign_id<T>(l: &Link<T>): ID {
    l.campaign_id
}

public fun creator<T>(l: &Link<T>): address {
    l.creator
}

public fun budget_value<T>(l: &Link<T>): u64 {
    balance::value(&l.budget)
}

public fun next_seq<T>(l: &Link<T>): u64 {
    l.next_seq
}

public fun frozen<T>(l: &Link<T>): bool {
    l.frozen
}

public fun epoch<T>(l: &Link<T>): u64 {
    l.epoch
}

public fun paid_in_epoch<T>(l: &Link<T>): u64 {
    l.paid_in_epoch
}

public fun total_paid<T>(l: &Link<T>): u64 {
    l.total_paid
}

/// Rolls the link's epoch counter forward if the current Sui epoch has moved on,
/// resetting paid_in_epoch. Called by payout::settle before checking the epoch cap.
public(package) fun roll_epoch_if_needed<T>(l: &mut Link<T>, current_epoch: u64) {
    if (l.epoch != current_epoch) {
        l.epoch = current_epoch;
        l.paid_in_epoch = 0;
    };
}

public(package) fun record_payout<T>(l: &mut Link<T>, seq: u64, amount: u64): Balance<T> {
    l.next_seq = seq + 1;
    l.paid_in_epoch = l.paid_in_epoch + amount;
    l.total_paid = l.total_paid + amount;
    balance::split(&mut l.budget, amount)
}
