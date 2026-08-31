# Operasional Sistem Ticketing

## Konfigurasi aplikasi

Isi `AUTH_SESSION_SECRET`, `JOB_SECRET`, konfigurasi Supabase, dan konfigurasi
gateway WhatsApp dari `.env.example`. Jangan gunakan nilai contoh di produksi.
`JOB_SECRET` tetap disediakan untuk pemanggilan manual; QStash produksi memakai
signature resminya.

## Database

Jalankan seluruh file `supabase/migrations` dari 001 sampai 009 sesuai nomor.
Migration 007 wajib sebelum operasi tiket karena kode menulis `whatsapp_outbox`;
migration 008 menyimpan audit autentikasi dan 009 mencegah notifikasi retry ganda.

Supervisor pertama dapat dibuat setelah migration dengan environment bootstrap,
lalu jalankan `npm run user:create-supervisor`. Hapus nilai
`BOOTSTRAP_SUPERVISOR_PASSWORD` dari environment/shell setelah selesai.

## Scheduler

Setelah aplikasi memiliki URL HTTPS publik dan environment QStash terpasang,
jalankan `npm run qstash:setup`. Script membuat maintenance setiap lima menit,
retry tiga kali, dan failure callback. Schedule outbox hanya dibuat bila
`ENABLE_WHATSAPP_OUTBOX_SCHEDULE=true`.

Untuk invocation manual:

```http
POST /api/jobs/ticket-maintenance
Authorization: Bearer <JOB_SECRET>
```

Job maintenance menangani reminder informasi 15 menit, auto-close setelah reminder,
reminder assignment 30 menit, tiket stagnan empat jam kerja, dan auto-close
RESOLVED setelah 24 jam. Reminder WhatsApp membutuhkan
`WHATSAPP_OFFICE_SEND_URL`. Jangan aktifkan schedule outbox sebelum endpoint dan
token kantor tersedia.

## Redis

Redis dipakai untuk rate limit, session revocation, cache laporan 30 detik, dan
lock maintenance. PostgreSQL tetap sumber kebenaran. Jika Redis terganggu,
aplikasi berjalan dalam mode degraded dan tidak menggagalkan operasi utama.

## Log dan retensi

Logger JSON otomatis meredaksi password, token, secret, authorization, cookie,
dan service-role key; nomor telepon dimasking. String dibatasi 2.000 karakter.
Atur retensi log aplikasi 90 hari dan audit autentikasi/database minimal 365 hari
pada platform deployment/Supabase, atau ikuti kebijakan organisasi bila lebih lama.

## Health check

`GET /api/health` mengembalikan status database dan Redis. Database menentukan
HTTP 200 atau 503; kegagalan Redis membuat status `degraded` tetapi tidak
mematikan aplikasi.

## Realtime

Dashboard memakai authenticated Server-Sent Events dari `/api/v1/events`.
Jika koneksi putus, browser otomatis memakai polling 30 detik.

## Lampiran

Bucket `ticket-attachments` bersifat private. Download memakai signed URL
berumur 60 detik setelah API memeriksa akses tiket.
