# Integrasi WhatsApp Gateway Kantor

Endpoint inbound: `POST /api/webhook/whatsapp`

Pesan hanya membuat tiket bila teks, setelah spasi awal dibuang, dimulai dengan
trigger `#t` (case-insensitive). Contoh valid:

```text
#t Aplikasi payroll gagal dibuka sejak pukul 09.00
```

`Halo #t ...`, `#test`, media tanpa teks, status delivery, dan pesan biasa tidak
akan membuat tiket.

## Payload gateway kantor

Format default yang diterima:

```json
{
  "id": "unique-message-id",
  "from": "628123456789",
  "type": "text",
  "text": "#t Aplikasi payroll gagal dibuka",
  "timestamp": "2026-08-31T10:00:00+07:00"
}
```

Alias berikut juga dikenali: `message_id`, `sender`, `phone`, dan `message`.
Batch dapat dikirim sebagai `{ "messages": [...] }`. Jika payload kantor berbeda,
hanya ubah `lib/whatsapp/normalizer.ts`.

## Keamanan request

Gateway menghitung HMAC-SHA256 atas raw request body dengan shared secret dan
mengirim header berikut:

```text
X-Webhook-Signature: sha256=<hex-digest>
```

Nama header dan secret dikonfigurasi melalui
`WHATSAPP_OFFICE_SIGNATURE_HEADER` dan `WHATSAPP_OFFICE_WEBHOOK_SECRET`.

## Balasan outbound

Jika `WHATSAPP_OFFICE_SEND_URL` diisi, aplikasi mengirim:

```json
{
  "to": "628123456789",
  "type": "text",
  "text": "Tiket TKT-... berhasil dibuat..."
}
```

Token opsional dikirim sebagai `Authorization: Bearer <token>`. Balasan disimpan
lebih dulu di tabel `whatsapp_outbox`; worker QStash mengirim dan retry. Jangan
aktifkan `ENABLE_WHATSAPP_OUTBOX_SCHEDULE` sebelum endpoint outbound tersedia.

## Provider Meta

Adapter Meta juga tersedia. Atur `WHATSAPP_WEBHOOK_PROVIDER=meta`,
`WHATSAPP_APP_SECRET`, dan `WHATSAPP_VERIFY_TOKEN`. Endpoint yang sama menangani
GET verification handshake dan signature `X-Hub-Signature-256`.

## Database

Jalankan migration secara berurutan:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_security_and_webhooks.sql`
3. `supabase/migrations/003_atomic_ticket_operations.sql`
4. `supabase/migrations/004_automation_and_storage.sql`
5. `supabase/migrations/005_ticket_search.sql`
6. `supabase/migrations/006_claim_ticket.sql`
7. `supabase/migrations/007_whatsapp_outbox.sql`
8. `supabase/migrations/008_auth_audit.sql`
9. `supabase/migrations/009_notification_deduplication.sql`

Migration tersebut menambahkan transaksi atomik, automation markers, private
attachment bucket, pencarian terpaginasi, klaim tiket, dan durable outbound queue.
