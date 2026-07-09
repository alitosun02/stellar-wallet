# Stellar Wallet — Rise In Builder Challenge

A browser-based Stellar **Testnet** wallet dApp built for the **Stellar Journey to Mastery: Monthly Builder Challenges** (Builder Track / Belt Progression).

Connect a wallet (**Freighter**, Albedo, or a local test keypair), fund it via Friendbot, view your XLM balance, and send real XLM transactions on the Stellar testnet — with live transaction feedback and real-time payment notifications.

---

## ✅ Level 1 (White Belt) Requirements Coverage

| Requirement | Implementation |
|---|---|
| **Freighter wallet setup** | Integrated via [`@stellar/freighter-api`](https://www.npmjs.com/package/@stellar/freighter-api) — see [`src/lib/wallets.ts`](src/lib/wallets.ts) |
| **Stellar Testnet** | All Horizon/Soroban calls use `Networks.TESTNET` (`horizon-testnet.stellar.org`) |
| **Wallet connect** | `isConnected()` → `setAllowed()` → `getAddress()` → `getNetwork()` flow in `connectFreighter()`; "🚀 Freighter Cüzdanını Bağla" is the primary CTA |
| **Wallet disconnect** | "Bağlantıyı Kes (Disconnect)" button clears the session (`clearConnection`) |
| **Fetch & display XLM balance** | Horizon `loadAccount` → balance card in UI, with Friendbot one-click funding for new accounts |
| **Send XLM transaction on testnet** | Payment built with `TransactionBuilder`, signed by the connected wallet (`signTransaction` for Freighter), submitted to Horizon |
| **Transaction feedback (success/failure + hash)** | Success panel shows the full **transaction hash** + Stellar Expert link; failures render clear error messages |
| **Error handling** | Invalid address/secret validation, unfunded account detection, network errors surfaced in UI |

## 📸 Screenshots

### 1. Wallet connect screen
![Wallet connect](docs/screenshots/01-connect-wallet.png)

### 2. Wallet connected — balance displayed
![Wallet connected with balance](docs/screenshots/02-wallet-connected-balance.png)

### 3. Successful testnet transaction (hash + explorer link)
![Transaction success](docs/screenshots/03-transaction-success.png)

> Screenshots are generated with the local test wallet mode (headless browsers cannot run the Freighter extension). Connecting with Freighter opens the exact same dashboard — only the wallet badge reads "Freighter" and signing happens inside the extension.

## 🚀 Setup — Run Locally

```bash
git clone https://github.com/alitosun02/stellar-wallet.git
cd stellar-wallet
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Freighter setup

1. Install the [Freighter extension](https://freighter.app) (Chrome/Firefox/Edge).
2. Create or import a wallet inside Freighter.
3. Open Freighter → **Settings → Network** and switch to **Testnet**.
4. In the app, click **🚀 Freighter Cüzdanını Bağla** and approve the connection prompt.
5. If your testnet account is new, click **Friendbot ile Fonla** to receive 10,000 test XLM.

### Try it without an extension

- **Albedo**: browser-popup signer, no extension needed.
- **Local test wallet**: generates a keypair in the browser (testnet only, stored in `sessionStorage`).

## 🧭 Usage Flow

1. **Connect** a wallet (Freighter / Albedo / local test keypair).
2. **Fund** the account via Friendbot if it's not active on testnet yet.
3. **Check balance** — displayed on the dashboard, refreshes automatically.
4. **Send XLM** — enter destination + amount, the connected wallet signs, and the app submits to testnet.
5. **See feedback** — success panel with transaction hash + [Stellar Expert](https://stellar.expert/explorer/testnet) link, or a descriptive error.
6. **Watch live** — incoming/outgoing payments stream in real time (Horizon SSE): balance and history auto-update with a toast notification.

## 🟡 Level 2 (Yellow Belt) Features — also included

This repo has progressed to Level 2 on the same codebase:

- 👛 **Multi-wallet integrations** — Freighter (`@stellar/freighter-api`), Albedo (`@albedo-link/intent`), and local keypair behind one unified interface
- ✍️ **Unified transaction handling** — transactions are built as unsigned XDR and signed by whichever wallet is connected (`signWithWallet`)
- 📡 **Real-time event synchronization** — Horizon SSE payment stream (`payments().forAccount().stream()`) with auto-refresh + live toasts
- 📜 **Smart contract interaction (Soroban)** — the native XLM Stellar Asset Contract (SAC):
  - `balance` read via `simulateTransaction` (read-only contract call)
  - `transfer` invoked as a real `InvokeHostFunction` transaction (prepare → sign → send → poll) over Soroban RPC

## 🏗️ Project Structure

```
src/
  lib/stellar.ts             Horizon interactions (keypair, balances, payment build/submit, history)
  lib/wallets.ts             Multi-wallet abstraction (Freighter / Albedo / local) + unified signing
  lib/soroban.ts             Soroban RPC + SAC contract calls (balance simulate, transfer invoke)
  hooks/usePaymentStream.ts  Real-time Horizon SSE payment stream
  context/WalletContext.tsx  Wallet connection state (sessionStorage-backed)
  components/                UI components (onboarding, dashboard, contract panel, live toasts...)
  app/                       Next.js App Router entry points
scripts/
  take-screenshots.mjs       Automated README screenshot generation (puppeteer-core)
```

## 🛠️ Tech Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack) + TypeScript + Tailwind CSS
- [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) — Horizon + Soroban RPC
- [`@stellar/freighter-api`](https://docs.freighter.app) — Freighter wallet connection & signing
- [`@albedo-link/intent`](https://albedo.link/docs) — Albedo web signer

## ⚠️ Security Note

This project targets **Stellar Testnet only**. Never enter a secret key that controls mainnet assets. In local-wallet mode the secret lives in the tab's `sessionStorage` and is wiped when the tab closes; prefer **Freighter/Albedo** modes, where keys never touch the app and signing happens in the wallet.

## 🗺️ Roadmap (Next Belts)

- 🟠 Orange Belt (Level 3): complete mini dApp with a custom Soroban contract; tests and deployment.
- 🟢 Green Belt (Level 4): production-ready MVP.
- 🔵 Blue Belt (Level 5): scale to 50 users, pitch deck and demo.
- ⚫️ Black Belt (Level 6): mainnet launch, 20+ real users, security review.
