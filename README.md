# Sanal Portföy

BIST, yabancı hisse/ETF, TEFAS/BEFAS fonları, Türk altın türleri, döviz ve kripto varlıklarını tek ekranda takip eden kişisel portföy uygulaması. React 19, TypeScript, Vite ve Tailwind CSS ile yazılmıştır.

Veriler yalnızca tarayıcıda (`localStorage`) tutulur, sunucuya gönderilmez. "Yedekle / Yükle" menüsünden JSON yedeği alınabilir.

## Çalıştırma

Node.js 22 veya üzeri gerekir.

```bash
npm install
npm run dev      # http://localhost:3000
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | `dist/` klasörüne üretim derlemesi |
| `npm run preview` | Derlenmiş uygulamayı yerelde açar |
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
```

## Fiyat kaynakları

- **Döviz ve altın:** finans.truncgil.com, ulaşılamazsa Binance (PAXG) ve open.er-api.com.
- **BIST ve yabancı hisseler:** Yahoo Finance, herkese açık CORS proxy'leri üzerinden.
- **TEFAS/BEFAS:** birkaç deneme uç noktası.
- **Kripto:** Binance, ulaşılamazsa Yahoo Finance.

Hisse ve fon fiyatları üçüncü taraf proxy'lere bağlı olduğundan her zaman alınamayabilir. Fiyatı alınamayan varlık son bilinen fiyatıyla kalır ve tabloda "Eski fiyat" olarak işaretlenir.

## Değer geçmişi

Uygulama her gün portföyün toplam değerini ve maliyetini bir kez kaydeder (aynı gün içindeki son değer geçerlidir). "Zaman İçinde Değer Değişimi" grafiği ve "Son Kayıttan Bu Yana Değişim" kartı bu kayıtlardan hesaplanır. Değişim kâr/zarar üzerinden ölçüldüğü için yeni varlık eklemek kazanç gibi görünmez. Kayıtlar JSON yedeğine de dahildir.

## Tek dosya HTML

"HTML İndir" butonu, portföyü içine gömülü olarak taşıyan bağımsız bir `index.html` üretir (Vue ve Chart.js CDN üzerinden yüklenir). Bu dosya GitHub Pages gibi statik bir barındırmaya doğrudan yüklenebilir. Depodaki `standalone-portfolio.html` bu çıktının bir örneğidir.
