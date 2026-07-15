/**
 * README için ekran görüntülerini üretir (docs/screenshots/).
 * Kullanım: dev sunucusu 3000 portunda çalışırken `node scripts/take-screenshots.mjs`
 *
 * Not: Freighter bir tarayıcı eklentisi olduğundan headless ortamda çalıştırılamaz;
 * "bağlı cüzdan" görüntüleri uygulamanın yerel test cüzdanı moduyla alınır.
 * Freighter bağlantısı aynı dashboard'u açar (sadece rozet "Freighter" yazar).
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { Horizon, Keypair, Networks, Operation, Asset, BASE_FEE, TransactionBuilder } from "@stellar/stellar-sdk";

const APP_URL = "http://localhost:3000";
const OUT_DIR = new URL("../docs/screenshots/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

mkdirSync(OUT_DIR, { recursive: true });

// Ödeme demosu için fonlanmış bir hedef hesap hazırla
async function prepareDestination() {
  const kp = Keypair.random();
  const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error("Friendbot destination funding failed");
  return kp.publicKey();
}

const setReactValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

async function main() {
  const destination = await prepareDestination();
  console.log("destination funded:", destination);

  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    defaultViewport: { width: 1280, height: 900 },
    args: ["--no-first-run", "--disable-extensions"],
  });
  const page = await browser.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle2" });

  // 1) Cüzdan bağlantı ekranı
  await page.waitForSelector("button");
  await page.screenshot({ path: `${OUT_DIR}/01-connect-wallet.png` });
  console.log("saved 01-connect-wallet.png");

  // Yerel cüzdan oluştur (headless'ta Freighter eklentisi çalışmaz)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Yeni Cüzdan Oluştur")
    );
    btn.click();
  });
  await page.waitForFunction(() => !!sessionStorage.getItem("stellar-wallet-session"));

  // Friendbot ile fonla ve bakiyeyi bekle
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Friendbot"))
  );
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Friendbot")
    );
    btn.click();
  });
  await page.waitForFunction(
    () => document.body.textContent.includes("10.000") || document.body.textContent.includes("10,000"),
    { timeout: 30000 }
  );

  // 2) Bağlı cüzdan + bakiye
  await page.screenshot({ path: `${OUT_DIR}/02-wallet-connected-balance.png` });
  console.log("saved 02-wallet-connected-balance.png");

  // Ödeme formunu doldur ve gönder
  await page.evaluate(
    ({ destination, setValSrc }) => {
      const setVal = eval(setValSrc);
      const panel = [...document.querySelectorAll("h2")]
        .find((h) => h.textContent.includes("Ödeme Gönder"))
        .closest("div.rounded-2xl");
      const inputs = panel.querySelectorAll("input");
      setVal(inputs[0], destination);
      setVal(inputs[1], "100");
      setVal(inputs[2], "level1 demo");
      const btn = [...panel.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Gönder")
      );
      btn.click();
    },
    { destination, setValSrc: `(${setReactValue.toString()})` }
  );

  // Başarı mesajı + hash bekle
  await page.waitForFunction(() => document.body.textContent.includes("İşlem başarılı"), {
    timeout: 45000,
  });
  // Ödeme paneline kaydır
  await page.evaluate(() => {
    [...document.querySelectorAll("h2")]
      .find((h) => h.textContent.includes("Ödeme Gönder"))
      .scrollIntoView({ block: "center" });
  });
  await new Promise((r) => setTimeout(r, 500));

  // 3) Başarılı işlem + hash
  await page.screenshot({ path: `${OUT_DIR}/03-transaction-success.png` });
  console.log("saved 03-transaction-success.png");

  // ---- Level 2 görüntüleri ----

  // 4) Soroban kontrat paneli: bakiye oku + kontrat üzerinden transfer
  await page.evaluate(() => {
    const panel = [...document.querySelectorAll("h2")]
      .find((h) => h.textContent.includes("Smart Contract"))
      .closest("div.rounded-2xl");
    const readBtn = [...panel.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Kontrattan Bakiye")
    );
    readBtn.click();
  });
  await page.waitForFunction(
    () => {
      const panel = [...document.querySelectorAll("h2")]
        .find((h) => h.textContent.includes("Smart Contract"))
        .closest("div.rounded-2xl");
      return /XLM/.test(panel.textContent) && !panel.textContent.includes("Okunuyor");
    },
    { timeout: 30000 }
  );

  await page.evaluate(
    ({ destination, setValSrc }) => {
      const setVal = eval(setValSrc);
      const panel = [...document.querySelectorAll("h2")]
        .find((h) => h.textContent.includes("Smart Contract"))
        .closest("div.rounded-2xl");
      const inputs = panel.querySelectorAll("input");
      setVal(inputs[0], destination);
      setVal(inputs[1], "15");
      const btn = [...panel.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Transfer Et")
      );
      btn.click();
    },
    { destination, setValSrc: `(${setReactValue.toString()})` }
  );
  await page.waitForFunction(
    () => document.body.textContent.includes("Kontrat transferi başarılı"),
    { timeout: 60000 }
  );
  await page.evaluate(() => {
    [...document.querySelectorAll("h2")]
      .find((h) => h.textContent.includes("Smart Contract"))
      .scrollIntoView({ block: "center" });
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT_DIR}/04-soroban-contract.png` });
  console.log("saved 04-soroban-contract.png");

  // 5) Gerçek zamanlı bildirim: dışarıdan ödeme gönder, toast'ı yakala
  const walletAddress = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("stellar-wallet-session")).publicKey
  );
  const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
  const senderKp = Keypair.random();
  await fetch(`https://friendbot.stellar.org?addr=${senderKp.publicKey()}`);
  const senderAcc = await horizon.loadAccount(senderKp.publicKey());
  const liveTx = new TransactionBuilder(senderAcc, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({ destination: walletAddress, asset: Asset.native(), amount: "42" })
    )
    .setTimeout(60)
    .build();
  liveTx.sign(senderKp);
  await horizon.submitTransaction(liveTx);
  console.log("external live payment submitted");

  await page.waitForSelector("div.fixed.bottom-6", { timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT_DIR}/05-realtime-notification.png` });
  console.log("saved 05-realtime-notification.png");

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
