#[test_only]
module kawaipay::zzz_id_probe_tests;

use kawaipay::campaign::{Self, Campaign};
use kawaipay::link;
use kawaipay::oracle_registry::{Self, OracleRegistry, AdminCap};
use kawaipay::test_coin::TEST_USDC;
use sui::coin;
use sui::test_scenario;

const ADMIN: address = @0xE1;
const CREATOR: address = @0xE2;

#[test]
fun probe_ids() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let mut reg = scenario.take_shared<OracleRegistry>();
        let admin_cap = scenario.take_from_sender<AdminCap>();
        oracle_registry::set_signer(&mut reg, &admin_cap, x"0000000000000000000000000000000000000000000000000000000000000000");
        scenario.return_to_sender(admin_cap);
        test_scenario::return_shared(reg);
    };
    scenario.next_tx(ADMIN);
    {
        let coin = coin::mint_for_testing<TEST_USDC>(10_000_000, scenario.ctx());
        let cap = campaign::create<TEST_USDC>(coin, 200, 1000, 10_000, 5_000_000, true, scenario.ctx());
        transfer::public_transfer(cap, ADMIN);
    };
    scenario.next_tx(CREATOR);
    {
        let c = scenario.take_shared<Campaign<TEST_USDC>>();
        link::create<TEST_USDC>(&c, scenario.ctx());
        std::debug::print(&object::id(&c));
        test_scenario::return_shared(c);
    };
    scenario.next_tx(CREATOR);
    {
        let l = scenario.take_shared<link::Link<TEST_USDC>>();
        std::debug::print(&object::id(&l));
        test_scenario::return_shared(l);
    };
    scenario.end();
}
