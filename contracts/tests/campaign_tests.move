#[test_only]
module kawaipay::campaign_tests;

use kawaipay::campaign::{Self, Campaign, CampaignCap};
use kawaipay::test_coin::TEST_USDC;
use sui::coin;
use sui::test_scenario;

const SELLER: address = @0xA1;
const OTHER: address = @0xA2;

fun new_campaign(scenario: &mut test_scenario::Scenario): CampaignCap {
    let coin = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
    campaign::create<TEST_USDC>(coin, 200, 400, 100_000, 5_000_000, true, scenario.ctx())
}

#[test]
fun test_create_and_read_back() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        assert!(c.escrow_value() == 10_000_000, 0);
        assert!(c.active(), 1);
        assert!(c.open_links(), 2);
        assert!(c.rate_per_second() == 200, 3);
        assert!(c.max_rate_per_second() == 400, 4);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test]
fun test_top_up_increases_escrow() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        campaign::top_up(&mut c, coin::mint_for_testing<TEST_USDC>(5_000_000, scenario.ctx()));
        assert!(c.escrow_value() == 15_000_000, 0);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test]
fun test_set_active_and_set_params_with_valid_cap() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();

        campaign::set_active(&mut c, &cap, false);
        assert!(!c.active(), 0);

        campaign::set_params(&mut c, &cap, 300, 600, 200_000, 9_000_000);
        assert!(c.rate_per_second() == 300, 1);
        assert!(c.max_rate_per_second() == 600, 2);
        assert!(c.per_settle_cap() == 200_000, 3);
        assert!(c.per_link_epoch_cap() == 9_000_000, 4);

        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test]
fun test_withdraw_reduces_escrow_and_returns_coin() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();

        let withdrawn = campaign::withdraw(&mut c, &cap, 4_000_000, scenario.ctx());
        assert!(withdrawn.value() == 4_000_000, 0);
        assert!(c.escrow_value() == 6_000_000, 1);

        transfer::public_transfer(withdrawn, SELLER);
        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 2)] // E_BAD_RATE
fun test_create_rejects_max_rate_below_rate() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let coin = coin::mint_for_testing<TEST_USDC>(1_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(coin, 500, 400, 100_000, 5_000_000, true, scenario.ctx());
        transfer::public_transfer(cap, SELLER);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 2)] // E_BAD_RATE
fun test_create_rejects_zero_max_rate() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let coin = coin::mint_for_testing<TEST_USDC>(1_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(coin, 0, 0, 100_000, 5_000_000, true, scenario.ctx());
        transfer::public_transfer(cap, SELLER);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 1)] // E_CAP_MISMATCH
fun test_set_active_rejects_foreign_cap() {
    let mut scenario = test_scenario::begin(SELLER);
    let campaign_a_id;
    {
        let cap_a = new_campaign(&mut scenario);
        campaign_a_id = cap_a.campaign_cap_campaign_id();
        transfer::public_transfer(cap_a, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        // A second, unrelated campaign, whose cap does not belong to campaign A.
        let cap_b = new_campaign(&mut scenario);
        transfer::public_transfer(cap_b, OTHER);
    };
    scenario.next_tx(OTHER);
    {
        let mut campaign_a = test_scenario::take_shared_by_id<Campaign<TEST_USDC>>(&scenario, campaign_a_id);
        let cap_b = scenario.take_from_sender<CampaignCap>();
        campaign::set_active(&mut campaign_a, &cap_b, false);
        scenario.return_to_sender(cap_b);
        test_scenario::return_shared(campaign_a);
    };
    scenario.end();
}
