# Stellar Wallet — White Belt (Level 1)

**Stellar Journey to Mastery: Monthly Builder Challenges** programının Builder Track / Belt Progression
yolunda **⚪️ White Belt — Level 1** seviyesi için geliştirilmiş demo uygulama.

> Level 1 hedefi: *"Build wallets, handle balances, and submit your first on-chain transactions on Stellar."*

Bu uygulama, Stellar **Testnet** üzerinde çalışan, tarayıcı tabanlı bir cüzdan istemcisidir:

- 🔑 Yeni bir Stellar keypair oluşturma veya mevcut bir gizli anahtarla içe aktarma
- 💰 Hesap bakiyesini (XLM) görüntüleme ve Friendbot ile testnet fonlaması alma
- 📤 Başka bir Stellar adresine XLM ödemesi gönderme (gerçek, imzalanmış, testnet'e submit edilen işlem)
- 📜 Hesabın son ödeme işlemlerini listeleme, Stellar Expert üzerinde görüntüleme

## Neden bu mimari?

| Karar | Gerekçe |
|---|---|
| **Next.js 16 (App Router) + TypeScript + Tailwind** | İleriki seviyelerde (Soroban akıllı kontratlar, Freighter cüzdan entegrasyonu, çoklu cüzdan) büyümeye uygun, endüstri standardı bir temel. |
| **Client-only render (`ssr:false`)** | Gizli anahtar hiçbir zaman sunucuya/SSR'a dokunmuyor — tamamen tarayıcıda üretiliyor, imzalanıyor ve tutuluyor. |
| **`sessionStorage`, kalıcı depolama yok** | Cüzdan verisi yalnızca sekme açıkken bellekte kalır; sekme kapanınca silinir. Bu bir demo/eğitim uygulamasıdır, gerçek varlık saklama amacı taşımaz. |
| **`@stellar/stellar-sdk` (v16)** | Stellar ekosisteminin resmi JS/TS SDK'sı; Horizon testnet API'si ve işlem imzalama/gönderme için kullanılıyor. |

## ⚠️ Güvenlik Notu

Bu proje **yalnızca Stellar Testnet** için tasarlanmıştır. Gerçek (mainnet) varlıkları temsil eden bir
gizli anahtarı **asla** bu uygulamaya girmeyin. Gizli anahtar tarayıcı sekmesinin `sessionStorage`'ında
düz metin olarak tutulur — bu, bir demo/öğrenme uygulaması için kabul edilebilir, ancak üretim ortamı için
yeterli değildir (ileri seviyelerde Freighter gibi harici imzalayıcılara geçilecektir).

## Kurulum

```bash
npm install
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

## Kullanım Akışı

1. **Yeni Cüzdan Oluştur** ya da **Mevcut Cüzdanı İçe Aktar** ile bir Stellar keypair yükleyin.
2. Hesap testnet'te henüz aktif değilse **Friendbot ile Fonla** butonuyla 10.000 testnet XLM alın.
3. **Ödeme Gönder** formundan başka bir (fonlanmış) testnet adresine XLM gönderin.
4. **İşlem Geçmişi** bölümünden gönderilen/alınan ödemeleri ve Stellar Expert bağlantılarını görüntüleyin.

## Proje Yapısı

```
src/
  lib/stellar.ts            Stellar SDK ile tüm on-chain etkileşimler (keypair, bakiye, ödeme, geçmiş)
  context/WalletContext.tsx  Cüzdan oturum durumu (sessionStorage senkronizasyonu)
  components/                UI bileşenleri (onboarding, dashboard, bakiye, ödeme formu, geçmiş)
  app/                        Next.js App Router giriş noktaları
```

## Teknoloji

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- TypeScript
- Tailwind CSS
- [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) — Horizon Testnet + işlem oluşturma/imzalama

## Yol Haritası (Sonraki Belt'ler)

- 🟡 Yellow Belt (Level 2): Çoklu cüzdan entegrasyonu (Freighter), akıllı kontrat (Soroban) etkileşimi, gerçek zamanlı olay senkronizasyonu.
- 🟠 Orange Belt (Level 3): Gelişmiş akıllı kontratlarla eksiksiz bir mini dApp; test ve deploy süreçleri.
- 🟢 Green Belt (Level 4): Üretime hazır MVP.
- 🔵 Blue Belt (Level 5): 50 kullanıcıya ölçekleme, pitch deck ve demo.
- ⚫️ Black Belt (Level 6): Mainnet lansmanı, 20+ gerçek kullanıcı, güvenlik denetimi.
