#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, String,
};

const DAY: u64 = 86_400;
const XLM: i128 = 10_000_000; // 1 XLM = 10^7 stroop

struct Fixture<'a> {
    env: Env,
    client: CampaignContractClient<'a>,
    asset: StellarAssetClient<'a>,
    token: TokenClient<'a>,
}

fn setup() -> Fixture<'static> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);

    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin);
    let token_address = sac.address();

    let contract_id = env.register(CampaignContract, ());
    let client = CampaignContractClient::new(&env, &contract_id);
    client.init(&token_address);

    let asset = StellarAssetClient::new(&env, &token_address);
    let token = TokenClient::new(&env, &token_address);

    Fixture {
        env,
        client,
        asset,
        token,
    }
}

fn funded_donor(f: &Fixture<'_>, amount: i128) -> Address {
    let donor = Address::generate(&f.env);
    f.asset.mint(&donor, &amount);
    donor
}

fn new_campaign(f: &Fixture<'_>, goal: i128) -> (u32, Address) {
    let creator = Address::generate(&f.env);
    let deadline = f.env.ledger().timestamp() + 7 * DAY;
    let id = f.client.create_campaign(
        &creator,
        &String::from_str(&f.env, "Test campaign"),
        &goal,
        &deadline,
    );
    (id, creator)
}

#[test]
fn test_create_campaign_stores_metadata() {
    let f = setup();
    let (id, creator) = new_campaign(&f, 100 * XLM);

    let campaign = f.client.get_campaign(&id);
    assert_eq!(campaign.id, 0);
    assert_eq!(campaign.creator, creator);
    assert_eq!(campaign.goal, 100 * XLM);
    assert_eq!(campaign.raised, 0);
    assert_eq!(campaign.supporters, 0);
    assert!(!campaign.withdrawn);
    assert_eq!(f.client.get_campaign_count(), 1);
    assert_eq!(f.client.get_status(&id), Status::Active);
}

#[test]
fn test_create_campaign_validates_input() {
    let f = setup();
    let creator = Address::generate(&f.env);
    let title = String::from_str(&f.env, "Bad");
    let future = f.env.ledger().timestamp() + DAY;

    assert_eq!(
        f.client.try_create_campaign(&creator, &title, &0, &future),
        Err(Ok(Error::InvalidGoal))
    );
    // Geçmiş bir son tarih reddedilmeli
    let past = f.env.ledger().timestamp() - 1;
    assert_eq!(
        f.client.try_create_campaign(&creator, &title, &(10 * XLM), &past),
        Err(Ok(Error::InvalidDeadline))
    );
}

#[test]
fn test_donate_moves_funds_into_escrow() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 50 * XLM);

    let raised = f.client.donate(&id, &donor, &(30 * XLM));
    assert_eq!(raised, 30 * XLM);

    // Cross-contract transfer gerçekten yürüdü mü?
    assert_eq!(f.token.balance(&donor), 20 * XLM);
    assert_eq!(f.token.balance(&f.client.address), 30 * XLM);

    let campaign = f.client.get_campaign(&id);
    assert_eq!(campaign.raised, 30 * XLM);
    assert_eq!(campaign.supporters, 1);
    assert_eq!(f.client.get_contribution(&id, &donor), 30 * XLM);
}

#[test]
fn test_supporter_counted_once_per_donor() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 50 * XLM);

    f.client.donate(&id, &donor, &(10 * XLM));
    f.client.donate(&id, &donor, &(5 * XLM));

    let campaign = f.client.get_campaign(&id);
    assert_eq!(campaign.supporters, 1);
    assert_eq!(campaign.raised, 15 * XLM);
    assert_eq!(f.client.get_contribution(&id, &donor), 15 * XLM);
}

#[test]
fn test_donation_rejects_invalid_amount_and_expired_campaign() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 50 * XLM);

    assert_eq!(
        f.client.try_donate(&id, &donor, &0),
        Err(Ok(Error::InvalidAmount))
    );

    // Süre dolduktan sonra destek alınamaz
    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 8 * DAY);
    assert_eq!(
        f.client.try_donate(&id, &donor, &(1 * XLM)),
        Err(Ok(Error::CampaignEnded))
    );
}

#[test]
fn test_withdraw_after_goal_reached() {
    let f = setup();
    let (id, creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 150 * XLM);

    f.client.donate(&id, &donor, &(120 * XLM));
    assert_eq!(f.client.get_status(&id), Status::Succeeded);

    let withdrawn = f.client.withdraw(&id);
    assert_eq!(withdrawn, 120 * XLM);
    assert_eq!(f.token.balance(&creator), 120 * XLM);
    assert_eq!(f.token.balance(&f.client.address), 0);
    assert_eq!(f.client.get_status(&id), Status::Withdrawn);
}

#[test]
fn test_withdraw_rejected_before_goal_and_twice() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 150 * XLM);

    f.client.donate(&id, &donor, &(40 * XLM));
    assert_eq!(f.client.try_withdraw(&id), Err(Ok(Error::GoalNotReached)));

    f.client.donate(&id, &donor, &(70 * XLM));
    f.client.withdraw(&id);
    assert_eq!(f.client.try_withdraw(&id), Err(Ok(Error::AlreadyWithdrawn)));
}

#[test]
fn test_refund_after_failed_campaign() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let alice = funded_donor(&f, 50 * XLM);
    let bob = funded_donor(&f, 50 * XLM);

    f.client.donate(&id, &alice, &(30 * XLM));
    f.client.donate(&id, &bob, &(20 * XLM));

    // Süre dolsun; hedefe ulaşılmadı
    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 8 * DAY);
    assert_eq!(f.client.get_status(&id), Status::Failed);

    assert_eq!(f.client.claim_refund(&id, &alice), 30 * XLM);
    assert_eq!(f.client.claim_refund(&id, &bob), 20 * XLM);

    assert_eq!(f.token.balance(&alice), 50 * XLM);
    assert_eq!(f.token.balance(&bob), 50 * XLM);
    assert_eq!(f.token.balance(&f.client.address), 0);

    // İkinci kez iade alınamaz
    assert_eq!(
        f.client.try_claim_refund(&id, &alice),
        Err(Ok(Error::NothingToRefund))
    );
}

#[test]
fn test_refund_rejected_while_active_or_succeeded() {
    let f = setup();
    let (id, _creator) = new_campaign(&f, 100 * XLM);
    let donor = funded_donor(&f, 150 * XLM);
    f.client.donate(&id, &donor, &(30 * XLM));

    // Kampanya hâlâ aktifken iade yok
    assert_eq!(
        f.client.try_claim_refund(&id, &donor),
        Err(Ok(Error::CampaignStillActive))
    );

    // Hedefe ulaşıldıysa, süre dolsa bile iade yok
    f.client.donate(&id, &donor, &(80 * XLM));
    f.env.ledger().set_timestamp(f.env.ledger().timestamp() + 8 * DAY);
    assert_eq!(
        f.client.try_claim_refund(&id, &donor),
        Err(Ok(Error::CampaignSucceeded))
    );
}

#[test]
fn test_list_campaigns_returns_newest_first() {
    let f = setup();
    new_campaign(&f, 10 * XLM);
    new_campaign(&f, 20 * XLM);
    new_campaign(&f, 30 * XLM);

    let all = f.client.list_campaigns(&10);
    assert_eq!(all.len(), 3);
    assert_eq!(all.get(0).unwrap().id, 2);
    assert_eq!(all.get(2).unwrap().id, 0);

    let limited = f.client.list_campaigns(&2);
    assert_eq!(limited.len(), 2);
    assert_eq!(limited.get(0).unwrap().id, 2);
}

#[test]
fn test_unknown_campaign_reports_not_found() {
    let f = setup();
    assert_eq!(f.client.try_get_campaign(&42), Err(Ok(Error::CampaignNotFound)));
}
