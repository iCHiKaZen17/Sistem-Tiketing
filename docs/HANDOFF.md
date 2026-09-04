# Handoff Maintenance — WhatsApp Ticketing System

Dokumen ini menjelaskan aplikasi dari sudut pandang orang yang baru mulai
maintenance. Fokusnya adalah: **file mana yang perlu dibuka, data bergerak ke
mana, pengaman apa yang tidak boleh dilewati, dan cara mengubah kode dengan
aman**.

## Gambaran singkat aplikasi

Aplikasi ini adalah dashboard ticketing internal berbasis **Next.js 14 App
Router**. Pelapor mengirim laporan melalui WhatsApp, sedangkan Staff dan
Supervisor bekerja melalui dashboard.

Komponen utamanya:

- **Next.js/React**: halaman dashboard dan API.
- **Supabase/PostgreSQL**: sumber data utama untuk user, pelapor, tiket,
  riwayat, notifikasi, lampiran, dan antrean WhatsApp.
- **Upstash Redis**: rate limit, pencabutan sesi, cache laporan, dan lock job.
- **Upstash QStash**: memanggil job maintenance dan pengiriman WhatsApp secara
  terjadwal.
- **Supabase Storage**: menyimpan lampiran di bucket private
  `ticket-attachments`.

Alur status tiket yang berlaku:

```text
OPEN ──assign/claim──> IN_PROGRESS ──resolve──> RESOLVED ──close──> CLOSED
  └────────────────────── close ────────────────────────────────> CLOSED
                          └──────── close ──────────────────────> CLOSED
CLOSED ──reopen oleh Supervisor saja──> IN_PROGRESS
```

> Prinsip paling penting: browser tidak boleh berbicara langsung ke tabel.
> Browser memanggil API Next.js, lalu API yang sudah memeriksa sesi/role memakai
> Supabase service-role. Service-role melewati RLS, jadi cek akses di API adalah
> pengaman wajib.

---

## 1. File Map

### Peta folder dan tanggung jawab

| File/folder terkait | Fungsi singkat | Risiko yang perlu dicek | Cara aman mengubahnya |
|---|---|---|---|
| `app/(auth)/login/page.tsx` | Form login Staff/Supervisor. | Pesan error bisa membocorkan detail login; redirect harus tetap ke area terlindungi. | Ubah tampilan saja di sini. Logika autentikasi tetap di API dan `lib/auth`.
| `app/(dashboard)/**` | Halaman tiket, notifikasi, user, pelapor, workload, dan laporan. | Menyembunyikan tombol di UI **bukan** pengamanan; request masih bisa dibuat manual. | Setiap aksi baru harus tetap mempunyai cek sesi/role di API.
| `app/api/auth/**` | Login, logout, dan membaca user yang sedang aktif. | Cookie, rate limit, lockout, dan revocation dapat rusak jika alurnya dipisah. | Gunakan helper di `lib/auth`; jangan menyimpan token/user di `localStorage` atau header buatan browser.
| `middleware.ts` | Gerbang awal route, redirect login, dan pembatas halaman Supervisor. | Middleware hanya memeriksa tanda tangan/role di cookie, bukan status aktif terbaru dari DB atau revocation Redis. | Anggap middleware sebagai filter awal. Route sensitif tetap memanggil `getAuthenticatedUser()` dan mengecek role.
| `lib/auth/**` | Hash password, token sesi 8 jam, revocation, RBAC, dan validasi user aktif. | Mengubah format token/secret dapat membuat semua sesi logout; fallback Redis memengaruhi revocation. | Ubah sebagai satu alur, grep semua pemanggil, lalu test login, logout, user nonaktif, dan role.
| `app/api/v1/tickets/**` | Endpoint list/detail/create/assign/claim/resolve/close/reopen/lampiran. | Salah cek role dapat membuka semua data karena service-role melewati RLS. | Urutan aman: autentikasi → otorisasi → validasi input → panggil service/RPC → bentuk response.
| `lib/tickets/ticket-service.ts` | Logika domain tiket, transisi status, history, notifikasi, dan outbox WA. | Status machine juga ada di SQL; perubahan satu sisi membuat perilaku tidak sinkron. | Ubah service dan RPC migration bersama-sama. Pertahankan transaksi atomik untuk perubahan tiket + history.
| `lib/whatsapp/**` | Normalisasi payload, verifikasi signature, trigger `#t`, intake, gateway, dan outbox. | Payload provider adalah input tidak tepercaya; retry dapat membuat duplikat/partial success. | Pertahankan raw-body HMAC. Jika format provider berubah, ubah hanya `normalizer.ts` bila memungkinkan.
| `app/api/webhook/whatsapp/route.ts` | Endpoint GET handshake Meta dan POST webhook inbound. | Route publik; signature salah atau normalisasi longgar dapat membuat tiket palsu. | Verifikasi HMAC sebelum `JSON.parse`. Pesan hanya boleh membuat tiket jika diawali `#t`.
| `lib/jobs/**`, `app/api/jobs/**` | Maintenance tiket, worker outbox, dan failure callback QStash. | Route job sengaja publik di middleware; keamanan sepenuhnya bergantung pada signature QStash/`JOB_SECRET`. | Semua job baru wajib memanggil `verifyJobRequest()` sebelum melakukan kerja apa pun.
| `lib/notifications/**`, `app/api/v1/notifications/**` | Membuat, membaca, menampilkan, dan mengatur preferensi notifikasi. | Retry dapat menggandakan notifikasi; payload mentah dapat menghasilkan UI buruk. | Pakai `dedupe_key` untuk event yang dapat diulang dan tambah presenter untuk event type baru.
| `lib/attachments/**`, route `attachments/**` | Validasi file, upload private, record metadata, dan signed download URL. | MIME dapat dipalsukan, file dapat berbahaya, dan service-role dapat membuka seluruh bucket. | Pertahankan size + magic-byte check, cek akses tiket sebelum upload/download, dan bucket harus private.
| `lib/reports/**`, `app/api/v1/reports/**` | Ringkasan dan export CSV berdasarkan rentang tanggal. | Query sampai 365 hari dimuat ke memori aplikasi; formula CSV perlu dicegah. | Pertahankan batas tanggal, escaping CSV, dan cache pendek. Untuk data besar, pindahkan agregasi ke SQL/RPC.
| `lib/cache/**` | Redis client dan rate limit. | Sistem sengaja fail-open saat Redis mati: operasi lanjut tetapi proteksi berkurang. | Jangan jadikan Redis sumber data tiket. Pantau mode degraded dan uji fallback.
| `lib/supabase/server.ts` | Membuat Supabase anon server client dan admin/service-role client. | `createAdminClient()` melewati RLS dan memegang secret paling kuat. | Hanya import dari kode server. Jangan pernah kirim `SUPABASE_SERVICE_ROLE_KEY` ke browser/log.
| `lib/supabase/client.ts`, `lib/supabase/middleware.ts` | Helper Supabase Auth lama/alternatif. Saat ini tidak dipakai oleh middleware utama. | Maintainer dapat keliru mencampur Supabase Auth dengan cookie custom `ticketing-session`. | Jangan aktifkan tanpa keputusan migrasi auth yang jelas dan test end-to-end.
| `supabase/migrations/**` | Skema tabel, RLS/revoke, RPC atomik, search, outbox, audit, dan dedupe. | Urutan atau signature RPC salah dapat memutus production; migration lama tidak boleh diedit setelah diterapkan. | Tambah migration bernomor baru, dry-run di staging, backup, lalu smoke test.
| `scripts/**` | Cek migration, bootstrap Supervisor, dan membuat schedule QStash. | Script menggunakan secret dan dapat menyentuh environment remote. | Jalankan di environment yang dituju dengan secret sementara; hapus bootstrap password setelah selesai.
| `__tests__/**` | Unit/route tests untuk auth, API, WhatsApp, laporan, dan operasi. | Banyak test memakai mock; lulus lokal bukan bukti integrasi remote. | Tambah test terkecil pada alur yang berubah, lalu lakukan smoke test staging untuk layanan eksternal.
| `docs/operations.md`, `docs/external-setup-checklist.md`, `docs/whatsapp-office-integration.md` | Runbook operasional dan setup eksternal. | Dokumen mudah tertinggal dari kode/env. | Setiap perubahan env, provider, job, atau migration harus memperbarui dokumen terkait.

### Data utama di PostgreSQL

| Tabel | Isi | Relasi penting |
|---|---|---|
| `users` | Staff/Supervisor, password hash, status aktif, lockout. | `tickets.assigned_to`, notification, audit.
| `reporters` | Pelapor WhatsApp yang diizinkan. | Satu reporter dapat memiliki banyak tiket.
| `tickets` | Kondisi tiket saat ini. | Mengarah ke reporter dan Staff yang ditugaskan.
| `ticket_history` | Timeline immutable: pesan, status, assignment, resolusi. | Tidak boleh di-update/delete karena ada trigger DB.
| `ticket_attachments` | Metadata file; isi file ada di Storage. | Mengarah ke tiket dan opsional ke history.
| `notifications` | Notifikasi per user. | Dedupe unik per `(user_id, dedupe_key)`.
| `notification_preferences` | Pilihan jenis notifikasi per user. | Satu baris per user.
| `webhook_events` | Klaim/dedupe event inbound provider. | Unik per `(provider, provider_event_id)`.
| `whatsapp_outbox` | Antrean balasan WA yang durable dan dapat retry. | Opsional mengarah ke tiket.
| `auth_audit_logs` | Login berhasil/gagal/locked dan logout. | Retensi operasional, bukan data sesi.

---

## 2. Data Flow

### A. Tiket masuk dari WhatsApp

```text
Gateway/Meta
  → POST /api/webhook/whatsapp
  → verifikasi HMAC atas raw body
  → normalizeWebhook()
  → processInboundMessage()
  → webhook_events (dedupe)
  → cek reporter aktif
  → leading #t? buat tiket : append ke tiket aktif terbaru
  → RPC create_ticket_atomic / ticket_history
  → notifications + whatsapp_outbox
  → worker QStash mengirim balasan WA
```

- **File terkait:** `app/api/webhook/whatsapp/route.ts`,
  `lib/whatsapp/signature.ts`, `normalizer.ts`, `webhook-service.ts`,
  `outbox-service.ts`, `lib/tickets/ticket-service.ts`, migration `002`, `003`,
  dan `007`.
- **Fungsi singkat:** menerima pesan provider, mengubahnya ke bentuk internal,
  menolak pengirim tidak aktif, mencegah duplikat, lalu membuat atau memperbarui
  tiket.
- **Risiko yang perlu dicek:** hanya leading `#t` boleh membuat tiket; pesan
  biasa saat ada beberapa tiket aktif akan masuk ke **tiket aktif terbaru**;
  event dicatat sebelum seluruh proses selesai sehingga kegagalan setelah insert
  dapat membuat retry berikutnya dianggap duplikat; pembuatan tiket dan enqueue
  outbox/notifikasi belum satu transaksi penuh.
- **Cara aman mengubahnya:** simpan kontrak internal
  `InboundWhatsAppMessage`; isolasi variasi provider di `normalizer.ts`; jangan
  parse JSON sebelum HMAC lolos; test `#t`, pesan biasa, duplikat ID, reporter
  nonaktif, kegagalan outbox, dan retry provider.

### B. Tiket dibuat manual dari dashboard

```text
Supervisor → AddTicketModal → POST /api/v1/tickets
  → getAuthenticatedUser + role SUPERVISOR
  → validasi Zod
  → upsert reporter berdasarkan nomor bersih
  → TicketService.createTicket()
  → RPC create_ticket_atomic()
  → history + notifikasi + outbox WA
```

- **File terkait:** `components/tickets/add-ticket-modal.tsx`,
  `app/api/v1/tickets/route.ts`, `lib/utils/validation.ts`,
  `lib/tickets/ticket-service.ts`, migration `003`.
- **Fungsi singkat:** Supervisor dapat membuat tiket untuk pelapor tanpa menunggu
  webhook.
- **Risiko yang perlu dicek:** `upsert` dapat mengubah nama/status reporter yang
  sudah ada; kegagalan setelah RPC dapat meninggalkan tiket yang sebenarnya sudah
  dibuat walau response error.
- **Cara aman mengubahnya:** validasi tetap di server, normalisasi nomor secara
  konsisten, gunakan idempotency bila UI dapat retry otomatis, dan cek DB sebelum
  mengulang request yang mendapat timeout.

### C. Tiket dibaca dan dikerjakan

```text
Dashboard → GET list/detail API → getAuthenticatedUser()
  → search_tickets() / TicketService.getTicketDetail()
  → Supervisor melihat semua
  → Staff melihat tiket unassigned atau miliknya

Assign Supervisor / Claim Staff / Resolve / Close / Reopen
  → cek sesi + role/ownership
  → RPC atomik
  → tickets berubah + ticket_history bertambah
  → notifikasi/outbox bila diperlukan
```

- **File terkait:** `app/(dashboard)/tickets/**`, `app/api/v1/tickets/**`,
  `lib/tickets/ticket-service.ts`, migration `003`, `005`, dan `006`.
- **Fungsi singkat:** menyediakan daftar/detail dan seluruh perubahan lifecycle
  tiket.
- **Risiko yang perlu dicek:** state machine ada di TypeScript dan SQL; Staff
  tidak boleh membaca/resolve tiket Staff lain; race saat dua Staff claim ditahan
  oleh `claim_ticket_atomic`.
- **Cara aman mengubahnya:** pakai RPC untuk mutation yang menyentuh tiket dan
  history; pass `currentUser` ke detail/list; tambahkan aturan akses di server,
  bukan hanya conditional button; test dua request claim bersamaan.

### D. Lampiran

```text
Browser → POST multipart attachment API
  → validasi sesi + akses tiket
  → cek MIME, ukuran, dan magic bytes
  → upload ke private Storage
  → insert ticket_attachments + append history

Download → cek sesi + akses tiket → signed URL 60 detik → redirect
```

- **File terkait:** route `app/api/v1/tickets/[id]/attachments/**`,
  `lib/attachments/attachment-service.ts`, migration `001` dan `004`.
- **Fungsi singkat:** menyimpan file private dan memberikan link sementara hanya
  setelah akses tiket lolos.
- **Risiko yang perlu dicek:** magic-byte check bukan antivirus; upload sukses
  tetapi insert DB gagal harus membersihkan file; bucket public akan membocorkan
  data.
- **Cara aman mengubahnya:** pertahankan compensating delete, jangan mengubah
  bucket menjadi public, batasi MIME/size di kode dan bucket, dan tambahkan malware
  scanning bila kebijakan organisasi mewajibkan.

### E. Notifikasi dan refresh dashboard

```text
TicketService/Job → NotificationService → notifications
Browser → /api/v1/notifications
Browser → EventSource /api/v1/events → polling DB tiap 3 detik
Jika SSE gagal → polling UI tiap 30 detik
```

- **File terkait:** `lib/notifications/**`, route notifications,
  `app/api/v1/events/route.ts`, `lib/frontend/use-ticket-events.ts`, migration
  `009`.
- **Fungsi singkat:** memberi tahu user dan membuat daftar tiket terasa realtime.
- **Risiko yang perlu dicek:** event tanpa dedupe dapat muncul berulang; SSE
  melakukan query berkala per koneksi sehingga biaya DB naik seiring jumlah user.
- **Cara aman mengubahnya:** selalu tentukan apakah event retryable dan butuh
  `dedupe_key`; tambahkan presenter; load-test SSE sebelum menaikkan jumlah user,
  atau pindah ke mekanisme realtime/pub-sub bila skala membutuhkannya.

### F. Job maintenance, laporan, dan cache

```text
QStash/manual caller → verifyJobRequest()
  → maintenance tiap 5 menit / outbox tiap 1 menit bila diaktifkan
  → reminder, auto-close, retry WhatsApp

Supervisor → report API → validasi rentang ≤365 hari
  → cache Redis 30 detik → query PostgreSQL → JSON/CSV
```

- **File terkait:** `app/api/jobs/**`, `lib/jobs/**`,
  `scripts/setup-qstash-schedules.mjs`, `lib/reports/**`, route reports, dan
  `lib/cache/**`.
- **Fungsi singkat:** menjalankan pekerjaan tanpa browser dan membuat laporan
  operasional.
- **Risiko yang perlu dicek:** `JOB_SECRET`/QStash keys salah menghentikan job;
  Redis down menghilangkan distributed lock; jam kerja mengikuti timezone proses
  server dan belum mengenal hari libur; laporan besar dimuat ke memori.
- **Cara aman mengubahnya:** job wajib idempotent, gunakan dedupe marker/RPC,
  uji timezone deployment, pertahankan rentang laporan, dan pantau health serta
  failure callback.

---

## 3. Auth Flow

### Alur login sampai logout

```text
1. Browser POST username/password ke /api/auth/login
2. Rate limit Redis (jika tersedia)
3. AuthService membaca users dan memeriksa active/lockout
4. Password diverifikasi dengan scrypt
   - row plaintext legacy diterima sekali lalu langsung di-hash
5. Login sukses dicatat ke auth_audit_logs
6. Server membuat token HMAC dan cookie HTTP-only ticketing-session
7. middleware.ts menyaring route dan role awal
8. Route sensitif memanggil getAuthenticatedUser()
   - verifikasi token + revocation Redis
   - baca ulang user/role/is_active dari PostgreSQL
9. Logout mencatat audit, revoke jti di Redis, lalu menghapus cookie
```

### Role yang berlaku

| Aksi | Staff | Supervisor |
|---|---:|---:|
| Melihat tiket unassigned | Ya | Ya |
| Melihat tiket milik Staff lain | Tidak | Ya |
| Claim tiket OPEN | Ya | Tidak melalui endpoint claim |
| Assign/reassign Staff | Tidak | Ya |
| Resolve tiket | Hanya tiket sendiri | Ya |
| Close/reopen tiket | Tidak | Ya |
| Kelola user, reporter, workload, laporan | Tidak | Ya |

- **File terkait:** `middleware.ts`, `lib/auth/session-core.ts`, `session.ts`,
  `get-user.ts`, `auth-service.ts`, `password.ts`, `rbac.ts`, `ticket-access.ts`,
  route `app/api/auth/**`, migration `008`.
- **Fungsi singkat:** cookie menyimpan identitas bertanda tangan; Redis dapat
  mencabut sesi lebih cepat; PostgreSQL memastikan akun masih aktif dan role
  masih benar.
- **Risiko yang perlu dicek:** `AUTH_SESSION_SECRET` kurang dari 32 karakter
  membuat sesi gagal; rotasi secret melogout semua user; tanpa Redis, token yang
  sudah dicuri tetap valid sampai maksimal 8 jam; middleware memakai claim cookie
  lama; beberapa route supervisor saat ini belum memanggil
  `getAuthenticatedUser()` sendiri.
- **Cara aman mengubahnya:** jadikan `getAuthenticatedUser()` + cek role sebagai
  pola wajib di setiap API protected; jangan percaya data user dari client;
  lakukan rotasi secret dengan rencana logout; setelah perubahan auth, uji akun
  aktif, nonaktif, role salah, cookie rusak, logout, dan Redis down.

### Route yang perlu perhatian khusus

Route berikut saat ini mengandalkan pembatas role di `middleware.ts`, tetapi
belum melakukan validasi DB terbaru melalui `getAuthenticatedUser()` di dalam
handler:

- `app/api/v1/users/route.ts`
- `app/api/v1/reporters/route.ts`
- `app/api/v1/reporters/[id]/status/route.ts`
- `app/api/v1/reports/summary/route.ts`
- `app/api/v1/reports/export/route.ts`

Ini berarti akun Supervisor yang baru dinonaktifkan/berubah role dapat tetap
mengakses route tersebut menggunakan cookie lama sampai sesi berakhir apabila
middleware masih menerima tandatangannya. Saat maintenance auth berikutnya,
prioritaskan penambahan validasi route-level tanpa menghapus middleware.

---

## 4. Risk Map

| Level | File terkait | Risiko yang perlu dicek | Cara aman mengubahnya |
|---|---|---|---|
| **Kritis** | `lib/supabase/server.ts`, seluruh `app/api/**` | Service-role melewati RLS. Satu route tanpa auth/RBAC dapat membaca atau mengubah seluruh data. | Semua route protected wajib autentikasi dan otorisasi sebelum membuat admin client/query.
| **Tinggi** | Lima route yang disebut di Auth Flow, `middleware.ts` | Route supervisor bergantung pada role lama di cookie dan tidak selalu cek user aktif terbaru. | Tambahkan `getAuthenticatedUser(request)` dan `role === 'SUPERVISOR'` di handler; test user dinonaktifkan.
| **Tinggi** | `webhook-service.ts`, tabel `webhook_events` | Event diklaim sebelum proses selesai. Jika proses gagal, retry provider dapat dianggap duplikat dan pesan hilang. | Rancang status event (`PROCESSING/PROCESSED/FAILED`) atau transaksi/retry-safe flow sebelum mengubah behavior produksi.
| **Tinggi** | `TicketService.createTicket()`, outbox/notifikasi | RPC tiket commit lebih dulu; kegagalan enqueue dapat mengembalikan error walau tiket sudah ada. | Gunakan outbox dalam transaksi DB yang sama atau buat langkah setelah commit benar-benar idempotent.
| **Tinggi** | `session*.ts`, Redis env | Redis outage membuat revocation dan rate limit fail-open. Stolen cookie tidak dapat dicabut cepat. | Monitor Redis, gunakan TTL sesi pendek sesuai risiko, dan jangan menyatakan mode degraded sebagai fully healthy.
| **Tinggi** | migration `003`, `005`, `006`; `ticket-service.ts` | Perubahan status/search/access tersebar antara TypeScript dan SQL SECURITY DEFINER. | Tambah migration baru, revoke PUBLIC, grant hanya service_role, dan sinkronkan test/service.
| **Tinggi** | attachment route, Storage bucket | File sensitif bocor jika bucket public; file valid-format masih dapat berisi malware. | Pastikan bucket private, signed URL pendek, cek akses tiket, dan gunakan scanning sesuai kebijakan.
| **Sedang** | `webhook-service.ts` | Pesan tanpa `#t` ditempelkan ke tiket aktif terbaru; ambigu jika satu reporter punya beberapa tiket aktif. | Jangan ubah diam-diam. Jika perlu routing eksplisit, buat format nomor tiket dan test kompatibilitas.
| **Sedang** | `app/api/v1/events/route.ts` | Satu koneksi melakukan dua query setiap 3 detik; scaling dapat membebani DB/serverless. | Ukur concurrency/query rate. Naikkan interval atau pakai pub-sub/realtime saat metrik membuktikan perlu.
| **Sedang** | `working-hours.ts`, maintenance job | Timezone mengikuti runtime, tidak eksplisit Asia/Jakarta, dan hari libur belum dihitung. | Tetapkan timezone bisnis secara eksplisit dan tambah kalender libur hanya jika SLA membutuhkannya.
| **Sedang** | reports route/service | Query 365 hari diolah di memori; data besar dapat lambat atau timeout. | Pertahankan range limit; pindahkan agregasi/export streaming ke DB saat volume meningkat.
| **Sedang** | migrations `001`–`009` | Mengedit migration lama menyebabkan staging/production berbeda; `storage.objects` dikelola Supabase. | Migration append-only. Jangan alter policy/grant managed `storage.objects`; backup dan dry-run.
| **Sedang** | `rate-limit.ts`, webhook/login | Rate limit berdasarkan forwarded IP dan fail-open; konfigurasi proxy salah dapat membagi IP palsu/sama. | Pastikan platform menulis `x-forwarded-for` tepercaya dan tambahkan observability saat degraded.
| **Rendah** | `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `authHeaders()` | Kode sisa/alternatif dapat menyesatkan maintainer dan menghidupkan lagi auth client yang spoofable. | Dokumentasikan sebagai tidak aktif; hapus hanya setelah grep dan test membuktikan tidak dipakai.
| **Operasional** | Supabase, Redis, QStash, gateway WA, Vercel env | Test lokal memakai mock dan tidak membuktikan migration, webhook, job, storage, atau outbound production. | Gunakan checklist staging/remote dan pisahkan status “lulus lokal” dari “terverifikasi produksi”.

### Secret dan environment yang harus dijaga

| Kelompok | Variable utama | Catatan aman |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Hanya dua variable `NEXT_PUBLIC_*` boleh masuk bundle browser. Service-role wajib server-only.
| Session/job | `AUTH_SESSION_SECRET`, `JOB_SECRET` | Session secret minimal 32 karakter. Rotasi memutus sesi. Job secret adalah fallback pemanggilan manual.
| Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Kehilangan Redis menurunkan proteksi tetapi tidak menghapus tiket.
| QStash | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `APP_BASE_URL` | Signing keys memverifikasi request; token dipakai saat membuat schedule.
| WhatsApp | `WHATSAPP_WEBHOOK_PROVIDER`, `WHATSAPP_OFFICE_*`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | Jangan menebak kontrak/token provider. Aktifkan outbox schedule hanya setelah outbound siap.
| Bootstrap | `BOOTSTRAP_SUPERVISOR_*` | Password hanya sementara dan harus dihapus dari environment setelah script selesai.

---

## 5. Change Guide

### Pola aman untuk perubahan umum

| Perubahan | File terkait | Fungsi singkat | Risiko yang perlu dicek | Cara aman mengubahnya |
|---|---|---|---|---|
| Tambah field tiket | migration baru, `lib/types/ticket.ts`, service/API, UI, test | Membawa field dari DB sampai tampilan. | Field null pada data lama, query/select, export, dan webhook tidak sinkron. | Tambah nullable/default lewat migration baru; update type dan pembaca; backfill terpisah bila perlu; test data lama.
| Ubah status/lifecycle | `ticket-service.ts`, migration RPC baru, route aksi, UI badge/button, tests | Mengubah state machine bisnis. | TypeScript dan DB berbeda; history/timestamp/notifikasi terlewat. | Definisikan transisi, role, timestamp, dan history dulu; implementasikan atomik di SQL; sinkronkan service/UI/test.
| Tambah endpoint API | `app/api/.../route.ts`, validation, service, test | Membuka operasi baru untuk browser/integrasi. | Service-role tanpa auth, IDOR, input tak tervalidasi, status error salah. | Ikuti urutan auth → role/ownership → Zod → service/RPC → response; tambahkan unauthorized/forbidden test.
| Ubah payload WA kantor | `normalizer.ts`, types, webhook tests, docs integrasi | Mengadaptasi format eksternal ke kontrak internal. | Perubahan bocor ke domain dan merusak Meta/office; signature dihitung dari body yang sudah berubah. | Ubah adapter saja; HMAC tetap memakai raw body; simpan fixture payload nyata yang sudah disanitasi.
| Ubah trigger tiket WA | `webhook-service.ts`, tests, docs | Menentukan pesan mana yang membuat tiket. | Pesan biasa dapat membuat spam tiket atau perilaku lama rusak. | Pertahankan leading `#t` kecuali ada keputusan bisnis eksplisit; test case positif/negatif dan follow-up.
| Tambah notification type | `notification-service.ts`, `presentation.ts`, types/UI, migration bila perlu, test | Membuat dan menampilkan event baru. | Duplicate, preferensi tidak diterapkan, payload tampil mentah. | Tentukan target, dedupe key, preferensi, judul/pesan/link, lalu test presenter dan retry.
| Ubah auth/role | `middleware.ts`, `lib/auth/**`, semua route terkait, auth tests | Mengubah siapa yang dapat masuk dan melakukan aksi. | Stale cookie, session revocation, privilege escalation, semua user logout. | Jangan percaya client; cek DB di route; grep semua caller; uji seluruh role matrix dan Redis down.
| Tambah jenis lampiran | attachment service/route, migration bucket config baru, UI accept, tests | Mengizinkan format file baru. | MIME spoof, parser exploit, ukuran bucket/kode berbeda. | Tambah MIME + magic signature + limit di dua lapis; evaluasi malware scan; jangan jadikan bucket public.
| Tambah job terjadwal | route job, `verify-job-request.ts`, service job, setup script, operations docs, tests | Menjalankan proses background. | Endpoint publik tanpa signature, double-run, partial failure. | Verify request di baris awal; buat idempotent/dedupe; gunakan lock bila perlu; pasang retry/failure callback.
| Ubah laporan/export | report service/date range/route/UI/tests | Mengolah data operasional. | Timezone, formula injection CSV, query besar, cache stale. | Pertahankan escaping dan batas range; update cache key; test tanggal boundary dan nilai `= + - @`.
| Ubah skema DB | migration bernomor berikutnya, script check, docs operasi | Menjaga semua environment pada skema sama. | Migration non-reversible atau remote drift. | Backup/PITR; apply di staging; cek RPC/grant/RLS; smoke test; baru produksi. Jangan edit migration lama.

### Checklist sebelum mulai coding

1. Cari semua pemanggil fungsi/route yang akan diubah dengan `rtk rg`.
2. Baca route, service, type, SQL RPC, dan test yang berada dalam satu alur.
3. Tentukan trust boundary: input browser, webhook, job, atau database.
4. Pastikan perubahan sekecil mungkin tetapi tidak memotong auth, validation,
   transaksi, audit history, atau error handling.
5. Jika menyentuh remote data/secrets, siapkan backup dan staging; jangan
   menjalankan production migration hanya karena build lokal lulus.

### Checklist verifikasi lokal

Jalankan dari root repo:

```powershell
rtk npm run migrations:check
rtk npm test
rtk npx tsc --noEmit
rtk npm run lint
rtk npm run build
```

Pilih verifikasi yang sebanding dengan perubahan, tetapi untuk auth, migration,
webhook, atau state machine sebaiknya jalankan semuanya.

### Checklist smoke test staging

1. Login sebagai Staff dan Supervisor; coba akses role yang salah.
2. Nonaktifkan satu user dan pastikan session/route benar-benar ditolak.
3. Kirim pesan biasa, leading `#t`, duplicate message ID, follow-up, dan `YA`.
4. Buat, claim/assign, resolve, close, dan reopen tiket.
5. Upload/download lampiran dan pastikan URL kedaluwarsa/bucket tetap private.
6. Jalankan maintenance/outbox dua kali untuk menguji idempotency.
7. Putuskan Redis sementara dan pastikan status degraded terlihat.
8. Export CSV, cek timezone dan nilai yang dimulai `=`, `+`, `-`, atau `@`.
9. Periksa log tanpa password/token/nomor telepon utuh.

### Definition of done

Perubahan baru dianggap selesai hanya jika:

- test/typecheck/lint/build yang relevan lulus;
- migration baru sudah diuji berurutan di staging bila ada;
- auth dan role diuji dari server, bukan hanya tampilan;
- docs/env/checklist diperbarui;
- status remote disebut jelas: **belum diverifikasi**, **terverifikasi staging**,
  atau **terverifikasi production**.

