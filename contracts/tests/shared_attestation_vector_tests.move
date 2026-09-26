#[test_only]
module kawaipay::shared_attestation_vector_tests;

use kawaipay::payout;
use sui::ed25519;

// Mirrors packages/shared/testvectors/attestation.json exactly. If that file is
// regenerated, update these constants too — this test is the Move-side half of C2's
// cross-language attestation vector (spec section 14).
const PUBKEY: vector<u8> = x"c343a80bc9ed4e933fb091ef77caba8460e057273328b8d71762c85b9eae3fb5";
const CAMPAIGN_ID_BYTES: vector<u8> = x"3d7b3a223ad99afec71af2cea9c5c572decc94f74a2e5692a34d5939efb60d2e";
const LINK_ID_BYTES: vector<u8> = x"921a0709108c9e39f5434c0942c8b7cf2d990a0838710bd08551a086e5b4aac7";
const LOG_ROOT: vector<u8> = x"e3917c59c7c0460a66f5039d18eb7438e5f6dba94e0020141a7869953b2d55c9";
const EXPECTED_MESSAGE: vector<u8> =
    x"4b415741495041595f5041594f55545f56313d7b3a223ad99afec71af2cea9c5c572decc94f74a2e5692a34d5939efb60d2e921a0709108c9e39f5434c0942c8b7cf2d990a0838710bd08551a086e5b4aac72a000000000000002c01000000000000393000000000000020e3917c59c7c0460a66f5039d18eb7438e5f6dba94e0020141a7869953b2d55c900b4c5dab8010000";
const SIGNATURE: vector<u8> =
    x"6267e834ce92d1b09527b28795d6a2c441d7a134702d83ea231f7c76425cf775816cf1039480206ef08ae6b7d940f4f0730e85872d0e1912b5c06af669aca40b";

const SEQ: u64 = 42;
const SECONDS_VERIFIED: u64 = 300;
const AMOUNT: u64 = 12345;
const EXPIRES_AT_MS: u64 = 1893456000000;

#[test]
fun test_move_bcs_encoding_matches_shared_vector() {
    let campaign_id = object::id_from_bytes(CAMPAIGN_ID_BYTES);
    let link_id = object::id_from_bytes(LINK_ID_BYTES);

    let message = payout::attestation_for_testing(
        campaign_id, link_id, SEQ, SECONDS_VERIFIED, AMOUNT, LOG_ROOT, EXPIRES_AT_MS,
    );
    assert!(message == EXPECTED_MESSAGE, 0);
}

#[test]
fun test_signature_verifies_against_shared_vector() {
    let campaign_id = object::id_from_bytes(CAMPAIGN_ID_BYTES);
    let link_id = object::id_from_bytes(LINK_ID_BYTES);

    let message = payout::attestation_for_testing(
        campaign_id, link_id, SEQ, SECONDS_VERIFIED, AMOUNT, LOG_ROOT, EXPIRES_AT_MS,
    );
    let signature = SIGNATURE;
    let pubkey = PUBKEY;
    assert!(ed25519::ed25519_verify(&signature, &pubkey, &message), 1);
}
