# Sanal Portföy

BIST, yabancı hisse/ETF, TEFAS/BEFAS fonları, Türk altın türleri, döviz ve kripto varlıklarını tek ekranda takip eden kişisel portföy uygulaması. React 19, TypeScript, Vite ve Tailwind CSS ile yazılmıştır.

Veriler yalnızca tarayıcıda (`localStorage`) tutulur, sunucuya gönderilmez. "Yedekle / Yükle" menüsünden JSON yedeği alınabilir.

## Çalıştırma

Node.js 22 veya üzeri gerekir.

```bash
npm install
npm run dev      # http://localhost:3000
```

Sürekli kullanım için derleyip sunucuyu başlatın:

```bash
npm run build
npm start        # http://localhost:3000
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | `dist/` klasörüne üretim derlemesi |
| `npm start` | Derlenmiş uygulamayı fiyat API'siyle birlikte 3000 portunda sunar |
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
  priceApi.ts   Sunucu tarafı fiyat API'si (/api/quote, /api/fund)
```

## Fiyat kaynakları

- **Döviz ve altın:** finans.truncgil.com, ulaşılamazsa Binance (PAXG) ve open.er-api.com.
- **BIST ve yabancı hisseler:** Yahoo Finance, uygulamanın kendi sunucusu üzerinden (`/api/quote`). Fiyat varlığın para birimine çevrilir (ör. EUR işlem gören bir ETF TRY ile takip ediliyorsa).
- **TEFAS/BEFAS:** tefas.gov.tr, uygulamanın kendi sunucusu üzerinden (`/api/fund`).
- **Kripto:** Binance, ulaşılamazsa Yahoo Finance (sunucu üzerinden).

Sunucu sonuçları önbelleğe alır (hisseler 1 dk, fonlar 10 dk). Fiyatı alınamayan varlık son bilinen fiyatıyla kalır ve tabloda "Eski fiyat" olarak işaretlenir.

Fiyat API'si `npm run dev`, `npm run preview` ve `npm start` ile çalışır. Uygulama sunucusuz bir statik barındırmada (ör. GitHub Pages) yayınlanırsa hisse ve fon fiyatları otomatik güncellenmez; döviz, altın ve kripto güncellenmeye devam eder.

## Alış / satış işlemleri

Tablodaki ⇄ butonu bir varlığa alış veya satış işlemi eklemeyi ve işlem geçmişini görmeyi sağlar.

- **Alış:** miktar artar, ortalama maliyet ağırlıklı ortalamayla güncellenir (komisyon maliyete eklenir).
- **Satış:** miktar azalır, ortalama maliyet değişmez. Satıştan doğan kâr/zarar (komisyon düşülerek) "Gerçekleşmiş K/Z" olarak ayrıca tutulur.
- Tüm miktar satılan varlık "Kapandı" olarak tabloda kalır, geçmişi silinmez.
- İşlemler tarih sırasıyla yeniden hesaplanır; o tarihte eldekinden fazla satış kabul edilmez.
- Bu özellikten önce eklenmiş varlıklar otomatik olarak tek bir "Açılış kaydı" alışına dönüştürülür.

Tek dosya HTML sürümü işlem geçmişini taşır ama işlem ekleme arayüzü yalnızca ana uygulamadadır.

## Değer geçmişi

Uygulama her gün portföyün toplam değerini ve maliyetini bir kez kaydeder (aynı gün içindeki son değer geçerlidir). "Zaman İçinde Değer Değişimi" grafiği ve "Son Kayıttan Bu Yana Değişim" kartı bu kayıtlardan hesaplanır. Değişim kâr/zarar üzerinden ölçüldüğü için yeni varlık eklemek kazanç gibi görünmez. Kayıtlar JSON yedeğine de dahildir.

## Tek dosya HTML

"HTML İndir" butonu, portföyü içine gömülü olarak taşıyan bağımsız bir `index.html` üretir (Vue ve Chart.js CDN üzerinden yüklenir). Bu dosya GitHub Pages gibi statik bir barındırmaya doğrudan yüklenebilir. Depodaki `standalone-portfolio.html` bu çıktının bir örneğidir.
