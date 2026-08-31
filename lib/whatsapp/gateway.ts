import { WhatsAppReply } from './types';

export async function sendWhatsAppReply(reply: WhatsAppReply): Promise<boolean> {
  const url = process.env.WHATSAPP_OFFICE_SEND_URL;
  if (!url) return false; // Webhook response still includes reply for gateway-driven delivery.
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.WHATSAPP_OFFICE_API_TOKEN ? { Authorization: `Bearer ${process.env.WHATSAPP_OFFICE_API_TOKEN}` } : {}),
    },
    body: JSON.stringify({ to: reply.to, type: 'text', text: reply.text }),
  });
  if (!response.ok) throw new Error(`Gateway WA kantor menolak balasan (${response.status}).`);
  return true;
}
