//! FanFuel — hedef bazlı kitle fonlama / yaratıcı destekleme kontratı.
//!
//! Escrow durum makinesi:
//!   Active  ──(raised >= goal)──▶ Succeeded ──withdraw──▶ Withdrawn
//!      └────(deadline geçti, raised < goal)──▶ Failed ──claim_refund──▶ (destekçiye iade)
//!
//! Fonlar kontratta emanette (escrow) tutulur; para hareketleri XLM token
//! kontratına (Stellar Asset Contract) yapılan cross-contract çağrılarla yürür.
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, String,
    Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    /// Tutar sıfırdan büyük olmalı.
    InvalidAmount = 3,
    /// Hedef sıfırdan büyük olmalı.
    InvalidGoal = 4,
    /// Son tarih gelecekte olmalı.
    InvalidDeadline = 5,
    CampaignNotFound = 6,
    /// Kampanya süresi doldu, yeni destek alınamaz.
    CampaignEnded = 7,
    /// Hedefe ulaşılmadı — çekim yapılamaz.
    GoalNotReached = 8,
    /// Fonlar zaten çekildi.
    AlreadyWithdrawn = 9,
    /// Kampanya hâlâ aktif — iade talep edilemez.
    CampaignStillActive = 10,
    /// Kampanya başarılı — iade talep edilemez.
    CampaignSucceeded = 11,
    /// İade edilecek bir katkı yok (hiç destek olmadı ya da zaten iade alındı).
    NothingToRefund = 12,
}

/// Kampanyanın hesaplanan durumu.
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Status {
    /// Süre devam ediyor, hedefe henüz ulaşılmadı.
    Active = 0,
    /// Hedefe ulaşıldı, yaratıcı çekim yapabilir.
    Succeeded = 1,
    /// Süre doldu, hedefe ulaşılamadı — destekçiler iade alabilir.
    Failed = 2,
    /// Fonlar yaratıcı tarafından çekildi.
    Withdrawn = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Campaign {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub goal: i128,
    /// Unix saniye cinsinden bitiş zamanı.
    pub deadline: u64,
    pub raised: i128,
    pub supporters: u32,
    pub withdrawn: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Token,
    Count,
    Campaign(u32),
    /// (kampanya, destekçi) → katkı tutarı
    Contribution(u32, Address),
}

#[contractevent]
pub struct CampaignCreated {
    #[topic]
    pub creator: Address,
    pub id: u32,
    pub goal: i128,
    pub deadline: u64,
}

#[contractevent]
pub struct Donation {
    #[topic]
    pub donor: Address,
    pub id: u32,
    pub amount: i128,
    pub raised: i128,
}

#[contractevent]
pub struct Withdrawal {
    #[topic]
    pub creator: Address,
    pub id: u32,
    pub amount: i128,
}

#[contractevent]
pub struct Refund {
    #[topic]
    pub donor: Address,
    pub id: u32,
    pub amount: i128,
}

#[contract]
pub struct CampaignContract;

#[contractimpl]
impl CampaignContract {
    /// Kontratı, bağışların tahsil edileceği token (XLM SAC) ile kurar.
    pub fn init(env: Env, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Token) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage().instance().extend_ttl(500_000, 1_000_000);
        Ok(())
    }

    /// Yeni kampanya oluşturur, kampanya id'sini döndürür.
    pub fn create_campaign(
        env: Env,
        creator: Address,
        title: String,
        goal: i128,
        deadline: u64,
    ) -> Result<u32, Error> {
        if goal <= 0 {
            return Err(Error::InvalidGoal);
        }
        if deadline <= env.ledger().timestamp() {
            return Err(Error::InvalidDeadline);
        }
        if !env.storage().instance().has(&DataKey::Token) {
            return Err(Error::NotInitialized);
        }

        creator.require_auth();

        let id: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let campaign = Campaign {
            id,
            creator: creator.clone(),
            title,
            goal,
            deadline,
            raised: 0,
            supporters: 0,
            withdrawn: false,
        };

        env.storage().persistent().set(&DataKey::Campaign(id), &campaign);
        env.storage().instance().set(&DataKey::Count, &(id + 1));
        env.storage().instance().extend_ttl(500_000, 1_000_000);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Campaign(id), 500_000, 1_000_000);

        CampaignCreated {
            creator,
            id,
            goal,
            deadline,
        }
        .publish(&env);

        Ok(id)
    }

    /// Kampanyaya destek olur. Tutar, token kontratına yapılan cross-contract
    /// `transfer` çağrısıyla escrow'a (bu kontrata) aktarılır.
    pub fn donate(env: Env, id: u32, donor: Address, amount: i128) -> Result<i128, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let mut campaign = Self::load(&env, id)?;
        if env.ledger().timestamp() >= campaign.deadline {
            return Err(Error::CampaignEnded);
        }
        if campaign.withdrawn {
            return Err(Error::AlreadyWithdrawn);
        }

        donor.require_auth();

        let token_id = Self::token(&env)?;
        token::Client::new(&env, &token_id).transfer(
            &donor,
            &env.current_contract_address(),
            &amount,
        );

        let key = DataKey::Contribution(id, donor.clone());
        let previous: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if previous == 0 {
            campaign.supporters += 1;
        }
        env.storage().persistent().set(&key, &(previous + amount));
        env.storage().persistent().extend_ttl(&key, 500_000, 1_000_000);

        campaign.raised += amount;
        let raised = campaign.raised;
        Self::store(&env, &campaign);

        Donation {
            donor,
            id,
            amount,
            raised,
        }
        .publish(&env);

        Ok(raised)
    }

    /// Yaratıcı, hedefe ulaşıldıysa toplanan fonu çeker (kısmi çekim yok).
    pub fn withdraw(env: Env, id: u32) -> Result<i128, Error> {
        let mut campaign = Self::load(&env, id)?;
        if campaign.withdrawn {
            return Err(Error::AlreadyWithdrawn);
        }
        if campaign.raised < campaign.goal {
            return Err(Error::GoalNotReached);
        }

        campaign.creator.require_auth();

        let amount = campaign.raised;
        let token_id = Self::token(&env)?;
        token::Client::new(&env, &token_id).transfer(
            &env.current_contract_address(),
            &campaign.creator,
            &amount,
        );

        campaign.withdrawn = true;
        let creator = campaign.creator.clone();
        Self::store(&env, &campaign);

        Withdrawal {
            creator,
            id,
            amount,
        }
        .publish(&env);

        Ok(amount)
    }

    /// Kampanya başarısız olduysa (süre doldu, hedef tutmadı) destekçi
    /// katkısının tamamını geri alır.
    pub fn claim_refund(env: Env, id: u32, donor: Address) -> Result<i128, Error> {
        let campaign = Self::load(&env, id)?;
        if campaign.withdrawn {
            return Err(Error::CampaignSucceeded);
        }
        if env.ledger().timestamp() < campaign.deadline {
            return Err(Error::CampaignStillActive);
        }
        if campaign.raised >= campaign.goal {
            return Err(Error::CampaignSucceeded);
        }

        donor.require_auth();

        let key = DataKey::Contribution(id, donor.clone());
        let contribution: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if contribution <= 0 {
            return Err(Error::NothingToRefund);
        }

        let token_id = Self::token(&env)?;
        token::Client::new(&env, &token_id).transfer(
            &env.current_contract_address(),
            &donor,
            &contribution,
        );

        env.storage().persistent().set(&key, &0i128);

        Refund {
            donor,
            id,
            amount: contribution,
        }
        .publish(&env);

        Ok(contribution)
    }

    // ---- salt-okunur görünümler ----

    pub fn get_campaign(env: Env, id: u32) -> Result<Campaign, Error> {
        Self::load(&env, id)
    }

    /// Son `limit` kampanyayı (en yeniden eskiye) döndürür.
    pub fn list_campaigns(env: Env, limit: u32) -> Vec<Campaign> {
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut result = Vec::new(&env);
        if count == 0 {
            return result;
        }
        let take = if limit == 0 || limit > count { count } else { limit };
        let mut id = count;
        let mut taken = 0u32;
        while id > 0 && taken < take {
            id -= 1;
            if let Some(campaign) = env
                .storage()
                .persistent()
                .get::<DataKey, Campaign>(&DataKey::Campaign(id))
            {
                result.push_back(campaign);
                taken += 1;
            }
        }
        result
    }

    pub fn get_campaign_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    pub fn get_contribution(env: Env, id: u32, donor: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Contribution(id, donor))
            .unwrap_or(0)
    }

    /// Kampanyanın anlık durumunu hesaplar.
    pub fn get_status(env: Env, id: u32) -> Result<Status, Error> {
        let campaign = Self::load(&env, id)?;
        Ok(Self::status_of(&env, &campaign))
    }

    // ---- yardımcılar ----

    fn status_of(env: &Env, campaign: &Campaign) -> Status {
        if campaign.withdrawn {
            Status::Withdrawn
        } else if campaign.raised >= campaign.goal {
            Status::Succeeded
        } else if env.ledger().timestamp() >= campaign.deadline {
            Status::Failed
        } else {
            Status::Active
        }
    }

    fn load(env: &Env, id: u32) -> Result<Campaign, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Campaign(id))
            .ok_or(Error::CampaignNotFound)
    }

    fn store(env: &Env, campaign: &Campaign) {
        let key = DataKey::Campaign(campaign.id);
        env.storage().persistent().set(&key, campaign);
        env.storage().persistent().extend_ttl(&key, 500_000, 1_000_000);
    }

    fn token(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)
    }
}

#[cfg(test)]
mod test;
