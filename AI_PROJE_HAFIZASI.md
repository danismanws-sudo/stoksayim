# PROJE: DETAY STOK SAYIM UYGULAMASI - AI HAFIZA DOSYASI
_Son güncelleme: 19.10.2026_

## 0. Temel Kurallar
- Kaynaklar:
  - `UYGULAMA NE YAPACAK.docx` (ana felsefe)
  - `UYGULAMA SÜRECİ WHATSAPP KONUŞMALARI.docx` (malzeme seçimi + DİĞER kuralı)
  - `BENZER BİR UYGULAMAYA DAİR GÖRSELLER/` (3 SS + tasarım talimatı docx: özellikler referans, arayüz premium/modern/şık)
  - `Duran Varlık Sayım Datası.xlsx` (11 sütunlu veri şablonu)
  - `KULLANACAKSAN LOGO/` (marka logoları)

## 1. Amaç ve Google Drive Veritabanı Kuralı
- Detay Stok çalışanları mobil, tablet ve bilgisayardan girerek Excel düzeninde duran varlık (demirbaş) sayımı yapar.
- **Veritabanı Google Drive üzerinde çalışır:**
  - Her operasyon `Operasyonlar/{OP_KODU}/` klasöründe kendi canlı Excel dosyası (`{OP_KODU}_Duran_Varlik_Sayim_Datasi.xlsx`) ve barkod ID'li fotoğraflar klasörüyle (`Fotograflar/{BARKOD}.webp`) saklanır.
  - Yönetici panelinden Google Drive Bulut Köprüsü (Google Apps Script Webhook) ile doğrudan kurumsal Google Drive hesabına senkronize edilir.

## 2. Kesinleşen İş Kuralları
1. **Barkod Eşsizliği:** Barkodlar TC Kimlik numarası gibi her ürüne özel ve EŞSİZ (unique) çalışır. Tekrar okutulursa uyarı verir ve kimin/nerede/ne zaman saydığını gösterir.
2. **Zorunlu Alanlar:** Sadece **Barkod** ve **Ürün Açıklaması** (ve aktif **Lokasyon**) zorunludur. Fotoğraf dahil diğer tüm alanlar opsiyoneldir.
3. **Lokasyon (Oda/Bölge) Kilidi:** Sayıma başlamadan önce `3340` veya `Kaplan Toplantı Odası` gibi serbest metin lokasyon girilmesi zorunludur. Oda değiştiğinde state/session kilidi üzerinden güncellenir.
4. **Esnek Fire & Sayım Modu:**
   - Mod A: Sıfırdan boş listeye sayım.
   - Mod B: Eski envanter listesi yüklenip **Bulunan / Fire (Eksik) / Fazla** karşılaştırması.
5. **Fotoğraf:** Her ürün için tek kare fotoğraf çekilir ve barkod numarası ID'si ile (`{barkod}.webp`) kaydedilir.
6. **Malzeme Seçimi + DİĞER:** Ana başlıklar (Mobilya, Teknolojik Alet, Beyaz Eşya, Ofis Malzemesi, Otomobil, Tekstil) -> Alt çeşitler (Masa, Sandalye, Saat, Kanepe, Keson, Askılık vb.) + **DİĞER** sekmesi (serbest klavye girişi).
7. **Operasyona Özel QR / Link:** Patron/yönetici panelden her operasyon için sadece o operasyonda geçerli özel QR kod ve WhatsApp linki üretir.

## 3. Uygulama Mimarisi (`web/` klasörü)
- **Ana Sayfa (`/`):** Rol seçimi, operasyon davet kodu girişi, hızlı erişim.
- **Saha Katılım (`/j/[token]`):** WhatsApp/QR linkiyle şifresiz Ad-Soyad + Telefon girişi.
- **Saha Sayım Ekranı (`/sayim/[opId]`):** Zorunlu lokasyon kilidi, kamera barkod tarayıcı, eşsiz barkod kontrolü, malzeme + DİĞER seçimi, tek fotoğraf çekimi, çevrimdışı kuyruk.
- **Yönetici & Patron Dashboard (`/panel`):** Canlı Excel tablosu, Fire karşılaştırma motoru, QR/WhatsApp link üretici, malzeme çeşitleri yönetimi ve Google Drive bağlantı ayarları.
