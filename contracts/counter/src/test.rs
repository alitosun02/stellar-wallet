#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_increment_and_get() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(CounterContract, ());
    let client = CounterContractClient::new(&env, &contract_id);
    let caller = Address::generate(&env);

    assert_eq!(client.get_count(), 0);
    assert_eq!(client.increment(&caller), 1);
    assert_eq!(client.increment(&caller), 2);
    assert_eq!(client.increment(&caller), 3);
    assert_eq!(client.get_count(), 3);
}
