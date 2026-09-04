# Design Document: Internal Ticketing System

## 1. Tujuan dan Status

Sistem menyediakan dashboard internal untuk mengelola laporan kendala aplikasi. Reporter akan mengirim laporan melalui WhatsApp Gateway kantor, sedangkan Staff dan Supervisor menangani tiket melalui dashboard web.

Status per 4 September 2026:

- Core dashboard, autentikasi, RBAC, tiket, notifikasi, laporan, audit trail, lampiran, maintenance handler, dan webhook adapter tersedia dalam kode.
- Integrasi nyata dengan WhatsApp Gateway kantor belum dapat diuji karena akses API belum tersedia.
- Migration database 001 sampai 011 sudah disiapkan; penerapan migration terbaru pada Supabase staging belum diverifikasi.
- Redis dan QStash sudah terhubung di kode. Pembuatan resource, secret, schedule, dan uji staging masih harus dilakukan pada layanan nyata.

## 2. Arsitektur Aktual

Alur utama:

1. Dashboard Next.js memanggil API /api/v1.
2. API memvalidasi signed HTTP-only session dan role.
3. Ticket Service memakai Supabase service-role setelah pemeriksaan aplikasi.
4. PostgreSQL menyimpan data dan menjalankan mutation RPC atomik.
5. Supabase Storage menyimpan lampiran private.
6. SSE /api/v1/events memberi sinyal perubahan ke browser; polling 30 detik menjadi fallback.
7. Webhook /api/webhook/whatsapp menerima payload Meta atau gateway kantor.
8. Maintenance endpoint dipanggil QStash dan dilindungi signature atau secret manual.
9. Balasan WhatsApp masuk ke durable outbox PostgreSQL lalu dikirim worker QStash secara berurutan: teks kemudian attachment.
10. Media inbound `#t` masuk antrean download terpisah sebelum disimpan ke private Storage dan tiket.

Pembagian tanggung jawab:

| Komponen | Tanggung jawab |
|---|---|
| Next.js 14 | Dashboard, API, middleware, webhook, dan job handler |
| Supabase PostgreSQL | Sumber data utama, transaksi, lockout, audit, dan pencarian |
| Supabase Storage | Lampiran private dan signed download URL |
| Upstash QStash | Schedule, retry job, dan failure callback |
| Upstash Redis | Distributed rate limit, session revocation, dan cache pendek |
| SSE | Sinyal perubahan tiket/notifikasi ke browser |
| WhatsApp Gateway kantor | Transport WhatsApp; blocked menunggu akses |

Redis tidak menggantikan PostgreSQL. QStash tidak menjadi database. Keduanya menangani masalah operasional berbeda.

## 3. Alur Sistem

### 3.1 Login

1. User mengirim username dan password ke POST /api/auth/login.
2. Password diverifikasi dengan scrypt. Password plaintext lama dimigrasikan saat login berhasil.
3. Lima kegagalan login mengunci akun 15 menit melalui data PostgreSQL.
4. Server membuat signed HTTP-only session cookie selama delapan jam.
5. API memverifikasi cookie dan memastikan user masih aktif.
6. Middleware membatasi halaman dan API Supervisor.

Redis:

- Rate limit login per IP dan webhook per IP.
- Session revocation per session dan per user sampai session expiry.
- Cache laporan 30 detik dan lock maintenance empat menit.
- Lockout akun durable tetap di PostgreSQL.

### 3.2 Webhook WhatsApp

1. Gateway mengirim raw JSON ke POST /api/webhook/whatsapp.
2. HMAC-SHA256 diverifikasi sebelum parsing JSON.
3. Normalizer mengubah payload menjadi format internal.
4. Tabel webhook_events mencegah pemrosesan provider message ID yang sama.
5. Teks atau caption media yang dimulai #t dapat membuat tiket.
6. Reporter harus terdaftar dan aktif.
7. RPC create_ticket_atomic membuat tiket dan audit dalam satu transaksi.
8. Balasan dimasukkan ke whatsapp_outbox secara idempotent.
9. Worker mengklaim pesan dengan lease lima menit, menjaga urutan teks–attachment, retry hanya item gagal, lalu memberi notifikasi Supervisor setelah gagal permanen.
10. Media inbound diunduh asynchronous berdasarkan `media_id`, divalidasi, lalu disimpan ke tiket.

Pesan biasa tidak membuat tiket baru. Pesan biasa dapat ditambahkan ke tiket OPEN/IN_PROGRESS terakhir. Pada tiket RESOLVED, balasan YA menutup tiket dan BELUM SELESAI mengembalikannya ke IN_PROGRESS.

### 3.3 Siklus tiket

Status valid:

- OPEN ke IN_PROGRESS atau CLOSED.
- IN_PROGRESS ke RESOLVED atau CLOSED.
- RESOLVED ke CLOSED atau kembali ke IN_PROGRESS setelah konfirmasi Reporter.
- CLOSED ke IN_PROGRESS oleh Supervisor.

Supervisor dapat assign/reassign. Reassignment membutuhkan alasan. Staff dapat mengklaim tiket OPEN tanpa assignee. Staff yang ditugaskan dapat resolve dengan catatan 10–2000 karakter. Hanya Supervisor dapat close/reopen melalui dashboard API.

RPC create_ticket_atomic, assign_ticket_atomic, resolve_ticket_atomic, change_ticket_status_atomic, dan claim_ticket_atomic menggabungkan validasi, mutation, dan audit dalam transaksi database.

### 3.4 Maintenance

POST /api/jobs/ticket-maintenance menangani:

- Reminder informasi setelah 15 menit.
- Auto-close 15 menit setelah reminder tanpa respons.
- Reminder assignment setelah 30 menit.
- Reminder tiket stagnan setelah empat jam kerja.
- Auto-close RESOLVED setelah 24 jam.

QStash:

- Schedule maintenance setiap lima menit.
- Schedule outbox setiap menit, tetapi baru diaktifkan setelah API WhatsApp tersedia.
- Verifikasi Upstash-Signature memakai current dan next signing key.
- Retry tiga kali serta failure callback.
- JOB_SECRET hanya fallback local/manual.

### 3.5 Realtime

Browser membuka authenticated SSE /api/v1/events. Server memeriksa versi data tiap tiga detik dan hanya mengirim sinyal perubahan. Browser mengambil data lewat REST API. Saat SSE putus, polling 30 detik aktif.

Supabase Realtime tidak dipakai karena browser tidak memakai Supabase Auth JWT dan RLS melarang akses tabel langsung.

### 3.6 Lampiran

- Upload: POST /api/v1/tickets/[id]/attachments.
- JPG/PNG/GIF maksimal 5 MB.
- PDF/DOC/DOCX maksimal 10 MB.
- API memeriksa akses, MIME, ukuran, dan magic bytes.
- Bucket ticket-attachments bersifat private.
- Download memakai signed URL 60 detik.
- File storage dihapus jika insert metadata gagal.

## 4. Data dan Keamanan

Tabel utama:

- reporters
- users
- tickets
- ticket_history
- ticket_attachments
- notifications
- notification_preferences
- webhook_events
- whatsapp_outbox
- whatsapp_media_inbox
- auth_audit_logs

Migration:

1. 001_initial_schema.sql: enum dan tabel awal.
2. 002_security_and_webhooks.sql: RLS dan idempotensi webhook.
3. 003_atomic_ticket_operations.sql: nomor tiket dan RPC atomik.
4. 004_automation_and_storage.sql: automation markers dan private storage.
5. 005_ticket_search.sql: pencarian dan pagination.
6. 006_claim_ticket.sql: klaim tiket atomik.
7. 007_whatsapp_outbox.sql: durable outbound queue dan atomic claim.
8. 008_auth_audit.sql: audit login, lockout, dan logout.
9. 009_notification_deduplication.sql: idempotency key notifikasi.
10. 010_whatsapp_ordered_media.sql: urutan outbound dan antrean media inbound.
11. 011_reopen_unresolved_ticket.sql: penolakan resolusi oleh Reporter.

Role anon dan authenticated tidak memiliki akses tabel langsung. Browser hanya memakai API aplikasi. Service-role hanya digunakan server-side setelah autentikasi dan RBAC.

ticket_history immutable melalui database trigger. Semua status dan assignment menyimpan actor, waktu, dan metadata.

## 5. Strategi Upstash

### Redis

Penggunaan aktual:

- Distributed rate limit.
- Session revocation.
- Cache laporan atau query read-heavy dengan TTL pendek.

Redis tidak digunakan untuk nomor tiket, status tiket, audit, atau lockout durable. Redis bersifat fail-open: gangguan Redis menurunkan proteksi/cache sementara, tetapi PostgreSQL tetap tersedia.

### QStash

Penggunaan aktual:

- Schedule maintenance.
- Outbound WhatsApp async melalui durable PostgreSQL outbox.
- Retry transient failure.
- Failure callback untuk kegagalan permanen.

Script `npm run qstash:setup`, signature verification, retry policy, worker outbox, dan failure callback tersedia. Eksekusi script pada akun Upstash tetap pekerjaan deployment.

Referensi resmi:

- https://upstash.com/docs/qstash/features/schedules
- https://upstash.com/docs/qstash/howto/signature

## 6. API Aktual

Auth:

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

Tickets:

- GET dan POST /api/v1/tickets
- GET /api/v1/tickets/[id]
- POST assignment, claim, resolve, close, reopen
- POST attachment dan GET attachment download

Management:

- User dan status user
- Reporter dan status reporter
- Staff workload
- Report summary dan CSV
- Notification, read-all, dan preferences

Operations:

- GET /api/v1/events
- GET /api/health
- POST /api/jobs/ticket-maintenance
- POST /api/jobs/whatsapp-outbox
- POST /api/jobs/whatsapp-media-inbox
- POST /api/jobs/qstash-failure
- GET dan POST /api/webhook/whatsapp

## 7. Observability dan Testing

Tersedia:

- Structured JSON server error log.
- Health check PostgreSQL dan Redis.
- Duplicate webhook detection.
- Attachment cleanup.
- 8 Jest suites dan 26 tests untuk keamanan, webhook, laporan, parser, rate limit degraded mode, job secret, dan log redaction.
- TypeScript check dan production build lulus.

Belum terbukti:

- Migration pada Supabase staging.
- QStash dan Redis nyata.
- WhatsApp Gateway kantor.
- Storage end-to-end.
- Race/load test.
- Backup restore, alerting, dan production deployment.

## 8. Keputusan Ditunda

Kontrak payload, outbound endpoint, token, media download, delivery status, retry semantics, dan SLA WhatsApp kantor tidak ditebak. Semua tetap blocked sampai dokumentasi dan akses API resmi diterima. Normalizer WhatsApp menjadi titik adaptasi payload.
