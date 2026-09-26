/// Module: my_first_package
module my_first_package::counter;

public struct Counter has key, store {
    id: UID,
    value: u64,
}

public fun create(ctx: &mut TxContext) {
    let counter = Counter {
        id: object::new(ctx),
        value: 0,
    };
    transfer::transfer(counter, ctx.sender());
}

public fun increment(counter: &mut Counter) {
    counter.value = counter.value + 1;
}

public fun value(counter: &Counter): u64 {
    counter.value
}
