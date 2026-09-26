#[test_only]
module kawaipay::test_coin;

/// A stand-in for USDC in tests. Campaign/Link are generic over the coin type,
/// so any marker type works here; production deployments use the real USDC type.
public struct TEST_USDC has drop {}
