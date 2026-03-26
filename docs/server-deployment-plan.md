# EDN Projesi - Sunucu Kurulum ve Yayınlama Planı

Bu belge, **185.254.28.53** IP adresli Ubuntu 22 sunucusu üzerinde NestJS Backend, PostgreSQL ve n8n servislerinin kurulumu ve yönetimi için rehberdir.

## 1. Aşama: Sunucu Hazırlığı ve Docker Kurulumu
Sunucunun modern ve izole bir yapıda çalışması için Docker kullanılacaktır.
- [ ] SSH ile sunucuya bağlantı sağlanması (`ssh root@185.254.28.53`).
- [ ] Sistemin güncellenmesi (`apt update && apt upgrade`).
- [ ] Docker ve Docker Compose kurulumunun yapılması.
- [ ] Firewall (UFW) ayarlarının yapılandırılması (22, 80, 443 ve veritabanı portları).

## 2. Aşama: Veritabanı (PostgreSQL) ve n8n Kurulumu
n8n ve Backend için ortak veya ayrı veritabanları Docker üzerinde çalışacaktır.
- [ ] `docker-compose.yml` dosyasının hazırlanması.
- [ ] PostgreSQL konteynerının ayağa kaldırılması.
- [ ] n8n konteynerının ayağa kaldırılması.
- [ ] Veritabanı kullanıcılarının ve DB'lerin oluşturulması.

## 3. Aşama: Local Test ve Veri Göçü
Server üzerindeki DB'nin dışarıya (şimdilik) açılması ve localdeki projenin oraya bağlanması.
- [ ] Sunucudaki PostgreSQL portunun (5432) geçici olarak dışarıya açılması.
- [ ] Localdeki `.env` dosyasındaki `DATABASE_URL`'in yeni IP ile güncellenmesi.
- [ ] `npx prisma db push` ile şemanın sunucuya basılması.
- [ ] Local uygulamanın sunucu veritabanıyla çalıştığının doğrulanması.

## 4. Aşama: Otomatik Deploy (CI/CD) - GitHub Actions
Vercel rahatlığında bir deneyim için yapılandırılacaktır.
- [ ] GitHub'da `SERVER_IP`, `SERVER_SSH_KEY` ve `ENV_FILE` secret'larının tanımlanması.
- [ ] `.github/workflows/deploy.yml` dosyasının oluşturulması.
- [ ] Her `git push` sonrasında:
    - Kodun build edilmesi.
    - Sunucuya aktarılması.
    - PM2 veya Docker ile yeniden başlatılması.

## 5. Aşama: Alan Adı ve SSL (Nginx)
Profesyonel erişim için domain yönlendirmesi.
- [ ] Domainin (Cloudflare üzerinden) IP adresine yönlendirilmesi.
- [ ] Nginx Reverse Proxy ayarlarının yapılması.
    - `api.edirneburada.com` -> Backend (Port 3000)
    - `n8n.edirneburada.com` -> n8n (Port 5678)
- [ ] Certbot ile ücretsiz SSL (HTTPS) sertifikalarının alınması.

---

### Sunucu Bilgileri (Özet)
- **IP:** 185.254.28.53
- **OS:** Ubuntu 22 (LTS)
- **Kaynak:** 4 vCPU / 4 GB RAM / 30 GB SSD
- **Altyapı:** Docker + PM2 + Nginx

---
*Son Güncelleme: 26.03.2026*
