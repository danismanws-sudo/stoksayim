# PROJE: DETAY STOK SAYIM UYGULAMASI - AI HAFIZA DOSYASI

## 1. Temel Kural
- **Asla onaysız uygulamaya/kodlamaya geçilmeyecek.** Her aşamada onay alınacak.
- Ana kaynak her zaman `UYGULAMA NE YAPACAK.docx` dosyasıdır. Değişiklikler oradan takip edilecek.

## 2. Genel Felsefe ve Amaç
- Detay Stok firması çalışanlarının mobil, tablet ve bilgisayar üzerinden Excel mantığıyla, pratik bir şekilde sayım yapmasını sağlayan bir sistem.
- Cihaz kamerası aktif olarak kullanılacak.

## 3. Kullanıcı Tipleri ve Görevleri
**A. Saha Çalışanı (Mobil/Tablet Kullanıcısı)**
- Cihaz kamerasını kullanarak ürünlerin **barkodlarını okutacak.**
- Aynı zamanda sayımını yaptığı ürünün **fotoğrafını çekecek** ve bu fotoğraf direkt o ürünün barkod ID'si ile eşleşecek.
- Uygulama indirme derdi yok. Doğrudan WhatsApp'tan vb. gelen **QR kod veya link ile** sisteme anında girecek.

**B. Patron ve Yöneticiler (Dashboard Kullanıcısı)**
- Bilgisayar/Tablet üzerinden sadece yetkililerin erişebileceği bir **Yönetici Paneli (Dashboard)** kullanılacak.
- Excel'deki verilerin tamamına ve tüm ürün detaylarına bu panelden hakim olacaklar.
- Yeni bir sayım işlemi (başka bir gün veya başka bir firmanın sayımı) ayrı bir **Operasyon Numarası/İsmi** altında oluşturulacak.

## 4. Özel İş Kuralları (Operasyon ve QR/Link Yönetimi)
- Patron/Yönetici, panelden her bir operasyon (örn. X firması projesi) için **özel bir QR kod veya bağlantı (link) üretebilecek.**
- Üretilen bu link/QR kod **SADECE o operasyon için geçerli olacak.** 
- Böylece çalışan, X operasyonunun QR kodunu okuttuğunda sadece X operasyonuna veri girecek, veriler diğer günlerin/firmaların sayımlarıyla asla karışmayacak.

## 5. Teknik Altyapı Notları
- **Platform:** PWA (Progressive Web App - İndirmeden çalışan, kameraya erişebilen web uygulaması)
- **Versiyon Kontrol:** Tüm kodlar `https://github.com/danismanws-sudo/stoksayim.git` reposuna senkronize edilecek.
