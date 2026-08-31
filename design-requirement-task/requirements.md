# Requirements Document: Internal Ticketing System

## 1. Tujuan

Sistem memungkinkan karyawan melaporkan kendala melalui WhatsApp Gateway kantor menggunakan trigger #t. Staff dan Supervisor menangani tiket melalui dashboard internal. Integrasi gateway nyata masih blocked sampai akses API kantor tersedia.

## 2. Peran dan Istilah

- Reporter: karyawan yang nomor WhatsApp-nya terdaftar.
- Staff: petugas support yang menangani tiket.
- Supervisor: pengawas yang mengelola assignment, user, reporter, dan laporan.
- OPEN: tiket baru.
- IN_PROGRESS: tiket sedang ditangani.
- RESOLVED: solusi diberikan, menunggu konfirmasi.
- CLOSED: tiket selesai atau ditutup.
- Implemented: kode tersedia dan lolos test/build lokal.
- Partial: sebagian acceptance criteria tersedia.
- Planned: belum diimplementasikan.
- Blocked External: membutuhkan API atau kredensial kantor.

## 3. Functional Requirements

### Requirement 1: Pembuatan tiket WhatsApp

Status: Partial / Blocked External

1. Hanya pesan teks yang setelah whitespace dimulai #t yang boleh membuat tiket.
2. Pesan biasa tidak boleh otomatis membuat tiket baru.
3. Nomor Reporter harus terdaftar dan aktif.
4. Tiket baru berstatus OPEN dan memakai nomor TKT-YYYYMMDD-NNNN yang unik.
5. Provider message ID yang sama tidak boleh diproses dua kali.
6. Trigger tanpa deskripsi harus ditolak dengan panduan format.
7. Reporter tidak terdaftar harus menerima balasan penolakan.
8. Tiket berhasil harus menerima balasan nomor tiket.
9. Signature webhook harus diverifikasi dari raw request body sebelum parsing.
10. Adapter harus mendukung payload gateway kantor tanpa mengubah Ticket Service.

Implemented: parser #t, HMAC, normalizer, reporter validation, idempotency, pembuatan atomik, response balasan.

Blocked External: inbound nyata, outbound delivery, kredensial, payload final, delivery status, dan SLA gateway.

### Requirement 2: Percakapan dan informasi terstruktur

Status: Partial / Blocked External

1. Pesan biasa dari Reporter dengan tiket OPEN atau IN_PROGRESS aktif harus masuk ke riwayat tiket tersebut.
2. Pesan tersebut tidak boleh membuat tiket baru.
3. Sistem harus meminta nama aplikasi, deskripsi, dan langkah reproduksi.
4. Reminder kelengkapan dikirim setelah 15 menit.
5. Tiket dapat ditutup 15 menit setelah reminder tanpa respons.
6. Balasan YA case-insensitive pada tiket RESOLVED harus menutup tiket.
7. Pesan dan balasan bot harus tersimpan kronologis.

Implemented: append follow-up, YA close, automation handler, chronological history.

Partial: parsing tiga field terstruktur belum tersedia.

Blocked External: pengiriman panduan/reminder nyata melalui API kantor.

### Requirement 3: Antrian tiket

Status: Implemented

1. Daftar harus memuat nomor tiket, Reporter, aplikasi, ringkasan error, status, waktu, dan assignee.
2. Filter tersedia untuk status, aplikasi, assignee, dan rentang tanggal.
3. Pencarian minimal tiga karakter mencakup tiket, Reporter, aplikasi, deskripsi, dan Staff.
4. Pagination dan total hasil dihitung database-side.
5. Staff hanya melihat tiket sendiri atau tiket tanpa assignee.
6. SSE memberi sinyal perubahan maksimal sekitar tiga detik.
7. Polling 30 detik aktif saat SSE putus.
8. Empty state tampil bila tidak ada hasil.

### Requirement 4: Assignment dan klaim

Status: Implemented

1. Hanya Supervisor dapat assign/reassign.
2. Target harus Staff aktif.
3. Assignment OPEN mengubah status menjadi IN_PROGRESS.
4. Reassignment mempertahankan IN_PROGRESS dan mewajibkan alasan maksimal 500 karakter.
5. Staff dapat mengklaim tiket OPEN tanpa assignee secara atomik.
6. Race claim harus menghasilkan hanya satu pemenang.
7. Assignment dan perubahan status harus tercatat pada audit history.
8. Staff penerima mendapat notifikasi dashboard sesuai preferensi.
9. Notifikasi assignment kepada Reporter melalui WhatsApp berstatus Blocked External.

### Requirement 5: Resolusi dan penutupan

Status: Implemented / Blocked External

1. Hanya Staff yang ditugaskan atau Supervisor boleh resolve tiket IN_PROGRESS.
2. Catatan resolusi wajib 10–2000 karakter.
3. Resolve mengubah status, menyimpan catatan, deadline, dan audit dalam satu transaksi.
4. Reporter dapat menutup tiket RESOLVED dengan YA.
5. Tiket RESOLVED tanpa konfirmasi ditutup otomatis setelah 24 jam.
6. Hanya Supervisor dapat close atau reopen melalui dashboard API.
7. Reopen mengubah CLOSED menjadi IN_PROGRESS.
8. Pengiriman ringkasan resolusi ke WhatsApp berstatus Blocked External.

### Requirement 6: Audit trail

Status: Implemented

1. History menyimpan pesan Reporter, bot/system event, status, assignment, dan resolusi.
2. Status dan assignment menyimpan actor, timestamp, previous/new value, dan alasan bila ada.
3. History ditampilkan kronologis.
4. Record history tidak dapat di-update atau dihapus.
5. Data history dipertahankan minimal 365 hari.

Catatan: retention policy produksi masih perlu dikonfigurasi dan diuji.

### Requirement 7: Autentikasi dan otorisasi

Status: Implemented / Planned

1. Password baru disimpan menggunakan scrypt.
2. Signed session disimpan sebagai HTTP-only, SameSite cookie.
3. Session berlaku maksimal delapan jam.
4. API memeriksa signature, expiry, user aktif, dan role database.
5. Lima kegagalan login mengunci akun 15 menit.
6. Endpoint Supervisor harus menolak Staff dengan 403.
7. Staff tidak boleh membaca atau mengubah tiket milik Staff lain.
8. Direct table access dari browser harus ditolak RLS.
9. Redis rate limiting dan session revocation harus fail-open saat Redis terganggu. Implemented.
10. Supervisor dapat reset password user; reset dan deaktivasi merevoke seluruh session user. Implemented.
11. Login sukses, gagal, lockout, dan logout dicatat pada audit server-side. Implemented.

### Requirement 8: Notifikasi

Status: Implemented / Partial

1. Notifikasi disimpan untuk user target dan tetap tersedia setelah user offline.
2. Preferensi empat jenis notifikasi harus dihormati.
3. User hanya dapat membaca dan mengubah notifikasinya sendiri.
4. Badge diperbarui melalui SSE.
5. Read-all tersedia.
6. Reminder assignment 30 menit dan stagnan empat jam kerja diproses maintenance handler.
7. Mark-one-read tersedia dan hanya boleh mengubah notifikasi milik user aktif.

### Requirement 9: Laporan

Status: Implemented

1. Rentang laporan maksimal 365 hari dan mencakup seluruh hari akhir.
2. Summary memuat total, status, aplikasi, Staff, first response, resolution time, dan top-10 aplikasi.
3. Periode tanpa data menampilkan empty state.
4. CSV dapat diunduh.
5. CSV harus escape quote dan mencegah formula injection.
6. Hanya Supervisor dapat mengakses laporan.
7. Redis cache laporan memakai TTL 30 detik dan bersifat optional/fail-open.

### Requirement 10: Reporter management

Status: Implemented

1. Supervisor dapat melihat Reporter.
2. Supervisor dapat mencari berdasarkan nama atau telepon.
3. Supervisor dapat menambah/upsert Reporter.
4. Nomor telepon dinormalisasi menjadi digit.
5. Supervisor dapat mengaktifkan atau menonaktifkan Reporter.
6. Reporter nonaktif tidak dapat membuat tiket WhatsApp.

### Requirement 11: Lampiran

Status: Implemented / Blocked External

1. JPG, PNG, GIF maksimal 5 MB.
2. PDF, DOC, DOCX maksimal 10 MB.
3. API memeriksa MIME, ukuran, dan file signature.
4. Storage bucket harus private.
5. Download memakai signed URL 60 detik setelah access check.
6. Metadata dan audit tersimpan pada tiket.
7. File storage dibersihkan jika metadata gagal.
8. Download media WhatsApp berstatus Blocked External.
9. Antivirus scanning berstatus Planned untuk produksi.

### Requirement 12: Operasional, Redis, dan QStash

Status: Implemented in Code / External Setup Required

1. Health endpoint harus melaporkan PostgreSQL dan Redis tanpa membocorkan secret.
2. Error server harus menggunakan structured log.
3. QStash harus memanggil maintenance setiap lima menit.
4. QStash callback produksi harus memverifikasi Upstash-Signature.
5. QStash harus retry transient failure dan memakai failure callback.
6. Redis harus dipakai untuk distributed rate limit.
7. Redis harus menyimpan revocation session sampai expiry.
8. Redis dapat menyimpan cache laporan dengan TTL pendek; PostgreSQL tetap sumber kebenaran.
9. Outbound WhatsApp harus memakai durable outbox dan retry setelah API tersedia.
10. Backup, alerting, load test, dan restore drill wajib sebelum produksi.

Implemented: health endpoint, structured logging, request ID, QStash signature verification, setup schedule, failure callback, Redis rate limit/revocation/cache/lock, dan durable WhatsApp outbox.

External Setup Required: resource dan secret Upstash, penerapan migration Supabase, deployment staging, alerting, backup, restore drill, serta API WhatsApp kantor.

## 4. Non-Functional Requirements

### Security

- Secret hanya tersedia server-side.
- Webhook signature dibandingkan secara timing-safe.
- Session dan password tidak disimpan pada localStorage.
- Service-role tidak pernah dikirim ke browser.
- Attachment tidak public.

### Reliability

- Mutation bisnis penting bersifat atomik.
- Webhook bersifat idempotent.
- Scheduler action harus aman bila dipanggil berulang.
- Kegagalan layanan eksternal tidak boleh menghilangkan outbound message.

### Performance

- Pagination default 20 dan maksimal 100.
- Search dilakukan database-side.
- Realtime signal sekitar tiga detik.
- Report maksimal 365 hari.

## 5. Status Validasi

Tersedia:

- 8 Jest suites dan 26 tests lulus.
- Pemeriksaan statis migration lulus.
- TypeScript check lulus.
- Next.js production build lulus.

Belum tersedia:

- Supabase staging migration test.
- Redis dan QStash end-to-end.
- WhatsApp kantor end-to-end.
- Attachment storage end-to-end.
- Concurrency, load, backup, dan deployment test.
