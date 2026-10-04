# Detay Stok Sayım Uygulaması

Bu proje, saha çalışanlarının mobil cihazları üzerinden (kamera ile barkod okutarak ve fotoğraf çekerek) hızlı ve Excel düzeninde stok sayımı yapabilmesini sağlayan özel bir sistemdir.

## 🚀 Proje Felsefesi ve Temel Özellikler
- **Çoklu Platform (PWA):** Mobil, tablet ve masaüstünden erişim.
- **Kamera ile Barkod & Fotoğraf:** Çalışanlar kamera ile ürün barkodu okutur, o an ürünün fotoğrafını çeker ve sisteme barkod ID'si ile yükler.
- **Uygulama İndirme Derdi Yok:** Her sayım operasyonu (Örn: X Firması Ekim Sayımı) için patron/yönetici tarafından özel bir **Link veya QR Kod** üretilir. Çalışanlar bu linke tıklayarak doğrudan o sayıma dahil olurlar.
- **Gelişmiş Yönetici Paneli (Dashboard):** Yöneticiler Excel düzeninde tüm sayım verilerini canlı olarak takip edebilir, verileri operasyon/firma bazında filtreleyebilir. Veriler kesinlikle birbirine karışmaz.

## 🏗️ Kullanıcı Rolleri
1. **Saha Çalışanları:** Kendilerine iletilen operasyona özel link/QR ile anında giriş yapıp hızlıca veri girerler. Sadece kendi saydıkları ürünleri görürler.
2. **Patron ve Yöneticiler:** Kendilerine özel şifreli panelden girerek tüm operasyonları yönetir, yeni QR/Link üretir ve Excel benzeri geniş tablodan tüm verileri (fotoğraflar dahil) incelerler.
