/**
 * README ekran görüntülerini üretir (docs/screenshots/).
 * Kullanım: dev sunucusu 3000 portunda çalışırken `node scripts/take-screenshots.mjs`
 *
 * Not: Freighter bir tarayıcı eklentisi olduğundan headless ortamda çalışmaz;
 * görüntüler yerel test cüzdanı moduyla alınır. Freighter bağlantısı aynı
 * arayüzü açar, yalnızca imza eklentide atılır.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const APP_URL = "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT_DIR = new URL("../docs/screenshots/", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1"
);

mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setReactValue = (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
};

async function clickText(page, text, scope = "body") {
  await page.evaluate(
    ({ text, scope }) => {
      const root = document.querySelector(scope) ?? document.body;
      const btn = [...root.querySelectorAll("button, a")].find((b) =>
        b.textContent.includes(text)
      );
      if (!btn) throw new Error(`button not found: ${text}`);
      btn.click();
    },
    { text, scope }
  );
  await sleep(600);
}

async function setLocale(page, locale) {
  await page.evaluate((locale) => {
    const btn = [...document.querySelectorAll("header button")].find(
      (b) => b.textContent.trim() === locale
    );
    btn?.click();
  }, locale);
  await sleep(400);
}

async function connectTestWallet(page) {
  await clickText(page, "Connect wallet", "header");
  await clickText(page, "Create test wallet");
  await page.waitForFunction(() => !!sessionStorage.getItem("stellar-wallet-session"));
  const publicKey = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("stellar-wallet-session")).publicKey
  );
  const funded = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
  if (!funded.ok) throw new Error("friendbot funding failed");
  return publicKey;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1.5 },
    args: ["--no-first-run", "--disable-extensions"],
  });
  const page = await browser.newPage();

  await page.goto(APP_URL, { waitUntil: "networkidle2" });
  await page.waitForSelector("header button");
  await setLocale(page, "en");
  await page.waitForFunction(() => document.body.textContent.includes("raised of"), {
    timeout: 30000,
  });
  await sleep(1200);

  // 1) Ana sayfa — ürün arayüzü
  await page.screenshot({ path: `${OUT_DIR}/10-product-home.png`, fullPage: true });
  console.log("saved 10-product-home.png");

  // 2) Cüzdan bağla + fonla
  await connectTestWallet(page);
  await sleep(800);

  // 3) Kampanya detayı + destek akışı
  await page.goto(`${APP_URL}/campaigns/0`, { waitUntil: "networkidle2" });
  // Not: başlıklar CSS ile büyütülüyor; textContent özgün yazımını korur
  await page.waitForFunction(() => document.body.textContent.includes("Support this campaign"), {
    timeout: 30000,
  });
  await page.evaluate(
    ({ setValSrc }) => {
      const setVal = eval(setValSrc);
      setVal(document.querySelector("main input[type=number]"), "75");
    },
    { setValSrc: `(${setReactValue.toString()})` }
  );
  await sleep(400);
  await clickText(page, "Support", "main");
  await page.waitForFunction(() => document.body.textContent.includes("✅ Success"), {
    timeout: 90000,
  });
  await sleep(1500);
  await page.screenshot({ path: `${OUT_DIR}/11-campaign-support.png`, fullPage: true });
  console.log("saved 11-campaign-support.png");

  // 4) Kampanya oluşturma ekranı
  await page.goto(`${APP_URL}/create`, { waitUntil: "networkidle2" });
  await sleep(1000);
  await page.evaluate(
    ({ setValSrc }) => {
      const setVal = eval(setValSrc);
      const inputs = document.querySelectorAll("main input");
      setVal(inputs[0], "Weekly Stellar dev newsletter");
      setVal(inputs[1], "300");
    },
    { setValSrc: `(${setReactValue.toString()})` }
  );
  await sleep(400);
  await page.screenshot({ path: `${OUT_DIR}/12-create-campaign.png` });
  console.log("saved 12-create-campaign.png");

  // 5) Geri bildirim widget'ı
  await page.goto(APP_URL, { waitUntil: "networkidle2" });
  await sleep(800);
  await clickText(page, "Feedback");
  await sleep(600);
  await page.evaluate(() => {
    const stars = [...document.querySelectorAll('[role=dialog] button[aria-label]')];
    stars[3]?.click();
    const textarea = document.querySelector("[role=dialog] textarea");
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(textarea),
      "value"
    ).set;
    setter.call(textarea, "The refund guarantee is what makes this trustworthy.");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(500);
  await page.screenshot({ path: `${OUT_DIR}/13-feedback-widget.png` });
  console.log("saved 13-feedback-widget.png");

  // 6) Mobil görünüm (Türkçe — iki dilli desteği de gösterir)
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2 });
  await page.goto(`${APP_URL}/campaigns/0`, { waitUntil: "networkidle2" });
  await setLocale(page, "tr");
  await page.waitForFunction(() => document.body.textContent.includes("Bu kampanyayı destekle"), {
    timeout: 30000,
  });
  await sleep(1000);
  await page.screenshot({ path: `${OUT_DIR}/14-mobile-responsive.png`, fullPage: true });
  console.log("saved 14-mobile-responsive.png");

  await browser.close();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
