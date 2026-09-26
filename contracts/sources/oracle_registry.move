module kawaipay::oracle_registry;

use sui::event;

const E_BAD_PUBKEY_LEN: u64 = 1;

public struct OracleRegistry has key {
    id: UID,
    signer_pubkey: vector<u8>,
    version: u64,
}

public struct AdminCap has key, store { id: UID }
public struct FreezeCap has key, store { id: UID }

public struct SignerRotated has copy, drop {
    version: u64,
    pubkey: vector<u8>,
}

fun init(ctx: &mut TxContext) {
    let registry = OracleRegistry {
        id: object::new(ctx),
        signer_pubkey: vector[],
        version: 0,
    };
    transfer::share_object(registry);
    transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    transfer::transfer(FreezeCap { id: object::new(ctx) }, ctx.sender());
}

public fun set_signer(reg: &mut OracleRegistry, _: &AdminCap, pubkey: vector<u8>) {
    assert!(pubkey.length() == 32, E_BAD_PUBKEY_LEN);
    reg.signer_pubkey = pubkey;
    reg.version = reg.version + 1;
    event::emit(SignerRotated { version: reg.version, pubkey: reg.signer_pubkey });
}

public fun issue_freeze_cap(_: &AdminCap, to: address, ctx: &mut TxContext) {
    transfer::transfer(FreezeCap { id: object::new(ctx) }, to);
}

public fun signer_pubkey(reg: &OracleRegistry): vector<u8> {
    reg.signer_pubkey
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
