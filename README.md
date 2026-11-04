# Sanal Portföy

BIST, yabancı hisse/ETF, TEFAS/BEFAS fonları, Türk altın türleri, döviz ve kripto varlıklarını tek ekranda takip eden kişisel portföy uygulaması. React 19, TypeScript, Vite ve Tailwind CSS ile yazılmıştır.

Veriler tarayıcıda (`localStorage`) tutulur, sunucuya gönderilmez. "Yedekle / Yükle" menüsünden JSON yedeği alınabilir. İsteğe bağlı olarak Google Drive ile cihazlar arasında eşitlenebilir (aşağıya bakın).

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
  googleAuth.ts Google Drive eşitlemesi için giriş uçları (/api/google/*)
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

## Birden fazla portföy

Üst menüdeki portföy adına tıklayarak portföyler arasında geçiş yapılabilir, yeni portföy açılabilir, portföyün adı değiştirilebilir veya silinebilir. Her portföyün varlıkları, işlemleri ve değer geçmişi ayrı tutulur; kurlar ve endeksler ortaktır. JSON yedeği o anda açık olan portföyü kapsar, yedek yüklemek de yalnızca açık portföyün içeriğini değiştirir.

Bu özellikten önce girilen veriler "Ana Portföy" adıyla açılır.

## Google Drive ile eşitleme (isteğe bağlı)

Üst menüdeki bulut düğmesinden Google hesabıyla bağlanılırsa tüm portföyler Drive'daki gizli uygulama klasörüne (`appDataFolder`) tek bir `sanal-portfoy.json` dosyası olarak kaydedilir ve aynı hesapla bağlanan her cihazda görünür. Bağlanmadan kullanım bugünkü gibi devam eder.

- Uygulama yalnızca kendi oluşturduğu bu dosyayı görebilir, Drive'daki diğer dosyalara erişemez.
- Açılışta, sekmeye geri dönüldüğünde, bağlantı geri geldiğinde ve her değişiklikten birkaç saniye sonra eşitlenir. İki cihazda aynı anda değişiklik yapılırsa en son yapılan geçerli olur.
- Verisi olan bir cihaz ilk kez bağlandığında Drive'da farklı veri varsa hangisinin kullanılacağı sorulur.
- Google girişi sırasında kod-anahtar değişimini Worker yapar (OAuth "client secret" orada durur). Worker hiçbir şey saklamaz; kalıcı erişim anahtarı yalnızca tarayıcıda tutulur.

Worker'da `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` tanımlı değilse bulut düğmesi hiç görünmez. Kurulum bir kez yapılır:

1. [Google Cloud Console](https://console.cloud.google.com/)'da yeni bir proje açın.
2. **APIs & Services › Library**'de **Google Drive API**'yi bulup **Enable** deyin.
3. **Google Auth Platform › Branding**'de uygulama adını (ör. Sanal Portföy) ve e-posta adresinizi girin; **Audience**'ta **External** seçin.
4. **Audience** sayfasında **Publish app** ile uygulamayı "In production" durumuna alın. "Testing" durumunda Google girişi 7 günde bir düşer. Kullanılan izin (`drive.appdata`) hassas sayılmadığı için Google incelemesi gerekmez.
5. **Clients › Create client**: tür **Web application**. **Authorized JavaScript origins**: `https://sanal-portfoy.pages.dev` ve `http://localhost:3000`. **Authorized redirect URIs**: `https://sanal-portfoy.pages.dev/` ve `http://localhost:3000/` (sondaki `/` dahil). Oluşan **Client ID** ve **Client secret**'ı kopyalayın.
6. Cloudflare panelinde **Workers & Pages › sanal-portfoy-fiyat › Settings › Variables and Secrets**'ta iki **Secret** ekleyin: `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET`, sonra **Deploy** deyin. Secret'lar sonraki otomatik Worker yayınlarında korunur.

Yerelde denemek için aynı iki değeri ortam değişkeni olarak verip `npm run dev` çalıştırın.

## Alış / satış işlemleri

Tablodaki ⇄ butonu bir varlığa alış veya satış işlemi eklemeyi ve işlem geçmişini görmeyi sağlar.

- **Alış:** miktar artar, ortalama maliyet ağırlıklı ortalamayla güncellenir (komisyon maliyete eklenir).
- **Satış:** miktar azalır, ortalama maliyet değişmez. Satıştan doğan kâr/zarar (komisyon düşülerek) "Gerçekleşmiş K/Z" olarak ayrıca tutulur.
- Tüm miktar satılan varlık "Kapandı" olarak tabloda kalır, geçmişi silinmez.
- İşlemler tarih sırasıyla yeniden hesaplanır; o tarihte eldekinden fazla satış kabul edilmez.
- Bu özellikten önce eklenmiş varlıklar otomatik olarak tek bir "Açılış kaydı" alışına dönüştürülür.

## Değer geçmişi

Uygulama her gün portföyün toplam değerini ve maliyetini bir kez kaydeder (aynı gün içindeki son değer geçerlidir). "Zaman İçinde Değer Değişimi" grafiği ve "Son Kayıttan Bu Yana Değişim" kartı bu kayıtlardan hesaplanır. Değişim kâr/zarar üzerinden ölçüldüğü için yeni varlık eklemek kazanç gibi görünmez. Kayıtlar JSON yedeğine de dahildir.
