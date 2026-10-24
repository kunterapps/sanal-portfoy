# Kişisel Yatırım ve Portföy Takip Uygulaması (Portfolio Tracker)

Tüm yatırım varlıklarını (Yabancı Hisse & ETF'ler, BIST Hisseleri, TEFAS/BEFAS Fonları, Türkiye'ye özgü Altın & Kıymetli Madenler ve Nakit Döviz) tek bir ekranda toplayan, canlı piyasa fiyatları, zaman içindeki değer değişim grafiği (1H, 1A, 3A, 6A, 1Y, TÜMÜ), çift para birimli (TRY ve USD) net değer hesaplaması, varlık/döviz dağılım grafikleri, localStorage gizliliği ve GitHub Pages uyumlu tek parça HTML dışa aktarım imkanı sunan modern bir portföy yönetim platformu.

## Kullanıcı İncelemesi & Revize Edilen Kritik Kararlar

> [!IMPORTANT]
> Kullanıcı geri bildirimleri doğrultusunda eklenen ve güncellenen özellikler:
> - **Türkiye'ye Özgü Altın Türleri**: Gram ve Ons'a ek olarak **Çeyrek Altın**, **Yarım Altın**, **Tam / Ziynet Altın**, **Cumhuriyet / Ata Altın** ve **22 Ayar Bilezik** doğrudan desteklenmektedir. Her birinin standart gramaj ve has altın katsayısı otomatik hesaplanıp canlı fiyatlandırılır.
> - **Zaman İçinde Portföy Değer Değişim Grafiği (Trend Analizi)**: Portföyün zaman içerisindeki toplam değer değişimini ve kümülatif getirisini gösteren, **1H (1 Hafta)**, **1A (1 Ay)**, **3A (3 Ay)**, **6A (6 Ay)**, **1Y (1 Yıl)** ve **TÜMÜ** zaman dilimlerinde filtrelenebilir interaktif alan/çizgi grafiği eklendi.
> - **Mimari & Dağıtım**: React 19 + Tailwind CSS ve tek tıkla GitHub Pages uyumlu bağımsız tek dosya HTML indirme motoru.
> - **Para Birimi**: Çift para birimi (TRY ve USD anlık kur çevrimiyle eş zamanlı).
> - **Başlangıç Durumu**: Sıfır bakiye ile temiz başlangıç (isteğe bağlı tek tıkla demo yükleme desteğiyle).

---

## 1. Genel Bakış ve Temel Konsept

- **Uygulama Amacı**: Dağınık borsa, fon, banka ve yastık altı altın varlıklarını tek bir gizlilik odaklı (local-first) kontrol panelinde konsolide etmek.
- **Hedef Kitle**: Türk Lirası, döviz, BIST, yabancı borsa, TEFAS/BEFAS fonları ve geleneksel Türk altınları yatırımı yapan bireysel yatırımcılar.
- **Temel Değer**: Üçüncü şahıslara veya sunuculara hiçbir finansal veri aktarmadan, tarayıcının kendi belleğinde (localStorage) güvenli portföy takibi, canlı kurlar ve geçmiş değer analizi.

---

## 2. Kullanıcı Deneyimi & Görsel Tasarım

### Ana Kullanıcı Akışları
1. **Sıfır Durum (Empty State)**: Uygulama ilk açıldığında zarif ve sade bir karşılama ekranı sunar; "+ İlk Varlığını Ekle" veya inceleme amaçlı "Örnek Portföy Yükle" butonları yer alır.
2. **Gelişmiş Varlık Ekleme Modalı**:
   - **Kategori Seçimi**: Yabancı Hisse/ETF, BIST Hissesi, TEFAS Fonu, BEFAS Emeklilik Fonu, Kıymetli Maden / Altın, Nakit Döviz.
   - **Altın Türü Seçicisi**: Gram Altın (24K), Çeyrek Altın (1.75g / 22K), Yarım Altın (3.50g / 22K), Tam Altın (7.00g / 22K), Ata / Cumhuriyet Altını (7.216g / 22K), 22 Ayar Gram / Bilezik, Ons Altın (31.10g).
   - **Maliyet ve Para Birimi**: TRY, USD, EUR, GBP seçenekleri ve otomatik kategori varsayılanı.
3. **Zaman Dilimli Portföy Değer Grafiği (Portfolio Performance)**:
   - Portföyün zaman içindeki gelişim eğrisi, toplam portföy değeri ve maliyet çizgisi.
   - Zaman filtresi düğmeleri: `1H` | `1A` | `3A` | `6A` | `1Y` | `TÜMÜ`.
   - Hover ile tarih bazında değer, kâr tutarı ve yüzde getiri tooltip'i.
4. **Dağılım Analizleri**:
   - Varlık Sınıfı Dağılım Pastası (Hisseler, Fonlar, Altın & Emtia, Nakit).
   - Para Birimi Risk Dağılımı (TRY, USD, EUR, GBP payları).
5. **Varlık Tablosu & Hızlı Aksiyonlar**:
   - Sekmeler: Tümü, Yabancı ETF/Hisse, BIST, TEFAS/BEFAS, Altın, Nakit.
   - Her satırda: Sembol/Tür, Adet/Gramaj, Ortalama Maliyet, Canlı Fiyat, Toplam Değer, Kâr/Zarar (TRY/USD & %), İşlemler (Düzenle, Fiyat Güncelle, Sil).
6. **Yedekleme & GitHub Pages İndirme**:
   - `JSON Portföy Yedeği İndir` / `JSON Yedeği Yükle`
   - `GitHub Pages Uyumlu Tek Parça HTML İndir`

### Görsel Kimlik ve Tema (Dark Mode SaaS)
- **Renk Paleti**:
  - Arka Plan: Koyu Slate/Zinc derin yüzey (`#090D16` ve `#0F172A`)
  - Kartlar ve Tablolar: İnce 1px çerçeveli sakin paneller (`#1E293B`, kenarlıklar `border-slate-800`)
  - Kazanç / Artış Rengi: Zümrüt Yeşili (`#10B981`)
  - Kayıp / Düşüş Rengi: Gül Kırmızısı (`#F43F5E`)
  - Vurgu & Aksiyon: Elektrik İndigo (`#6366F1`)
- **Tipografi**:
  - Başlıklar ve Navigasyon: Manrope / Plus Jakarta Sans
  - Finansal Rakamlar: `tabular-nums` ve `font-mono` ile kusursuz dikey hizalama
- **Görsel Düzen**:
  - Üst Bar: Logo, Canlı Kurlar Ticker'ı (USD/TRY, EUR/TRY, Gram Altın, Çeyrek Altın), "+ Varlık Ekle" butonu.
  - KPI Bandı: Toplam Portföy Değeri (TRY ve USD), Toplam Kâr/Zarar, Günlük Değişim, Varlık Sayısı.
  - Grafik Bölümü:
    1. Üst Tam Genişlik: **Zaman İçinde Değer Değişimi Alan Grafiği** (1H, 1A, 3A, 6A, 1Y, TÜMÜ butonlarıyla).
    2. Alt Bölüm: 2'li Izgara: **Varlık Sınıfı Dağılımı** & **Döviz Pozisyon Dağılımı**.
  - Veri Tablosu: Kategori filtreleri, arama çubuğu ve detaylı varlık satırları.

---

## 3. Ürün Kararları & Teknik Tercihler

- **Karar 1: Türkiye Altın Türleri Formülasyonu**:
  - *Seçilen Yaklaşım*: Canlı Gram Altın (24 ayar has altın) ve Ons Altın fiyatına endeksli matematiksel katsayı motoru.
    - Gram Altın (24K): 1.000 × Has Gram Fiyatı
    - Çeyrek Altın: Standart 1.75g (22K) $\approx$ 1.606g has altın + darphane işçilik marjı
    - Yarım Altın: Standart 3.50g (22K) $\approx$ 3.212g has altın
    - Tam Altın (Ziynet): Standart 7.00g (22K) $\approx$ 6.425g has altın
    - Ata / Cumhuriyet: Standart 7.216g (22K) $\approx$ 6.620g has altın
    - 22 Ayar Gram: 0.916 × Has Gram Fiyatı
    - Ons Altın: 1 Ons = 31.1035 Gram
  - *Gerekçe*: Yatırımcının elindeki fiziki veya banka altınlarını gerçek hayatta olduğu gibi adet olarak (örneğin "5 adet Çeyrek", "2 adet Cumhuriyet") girmesini sağlayıp doğru anlık değerini üretmek.
- **Karar 2: Zaman İçinde Portföy Değer Takibi**:
  - *Seçilen Yaklaşım*: LocalStorage üzerinde periyodik portföy değer anlık görüntüleri (snapshots) tutulur. Kullanıcı yeni varlık eklediğinde geçmiş işlem tarihlerine göre geriye dönük portföy maliyeti ve piyasa simülasyonu ile kusursuz bir 1H, 1A, 3A, 6A, 1Y ve TÜMÜ trend eğrisi çizilir.
- **Karar 3: Canlı Veri ve CORS Çözümü**:
  - *Seçilen Yaklaşım*: Açık kaynaklı `allorigins.win` ve `corsproxy.io` proxy'leri ile `open.er-api.com` döviz servisi ve Yahoo Finance JSON API entegrasyonu. Ağ kesintilerinde ekran donmaz, son fiyat korunur ve manuel düzenleme butonu görünür.
- **Karar 4: Tek Tıkla Bağımsız HTML Oluşturucu**:
  - *Seçilen Yaklaşım*: Uygulama içindeki portföyü ve tüm arayüzü tek bir `.html` dosyasına derleyip tarayıcıdan indiren jeneratör.

---

## 4. Teknik Mimari & Bileşen Yapısı

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Top Navigation Bar                                     │
│ [Portföy Takip] ── [USD/TRY: 38.45  EUR/TRY: 41.20  Gram: 3.150₺  Çeyrek: 5.145₺] ── [+ Varlık Ekle] │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                              Executive KPI Summary Strip                               │
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────────────────┐ │
│ │ Toplam Portföy Değeri│ │ Toplam Kâr / Zarar   │ │ 24s Değişim & Kur                 │ │
│ │ ₺1,450,200 (TRY)     │ │ +₺320,400 (+28.35%)  │ │ +₺14,250 (+1.02%)                │ │
│ │ $37,716 (USD)        │ │ [▲ Net Kazanç]       │ │ USD/TRY Çift Kur Modu            │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                    Zaman İçinde Değer Değişimi (Portfolio Trend)                       │
│ Zaman Dilimi: [1H] [1A] [3A] [6A] [1Y] [TÜMÜ]      Para Birimi: [TRY] [USD]           │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 📈 [İnteraktif Alan/Çizgi Grafiği: Toplam Portföy Değeri & Maliyet Eğrisi]         │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────┴────────────────────────────────────────────┐
│                             Dağılım Analiz Grafikleri                                  │
│ ┌──────────────────────────────────────────┐ ┌───────────────────────────────────────┐ │
│ │        Varlık Sınıfı Dağılımı            │ │         Döviz Riski Dağılımı          │ │
│ │  (Hisse, Fon, Türk Altını, Nakit)        │ │        (TRY %, USD %, EUR %)          │ │
│ └──────────────────────────────────────────┘ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────┴────────────────────────────────────────────┐
│                      Varlık Listesi Tablosu & Kategori Sekmeleri                       │
│ [Tümü] [Yabancı Hisse/ETF] [BIST] [TEFAS/BEFAS] [Altın & Kıymetli Maden] [Nakit/Döviz]│
│ [Arama...] [Canlı Fiyatları Yenile] [JSON İçe/Dışa Aktar] [Tek Dosya HTML İndir]       │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Varlık/Tür | Adet/Gramaj | Ort. Maliyet | Anlık Fiyat | Değer | K/Z (%) | İşlemler │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Doğrulama ve Test Adımları
1. **Altın Türleri Hesaplama Doğrulaması**: Çeyrek, yarım, tam ve Ata altın için girilen adetlerin has altın gramaj katsayılarıyla piyasa fiyatının kuruşu kuruşuna doğru hesaplandığının testi.
2. **Zaman Dilimi Filtre Testi**: 1H, 1A, 3A, 6A, 1Y ve TÜMÜ seçenekleri arasında geçiş yapıldığında grafiğin akıcı animasyonla güncellenmesi ve doğru zaman aralıklarını göstermesi.
3. **Çift Para Birimi Doğrulaması**: TRY ve USD modları arasında geçiş yapıldığında tüm KPI kartları, grafikler ve varlık değerlerinin anlık kur ile kusursuz senkronizasyonu.
4. **Veri Kalıcılığı & JSON Yedek**: Sayfa yenilendiğinde, tarayıcı kapatılıp açıldığında ve JSON içe/dışa aktarıldığında verilerin tam korunumu.
5. **Bağımsız HTML İhracı**: Üretilen `index.html` dosyasının çift tıklanarak doğrudan yerel tarayıcıda ve GitHub Pages ortamında bağımsız çalışmasının doğrulanması.
