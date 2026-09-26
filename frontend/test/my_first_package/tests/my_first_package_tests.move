#[test_only]
module my_first_package::counter_tests;

use my_first_package::counter;
use sui::test_scenario;

#[test]
fun test_create_and_increment() {
    let user = @0xA;
    let mut scenario = test_scenario::begin(user);
    {
        counter::create(scenario.ctx());
    };
    scenario.next_tx(user);
    {
        let mut counter = scenario.take_from_sender<counter::Counter>();
        assert!(counter.value() == 0, 0);
        counter.increment();
        counter.increment();
        assert!(counter.value() == 2, 1);
        scenario.return_to_sender(counter);
    };
    scenario.end();
}
