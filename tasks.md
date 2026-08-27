# Implementation Plan: WhatsApp Ticketing System

## Overview

Implementasi dilakukan secara incremental — mulai dari fondasi database dan infrastruktur,
lalu core processing (webhook, message processor, ticket service), kemudian lapisan bot
responder dan notifikasi, kemudian API Routes, dan terakhir dashboard frontend. Setiap
kelompok task berakhir dengan checkpoint untuk memastikan semua tes berjalan sebelum
melanjutkan ke kelompok berikutnya.

Stack: Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL + Auth + Realtime + Storage),
Upstash QStash, Upstash Redis, Meta Cloud API, TailwindCSS, Vercel, Jest + fast-check.

---

## Tasks

- [x] 1. Project setup dan konfigurasi infrastruktur
  - [x] 1.1 Inisialisasi project Next.js 14 (App Router) dengan TypeScript dan TailwindCSS
    - Jalankan `create-next-app` dengan flag `--typescript --tailwind --app --src-dir`
    - Tambahkan dependencies: `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`,
      `@upstash/qstash`, `@upstash/redis`, `date-fns`, `zod`
    - Tambahkan dev dependencies: `jest`, `@types/jest`, `ts-jest`, `fast-check`, `nock`
    - Konfigurasikan `jest.config.ts` dengan `ts-jest`, environment `node`, path aliases
    - Buat `jest.setup.ts` untuk global mocks (Supabase, QStash)
    - _Requirements: semua requirement (fondasi project)_

  - [x] 1.2 Buat skema PostgreSQL lengkap di Supabase
    - Buat file migrasi `supabase/migrations/001_initial_schema.sql`
    - Definisikan enum types: `ticket_status`, `user_role`, `history_entry_type`, `attachment_type`
    - Buat semua tabel: `reporters`, `users`, `tickets`, `ticket_history`,
      `ticket_attachments`, `notifications`, `notification_preferences`
    - Tambahkan indexes sesuai desain (status, reporter, assigned_to, created_at, FTS gin index)
    - Buat database trigger `prevent_history_update` untuk enforce immutability `ticket_history`
    - _Requirements: 1.2, 2.3, 3.3, 6.1, 6.2, 6.3, 6.5, 6.6_

  - [x] 1.3 Konfigurasi environment variables dan Supabase client
    - Buat `lib/supabase/server.ts` menggunakan `createServerComponentClient`
    - Buat `lib/supabase/client.ts` menggunakan `createClientComponentClient`
    - Buat `lib/supabase/middleware.ts` menggunakan `createMiddlewareClient`
    - Buat `lib/queue/qstash-client.ts` menggunakan `@upstash/qstash` Client
    - Buat `lib/cache/redis-client.ts` menggunakan `@upstash/redis` Redis
    - Buat `.env.local.example` dengan semua key yang diperlukan
    - _Requirements: semua requirement (fondasi koneksi)_

- [x] 2. Core types, interfaces, dan shared utilities
  - [x] 2.1 Definisikan semua TypeScript types dan interfaces core
    - Buat `lib/types/ticket.ts`: `Ticket`, `TicketSummary`, `TicketDetail`, `TicketStatus`,
      `TicketFilter`, `CreateTicketParams`, `Pagination`, `PaginatedResult`
    - Buat `lib/types/user.ts`: `User`, `Reporter`, `AuthenticatedUser`, `AuthTokens`
    - Buat `lib/types/notification.ts`: `NotificationEvent`, `NotificationPreferences`
    - Buat `lib/types/webhook.ts`: `WhatsAppWebhookPayload`, `IncomingMessage`,
      `WebhookEntry`, `WebhookChange`, `ProcessMessageJob`, `ProcessMessageResult`
    - Buat `lib/types/queue.ts`: `BotReplyJob`, `TimerJob`
    - _Requirements: 1.1, 1.2, 2.1, 3.3, 4.1, 5.2, 8.1_

  - [x] 2.2 Implementasi utility functions
    - Buat `lib/utils/ticket-number.ts`: fungsi `generateTicketNumber(date)` menggunakan
      Upstash Redis INCR dengan key `ticket:seq:{YYYYMMDD}` dan `expireat` EOD+1 hari;
      format output `TKT-YYYYMMDD-NNNN` (sequence 4 digit zero-padded)
    - Buat `lib/utils/validation.ts`: skema Zod untuk validasi input API (tiket, user, filter)
    - Buat `lib/utils/working-hours.ts`: fungsi `isWorkingHour(date)` dan
      `calculateWorkingMinutes(start, end)` untuk jam kerja 08.00-17.00 Senin-Jumat
    - Buat `lib/utils/error-response.ts`: helper `createErrorResponse(code, message, details?)`
      sesuai format `ErrorResponse` di desain
    - _Requirements: 1.2, 1.4, 4.4, 5.4, 8.4_

  - [x]* 2.3 Property test untuk ticket number generation
    - **Property 1 (partial): Format nomor tiket TKT-YYYYMMDD-NNNN selalu valid**
    - Gunakan `fc.date()` untuk berbagai tanggal, verifikasi regex `/^TKT-\d{8}-\d{4}$/`
    - Verifikasi sequence number zero-padded 4 digit, naik monoton dalam hari yang sama
    - **Validates: Requirements 1.2**

- [x] 3. Auth Service dan middleware
  - [x] 3.1 Implementasi Auth Service dengan Supabase Auth
    - Buat `lib/auth/auth-service.ts` mengimplementasikan interface `AuthService`
    - Implementasi `login()`: panggil Supabase Auth `signInWithPassword`, cek lockout di Redis
      (`lockout:{userId}`) sebelum proses, reset counter setelah sukses
    - Implementasi `logout()`: panggil Supabase Auth `signOut`
    - Implementasi `validateSession()`: verifikasi Supabase JWT, baca `user_metadata.role`
    - Implementasi lockout logic: increment Redis counter `lockout:{userId}`, set TTL 15 menit
      saat counter mencapai 5; tolak login (bahkan jika password benar) selama TTL aktif
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Buat Next.js middleware untuk proteksi route
    - Buat `middleware.ts` di root: intercept semua request ke `/api/v1/*`
    - Validasi Supabase JWT dari Authorization header atau cookie session
    - Inject `AuthenticatedUser` ke request header untuk digunakan handler
    - Biarkan `/api/auth/*`, `/api/webhook/whatsapp`, dan `/api/jobs/*` melewati auth middleware
    - _Requirements: 7.1_

  - [x] 3.3 Implementasi role-based access control helpers
    - Buat `lib/auth/rbac.ts`: fungsi `requireRole(role)`, `isSupervisor(user)`, `isStaff(user)`
    - Buat helper `assertSupervisor(user)` dan `assertStaff(user)` yang melempar 403 jika gagal
    - Buat `lib/auth/ticket-access.ts`: fungsi `canAccessTicket(user, ticket)` sesuai Req 7.5
      (Staff hanya bisa akses tiket yang di-assign kepadanya atau tiket belum di-assign)
    - _Requirements: 7.3, 7.4, 7.5_

  - [x]* 3.4 Unit test Auth Service
    - Test login sukses: counter Redis reset setelah berhasil
    - Test lockout: percobaan ke-6 ditolak meskipun password benar
    - Test unlock otomatis: setelah TTL Redis habis (mock timer), login bisa kembali
    - Test `validateSession`: token valid dan invalid, expired, role terbaca dari metadata
    - _Requirements: 7.1, 7.2_

- [x] 4. Checkpoint — Fondasi siap
  - Pastikan skema Supabase dapat dijalankan di local (`supabase start && supabase db reset`)
  - Pastikan semua unit test Task 2 dan 3 lulus (`jest --testPathPattern="auth|utils" --runInBand`)
  - Pastikan TypeScript compile tanpa error (`tsc --noEmit`)
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan.

- [x] 5. Ticket Service — operasi CRUD tiket
  - [x] 5.1 Implementasi createTicket dan appendMessage
    - Buat `lib/tickets/ticket-service.ts` mengimplementasikan interface `TicketService`
    - Implementasi `createTicket()`: buat row di `tickets` dan entri awal di `ticket_history`
      dalam satu PostgreSQL transaction; gunakan `generateTicketNumber(date)` untuk nomor tiket
    - Implementasi `appendMessage()`: insert entri baru ke `ticket_history` (immutable);
      cek duplikasi via `wa_message_id` sebelum insert
    - _Requirements: 1.2, 2.7, 6.1_

  - [x]* 5.2 Property test: pembuatan tiket untuk Reporter terdaftar
    - **Property 1: Tiket dibuat untuk setiap pesan dari nomor terdaftar**
    - Gunakan `fc.record({ phone, name, message, timestamp })` dengan Supabase local dev
    - Verifikasi `ticket_number` cocok regex, `status = 'OPEN'`, satu entri riwayat
    - **Validates: Requirements 1.2**

  - [x] 5.3 Implementasi updateStatus dan validasi state machine
    - Implementasi `updateStatus()`: validasi transisi berdasarkan state machine di desain,
      tolak transisi ilegal dengan HTTP 409
    - Insert entri `STATUS_CHANGE` ke `ticket_history` dengan metadata
      `{ previousStatus, newStatus, actorId, actorLabel }`
    - Implementasi `resolveTicket()`: validasi panjang catatan resolusi (10–2000 karakter,
      bukan hanya whitespace), simpan `resolution_note`, set `resolved_at`
    - _Requirements: 5.1, 5.2, 6.2_

  - [x]* 5.4 Property test: transisi status sesuai state machine
    - **Property 20: Kontrol aksi status berbasis role dan state**
    - **Property 21: Catatan resolusi tidak valid mencegah perubahan status**
    - Gunakan `fc.constantFrom(...validStatuses)` untuk origin status, verifikasi transisi
      legal berhasil dan ilegal ditolak dengan kode error yang tepat
    - **Validates: Requirements 5.1, 5.2**

  - [x] 5.5 Implementasi assignStaff dan listTickets
    - Implementasi `assignStaff()`: validasi Staff aktif, terapkan transisi status
      (OPEN→IN_PROGRESS atau IN_PROGRESS→IN_PROGRESS), set `first_assigned_at` jika pertama kali
    - Untuk reassignment: wajibkan `reason` non-kosong dan ≤500 karakter
    - Insert entri `ASSIGNMENT_CHANGE` ke `ticket_history` dengan metadata lengkap
    - Implementasi `listTickets()`: query dengan filter (status, app_name, assignedStaffId,
      dateFrom, dateTo, search min 3 karakter via FTS), pagination, ringkasan ≤150 karakter
    - _Requirements: 4.1, 4.2, 4.5, 3.3, 3.4, 3.5, 6.3_

  - [x]* 5.6 Property test: assignStaff
    - **Property 15: Daftar Staff hanya berisi Staff aktif**
    - **Property 16: Transisi status tiket saat assignment konsisten dengan state machine**
    - **Property 18: Alasan pengalihan hanya whitespace ditolak**
    - **Property 19: Penugasan ke Staff tidak aktif selalu ditolak**
    - **Validates: Requirements 4.1, 4.2, 4.5, 4.7**

  - [x] 5.7 Implementasi getTicketDetail
    - Implementasi `getTicketDetail()`: ambil data tiket lengkap beserta riwayat dari
      `ticket_history` diurutkan ascending `created_at`, lampiran dari `ticket_attachments`
    - Gabungkan semua entry type dalam satu daftar kronologis
    - _Requirements: 6.4_

  - [x]* 5.8 Property test: riwayat tiket kronologis dan immutability
    - **Property 25: Semua pesan WhatsApp tersimpan secara kronologis**
    - **Property 26: Setiap perubahan status dan assignment dicatat dengan metadata lengkap**
    - **Property 27: Riwayat tiket ditampilkan dalam urutan kronologis**
    - **Property 28: Entri riwayat bersifat immutable** — verifikasi trigger DB menolak UPDATE
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

- [x] 6. Attachment Service
  - [x] 6.1 Implementasi upload dan validasi lampiran
    - Buat `lib/attachments/attachment-service.ts`
    - Implementasi `validateAttachment(mimeType, sizeBytes)`: terima JPG, PNG, GIF (≤5MB),
      PDF, DOCX (≤10MB); tolak selain itu
    - Implementasi `saveAttachment(ticketId, historyId, file)`: download media dari WhatsApp
      via Meta Cloud API menggunakan media ID, upload ke Supabase Storage, insert ke
      `ticket_attachments`
    - _Requirements: 2.3, 2.4_

  - [x]* 6.2 Property test: validasi lampiran
    - **Property 7: Lampiran valid tersimpan dan tertaut ke tiket**
    - **Property 8: Lampiran tidak valid ditolak dan tidak tersimpan**
    - Gunakan `fc.record({ mimeType, sizeBytes })` untuk berbagai kombinasi
    - **Validates: Requirements 2.3, 2.4**

- [x] 7. WhatsApp Webhook Handler
  - [x] 7.1 Implementasi GET dan POST webhook handler
    - Buat `app/api/webhook/whatsapp/route.ts`
    - Implementasi GET: verifikasi `hub.mode`, `hub.verify_token`, `hub.challenge`
    - Implementasi POST: verifikasi signature `X-Hub-Signature-256` menggunakan HMAC-SHA256,
      respond `200 OK` segera, enqueue job ke QStash topic `message-processor`
    - Tolak request tanpa signature valid dengan 403
    - _Requirements: 1.1_

  - [x] 7.2 Implementasi QStash signature validation middleware
    - Buat `lib/queue/qstash-validator.ts`: verifikasi `Upstash-Signature` header pada semua
      request ke `/api/jobs/*` menggunakan `@upstash/qstash` `Receiver`
    - Tolak request tanpa signature QStash valid dengan 403
    - _Requirements: 1.1 (keamanan job endpoint)_

- [x] 8. Message Processor (QStash Job Handler)
  - [x] 8.1 Implementasi routing logic pesan masuk
    - Buat `app/api/jobs/process-message/route.ts`
    - Routing logic:
      1. Cek nomor di tabel `reporters` (aktif); jika tidak → enqueue bot-reply `UNREGISTERED`
      2. Cek `type`; jika bukan `text`/`image`/`document` → enqueue bot-reply `INVALID_FORMAT`
      3. Cari tiket aktif terakhir Reporter:
         - Tidak ada → panggil `createTicket()`, enqueue bot-reply `TICKET_CREATED` dan `GUIDANCE_REQUEST`
         - Status OPEN → panggil `appendMessage()`, lampirkan attachment jika ada
         - Status IN_PROGRESS/RESOLVED/CLOSED → enqueue bot-reply `STATUS_INFO`
    - Kembalikan `ProcessMessageResult` yang sesuai
    - _Requirements: 1.2, 1.3, 1.7, 2.7, 2.8_

  - [x]* 8.2 Property test: routing pesan masuk
    - **Property 1: Tiket dibuat untuk setiap pesan dari nomor terdaftar**
    - **Property 2: Nomor tidak terdaftar tidak menghasilkan tiket**
    - **Property 4: Pesan non-teks tidak menghasilkan tiket**
    - **Property 9: Semua pesan ke tiket OPEN terakumulasi di riwayat yang sama**
    - **Property 10: Pesan ke tiket non-OPEN menghasilkan informasi status**
    - Gunakan Supabase local dev dan mock QStash untuk verifikasi
    - **Validates: Requirements 1.2, 1.3, 1.7, 2.7, 2.8**

  - [x] 8.3 Implementasi penanganan attachment dalam message processor
    - Integrasikan `AttachmentService` ke dalam `process-message` handler
    - Jika pesan mengandung `image` atau `document`: download media dari WhatsApp,
      validasi tipe dan ukuran, simpan via `saveAttachment()`; jika tidak valid → enqueue
      bot-reply `INVALID_ATTACHMENT`
    - _Requirements: 2.3, 2.4_

  - [x]* 8.4 Property test: validasi attachment dalam message processor
    - **Property 7: Lampiran valid tersimpan dan tertaut ke tiket**
    - **Property 8: Lampiran tidak valid ditolak dan tidak tersimpan** (end-to-end via processor)
    - **Validates: Requirements 2.3, 2.4**

- [x] 9. Bot Responder Service dan job handler
  - [x] 9.1 Implementasi semua template pesan Bot Responder
    - Buat `lib/bot/bot-responder-service.ts` mengimplementasikan interface `BotResponderService`
    - Setiap method membuat payload pesan dan memanggil Meta Cloud API Messages endpoint
      (`POST https://graph.facebook.com/v18.0/{phone_number_id}/messages`)
    - Template pesan:
      - `sendTicketCreated`: nomor tiket, waktu DD/MM/YYYY HH:MM, estimasi 30 menit (jam kerja)
      - `sendGuidanceRequest`: minta (a) nama aplikasi, (b) deskripsi error, (c) langkah reproduksi
      - `sendGuidanceReminder`: pengingat sekali setelah 15 menit tanpa respons
      - `sendStatusUpdate`: informasi status tiket terakhir + tawaran laporan baru
      - `sendAssignmentNotification`: nama Staff yang bertugas
      - `sendResolutionConfirmation`: ringkasan resolusi + minta balas "YA"
      - `sendUnregisteredReply`: nomor tidak dikenali + kontak admin
      - `sendInvalidFormatReply`: minta kirim dalam format teks
      - `sendError`: pesan permintaan maaf + minta kirim ulang
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 2.1, 2.5, 2.8, 4.4, 5.3_

  - [x] 9.2 Buat QStash job handler bot-reply
    - Buat `app/api/jobs/bot-reply/route.ts`
    - Validasi QStash signature, parse `BotReplyJob` payload, dispatch ke method yang sesuai
      di `BotResponderService`
    - Kembalikan `200 OK` setelah berhasil; kembalikan `5xx` untuk trigger QStash retry
    - _Requirements: 1.3, 1.4, 1.6, 4.4, 5.3_

  - [x]* 9.3 Unit test Bot Responder Service
    - Test setiap template mengirim payload yang benar ke Meta API (mock via nock)
    - Test retry behavior: Meta API return 5xx → handler return 5xx → QStash retry
    - _Requirements: 1.3, 1.4, 1.6, 1.7, 2.1, 2.5, 4.4, 5.3_

- [x] 10. Timer Job Handler (reminder dan auto-close)
  - [x] 10.1 Implementasi timer job handler
    - Buat `app/api/jobs/timer/route.ts`
    - Tangani job types berikut:
      - `GUIDANCE_REMINDER` (15 menit): kirim pengingat ke Reporter via bot, enqueue
        `AUTO_CLOSE_NO_RESPONSE` job dengan delay 15 menit
      - `AUTO_CLOSE_NO_RESPONSE` (15 menit setelah reminder): tutup tiket OPEN jika Reporter
        masih belum merespons, keterangan "ditutup karena tidak ada respons dari Reporter"
      - `AUTO_CLOSE_RESOLVED` (24 jam setelah RESOLVED): tutup tiket RESOLVED, keterangan
        "auto-closed: tidak ada konfirmasi dari Reporter"
      - `UNASSIGNED_REMINDER` (30 menit setelah tiket OPEN): notifikasi ke semua Supervisor login
      - `STALE_TICKET_REMINDER` (4 jam kerja tanpa aktivitas IN_PROGRESS): notifikasi Staff
        dan Supervisor
    - Enqueue timer jobs dari Ticket Service saat membuat tiket dan mengubah status
    - _Requirements: 2.5, 2.6, 4.6, 5.5, 8.4_

  - [x]* 10.2 Unit test timer jobs dengan fake timer
    - Test `GUIDANCE_REMINDER`: mock `jest.useFakeTimers()`, verifikasi QStash dipanggil tepat
      sekali dengan payload `GUIDANCE_REMINDER` setelah 15 menit
    - Test `AUTO_CLOSE_NO_RESPONSE`: setelah 30 menit total (15+15), tiket berstatus CLOSED
    - Test `AUTO_CLOSE_RESOLVED`: setelah 24 jam, tiket RESOLVED berstatus CLOSED dengan
      keterangan "auto-closed"
    - Test idempotency: timer job tidak menutup tiket jika status sudah berubah sebelum
      job dieksekusi
    - _Requirements: 2.5, 2.6, 5.5_

- [x] 11. Checkpoint — Backend core selesai
  - Pastikan semua unit dan property test Task 5–10 lulus
  - Pastikan TypeScript compile tanpa error
  - Jalankan smoke test koneksi Supabase, Redis, dan QStash di local dev
  - Tanyakan kepada user - [x] 12. Notification Service
  - [x] 12.1 Implementasi Notification Service (server-side write)
    - Buat `lib/notifications/notification-service.ts` mengimplementasikan `NotificationService`
    - Implementasi `notifyUser()`: insert ke tabel `notifications` dengan `user_id`, `event_type`,
      dan `payload` JSON; Supabase Realtime broadcast otomatis ke subscriber
    - Implementasi `broadcastToSupervisors()`: query semua user `role = 'SUPERVISOR'` dan
      `is_active = true`, panggil `notifyUser()` untuk masing-masing
    - Implementasi `broadcastToAll()`: query semua Staff dan Supervisor aktif, panggil
      `notifyUser()` untuk masing-masing
    - Integrasikan pemanggilan Notification Service ke dalam Ticket Service (setelah setiap
      event relevan: tiket baru, tiket di-assign, pesan baru, perubahan status)
    - Cek preferensi notifikasi user dari `notification_preferences` sebelum insert
    - _Requirements: 4.3, 4.6, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x]* 12.2 Property test: notifikasi dikirim ke target yang tepat
    - **Property 33: Notifikasi dikirim ke target yang tepat sesuai jenis event**
    - **Property 34: Preferensi notifikasi dihormati secara konsisten**
    - **Property 35: Notifikasi tersimpan selama offline dan tersedia saat login kembali**
    - Gunakan Supabase local dev, variasikan target user dan preferensi dengan fast-check
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.6**

- [x] 13. Report Service
  - [x] 13.1 Implementasi Report Service
    - Buat `lib/reports/report-service.ts`
    - Implementasi `getSummary(dateFrom, dateTo)`:
      - Hitung jumlah tiket per `status`, per `app_name`, per `assigned_to`
      - Hitung rata-rata first response time: mean `(first_assigned_at - created_at)` untuk
        tiket yang pernah di-assign
      - Hitung rata-rata resolution time: mean `(resolved_at - created_at)` untuk tiket RESOLVED
      - Ambil top-10 `app_name` descending berdasarkan jumlah tiket
    - Kembalikan pesan "tidak ada data" jika tidak ada tiket dalam rentang tanggal
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x] 13.2 Implementasi CSV export
    - Tambahkan method `exportCsv(dateFrom, dateTo)` ke Report Service
    - Generate CSV dengan header: nomor tiket, Reporter, aplikasi, status, Staff, waktu masuk,
      waktu resolved, catatan resolusi
    - Kembalikan `ReadableStream` atau `Buffer` CSV; handler API set header
      `Content-Disposition: attachment; filename=report-YYYYMMDD.csv`
    - _Requirements: 9.4_

  - [x]* 13.3 Property test: konsistensi laporan
    - **Property 36: Jumlah tiket dalam laporan konsisten dengan data aktual**
    - **Property 37: Rata-rata first response time akurat secara matematis**
    - **Property 38: Rata-rata resolution time akurat secara matematis**
    - **Property 39: Top-10 aplikasi dalam laporan konsisten dengan data aktual**
    - Gunakan `fc.array(fc.record({ ... }))` untuk generate berbagai dataset tiket
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.5**

- [x] 14. API Routes — Tiket, User, Notifikasi, Laporan
  - [x] 14.1 Implementasi Ticket API Routes
    - Buat `app/api/v1/tickets/route.ts`:
      GET `listTickets()` dengan query params filter + pagination; enforce `canAccessTicket()` RBAC
    - Buat `app/api/v1/tickets/[id]/route.ts`:
      GET `getTicketDetail()` dengan RBAC check
    - Buat `app/api/v1/tickets/[id]/assign/route.ts`:
      POST — hanya Supervisor; validasi body `{ staffId, reason? }` via Zod; panggil `assignStaff()`
    - Buat `app/api/v1/tickets/[id]/resolve/route.ts`:
      POST — hanya Staff yang ditugaskan; validasi `resolutionNote`; panggil `resolveTicket()`
    - Buat `app/api/v1/tickets/[id]/reopen/route.ts`:
      POST — hanya Supervisor; panggil `updateStatus(CLOSED/RESOLVED → IN_PROGRESS)`
    - _Requirements: 3.3, 3.4, 3.5, 4.1, 4.2, 4.5, 4.7, 5.1, 5.2, 5.6, 7.4, 7.5_

  - [x]* 14.2 Property test: RBAC pada Ticket API
    - **Property 20: Kontrol aksi status tiket berbasis role dan state**
    - **Property 24: Staff tidak bisa mengubah status tiket CLOSED**
    - **Property 29: Request tanpa token valid selalu ditolak (401)**
    - **Property 31: Endpoint Supervisor menolak akses Staff (403)**
    - **Property 32: Staff tidak dapat mengakses tiket di luar hak aksesnya**
    - **Validates: Requirements 5.1, 5.6, 7.1, 7.4, 7.5**

  - [x] 14.3 Implementasi User API Routes
    - Buat `app/api/v1/users/route.ts`:
      GET — daftar Staff aktif (untuk dropdown assignment); POST — buat user baru (Supervisor only)
    - Buat `app/api/v1/users/[id]/route.ts`:
      PATCH — update `full_name`, `role` (Supervisor only)
    - Buat `app/api/v1/users/[id]/status/route.ts`:
      PATCH `{ is_active }` — aktifkan/nonaktifkan akun (Supervisor only)
    - _Requirements: 4.1, 4.7, 7.3, 7.4_

  - [x]* 14.4 Property test: daftar Staff untuk assignment
    - **Property 15: Daftar Staff untuk assignment hanya berisi Staff aktif**
    - Variasikan kombinasi user aktif/nonaktif dan role dengan fast-check
    - **Validates: Requirements 4.1**

  - [x] 14.5 Implementasi Notification API Routes
    - Buat `app/api/v1/notifications/route.ts`: GET — ambil notifikasi belum dibaca milik user
    - Buat `app/api/v1/notifications/[id]/read/route.ts`: PATCH — tandai satu notifikasi dibaca
    - Buat `app/api/v1/notifications/read-all/route.ts`: PATCH — tandai semua notifikasi dibaca
    - Buat `app/api/v1/notifications/preferences/route.ts`:
      GET dan PUT preferensi notifikasi per user
    - _Requirements: 8.5, 8.6_

  - [x] 14.6 Implementasi Report API Routes
    - Buat `app/api/v1/reports/summary/route.ts`:
      GET dengan query `?from=&to=` (max 365 hari); Supervisor only; panggil `getSummary()`
    - Buat `app/api/v1/reports/export/route.ts`:
      GET — Supervisor only; panggil `exportCsv()`, stream hasil sebagai file CSV
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 14.7 Implementasi Auth API Routes
    - Buat `app/api/auth/login/route.ts`: POST `{ username, password }` → panggil `login()`,
      kembalikan `AuthTokens`; tangani lockout error dengan pesan yang sesuai
    - Buat `app/api/auth/logout/route.ts`: POST → panggil `logout()`
    - _Requirements: 7.1, 7.2_

- [x] 15. Checkpoint — Semua API Routes selesai
  - Pastikan semua property test dan unit test Task 12–14 lulus
  - Pastikan TypeScript compile tanpa error
  - Lakukan manual smoke test endpoint dengan `curl` atau REST client untuk happy path
    utama: login, buat tiket via webhook, assign tiket, resolve tiket
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan.olve tiket
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan.

- [x] 16. Frontend — Layout, Auth, dan Shared Components
  - [x] 16.1 Buat layout dasar dan halaman login
    - Buat `app/(auth)/login/page.tsx`: form login dengan `username` dan `password`
    - Tambahkan `app/(auth)/layout.tsx`: layout tanpa sidebar untuk halaman auth
    - Buat `app/(dashboard)/layout.tsx`: layout dashboard dengan sidebar navigasi, ikon
      notifikasi dengan badge counter, dan top bar (nama user + tombol logout)
    - Implementasikan redirect ke `/login` jika session tidak valid menggunakan middleware
    - _Requirements: 7.1_

  - [x] 16.2 Buat shared UI components
    - Buat `components/ui/badge.tsx`: badge status tiket (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
      dengan warna TailwindCSS yang berbeda per status
    - Buat `components/ui/error-message.tsx`: komponen reusable untuk pesan error
    - Buat `components/ui/empty-state.tsx`: komponen untuk state kosong (tidak ada tiket, dll.)
    - Buat `components/ui/pagination.tsx`: komponen pagination reusable
    - Buat `components/notifications/notification-bell.tsx`: ikon notifikasi dengan badge
      counter yang subscribe ke Supabase Realtime channel `notifications`
    - _Requirements: 3.7, 8.1, 8.2, 8.3_

  - [x] 16.3 Implementasi Supabase Realtime provider
    - Buat `app/(dashboard)/realtime-provider.tsx` (client component)
    - Subscribe ke channel `tickets` untuk Postgres Changes event `*` di tabel `tickets`
    - Subscribe ke channel `notifications` untuk INSERT pada tabel `notifications`
      dengan filter `user_id=eq.{userId}`
    - Implementasikan reconnection handling: tampilkan banner "koneksi real-time tidak aktif"
      dan aktifkan polling setiap 30 detik saat Realtime terputus
    - _Requirements: 3.1, 3.6, 8.1, 8.2, 8.3_

- [x] 17. Frontend — Halaman Antrian Tiket
  - [x] 17.1 Buat halaman daftar tiket (Antrian_Tiket)
    - Buat `app/(dashboard)/tickets/page.tsx` (Server Component) untuk initial data fetch
    - Buat `app/(dashboard)/tickets/ticket-list.tsx` (Client Component) yang subscribe
      ke Realtime; tampilkan list tiket terbaru maksimal 3 detik setelah tiket masuk
    - Tampilkan 7 field per tiket: nomor, nama Reporter, nama aplikasi, ringkasan deskripsi
      error (≤150 karakter), status badge, waktu masuk, Staff yang ditugaskan
    - Implementasikan filter: Status_Tiket (multi-select), nama aplikasi, Staff yang ditugaskan,
      rentang tanggal — filter dikirim sebagai query params ke API
    - Implementasikan search: nomor tiket, nama Reporter, kata kunci deskripsi (min 3 karakter)
    - Tampilkan `EmptyState` component jika filter/search tidak menghasilkan tiket
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_

  - [x] 17.2 Buat halaman detail tiket
    - Buat `app/(dashboard)/tickets/[id]/page.tsx` (Server Component)
    - Tampilkan informasi tiket lengkap: semua field + riwayat kronologis gabungan
      (pesan Reporter, balasan Bot, perubahan status, perubahan assignment)
    - Untuk Supervisor: tampilkan form assign/reassign Staff (dropdown Staff aktif + field
      alasan jika reassign); tampilkan tombol reopen jika status CLOSED
    - Untuk Staff (yang ditugaskan): tampilkan tombol "Resolve" jika status IN_PROGRESS;
      tampilkan form catatan resolusi (10–2000 karakter) saat tombol diklik
    - Tampilkan semua lampiran tiket dengan link download
    - _Requirements: 4.1, 4.2, 4.5, 4.7, 5.1, 5.2, 5.6, 6.4_

  - [x]* 17.3 Unit test komponen Ticket List dan Detail
    - Test filter dan search menghasilkan query param yang benar ke API
    - Test badge status warna sesuai
    - Test form assignment: alasan wajib saat reassign, error saat Staff tidak aktif
    - Test form resolve: tombol disabled jika catatan resolusi tidak memenuhi syarat
    - _Requirements: 3.4, 3.5, 4.5, 5.2_

- [x] 18. Frontend — Notifikasi, Preferensi, dan Manajemen User
  - [x] 18.1 Buat panel notifikasi
    - Buat `app/(dashboard)/notifications/notification-panel.tsx` (Client Component)
    - Tampilkan daftar notifikasi belum dibaca yang dihasilkan selama offline saat login
    - Implementasikan aksi "tandai dibaca" per item dan "tandai semua dibaca"
    - Integrasikan dengan `NotificationBell` (update badge count real-time via Realtime)
    - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [x] 18.2 Buat halaman preferensi notifikasi
    - Buat `app/(dashboard)/settings/notifications/page.tsx`
    - Tampilkan 4 toggle: "tiket baru belum di-assign", "tiket di-assign kepada saya",
      "pesan baru pada tiket saya", "pengingat tiket stagnan"
    - Simpan perubahan ke `PUT /api/v1/notifications/preferences`
    - _Requirements: 8.5_

  - [x] 18.3 Buat halaman manajemen user (Supervisor only)
    - Buat `app/(dashboard)/users/page.tsx`: daftar semua user dengan status aktif/nonaktif
    - Buat `app/(dashboard)/users/new/page.tsx`: form tambah user baru (username, full_name,
      role, password)
    - Implementasikan tombol aktifkan/nonaktifkan akun user
    - _Requirements: 7.3, 7.4_

- [x] 19. Frontend — Halaman Laporan
  - [x] 19.1 Buat halaman laporan kinerja (Supervisor only)
    - Buat `app/(dashboard)/reports/page.tsx`
    - Tampilkan date range picker (max 365 hari) dan tombol "Tampilkan Laporan"
    - Tampilkan hasil: tabel jumlah tiket per status, per aplikasi, per Staff; rata-rata FRT dan
      resolution time; top-10 aplikasi
    - Tampilkan `EmptyState` component jika tidak ada data pada periode tersebut
    - Tampilkan tombol "Export CSV" yang memanggil `GET /api/v1/reports/export`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]* 19.2 Unit test komponen laporan
    - Test empty state muncul jika API mengembalikan data kosong
    - Test export CSV: tombol memicu download dengan nama file yang benar
    - Test date range validation: tidak bisa lebih dari 365 hari
    - _Requirements: 9.4, 9.6_

- [x] 20. Integration tests end-to-end
  - [x]* 20.1 Integration test: alur pesan masuk hingga tiket terbuat (SLA 5 detik)
    - Kirim webhook POST dengan payload valid ke `/api/webhook/whatsapp`
    - Poll Supabase hingga tiket terbuat, verifikasi dalam <5 detik
    - Verifikasi bot-reply job di-enqueue ke QStash (mock via nock)
    - _Requirements: 1.1, 1.2_

  - [x]* 20.2 Integration test: semua transisi status tiket
    - Test alur lengkap: OPEN → IN_PROGRESS → RESOLVED → CLOSED (via konfirmasi Reporter)
    - Test alur auto-close: OPEN → CLOSED (timeout) dan RESOLVED → CLOSED (24 jam)
    - Test reopen: CLOSED → IN_PROGRESS (oleh Supervisor)
    - _Requirements: 4.2, 5.4, 5.5, 5.6_

  - [x]* 20.3 Integration test: property RBAC dan auth
    - **Property 29: Request tanpa token valid selalu ditolak**
    - **Property 30: Akun terkunci setelah 5 kali gagal login berturut-turut**
    - **Property 31: Endpoint Supervisor menolak akses Staff**
    - **Property 32: Staff tidak dapat mengakses tiket di luar hak aksesnya**
    - **Validates: Requirements 7.1, 7.2, 7.4, 7.5**

  - [x]* 20.4 Integration test: Supabase Realtime subscription
    - Test channel `tickets` tersubscribe dengan status `SUBSCRIBED`
    - Test update tiket di Supabase muncul sebagai Realtime event di subscriber
    - Test reconnection: simulasi disconnect → banner muncul → polling aktif → koneksi pulih
    - _Requirements: 3.1, 3.6_

  - [x]* 20.5 Integration test: CSV export
    - Test export laporan menghasilkan file CSV dengan format dan header yang benar
    - Test file tergenerate dalam <30 detik untuk dataset sampai 365 hari
    - _Requirements: 9.4_

- [x] 21. Final checkpoint — Semua tes lulus dan sistem siap deploy
  - Jalankan seluruh test suite (`jest --runInBand`) dan pastikan semua lulus
  - Pastikan TypeScript compile tanpa error (`tsc --noEmit`)
  - Verifikasi semua environment variables terdokumentasi di `.env.local.example`
  - Buat `supabase/seed.sql` dengan data awal: minimal 1 akun Supervisor untuk pertama kali login
  - Tanyakan kepada user jika ada pertanyaan sebelum melanjutkan.


---

## Notes

- Task yang ditandai `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat;
  task tanpa `*` wajib diimplementasikan
- Setiap property test merujuk langsung ke nomor Property di `design.md` untuk traceability
- Semua timer job diuji menggunakan `jest.useFakeTimers()` agar test tidak lambat
- QStash di-mock via `jest.spyOn(qstashClient, 'publishJSON')` atau nock di unit/property tests;
  hanya integration test yang menguji end-to-end dengan QStash real
- Supabase Realtime tidak perlu WebSocket server custom — semua broadcast otomatis dari
  Postgres Changes event
- Lockout Redis key `lockout:{userId}` di-expire otomatis setelah 15 menit, tidak ada cron job
- Nomor tiket menggunakan Redis INCR per hari (`ticket:seq:{YYYYMMDD}`) untuk atomisitas

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["5.4", "5.5", "6.2"] },
    { "id": 7, "tasks": ["5.6", "5.7"] },
    { "id": 8, "tasks": ["5.8", "7.1", "7.2"] },
    { "id": 9, "tasks": ["8.1", "9.1"] },
    { "id": 10, "tasks": ["8.2", "8.3", "9.2"] },
    { "id": 11, "tasks": ["8.4", "9.3", "10.1"] },
    { "id": 12, "tasks": ["10.2", "12.1", "13.1"] },
    { "id": 13, "tasks": ["12.2", "13.2"] },
    { "id": 14, "tasks": ["13.3", "14.1"] },
    { "id": 15, "tasks": ["14.2", "14.3", "14.5", "14.6", "14.7"] },
    { "id": 16, "tasks": ["14.4", "16.1", "16.2"] },
    { "id": 17, "tasks": ["16.3", "17.1", "18.3"] },
    { "id": 18, "tasks": ["17.2", "18.1", "18.2", "19.1"] },
    { "id": 19, "tasks": ["17.3", "19.2"] },
    { "id": 20, "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5"] }
  ]
}
```
