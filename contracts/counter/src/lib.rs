//! Basit sayaç kontratı — Rise In Stellar Builder Challenge, Level 2 (Yellow Belt).
//!
//! Frontend'den okuma (`get_count`) ve yazma (`increment`) çağrılarını,
//! her artırmada yayınlanan `increment` olayını (event) gösterir.
#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, symbol_short, Address, Env, Symbol};

const COUNTER: Symbol = symbol_short!("COUNTER");

/// Her `increment` çağrısında yayınlanan kontrat olayı.
#[contractevent]
pub struct Increment {
    #[topic]
    pub caller: Address,
    pub count: u32,
}

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    /// Sayacı 1 artırır, yeni değeri döndürür ve bir `increment` olayı yayınlar.
    /// `caller` imzasıyla çağrılmalıdır (require_auth).
    pub fn increment(env: Env, caller: Address) -> u32 {
        caller.require_auth();

        let mut count: u32 = env.storage().instance().get(&COUNTER).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&COUNTER, &count);
        // Kontrat verisinin TTL'ini uzat (instance storage arşivlenmesin)
        env.storage().instance().extend_ttl(100_000, 200_000);

        Increment { caller, count }.publish(&env);

        count
    }

    /// Mevcut sayaç değerini döndürür (salt-okunur).
    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&COUNTER).unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
