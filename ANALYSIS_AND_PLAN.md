# EDN-Backend: Teknik Analiz ve Planlama

## 1. Proje Özeti
Bu backend projesi (`edn-backend`), React Native mobil uygulaması ve Next.js web yönetim paneli için merkezi bir API sağlayacaktır. Amaç, güvenli, ölçeklenebilir ve modern bir altyapı kurmaktır.

## 2. Teknoloji Yığını (Tech Stack) Seçimi

### Backend Framework: **NestJS**
*   **Neden?** Node.js dünyasında kurumsal standart haline gelmiştir. Modüler yapısı (Module, Controller, Service), TypeScript ile tam uyumu ve Dependency Injection sistemi sayesinde kodun bakımı ve test edilmesi çok kolaydır. Express.js'e göre daha disiplinli bir yapı sunar.

### Veritabanı: **PostgreSQL (Supabase)**
*   **Durum:** Kesinleşti.
*   **Avantajlar:** 
    *   **Ücretsiz Katman:** 500MB veritabanı alanı.
    *   **Yönetim:** Web arayüzü üzerinden tablo yönetimi kolaylığı.
    *   **Prisma Uyumu:** Connection Pooling desteği ile serverless dostu.
*   **Yapılandırma:** `DATABASE_URL` (Transaction Pooler) ve `DIRECT_URL` (Session Pooler) ayrımı yapılarak migration hataları önlenecek.

### ORM: **Prisma**
*   **Neden?** Type-safe (Tip güvenli) veritabanı erişimi sağlar. Otomatik migration oluşturma yeteneği ve harika bir VS Code eklentisi vardır. SQL yazma hatasını minimize eder.

### Kimlik Doğrulama: **JWT (JSON Web Token)**
*   **Strateji:** `Access Token` (kısa ömürlü) ve `Refresh Token` (uzun ömürlü) yapısı. Bu yapı mobil uygulamalarda oturumun sürekli açık kalmasını sağlar.

## 3. Mimari Yapı (Modular Monolith)

Proje aşağıdaki kök modüllerden oluşacaktır:

1.  **Prisma Module:** (Tamamlandı) Veritabanı bağlantısı.
2.  **Auth Module:** Kayıt, giriş, token yenileme, şifre sıfırlama.
3.  **Users Module:** Profil yönetimi, roller (Admin, User).
4.  **Core Module:** Genel konfigürasyonlar, loglama, hata yakalama (Exception Filters).
5.  **School/Exam Modules:** Okul, Sınav, Salon vb. iş mantığı modülleri.

## 4. Geliştirme Yol Haritası

### Faz 1: Kurulum ve Altyapı (Devam Ediyor)
*   [x] NestJS projesinin oluşturulması.
*   [x] Prisma ORM kurulumu ve Supabase konfigürasyonu.
*   [ ] Swagger (OpenAPI) dokümantasyonunun aktif edilmesi.

### Faz 2: Kimlik Doğrulama (Auth)
*   User tablosunun tasarlanması.
*   JWT Guard ve Strategy implementasyonu.
*   Role-Based Access Control (RBAC) - Admin/User ayrımı.

### Faz 3: İş Mantığı ve API
*   Mobil ve Web için gerekli CRUD endpoint'lerinin yazılması.
*   Dosya yükleme işlemleri (Multer veya Cloudinary).

### Faz 4: Güvenlik ve Deploy
*   Rate Limiting (API saldırı koruması).
*   Helmet ve CORS ayarları.
*   CI/CD pipeline.
