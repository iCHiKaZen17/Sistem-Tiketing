# Implementation Progress: Internal Ticketing System

## Status Legend

- [x] Kode tersedia dan sudah diverifikasi lokal.
- [ ] Belum selesai atau belum diverifikasi pada layanan nyata.
- BLOCKED EXTERNAL: membutuhkan akses, kredensial, atau dokumentasi API WhatsApp kantor.
- Migration prepared berarti file SQL tersedia; bukan berarti sudah diterapkan ke database.

Baseline terakhir: 8 Jest suites, 26 tests, pemeriksaan migration, TypeScript check, dan production build lulus.

## 1. Fondasi dan Database

- [x] Setup Next.js 14, React, TypeScript, Tailwind, Jest, dan Zod.
- [x] Buat schema awal PostgreSQL.
- [x] Tambahkan RLS dan revoke direct browser access.
- [x] Tambahkan immutable ticket history trigger.
- [x] Tambahkan webhook event idempotency.
- [x] Tambahkan atomic ticket mutation RPC.
- [x] Pindahkan nomor tiket atomik ke PostgreSQL.
- [x] Tambahkan automation marker dan private storage bucket migration.
- [x] Tambahkan search/pagination RPC.
- [x] Tambahkan atomic Staff claim RPC.
- [x] Siapkan migration 007 durable WhatsApp outbox.
- [x] Siapkan migration 008 untuk audit autentikasi.
- [x] Siapkan migration 009 untuk deduplikasi notifikasi.
- [ ] Terapkan migration 001–009 ke Supabase staging.
- [ ] Jalankan migration smoke test dan rollback rehearsal.
- [x] Sediakan script bootstrap Supervisor pertama.
- [ ] Jalankan dan validasi bootstrap Supervisor pada staging.

## 2. Autentikasi dan RBAC

- [x] Implementasikan scrypt password hashing.
- [x] Migrasikan legacy plaintext password saat login berhasil.
- [x] Implementasikan signed HTTP-only session cookie.
- [x] Implementasikan /api/auth/login, logout, dan me.
- [x] Validasi user aktif dan role database pada API.
- [x] Implementasikan lockout lima kegagalan selama 15 menit di PostgreSQL.
- [x] Lindungi route Supervisor melalui middleware.
- [x] Hapus kepercayaan terhadap localStorage dan x-user-data.
- [x] Batasi close/reopen ke Supervisor.
- [x] Batasi resolve ke Staff yang ditugaskan atau Supervisor.
- [x] Tambahkan Redis distributed rate limit login.
- [x] Tambahkan session ID/JTI dan Redis session revocation.
- [x] Tambahkan UI reset password dan revoke seluruh session user.
- [x] Tambahkan audit login sukses, gagal, lockout, dan logout.

## 3. Ticket Service

- [x] Buat tiket manual oleh Supervisor.
- [x] Buat tiket dan initial history secara atomik.
- [x] Assignment/reassignment atomik.
- [x] Resolve dan resolution note atomik.
- [x] Close/reopen atomik.
- [x] Staff claim atomik.
- [x] Validasi state machine.
- [x] Catat audit status dan assignment.
- [x] Batasi daftar/detail tiket berdasarkan role.
- [x] Implementasikan filter, search, dan pagination database-side.
- [x] Tambahkan notifikasi tiket baru, assignment, dan pesan baru.
- [ ] Tambahkan concurrency integration test terhadap PostgreSQL asli.
- [x] Tambahkan notification deduplication untuk retry mutation.

## 4. Reporter dan WhatsApp Adapter

- [x] Implementasikan Reporter list, search, upsert, dan status.
- [x] Implementasikan provider-agnostic inbound message type.
- [x] Implementasikan normalizer payload kantor generik.
- [x] Implementasikan optional Meta payload normalizer.
- [x] Verifikasi HMAC-SHA256 dari raw body.
- [x] Implementasikan optional Meta GET verification handshake.
- [x] Implementasikan trigger #t di awal pesan.
- [x] Abaikan pesan biasa sebagai pembuat tiket baru.
- [x] Tambahkan follow-up message ke tiket aktif.
- [x] Implementasikan YA untuk close tiket RESOLVED.
- [x] Implementasikan webhook idempotency.
- [x] Sediakan optional outbound HTTP adapter.
- [ ] BLOCKED EXTERNAL: dapatkan dokumentasi dan kredensial WhatsApp Gateway kantor.
- [ ] BLOCKED EXTERNAL: finalisasi inbound payload mapping.
- [ ] BLOCKED EXTERNAL: finalisasi outbound endpoint dan authentication.
- [ ] BLOCKED EXTERNAL: implementasikan media download.
- [ ] BLOCKED EXTERNAL: proses sent/delivered/read/failed status.
- [ ] BLOCKED EXTERNAL: uji webhook dan outbound end-to-end.
- [ ] BLOCKED EXTERNAL: verifikasi SLA, retry, dan timeout gateway.

## 5. Informasi Terstruktur dan Bot

- [x] Simpan follow-up Reporter secara kronologis.
- [x] Deteksi tiket aktif terakhir.
- [x] Sediakan pesan konfirmasi tiket pada webhook response.
- [x] Sediakan pesan nomor tidak terdaftar dan trigger kosong.
- [x] Implementasikan maintenance reminder logic.
- [x] Parse format eksplisit Aplikasi, Deskripsi, dan Langkah dari pesan Reporter.
- [x] Simpan bot outbound message pada ticket history setelah delivery accepted.
- [x] Buat durable WhatsApp outbox table dan worker.
- [ ] BLOCKED EXTERNAL: kirim guidance, assignment, resolution, reminder, dan error message nyata.
- [ ] BLOCKED EXTERNAL: validasi template/format pesan kantor.

## 6. Scheduler dan Upstash QStash

- [x] Implementasikan /api/jobs/ticket-maintenance.
- [x] Implementasikan reminder kelengkapan 15 menit.
- [x] Implementasikan close 15 menit setelah reminder.
- [x] Implementasikan assignment reminder 30 menit.
- [x] Implementasikan stale reminder empat jam kerja.
- [x] Implementasikan RESOLVED auto-close 24 jam.
- [x] Lindungi manual invocation dengan JOB_SECRET.
- [x] Sediakan setup QStash schedule maintenance setiap lima menit dan outbox setiap menit.
- [x] Verifikasi callback memakai Upstash-Signature.
- [x] Dukung current dan next signing key melalui environment.
- [x] Konfigurasikan retry policy dan failure callback di setup script.
- [x] Tambahkan Redis concurrency guard untuk maintenance run paralel.
- [x] Tambahkan notifikasi Supervisor jika delivery QStash gagal permanen.
- [ ] Jalankan setup schedule pada akun QStash.
- [ ] Uji QStash end-to-end pada deployment staging.

## 7. Upstash Redis

- [x] Dependency dan server client tersedia.
- [x] Redis ditampilkan sebagai dependency health check.
- [x] Implementasikan distributed rate limit untuk login.
- [x] Implementasikan rate limit webhook WhatsApp.
- [x] Implementasikan session revocation key dengan TTL sampai expiry.
- [x] Implementasikan report cache dengan TTL 30 detik.
- [x] Hapus utilitas Redis ticket sequence lama.
- [x] Hapus fallback mock Redis dari runtime produksi.
- [x] Tambahkan unit test degraded mode ketika Redis tidak tersedia.
- [ ] Uji Redis nyata dan outage pada staging.

Catatan: nomor tiket dan account lockout tidak dipindahkan kembali ke Redis. PostgreSQL tetap sumber kebenaran.

## 8. Realtime dan Notifikasi

- [x] Implementasikan authenticated SSE event stream.
- [x] Refresh tiket/notifikasi saat versi berubah.
- [x] Implementasikan polling fallback 30 detik.
- [x] Tampilkan banner realtime disconnected.
- [x] Simpan notifikasi durable di PostgreSQL.
- [x] Implementasikan notification preferences.
- [x] Implementasikan read-all.
- [x] Pastikan user hanya mengakses notifikasinya sendiri.
- [x] Implementasikan mark-one-read.
- [ ] Tambahkan SSE connection/load test.
- [x] Tambahkan structured log connection count dan stream error SSE.

## 9. Lampiran

- [x] Validasi format dan ukuran.
- [x] Validasi magic bytes.
- [x] Upload ke private Supabase Storage.
- [x] Simpan metadata dan audit.
- [x] Cleanup storage jika metadata gagal.
- [x] Download melalui signed URL 60 detik.
- [x] Tambahkan UI upload dan daftar lampiran.
- [ ] Terapkan dan verifikasi bucket migration pada staging.
- [ ] Tambahkan antivirus scanning sebelum produksi.
- [ ] Tambahkan attachment integration test.
- [ ] BLOCKED EXTERNAL: download dan simpan media WhatsApp.

## 10. Reporting dan Dashboard

- [x] Ticket list, detail, filter, search, date range, dan pagination.
- [x] Manual ticket modal.
- [x] Assignment, resolve, close, reopen, dan claim UI.
- [x] User management.
- [x] Reporter management.
- [x] Staff workload.
- [x] Notification panel dan preferences.
- [x] Report summary, top applications, dan CSV.
- [x] Validasi rentang maksimal 365 hari.
- [x] Cegah CSV formula injection.
- [x] Tambahkan Redis cache laporan dengan TTL pendek dan fallback PostgreSQL.
- [x] Lengkapi breakdown laporan per status dan Staff pada UI.
- [ ] Tambahkan mobile/responsive acceptance test.
- [ ] Tambahkan accessibility audit.

## 11. Observability dan Operasional

- [x] Implementasikan structured server error log.
- [x] Implementasikan /api/health.
- [x] Dokumentasikan konfigurasi dan scheduler.
- [ ] Hubungkan error tracking dan alerting production.
- [x] Tambahkan request/correlation ID pada middleware.
- [ ] Tambahkan dashboard maintenance/webhook/outbound failure.
- [x] Implementasikan redaction log dan dokumentasikan target retensi.
- [ ] Terapkan retensi log pada platform deployment.
- [ ] Konfigurasikan database backup dan point-in-time recovery.
- [ ] Jalankan restore drill.
- [ ] Rotasi AUTH_SESSION_SECRET, JOB_SECRET, Supabase key, Redis token, dan QStash keys.

## 12. Testing dan Deployment

- [x] Unit test utility, auth helpers, attachment validation, report range, webhook trigger, HMAC, password, session, operational fallback, parser, dan log redaction.
- [x] Seluruh 26 test lulus pada baseline terakhir.
- [x] TypeScript check lulus.
- [x] Production build lulus.
- [ ] Tambahkan API integration test dengan Supabase staging/local.
- [ ] Tambahkan full ticket lifecycle E2E.
- [ ] Tambahkan RBAC negative-path E2E.
- [x] Tambahkan pemeriksaan statis urutan dan isi migration.
- [ ] Jalankan migration verification terhadap PostgreSQL staging.
- [ ] Tambahkan Redis rate-limit/revocation integration test.
- [ ] Tambahkan QStash schedule/signature integration test.
- [ ] BLOCKED EXTERNAL: tambahkan WhatsApp Gateway E2E.
- [ ] Jalankan load test webhook, SSE, search, report, dan attachment.
- [ ] Deploy staging.
- [ ] Lakukan User Acceptance Test bersama Staff dan Supervisor.
- [ ] Deploy production setelah semua mandatory check selesai.

## 13. Urutan Pekerjaan yang Dapat Dilakukan Tanpa API WhatsApp

1. Terapkan migration 001–009 ke staging dan verifikasi.
2. Buat resource Redis/QStash, pasang secret, dan jalankan setup schedule.
3. Jalankan integration/E2E test pada staging.
4. Tambahkan monitoring, backup, dan restore drill.
5. Lengkapi accessibility dan operational UI.

Pekerjaan WhatsApp tetap BLOCKED EXTERNAL sampai akses resmi tersedia.
