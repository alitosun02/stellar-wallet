/**
 * Demo videosu kaydeder (docs/demo.webm → ffmpeg ile docs/demo.mp4).
 * Kullanım: dev sunucusu 3000 portunda çalışırken `node scripts/record-demo.mjs`
 * Gereksinim: PATH üzerinde ffmpeg.
 *
 * Akış: ana sayfa → cüzdan bağla → fonla → kampanyayı destekle (kontrat çağrısı)
 *       → kampanya oluştur → dil değiştir → geri bildirim → mobil görünüm.
 */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const APP_URL = "http://localhost:3000";
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const OUT = new URL("../docs/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

mkdirSync(OUT, { recursive: true });

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
      const el = [...root.querySelectorAll("button, a")].find((b) =>
        b.textContent.includes(text)
      );
      if (!el) throw new Error(`not found: ${text}`);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => el.click(), 350);
    },
    { text, scope }
  );
  await sleep(900);
}

async function typeInto(page, selector, value, index = 0) {
  await page.evaluate(
    ({ selector, value, index, setValSrc }) => {
      const setVal = eval(setValSrc);
      const el = document.querySelectorAll(selector)[index];
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setVal(el, value);
    },
    { selector, value, index, setValSrc: `(${setReactValue.toString()})` }
  );
  await sleep(700);
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    defaultViewport: { width: 1280, height: 800 },
    args: ["--no-first-run", "--disable-extensions"],
  });
  const page = await browser.newPage();
  await page.goto(APP_URL, { waitUntil: "networkidle2" });
  await page.waitForSelector("header button");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("header button")].find(
      (b) => b.textContent.trim() === "en"
    );
    btn?.click();
  });
  await page.waitForFunction(() => document.body.textContent.includes("raised of"), {
    timeout: 30000,
  });

  const recorder = await page.screencast({ path: `${OUT}/demo.webm` });
  console.log("recording started");

  // 1) Ana sayfa tanıtımı
  await sleep(4500);
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: "smooth" }));
  await sleep(3500);

  // 2) Cüzdan bağlama
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(1200);
  await clickText(page, "Connect wallet", "header");
  await sleep(2500);
  await clickText(page, "Create test wallet");
  await sleep(1500);

  // 3) Friendbot ile fonlama
  const publicKey = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("stellar-wallet-session")).publicKey
  );
  await page.goto(`${APP_URL}/wallet`, { waitUntil: "networkidle2" });
  await sleep(2500);
  await clickText(page, "Fund with Friendbot", "main");
  // Bakiye tarayıcı diline göre biçimlenir (10,000 veya 10.000)
  await page.waitForFunction(() => /10[.,]?000/.test(document.body.textContent), {
    timeout: 45000,
  });
  await sleep(3000);
  console.log("wallet funded:", publicKey);

  // 4) Kampanyayı destekle — asıl kontrat çağrısı
  await page.goto(`${APP_URL}`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await clickText(page, "Open-source Stellar tooling");
  await page.waitForFunction(() => document.body.textContent.includes("Support this campaign"), {
    timeout: 30000,
  });
  await sleep(2500);
  await typeInto(page, "main input[type=number]", "60");
  await clickText(page, "Support", "main");
  await page.waitForFunction(() => document.body.textContent.includes("✅ Success"), {
    timeout: 90000,
  });
  await sleep(4500);

  // 5) Kampanya oluşturma ekranı
  await page.goto(`${APP_URL}/create`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await typeInto(page, "main input", "Weekly Stellar dev newsletter", 0);
  await typeInto(page, "main input", "300", 1);
  await sleep(2500);

  // 6) Dil değiştirme (EN → TR)
  await page.goto(`${APP_URL}/campaigns/0`, { waitUntil: "networkidle2" });
  await sleep(2000);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("header button")].find(
      (b) => b.textContent.trim() === "tr"
    );
    btn?.click();
  });
  await sleep(3500);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("header button")].find(
      (b) => b.textContent.trim() === "en"
    );
    btn?.click();
  });
  await sleep(2000);

  // 7) Geri bildirim widget'ı
  await clickText(page, "Feedback");
  await sleep(2500);
  await page.evaluate(() => {
    const stars = [...document.querySelectorAll("[role=dialog] button[aria-label]")];
    stars[4]?.click();
  });
  await sleep(1200);
  await page.evaluate(() => {
    const textarea = document.querySelector("[role=dialog] textarea");
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(textarea),
      "value"
    ).set;
    setter.call(textarea, "Refund guarantee makes this trustworthy — would use on mainnet.");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(3000);
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const close = document.querySelector("[role=dialog] button[aria-label]");
    if (document.querySelector("[role=dialog]")) close?.click();
  });
  await sleep(1000);

  // 8) Mobil görünüm
  await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${APP_URL}`, { waitUntil: "networkidle2" });
  await sleep(3000);
  await page.evaluate(async () => {
    const total = document.body.scrollHeight;
    for (let y = 0; y <= total; y += 10) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 16));
    }
  });
  await sleep(2500);

  await recorder.stop();
  console.log("recording saved to docs/demo.webm");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
