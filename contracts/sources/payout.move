module kawaipay::payout;

use kawaipay::campaign::{Self, Campaign};
use kawaipay::link::{Self, Link};
use kawaipay::oracle_registry::OracleRegistry;
use std::bcs;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::ed25519;
use sui::event;

const E_NO_SIGNER: u64 = 1;
const E_WRONG_CAMPAIGN: u64 = 2;
const E_INACTIVE: u64 = 3;
const E_FROZEN: u64 = 4;
const E_BAD_SEQ: u64 = 5;
const E_EXPIRED: u64 = 6;
const E_BAD_LOG_ROOT: u64 = 7;
const E_BAD_SIGNATURE: u64 = 8;
const E_ZERO: u64 = 9;
const E_RATE_EXCEEDED: u64 = 10;
const E_SETTLE_CAP: u64 = 11;
const E_EPOCH_CAP: u64 = 12;
const E_BUDGET: u64 = 13;

const DOMAIN: vector<u8> = b"KAWAIPAY_PAYOUT_V1";

public struct Attestation has copy, drop {
    campaign_id: ID,
    link_id: ID,
    seq: u64,
    seconds_verified: u64,
    amount: u64,
    log_root: vector<u8>,
    expires_at_ms: u64,
}

public struct PayoutSettled has copy, drop {
    link_id: ID,
    campaign_id: ID,
    creator: address,
    amount: u64,
    seq: u64,
    seconds_verified: u64,
    log_root: vector<u8>,
    timestamp_ms: u64,
}

public fun settle<T>(
    reg: &OracleRegistry,
    c: &Campaign<T>,
    l: &mut Link<T>,
    seq: u64,
    seconds_verified: u64,
    amount: u64,
    log_root: vector<u8>,
    expires_at_ms: u64,
    signature: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let pubkey = kawaipay::oracle_registry::signer_pubkey(reg);
    assert!(pubkey.length() > 0, E_NO_SIGNER); // 1
    assert!(link::campaign_id(l) == object::id(c), E_WRONG_CAMPAIGN); // 2
    assert!(campaign::active(c), E_INACTIVE); // 3
    assert!(!link::frozen(l), E_FROZEN); // 4
    assert!(seq == link::next_seq(l), E_BAD_SEQ); // 5
    assert!(clock::timestamp_ms(clock) <= expires_at_ms, E_EXPIRED); // 6
    assert!(log_root.length() == 32, E_BAD_LOG_ROOT); // 7

    let campaign_id = object::id(c);
    let link_id = object::id(l);
    let att = Attestation { campaign_id, link_id, seq, seconds_verified, amount, log_root, expires_at_ms };
    let mut message = DOMAIN;
    message.append(bcs::to_bytes(&att));
    assert!(ed25519::ed25519_verify(&signature, &pubkey, &message), E_BAD_SIGNATURE); // 8

    assert!(amount > 0 && seconds_verified > 0, E_ZERO); // 9
    assert!(
        (amount as u128) <= (campaign::max_rate_per_second(c) as u128) * (seconds_verified as u128),
        E_RATE_EXCEEDED,
    ); // 10
    assert!(amount <= campaign::per_settle_cap(c), E_SETTLE_CAP); // 11

    link::roll_epoch_if_needed(l, ctx.epoch());
    assert!(link::paid_in_epoch(l) + amount <= campaign::per_link_epoch_cap(c), E_EPOCH_CAP); // 12
    assert!(link::budget_value(l) >= amount, E_BUDGET); // 13

    let creator = link::creator(l);
    let paid = link::record_payout(l, seq, amount);
    transfer::public_transfer(coin::from_balance(paid, ctx), creator);

    event::emit(PayoutSettled {
        link_id,
        campaign_id,
        creator,
        amount,
        seq,
        seconds_verified,
        log_root: att.log_root,
        timestamp_ms: clock::timestamp_ms(clock),
    });
}

#[test_only]
public fun attestation_for_testing(
    campaign_id: ID,
    link_id: ID,
    seq: u64,
    seconds_verified: u64,
    amount: u64,
    log_root: vector<u8>,
    expires_at_ms: u64,
): vector<u8> {
    let att = Attestation { campaign_id, link_id, seq, seconds_verified, amount, log_root, expires_at_ms };
    let mut message = DOMAIN;
    message.append(bcs::to_bytes(&att));
    message
}
