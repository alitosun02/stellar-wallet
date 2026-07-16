/**
 * Demo videosu kaydeder (docs/demo.webm, ~90 saniye).
 * Kullanım: dev sunucusu 3000 portunda çalışırken `node scripts/record-demo.mjs`
 * Gereksinim: PATH üzerinde ffmpeg (puppeteer screencast için).
 *
 * Akış: cüzdan oluştur → Friendbot fonla → ödeme gönder → bağış yap (TipJar)
 *       → sayaç artır (Counter) → işlem geçmişi.
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

async function clickByText(page, text, container = null) {
  await page.evaluate(
    ({ text, container }) => {
      let root = document;
      if (container) {
        const heading = [...document.querySelectorAll("h2")].find((h) =>
          h.textContent.includes(container)
        );
        root = heading.closest("div.rounded-2xl");
      }
      const btn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes(text));
      btn.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => btn.click(), 400);
    },
    { text, container }
  );
  await sleep(700);
}

async function scrollToPanel(page, heading) {
  await page.evaluate((heading) => {
    const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.includes(heading));
    h.scrollIntoView({ block: "start", behavior: "smooth" });
  }, heading);
  await sleep(1500);
}

async function waitForText(page, text, timeout = 45000) {
  await page.waitForFunction((t) => document.body.textContent.includes(t), { timeout }, text);
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
  await page.waitForSelector("button");

  const recorder = await page.screencast({ path: `${OUT}/demo.webm` });
  console.log("recording started");

  // 1) Bağlantı ekranı (cüzdan seçenekleri)
  await sleep(4000);

  // 2) Yerel test cüzdanı oluştur (Freighter eklentisi headless'ta yok)
  await clickByText(page, "Yeni Cüzdan Oluştur");
  await sleep(2500);

  // 3) Friendbot ile fonla, bakiyeyi göster
  await clickByText(page, "Friendbot");
  await waitForText(page, "10.000");
  await sleep(2500);

  // 4) Ödeme gönder
  const dest = "GBSUXN22UTCUYFKQKDE2HTOMZG4DJUWUBXWC6D6EOW627UB777OGOUWU";
  await page.evaluate(
    ({ dest, setValSrc }) => {
      const setVal = eval(setValSrc);
      const panel = [...document.querySelectorAll("h2")]
        .find((h) => h.textContent.includes("Ödeme Gönder"))
        .closest("div.rounded-2xl");
      panel.scrollIntoView({ block: "start", behavior: "smooth" });
      const inputs = panel.querySelectorAll("input");
      setVal(inputs[0], dest);
      setVal(inputs[1], "50");
      setVal(inputs[2], "demo video");
    },
    { dest, setValSrc: `(${setReactValue.toString()})` }
  );
  await sleep(1500);
  await clickByText(page, "Gönder", "Ödeme Gönder");
  await waitForText(page, "İşlem başarılı");
  await sleep(3000);

  // 5) TipJar: bağış yap (inter-contract çağrı)
  await scrollToPanel(page, "Bağış Kavanozu");
  await page.evaluate(
    ({ setValSrc }) => {
      const setVal = eval(setValSrc);
      const panel = [...document.querySelectorAll("h2")]
        .find((h) => h.textContent.includes("Bağış Kavanozu"))
        .closest("div.rounded-2xl");
      setVal(panel.querySelector("input"), "15");
    },
    { setValSrc: `(${setReactValue.toString()})` }
  );
  await sleep(800);
  await clickByText(page, "Bağış Yap", "Bağış Kavanozu");
  await waitForText(page, "✅ Başarılı (success)", 60000);
  await sleep(3500);

  // 6) Counter: increment
  await scrollToPanel(page, "Counter");
  await clickByText(page, "Artır", "Counter");
  await page.waitForFunction(
    () => {
      const h = [...document.querySelectorAll("h2")].find((x) => x.textContent.includes("Counter"));
      return h.closest("div.rounded-2xl").textContent.includes("✅ Başarılı");
    },
    { timeout: 60000 }
  );
  await sleep(3500);

  // 7) İşlem geçmişi
  await scrollToPanel(page, "İşlem Geçmişi");
  await sleep(5000);

  // 8) Kapanış: yukarı dönüp tüm dashboard'u yavaşça gez
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await sleep(3000);
  await page.evaluate(async () => {
    const total = document.body.scrollHeight;
    for (let y = 0; y <= total; y += 12) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 16));
    }
  });
  await sleep(3000);

  await recorder.stop();
  console.log("recording saved to docs/demo.webm");
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
