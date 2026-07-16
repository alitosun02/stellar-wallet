#!/usr/bin/env bash
# Kontrat deploy workflow'u — testnet'e tekrarlanabilir deploy.
#
# Kullanım:
#   ./scripts/deploy-contracts.sh <source-account-alias>
#
# Önkoşullar:
#   - stellar CLI kurulu (https://developers.stellar.org/docs/tools/cli)
#   - `stellar keys generate <alias> --network testnet --fund` ile fonlanmış bir hesap
#   - Rust + wasm32v1-none hedefi (rustup target add wasm32v1-none)
set -euo pipefail

SOURCE="${1:?kullanım: deploy-contracts.sh <source-account-alias>}"
NETWORK=testnet
NATIVE_SAC="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" # testnet XLM SAC

ADMIN=$(stellar keys address "$SOURCE")

for contract in counter donation; do
  echo "==> $contract: test + build"
  (cd "contracts/$contract" && cargo test --locked && cargo build --target wasm32v1-none --release --locked)

  echo "==> $contract: deploy ($NETWORK)"
  stellar contract deploy \
    --wasm "contracts/$contract/target/wasm32v1-none/release/$contract.wasm" \
    --source-account "$SOURCE" \
    --network "$NETWORK" \
    --alias "$contract"
done

echo "==> donation: init (admin=$ADMIN, token=$NATIVE_SAC)"
stellar contract invoke --id donation --source-account "$SOURCE" --network "$NETWORK" -- \
  init --admin "$ADMIN" --token "$NATIVE_SAC" || echo "(init daha önce yapılmış olabilir — AlreadyInitialized beklenen bir durumdur)"

echo "Tamamlandı. Kontrat adreslerini src/lib/counter.ts ve src/lib/donation.ts içinde güncellemeyi unutmayın."
