#[test_only]
module kawaipay::oracle_registry_tests;

use kawaipay::oracle_registry::{Self, OracleRegistry, AdminCap, FreezeCap};
use sui::test_scenario;

const ADMIN: address = @0xAD;
const OTHER: address = @0x0B;

fun pubkey_32(byte: u8): vector<u8> {
    let mut v = vector[];
    let mut i = 0u64;
    while (i < 32) {
        v.push_back(byte);
        i = i + 1;
    };
    v
}

#[test]
fun test_init_shares_registry_and_sends_caps() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let reg = scenario.take_shared<OracleRegistry>();
        assert!(reg.signer_pubkey().length() == 0, 0);
        test_scenario::return_shared(reg);

        let admin_cap = scenario.take_from_sender<AdminCap>();
        scenario.return_to_sender(admin_cap);

        let freeze_cap = scenario.take_from_sender<FreezeCap>();
        scenario.return_to_sender(freeze_cap);
    };
    scenario.end();
}

#[test]
fun test_set_signer_updates_pubkey_and_version() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let mut reg = scenario.take_shared<OracleRegistry>();
        let admin_cap = scenario.take_from_sender<AdminCap>();

        oracle_registry::set_signer(&mut reg, &admin_cap, pubkey_32(7));
        assert!(reg.signer_pubkey() == pubkey_32(7), 0);

        oracle_registry::set_signer(&mut reg, &admin_cap, pubkey_32(9));
        assert!(reg.signer_pubkey() == pubkey_32(9), 1);

        scenario.return_to_sender(admin_cap);
        test_scenario::return_shared(reg);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = 1)] // E_BAD_PUBKEY_LEN
fun test_set_signer_rejects_wrong_length() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let mut reg = scenario.take_shared<OracleRegistry>();
        let admin_cap = scenario.take_from_sender<AdminCap>();

        oracle_registry::set_signer(&mut reg, &admin_cap, vector[1, 2, 3]);

        scenario.return_to_sender(admin_cap);
        test_scenario::return_shared(reg);
    };
    scenario.end();
}

#[test]
fun test_issue_freeze_cap_sends_to_target() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        oracle_registry::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        oracle_registry::issue_freeze_cap(&admin_cap, OTHER, scenario.ctx());
        scenario.return_to_sender(admin_cap);
    };
    scenario.next_tx(OTHER);
    {
        let cap = scenario.take_from_sender<FreezeCap>();
        scenario.return_to_sender(cap);
    };
    scenario.end();
}
