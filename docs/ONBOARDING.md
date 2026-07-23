# Try FanFuel in 3 minutes (Stellar Testnet)

> **No real money involved.** FanFuel runs on Stellar's *test* network. The XLM you
> use is free test currency with no value.

**Live app: https://stellar-wallet-steel.vercel.app**

---

## Option A — fastest (no extension, 60 seconds)

1. Open the app and click **Connect wallet**.
2. Choose **Create test wallet** — a Stellar keypair is generated in your browser.
3. Go to the **Wallet** tab and click **Fund with Friendbot** → you receive 10,000 test XLM.
4. Return to **Campaigns**, open any campaign, enter an amount and click **Support**.
5. Your support appears in "Recent support" within seconds, with a link to Stellar Expert.

That's it — you've made a real on-chain smart-contract call.

## Option B — with a real wallet extension (Freighter)

1. Install [Freighter](https://freighter.app) and create a wallet.
2. In Freighter: **Settings → Network → Testnet**.
3. In the app click **Connect wallet → Connect Freighter** and approve.
4. Fund the account with Friendbot from the **Wallet** tab (or [friendbot.stellar.org](https://friendbot.stellar.org)).
5. Support a campaign — Freighter will ask you to sign the transaction.

## Want to start your own campaign?

**Start a campaign** → title, goal (in XLM), duration. Your campaign is created on-chain
and immediately shareable. If you hit the goal you can withdraw; if you miss it, every
supporter can reclaim their contribution.

## Please leave feedback 🙏

Click the **💬 Feedback** button (bottom-right) and tell us:

- Was anything confusing?
- Did anything break or feel slow?
- Would you actually use this if it ran on mainnet with real XLM/USDC?

Feedback goes straight to the team and shapes the next version.

## FAQ

**Is this real money?** No — Stellar Testnet only. Test XLM is free and worthless.

**Is it safe to use my test wallet secret key?** The generated test wallet lives only in
your browser tab's session storage and is erased when you close the tab. Never enter a
secret key that controls real (mainnet) assets into any web app, including this one.

**Where do the funds go when I support a campaign?** Into the campaign smart contract's
escrow — not to the creator directly. The creator can only withdraw if the goal is met;
otherwise you can claim a refund after the deadline.

**Can I verify everything myself?** Yes. Every action links to
[Stellar Expert](https://stellar.expert/explorer/testnet), and the contract source is in
[`contracts/campaign`](../contracts/campaign).
