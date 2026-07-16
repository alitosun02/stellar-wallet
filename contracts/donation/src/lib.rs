//! Bağış Kavanozu (Tip Jar) kontratı — Rise In Stellar Builder Challenge, Level 3.
//!
//! İleri seviye kontrat desenleri:
//! - **Inter-contract communication**: bağış tutarı, XLM'in token kontratına
//!   (Stellar Asset Contract) yapılan cross-contract `transfer` çağrısıyla tahsil edilir.
//! - **Yetkilendirme**: bağışçı `require_auth`, çekim yalnızca admin.
//! - **Kalıcı durum**: toplam bağış, bağış sayısı, bağışçı başına toplam.
//! - **Events**: her bağışta `Donation`, her çekimde `Withdrawal` yayınlanır.
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// init yalnızca bir kez çağrılabilir.
    AlreadyInitialized = 1,
    /// Kontrat henüz init edilmedi.
    NotInitialized = 2,
    /// Tutar sıfırdan büyük olmalı.
    InvalidAmount = 3,
    /// Kavanozdaki bakiyeden fazlası çekilemez.
    InsufficientJarBalance = 4,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    Total,
    Count,
    /// Bağışçı başına kümülatif bağış.
    Donor(Address),
}

/// Her başarılı bağışta yayınlanır.
#[contractevent]
pub struct Donation {
    #[topic]
    pub donor: Address,
    pub amount: i128,
    pub total: i128,
}

/// Admin çekiminde yayınlanır.
#[contractevent]
pub struct Withdrawal {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contract]
pub struct DonationContract;

#[contractimpl]
impl DonationContract {
    /// Kontratı bir admin ve bağışların tahsil edileceği token (XLM SAC) ile kurar.
    pub fn init(env: Env, admin: Address, token: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::Total, &0i128);
        env.storage().instance().set(&DataKey::Count, &0u32);
        env.storage().instance().extend_ttl(100_000, 200_000);
        Ok(())
    }

    /// Bağış yapar: bağışçının imzasıyla `amount` kadar token, token kontratına
    /// yapılan cross-contract `transfer` çağrısıyla bu kontrata aktarılır.
    /// Yeni kümülatif toplamı döndürür.
    pub fn donate(env: Env, donor: Address, amount: i128) -> Result<i128, Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        donor.require_auth();

        // Inter-contract çağrı: XLM SAC üzerinde transfer(donor -> bu kontrat)
        let token_client = token::Client::new(&env, &token_id);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        let total: i128 = env.storage().instance().get(&DataKey::Total).unwrap_or(0) + amount;
        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0) + 1;
        let donor_total: i128 =
            env.storage().persistent().get(&DataKey::Donor(donor.clone())).unwrap_or(0) + amount;

        env.storage().instance().set(&DataKey::Total, &total);
        env.storage().instance().set(&DataKey::Count, &count);
        env.storage()
            .persistent()
            .set(&DataKey::Donor(donor.clone()), &donor_total);
        env.storage().instance().extend_ttl(100_000, 200_000);

        Donation { donor, amount, total }.publish(&env);

        Ok(total)
    }

    /// Yalnızca admin: kavanozdan `to` adresine `amount` çeker (cross-contract transfer).
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .ok_or(Error::NotInitialized)?;

        admin.require_auth();

        let token_client = token::Client::new(&env, &token_id);
        let jar_balance = token_client.balance(&env.current_contract_address());
        if amount > jar_balance {
            return Err(Error::InsufficientJarBalance);
        }
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        Withdrawal { to, amount }.publish(&env);

        Ok(())
    }

    /// Toplam bağış tutarı (stroop cinsinden).
    pub fn get_total(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Total).unwrap_or(0)
    }

    /// Toplam bağış işlemi sayısı.
    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Bir bağışçının kümülatif bağışı.
    pub fn get_donor_total(env: Env, donor: Address) -> i128 {
        env.storage().persistent().get(&DataKey::Donor(donor)).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
