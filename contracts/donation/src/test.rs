#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address, Env};

fn setup(
    env: &Env,
) -> (
    DonationContractClient<'_>,
    StellarAssetClient<'_>,
    Address, // token address
    Address, // admin
) {
    let admin = Address::generate(env);
    let token_admin = Address::generate(env);

    // Test ortamında gerçek bir Stellar Asset Contract (token) kur
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = sac.address();
    let asset_client = StellarAssetClient::new(env, &token_address);

    let contract_id = env.register(DonationContract, ());
    let client = DonationContractClient::new(env, &contract_id);
    client.init(&admin, &token_address);

    (client, asset_client, token_address, admin)
}

#[test]
fn test_donate_updates_totals() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, asset, _token, _admin) = setup(&env);

    let donor = Address::generate(&env);
    asset.mint(&donor, &1_000_0000000); // 1.000 XLM (stroop)

    assert_eq!(client.get_total(), 0);
    assert_eq!(client.donate(&donor, &50_0000000), 50_0000000);
    assert_eq!(client.donate(&donor, &25_0000000), 75_0000000);
    assert_eq!(client.get_total(), 75_0000000);
    assert_eq!(client.get_count(), 2);
    assert_eq!(client.get_donor_total(&donor), 75_0000000);
}

#[test]
fn test_donation_moves_tokens_cross_contract() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, asset, token_address, _admin) = setup(&env);

    let donor = Address::generate(&env);
    asset.mint(&donor, &100_0000000);

    client.donate(&donor, &40_0000000);

    // Inter-contract transferin gerçekten yürüdüğünü token bakiyeleriyle doğrula
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&donor), 60_0000000);
    assert_eq!(token_client.balance(&client.address), 40_0000000);
}

#[test]
fn test_invalid_amount_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, asset, _token, _admin) = setup(&env);

    let donor = Address::generate(&env);
    asset.mint(&donor, &10_0000000);

    let result = client.try_donate(&donor, &0);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));

    let negative = client.try_donate(&donor, &-5);
    assert_eq!(negative, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_withdraw_by_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, asset, token_address, _admin) = setup(&env);

    let donor = Address::generate(&env);
    let payout = Address::generate(&env);
    asset.mint(&donor, &100_0000000);
    client.donate(&donor, &80_0000000);

    client.withdraw(&payout, &30_0000000);

    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    assert_eq!(token_client.balance(&payout), 30_0000000);
    assert_eq!(token_client.balance(&client.address), 50_0000000);
}

#[test]
fn test_withdraw_more_than_jar_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, asset, _token, _admin) = setup(&env);

    let donor = Address::generate(&env);
    let payout = Address::generate(&env);
    asset.mint(&donor, &100_0000000);
    client.donate(&donor, &10_0000000);

    let result = client.try_withdraw(&payout, &999_0000000);
    assert_eq!(result, Err(Ok(Error::InsufficientJarBalance)));
}

#[test]
fn test_double_init_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _asset, token_address, admin) = setup(&env);

    let result = client.try_init(&admin, &token_address);
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));
}
