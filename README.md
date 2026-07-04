# Stellar Wallet — Yellow Belt (Level 2)

**Stellar Journey to Mastery: Monthly Builder Challenges** programının Builder Track / Belt Progression
yolunda geliştirilen cüzdan uygulaması. Şu anki seviye: **🟡 Yellow Belt — Level 2**
(Level 1 ⚪️ tamamlandı — git geçmişine bakın).

> Level 2 hedefi: *"Work with multi-wallet integrations, smart contracts, transaction handling, and real-time event synchronization."*

Stellar **Testnet** üzerinde çalışan, tarayıcı tabanlı bir cüzdan istemcisidir.

## Özellikler

### Level 1 — White Belt ⚪️
- 🔑 Yeni Stellar keypair oluşturma veya gizli anahtarla içe aktarma
- 💰 Hesap bakiyesi görüntüleme ve Friendbot ile testnet fonlaması
- 📤 XLM ödemesi gönderme (imzalanıp testnet'e submit edilen gerçek işlem)
- 📜 İşlem geçmişi + Stellar Expert bağlantıları

### Level 2 — Yellow Belt 🟡
- 👛 **Çoklu cüzdan entegrasyonu** — üç bağlantı yöntemi:
  - Yerel keypair (oluştur / içe aktar)
  - [Freighter](https://freighter.app) tarayıcı eklentisi (`@stellar/freighter-api`)
  - [Albedo](https://albedo.link) web imzalayıcı (`@albedo-link/intent`, eklenti gerektirmez)
- ✍️ **Birleşik işlem imzalama** — işlemler imzasız XDR olarak kurulur, bağlı cüzdan
  türü ne olursa olsun aynı arayüzle imzalanır (`signWithWallet`)
- 📡 **Gerçek zamanlı olay senkronizasyonu** — Horizon SSE akışı (`payments().stream()`)
  ile gelen/giden ödemeler anında yakalanır: bakiye ve geçmiş otomatik yenilenir,
  ekranda canlı bildirim (toast) gösterilir
- 📜 **Smart contract etkileşimi (Soroban)** — XLM'in Stellar Asset Contract'ı (SAC) ile:
  - `balance` fonksiyonu `simulateTransaction` ile okunur (salt-okunur kontrat çağrısı)
  - `transfer` fonksiyonu `InvokeHostFunction` işlemiyle invoke edilir
    (prepare → sign → send → poll akışı, Soroban RPC üzerinden)

## Mimari Kararlar

| Karar | Gerekçe |
|---|---|
| **Next.js 16 (App Router) + TypeScript + Tailwind** | İleriki seviyelere (özel Soroban kontratları, mini dApp, MVP) büyümeye uygun temel. |
| **Client-only render (`ssr:false`)** | Gizli anahtar hiçbir zaman sunucuya/SSR'a dokunmuyor. |
| **`sessionStorage`, kalıcı depolama yok** | Cüzdan verisi sekme kapanınca silinir; demo/eğitim uygulaması. |
| **Freighter + Albedo (kit yerine doğrudan)** | `stellar-wallets-kit` ağır bağımlılıklar getiriyor (Trezor, WalletConnect); iki resmi hafif API ile aynı gereksinim daha sağlam karşılanıyor. |
| **SAC kontratı (native XLM)** | Level 2'de "smart contract ile çalışma" gereksinimi, zincirde deploy'lu gerçek bir kontrat olan SAC ile karşılanıyor; Level 3'te özel Rust/Soroban kontratı yazılıp deploy edilecek. |

## ⚠️ Güvenlik Notu

Bu proje **yalnızca Stellar Testnet** için tasarlanmıştır. Gerçek (mainnet) varlıkları temsil eden bir
gizli anahtarı **asla** bu uygulamaya girmeyin. Yerel cüzdan modunda gizli anahtar sekmenin
`sessionStorage`'ında tutulur — üretim kullanımı için Freighter/Albedo modlarını tercih edin
(anahtar hiçbir zaman uygulamaya girmez, imza harici cüzdanda atılır).

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kullanım Akışı

1. Cüzdan bağlayın: **Yeni Cüzdan Oluştur**, **Gizli Anahtarla İçe Aktar**, **Freighter** veya **Albedo**.
2. Hesap aktif değilse **Friendbot ile Fonla** ile 10.000 testnet XLM alın.
3. **Ödeme Gönder** ile klasik payment işlemi gönderin (bağlı cüzdan imzalar).
4. **Smart Contract (Soroban)** panelinden bakiyeyi kontrattan okuyun veya
   `transfer` fonksiyonunu invoke ederek XLM gönderin.
5. Başka bir hesaptan size ödeme geldiğinde canlı bildirimi ve otomatik güncellenen
   bakiye/geçmişi izleyin (sayfa yenilemeye gerek yok).

## Proje Yapısı

```
src/
  lib/stellar.ts             Horizon etkileşimleri (keypair, bakiye, ödeme kurma/gönderme, geçmiş)
  lib/soroban.ts             Soroban RPC + SAC kontrat çağrıları (balance simulate, transfer invoke)
  lib/wallets.ts             Çoklu cüzdan soyutlaması (yerel / Freighter / Albedo) + birleşik imzalama
  hooks/usePaymentStream.ts  Horizon SSE gerçek zamanlı ödeme akışı
  context/WalletContext.tsx  Cüzdan bağlantı durumu (sessionStorage senkronizasyonu)
  components/                UI bileşenleri (onboarding, dashboard, kontrat paneli, canlı bildirim...)
  app/                       Next.js App Router giriş noktaları
```

## Teknoloji

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- TypeScript, Tailwind CSS
- [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) — Horizon + Soroban RPC
- [`@stellar/freighter-api`](https://docs.freighter.app) — Freighter cüzdan entegrasyonu
- [`@albedo-link/intent`](https://albedo.link/docs) — Albedo web imzalayıcı

## Yol Haritası (Sonraki Belt'ler)

- 🟠 Orange Belt (Level 3): Özel Soroban kontratıyla eksiksiz bir mini dApp; test ve deploy süreçleri.
- 🟢 Green Belt (Level 4): Üretime hazır MVP.
- 🔵 Blue Belt (Level 5): 50 kullanıcıya ölçekleme, pitch deck ve demo.
- ⚫️ Black Belt (Level 6): Mainnet lansmanı, 20+ gerçek kullanıcı, güvenlik denetimi.
