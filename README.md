# Sanal Portföy

BIST, yabancı hisse/ETF, TEFAS/BEFAS fonları, Türk altın türleri, döviz ve kripto varlıklarını tek ekranda takip eden kişisel portföy uygulaması. React 19, TypeScript, Vite ve Tailwind CSS ile yazılmıştır.

Veriler yalnızca tarayıcıda (`localStorage`) tutulur, sunucuya gönderilmez. "Yedekle / Yükle" menüsünden JSON yedeği alınabilir.

## Çalıştırma

Node.js 22 veya üzeri gerekir.

```bash
npm install
npm run dev      # http://localhost:3000
```

Yerelde fiyat API'si Vite'ın içinde çalışır, ayrıca bir şey kurmak gerekmez. Yayın için aşağıdaki "Yayınlama (Cloudflare)" bölümüne bakın.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | `dist/` klasörüne üretim derlemesi |
| `npm start` | Derlenmiş uygulamayı fiyat API'siyle birlikte 3000 portunda sunar |
| `npm run worker:deploy` | Fiyat API'sini Cloudflare Worker olarak yayınlar |
| `npm run preview` | Derlenmiş uygulamayı yerelde açar (fiyat API'si dahil) |
| `npm run lint` | TypeScript tip kontrolü |
| `npm test` | Birim testleri (Vitest) |

## Klasör yapısı

```
src/
  components/   Arayüz bileşenleri (tablo, grafikler, modallar)
  services/     Canlı kur ve fiyat çekme (marketDataService)
  utils/        Hesaplamalar: kâr/zarar, döviz çevrimi, altın fiyatı, yedek doğrulama, tek dosya HTML üretici
  types/        Ortak tipler
  data/         Örnek portföy
  test/         Birim testleri
server/
  priceApi.ts   Fiyat API'si (/api/quote, /api/fund); yerelde Vite, yayında Worker kullanır
worker/
  index.ts      Cloudflare Worker girişi
```

## Fiyat kaynakları

- **Döviz ve altın:** finans.truncgil.com, ulaşılamazsa Binance (PAXG) ve open.er-api.com.
- **BIST ve yabancı hisseler:** Yahoo Finance, uygulamanın kendi sunucusu üzerinden (`/api/quote`). Fiyat varlığın para birimine çevrilir (ör. EUR işlem gören bir ETF TRY ile takip ediliyorsa).
- **TEFAS/BEFAS:** tefas.gov.tr, uygulamanın kendi sunucusu üzerinden (`/api/fund`).
- **Kripto:** Binance, ulaşılamazsa Yahoo Finance (sunucu üzerinden).

Sunucu sonuçları önbelleğe alır (hisseler 1 dk, fonlar 10 dk). Fiyatı alınamayan varlık son bilinen fiyatıyla kalır ve tabloda "Eski fiyat" olarak işaretlenir.

Fiyat API'si yerelde `npm run dev` / `npm run preview` içinde, yayında Cloudflare Worker'da çalışır. Worker adresi tanımlanmadan yayınlanan bir sitede hisse ve fon fiyatları güncellenmez; döviz, altın ve kripto güncellenmeye devam eder.

## Yayınlama (Cloudflare)

Site `https://sanal-portfoy.pages.dev` adresinde Cloudflare Pages'de, hisse/fon fiyat API'si ücretsiz bir Cloudflare Worker'da çalışır (ücretsiz katman günde 100.000 istek). Kurulum bir kez yapılır:

1. **Worker'ı yayınlayın:** [cloudflare.com](https://dash.cloudflare.com/sign-up) üzerinden ücretsiz hesap açın, sonra repo klasöründe:
   ```bash
   npx wrangler@4 login     # tarayıcıda Cloudflare girişi
   npm run worker:deploy    # çıktıda https://sanal-portfoy-fiyat.<hesap>.workers.dev adresi yazar
   ```
2. **Adresi tanıtın:** repo › Settings › Secrets and variables › Actions › **Variables** sekmesinde `PRICE_API_URL` adında bir değişken oluşturup Worker adresini yazın.
3. **Secret'ları ekleyin:** aşağıdaki "Worker'ı otomatik yayınlama" adımlarıyla `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` secret'larını tanımlayın. Anahtarın izinlerinde **Account › Cloudflare Pages › Edit** de bulunmalıdır.
4. **Yayınlayın:** Actions sekmesinde "Cloudflare Pages" iş akışını çalıştırın (sonraki her `main` güncellemesinde kendiliğinden çalışır). İlk çalıştığında Pages projesini kendisi oluşturur.

Veriler tarayıcıda site adresine bağlı tutulur. Adres değişirse eski adresteki sitede üst menüdeki yedekleme düğmesinden **JSON Portföy Yedeği** alıp yeni adreste **JSON Yedeği Yükle** ile geri yükleyin.

### Worker'ı otomatik yayınlama (isteğe bağlı)

`server/`, `worker/` veya `wrangler.toml` değiştiğinde "Cloudflare Worker" iş akışı Worker'ı kendiliğinden yayınlar. Bunun için bir kez:

1. Cloudflare panelinde sağ üstten **My Profile › API Tokens › Create Token** deyip **Edit Cloudflare Workers** şablonunu seçin. Account Resources'ta kendi hesabınızı, Zone Resources'ta "All zones" seçip anahtarı oluşturun ve kopyalayın.
2. Cloudflare panelinde **Workers & Pages** sayfasının sağındaki **Account ID** değerini kopyalayın.
3. GitHub'da repo › Settings › Secrets and variables › Actions › **Secrets** sekmesinde iki secret ekleyin: `CLOUDFLARE_API_TOKEN` (anahtar) ve `CLOUDFLARE_ACCOUNT_ID` (hesap kimliği).
4. Actions sekmesinde "Cloudflare Worker" iş akışını bir kez elle çalıştırın.

Secret tanımlı değilse iş akışı bir uyarı yazıp hiçbir şey yayınlamadan biter; Worker'ı yine `npm run worker:deploy` ile elle yayınlayabilirsiniz.

Worker yalnızca `wrangler.toml` içindeki `ALLOWED_ORIGINS` listesindeki sitelerden gelen istekleri kabul eder. Siteyi başka bir adreste yayınlarsanız bu listeye ekleyin; Worker yeniden yayınlanır (otomatik yayın kurulu değilse `npm run worker:deploy`).

Veriler yine yalnızca tarayıcınızda tutulur; Worker sadece sorulan sembolün fiyatını döndürür, portföy bilgisi saklamaz.

## Alış / satış işlemleri

Tablodaki ⇄ butonu bir varlığa alış veya satış işlemi eklemeyi ve işlem geçmişini görmeyi sağlar.

- **Alış:** miktar artar, ortalama maliyet ağırlıklı ortalamayla güncellenir (komisyon maliyete eklenir).
- **Satış:** miktar azalır, ortalama maliyet değişmez. Satıştan doğan kâr/zarar (komisyon düşülerek) "Gerçekleşmiş K/Z" olarak ayrıca tutulur.
- Tüm miktar satılan varlık "Kapandı" olarak tabloda kalır, geçmişi silinmez.
- İşlemler tarih sırasıyla yeniden hesaplanır; o tarihte eldekinden fazla satış kabul edilmez.
- Bu özellikten önce eklenmiş varlıklar otomatik olarak tek bir "Açılış kaydı" alışına dönüştürülür.

## Değer geçmişi

Uygulama her gün portföyün toplam değerini ve maliyetini bir kez kaydeder (aynı gün içindeki son değer geçerlidir). "Zaman İçinde Değer Değişimi" grafiği ve "Son Kayıttan Bu Yana Değişim" kartı bu kayıtlardan hesaplanır. Değişim kâr/zarar üzerinden ölçüldüğü için yeni varlık eklemek kazanç gibi görünmez. Kayıtlar JSON yedeğine de dahildir.
