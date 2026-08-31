# Checklist Setup Layanan Eksternal

Kode lokal sudah disiapkan. Langkah berikut membutuhkan akun, project, atau
secret milik organisasi sehingga harus dilakukan oleh pemilik environment.

## 1. Supabase

- [ ] Buat atau pilih project staging dan aktifkan backup sebelum migration.
- [ ] Salin Project URL, anon key, dan service-role key ke environment deployment.
- [ ] Jalankan `supabase/migrations/001_initial_schema.sql` sampai
  `009_notification_deduplication.sql` berurutan melalui SQL Editor atau Supabase CLI.
- [ ] Pastikan tabel utama, RPC, RLS, dan bucket private `ticket-attachments` ada.
- [ ] Buat Supervisor pertama dengan script bootstrap di bawah.
- [ ] Login, buat tiket, assign, resolve, close, dan unduh lampiran sebagai smoke test.
- [ ] Aktifkan backup/PITR sesuai paket dan lakukan restore drill sebelum produksi.

Environment bootstrap Supervisor tidak perlu disimpan permanen:

```powershell
$env:BOOTSTRAP_SUPERVISOR_USERNAME="supervisor"
$env:BOOTSTRAP_SUPERVISOR_NAME="Supervisor Utama"
$env:BOOTSTRAP_SUPERVISOR_PASSWORD="ganti-dengan-password-kuat"
npm run user:create-supervisor
Remove-Item Env:BOOTSTRAP_SUPERVISOR_PASSWORD
```

Script juga membutuhkan `NEXT_PUBLIC_SUPABASE_URL` dan
`SUPABASE_SERVICE_ROLE_KEY`. Jangan pernah memasukkan service-role key ke browser.

## 2. Upstash Redis

- [ ] Buat database Redis pada region terdekat dengan deployment aplikasi.
- [ ] Isi `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.
- [ ] Deploy ulang aplikasi dan periksa `GET /api/health`; `checks.redis` harus true.
- [ ] Uji rate limit login, logout/revocation session, cache laporan, dan maintenance lock.
- [ ] Cabut sementara token di staging untuk memastikan aplikasi tetap berjalan degraded.

Redis bukan penyimpan tiket. Kehilangan Redis hanya menghilangkan rate limit,
cache, revocation sementara, dan distributed lock; PostgreSQL tetap sumber data.

## 3. Upstash QStash

- [ ] Buat/aktifkan QStash dan salin token serta current/next signing key.
- [ ] Isi `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`, dan `APP_BASE_URL` HTTPS publik.
- [ ] Deploy aplikasi lebih dahulu agar endpoint job dapat dijangkau.
- [ ] Biarkan `ENABLE_WHATSAPP_OUTBOX_SCHEDULE=false` selama API WA belum tersedia.
- [ ] Jalankan `npm run qstash:setup` dari environment yang berisi secret produksi.
- [ ] Pastikan schedule `ticket-maintenance-5m` aktif dan invocation mendapat HTTP 200.
- [ ] Uji failure callback di staging dan pastikan Supervisor menerima notifikasi.

Setelah API outbound WhatsApp tersedia, isi URL/token gateway, ubah
`ENABLE_WHATSAPP_OUTBOX_SCHEDULE=true`, deploy ulang, dan jalankan kembali
`npm run qstash:setup` agar schedule `whatsapp-outbox-1m` dibuat.

## 4. WhatsApp Gateway Kantor

- [ ] Minta kontrak payload inbound, header/signature, endpoint outbound, auth, dan SLA.
- [ ] Isi environment `WHATSAPP_OFFICE_*` berdasarkan data resmi kantor.
- [ ] Daftarkan `POST /api/webhook/whatsapp` sebagai webhook.
- [ ] Uji pesan biasa, `#t`, duplicate message ID, follow-up, dan `YA`.
- [ ] Uji retry, status delivery, media, timeout, dan redaction log.

Bagian ini tetap blocked sampai akses API resmi diterima. Jangan menebak token,
payload, atau endpoint produksi.
