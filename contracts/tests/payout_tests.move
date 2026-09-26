#[test_only]
module kawaipay::payout_tests;

use kawaipay::campaign::{Self, Campaign, CampaignCap};
use kawaipay::link::{Self, Link};
use kawaipay::oracle_registry::{Self, OracleRegistry, AdminCap};
use kawaipay::payout;
use kawaipay::test_coin::TEST_USDC;
use sui::clock::{Self, Clock};
use sui::coin;
use sui::test_scenario::{Self, Scenario};

const ADMIN: address = @0xE1;
const CREATOR: address = @0xE2;

// Test vectors generated in contracts/testvectors/gen_vectors.mjs, signed over the
// exact deterministic campaign/link IDs this setup() sequence produces (verified via
// contracts/tests/zzz_id_probe_tests.move). If setup() changes shape, regenerate both.
const PUBKEY: vector<u8> = x"bd5015c617cc94191a1142dcfc63b4e1713a58a7cbd4b05efe4241e3dbcc1e9e";

const LOG_ROOT: vector<u8> = x"4694df744c54d51c5867c52b690c3c44dd5c4418e128591e8e5ddf69074306ec";
const TAMPERED_LOG_ROOT: vector<u8> = x"1385da93cb3f796a406df2c4a84a2b6f9b56a4d75e3d19e7e56de1ef87340e78";
const FAR_FUTURE_MS: u64 = 4102444800000;
const NOW_MS: u64 = 1_700_000_000_000;

const HAPPY_SIG: vector<u8> = x"d14c9dfb80ee9302afc7387d6246375f1b801651eeabeed3f85fa74e3fbd42f8893f625c034e8a81a9670afde99dc0658907ab76b64c498f8dbd3157fdb6df01";
const SEQ_ONE_SIG: vector<u8> = x"b51224bee9b96fde0aed93a266d4b6a37d03e459caf15ee422db9aa1b3d2e2fc7d9676fabfb08b0985e8246305bff392c2d6a0b024593ed2d18c3b6f04e52f0d";
const EXPIRED_SIG: vector<u8> = x"7823932efc85911e03818e88ebbf43e29ad4cdc97ce5bbf11bcae004c6be51bb951099c9c23bcc6f259723de227cb5373e7b2193c4e4d98899a9755eb079d501";
const RATE_EXCEEDED_SIG: vector<u8> = x"5468d8c1bd8e3b7af097bd5b670fa3b8db197437766cea888af418ea9c2edfd079cbf6e476ae28bef984bf860b774607984f162541f83356020ed79febd07f02";
const SETTLE_CAP_SIG: vector<u8> = x"17c77adbee4ec3456cf1be18517f4b379ee6a433e5533d47356d0b64dc53fb4a39175c7e6218d77d4aeb8154400bbefd2fb38963c465ea00983390d1607ed501";
const WRONG_SIGNER_SIG: vector<u8> = x"f9eb42fb322f604f143093965e3cf3190a093c3d2ae077668256c97e872d478e86ed1c4bad990731f62225d8e3fe3fb45e5f8b88dae4b7acbc02f37907e6a20e";
const ZERO_AMOUNT_SIG: vector<u8> = x"e1d4dd352621d6d08111d92e1481e6fdf3238fd0807ad0c5667d22780f31241c54e230c5ef4562bb1c595e159c40aa291a4f040fa4901c22495969e7ec50150c";

/// Builds Registry (signer set to PUBKEY) + Campaign + Link + funded budget, following
/// a fixed transaction sequence so the resulting campaign/link IDs match the vectors above.
fun setup(
    max_rate_per_second: u64,
    per_settle_cap: u64,
    per_link_epoch_cap: u64,
    fund_amount: u64,
): Scenario {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let mut reg = scenario.take_shared<OracleRegistry>();
        let admin_cap = scenario.take_from_sender<AdminCap>();
        oracle_registry::set_signer(&mut reg, &admin_cap, PUBKEY);
        scenario.return_to_sender(admin_cap);
        test_scenario::return_shared(reg);
    };
    scenario.next_tx(ADMIN);
    {
        let deposit = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(
            deposit, 200, max_rate_per_second, per_settle_cap, per_link_epoch_cap, true, scenario.ctx(),
        );
        transfer::public_transfer(cap, ADMIN);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        link::fund(&mut c, &cap, &mut l, fund_amount);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(l);
        test_scenario::return_shared(c);
    };
    scenario
}

/// Standard, generously-capped setup: nothing should trip except what the test targets.
fun setup_default(): Scenario {
    setup(1000, 10_000, 5_000_000, 100_000)
}

fun clock_at(ms: u64, scenario: &mut Scenario): Clock {
    let mut clock = clock::create_for_testing(scenario.ctx());
    clock.set_for_testing(ms);
    clock
}

fun call_settle(
    scenario: &mut Scenario,
    seq: u64,
    seconds_verified: u64,
    amount: u64,
    log_root: vector<u8>,
    expires_at_ms: u64,
    signature: vector<u8>,
    clock_ms: u64,
) {
    let reg = scenario.take_shared<OracleRegistry>();
    let c = scenario.take_shared<Campaign<TEST_USDC>>();
    let mut l = scenario.take_shared<Link<TEST_USDC>>();
    let clock = clock_at(clock_ms, scenario);

    payout::settle<TEST_USDC>(&reg, &c, &mut l, seq, seconds_verified, amount, log_root, expires_at_ms, signature, &clock, scenario.ctx());

    clock.destroy_for_testing();
    test_scenario::return_shared(l);
    test_scenario::return_shared(c);
    test_scenario::return_shared(reg);
}

#[test]
fun test_happy_path_pays_creator_and_advances_seq() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.next_tx(CREATOR);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.next_seq() == 1, 0);
        assert!(l.total_paid() == 1000, 1);
        assert!(l.paid_in_epoch() == 1000, 2);
        assert!(l.budget_value() == 100_000 - 1000, 3);
        test_scenario::return_shared(l);

        let paid = scenario.take_from_address<coin::Coin<TEST_USDC>>(CREATOR);
        assert!(paid.value() == 1000, 4);
        transfer::public_transfer(paid, CREATOR);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 5)] // E_BAD_SEQ
fun test_replay_same_attestation_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.next_tx(ADMIN);
    {
        // Same seq=0 attestation again: next_seq is now 1, so this must fail E_BAD_SEQ.
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test]
fun test_sequential_settles_with_seq_one_succeed_after_seq_zero() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 1, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, SEQ_ONE_SIG, NOW_MS);
    };
    scenario.next_tx(CREATOR);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.next_seq() == 2, 0);
        assert!(l.total_paid() == 2000, 1);
        test_scenario::return_shared(l);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 1)] // E_NO_SIGNER
fun test_no_signer_set_fails() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let deposit = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(deposit, 200, 1000, 10_000, 5_000_000, true, scenario.ctx());
        transfer::public_transfer(cap, ADMIN);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        link::fund(&mut c, &cap, &mut l, 100_000);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(l);
        test_scenario::return_shared(c);
    };
    scenario.next_tx(ADMIN);
    {
        // No set_signer call was ever made: registry.signer_pubkey() is still empty.
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 2)] // E_WRONG_CAMPAIGN
fun test_mismatched_campaign_and_link_fails() {
    let mut scenario = setup_default();
    // A second, unrelated campaign (different shared object, different ID).
    scenario.next_tx(ADMIN);
    {
        let deposit = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(deposit, 200, 1000, 10_000, 5_000_000, true, scenario.ctx());
        transfer::public_transfer(cap, ADMIN);
    };
    scenario.next_tx(ADMIN);
    {
        let reg = scenario.take_shared<OracleRegistry>();
        // Take the ORIGINAL link, but the MOST RECENT (second) campaign.
        let wrong_campaign = scenario.take_shared<Campaign<TEST_USDC>>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        let clock = clock_at(NOW_MS, &mut scenario);
        payout::settle<TEST_USDC>(
            &reg, &wrong_campaign, &mut l, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, &clock, scenario.ctx(),
        );
        clock.destroy_for_testing();
        test_scenario::return_shared(l);
        test_scenario::return_shared(wrong_campaign);
        test_scenario::return_shared(reg);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 3)] // E_INACTIVE
fun test_inactive_campaign_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        campaign::set_active(&mut c, &cap, false);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 4)] // E_FROZEN
fun test_frozen_link_fails() {
    let mut scenario = setup_default();
    // ADMIN already holds a FreezeCap from setup()'s oracle_registry::init_for_testing call.
    scenario.next_tx(ADMIN);
    {
        let freeze_cap = scenario.take_from_sender<oracle_registry::FreezeCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        link::freeze_link(&mut l, &freeze_cap);
        scenario.return_to_sender(freeze_cap);
        test_scenario::return_shared(l);
    };
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 6)] // E_EXPIRED
fun test_expired_attestation_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        // expires_at_ms = 1000, clock set to 2000: already past expiry.
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, 1000, EXPIRED_SIG, 2000);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 7)] // E_BAD_LOG_ROOT
fun test_short_log_root_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, x"aabbcc", FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 8)] // E_BAD_SIGNATURE
fun test_wrong_signer_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, WRONG_SIGNER_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 8)] // E_BAD_SIGNATURE
fun test_tampered_amount_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        // Valid signature for amount=1000, but claiming 1001 on-chain.
        call_settle(&mut scenario, 0, 60, 1001, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 8)] // E_BAD_SIGNATURE
fun test_tampered_log_root_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        // Valid signature for LOG_ROOT, but a different 32-byte root is submitted.
        call_settle(&mut scenario, 0, 60, 1000, TAMPERED_LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 9)] // E_ZERO
fun test_zero_amount_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 0, LOG_ROOT, FAR_FUTURE_MS, ZERO_AMOUNT_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 10)] // E_RATE_EXCEEDED
fun test_rate_exceeded_fails() {
    let mut scenario = setup(1000, 10_000, 5_000_000, 1_000_000);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 999999, LOG_ROOT, FAR_FUTURE_MS, RATE_EXCEEDED_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 11)] // E_SETTLE_CAP
fun test_settle_cap_exceeded_fails() {
    let mut scenario = setup(1000, 10_000, 5_000_000, 1_000_000);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 50000, LOG_ROOT, FAR_FUTURE_MS, SETTLE_CAP_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 12)] // E_EPOCH_CAP
fun test_epoch_cap_exceeded_fails() {
    let mut scenario = setup(1000, 10_000, 500, 100_000);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 13)] // E_BUDGET
fun test_budget_exceeded_fails() {
    let mut scenario = setup(1000, 10_000, 5_000_000, 500);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.end();
}

#[test]
fun test_withdraw_and_reclaim_cannot_exceed_balances() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        // Escrow has 10_000_000 - 100_000 (funded to the link) = 9_900_000 left.
        let coin = campaign::withdraw(&mut c, &cap, 9_900_000, scenario.ctx());
        assert!(coin.value() == 9_900_000, 0);
        assert!(c.escrow_value() == 0, 1);
        transfer::public_transfer(coin, ADMIN);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test]
fun test_epoch_rollover_resets_paid_in_epoch_counter() {
    // per_link_epoch_cap = 1500: a second 1000 payout in the SAME epoch would exceed it,
    // but succeeds once the epoch has actually rolled over and the counter reset to 0.
    let mut scenario = setup(1000, 10_000, 1500, 100_000);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 0, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, HAPPY_SIG, NOW_MS);
    };
    scenario.next_tx(ADMIN);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.paid_in_epoch() == 1000, 0);
        test_scenario::return_shared(l);
    };

    let next_epoch = scenario.ctx().epoch() + 1;
    let builder = test_scenario::ctx_builder(&scenario).set_epoch(next_epoch);
    test_scenario::next_with_context(&mut scenario, builder);
    scenario.next_tx(ADMIN);
    {
        call_settle(&mut scenario, 1, 60, 1000, LOG_ROOT, FAR_FUTURE_MS, SEQ_ONE_SIG, NOW_MS);
    };
    scenario.next_tx(ADMIN);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.paid_in_epoch() == 1000, 1); // reset, not 2000
        assert!(l.total_paid() == 2000, 2); // cumulative total still tracks both payouts
        test_scenario::return_shared(l);
    };
    scenario.end();
}

#[test, expected_failure] // native balance::split underflow, no custom abort code
fun test_reclaim_more_than_link_budget_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        // Link only holds the 100_000 funded in setup(); reclaiming more must fail.
        link::reclaim(&mut c, &cap, &mut l, 200_000);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(l);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test, expected_failure] // native balance::split underflow, no custom abort code
fun test_withdraw_more_than_escrow_fails() {
    let mut scenario = setup_default();
    scenario.next_tx(ADMIN);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        let coin = campaign::withdraw(&mut c, &cap, 50_000_000, scenario.ctx());
        transfer::public_transfer(coin, ADMIN);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.end();
}
