#[test_only]
module kawaipay::link_tests;

use kawaipay::campaign::{Self, Campaign, CampaignCap};
use kawaipay::link::{Self, Link};
use kawaipay::oracle_registry;
use kawaipay::test_coin::TEST_USDC;
use sui::coin;
use sui::test_scenario;

const SELLER: address = @0xB1;
const CREATOR: address = @0xB2;
const OTHER_CREATOR: address = @0xB3;

fun new_open_campaign(scenario: &mut test_scenario::Scenario): CampaignCap {
    let coin = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
    campaign::create<TEST_USDC>(coin, 200, 400, 100_000, 5_000_000, true, scenario.ctx())
}

fun new_closed_campaign(scenario: &mut test_scenario::Scenario): CampaignCap {
    let coin = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
    campaign::create<TEST_USDC>(coin, 200, 400, 100_000, 5_000_000, false, scenario.ctx())
}

#[test]
fun test_create_shares_link_owned_by_sender() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_open_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(CREATOR);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.creator() == CREATOR, 0);
        assert!(l.budget_value() == 0, 1);
        assert!(l.next_seq() == 0, 2);
        assert!(!l.frozen(), 3);
        test_scenario::return_shared(l);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 1)] // E_NOT_OPEN
fun test_create_rejects_closed_campaign() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_closed_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test]
fun test_create_for_bypasses_closed_campaign() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_closed_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        link::create_for<TEST_USDC>(&c, &cap, OTHER_CREATOR, scenario.ctx());
        scenario.return_to_sender(cap);
        test_scenario::return_shared(c);
    };
    scenario.next_tx(SELLER);
    {
        let l = scenario.take_shared<Link<TEST_USDC>>();
        assert!(l.creator() == OTHER_CREATOR, 0);
        test_scenario::return_shared(l);
    };
    scenario.end();
}

#[test]
fun test_fund_and_reclaim_move_balance_between_campaign_and_link() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        let cap = new_open_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(SELLER);
    {
        let mut c = scenario.take_shared<Campaign<TEST_USDC>>();
        let cap = scenario.take_from_sender<CampaignCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();

        link::fund(&mut c, &cap, &mut l, 3_000_000);
        assert!(l.budget_value() == 3_000_000, 0);
        assert!(c.escrow_value() == 7_000_000, 1);

        link::reclaim(&mut c, &cap, &mut l, 1_000_000);
        assert!(l.budget_value() == 2_000_000, 2);
        assert!(c.escrow_value() == 8_000_000, 3);

        scenario.return_to_sender(cap);
        test_scenario::return_shared(l);
        test_scenario::return_shared(c);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 2)] // E_CAP_MISMATCH
fun test_fund_rejects_foreign_cap() {
    let mut scenario = test_scenario::begin(SELLER);
    let campaign_a_id;
    {
        let cap_a = new_open_campaign(&mut scenario);
        campaign_a_id = cap_a.campaign_cap_campaign_id();
        transfer::public_transfer(cap_a, SELLER);
    };
    scenario.next_tx(CREATOR);
    {
        let c = test_scenario::take_shared_by_id<Campaign<TEST_USDC>>(&scenario, campaign_a_id);
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(SELLER);
    {
        // Cap from an unrelated second campaign.
        let cap_b = new_open_campaign(&mut scenario);
        transfer::public_transfer(cap_b, SELLER);
    };
    scenario.next_tx(SELLER);
    {
        let mut campaign_a = test_scenario::take_shared_by_id<Campaign<TEST_USDC>>(&scenario, campaign_a_id);
        let cap_b = scenario.take_from_sender<CampaignCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();
        link::fund(&mut campaign_a, &cap_b, &mut l, 100);
        scenario.return_to_sender(cap_b);
        test_scenario::return_shared(l);
        test_scenario::return_shared(campaign_a);
    };
    scenario.end();
}

#[test]
fun test_freeze_and_unfreeze() {
    let mut scenario = test_scenario::begin(SELLER);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(SELLER);
    {
        let cap = new_open_campaign(&mut scenario);
        transfer::public_transfer(cap, SELLER);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        test_scenario::return_shared(c);
    };
    scenario.next_tx(SELLER);
    {
        let admin_cap = scenario.take_from_sender<oracle_registry::AdminCap>();
        let freeze_cap = scenario.take_from_sender<oracle_registry::FreezeCap>();
        let mut l = scenario.take_shared<Link<TEST_USDC>>();

        link::freeze_link(&mut l, &freeze_cap);
        assert!(l.frozen(), 0);

        link::unfreeze_link(&mut l, &admin_cap);
        assert!(!l.frozen(), 1);

        scenario.return_to_sender(admin_cap);
        scenario.return_to_sender(freeze_cap);
        test_scenario::return_shared(l);
    };
    scenario.end();
}
