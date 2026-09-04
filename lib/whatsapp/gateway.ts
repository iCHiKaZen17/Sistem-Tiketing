import { WhatsAppAttachmentReply, WhatsAppReply } from './types';

export async function sendWhatsAppText(reply: WhatsAppReply): Promise<boolean> {
  const url = process.env.WHATSAPP_OFFICE_SEND_URL;
  if (!url) return false;
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

export async function sendWhatsAppAttachment(reply: WhatsAppAttachmentReply): Promise<boolean> {
  const url = process.env.WHATSAPP_OFFICE_ATTACHMENT_SEND_URL;
  if (!url) return false;

  const form = new FormData();
  const buffer = new ArrayBuffer(reply.bytes.byteLength);
  new Uint8Array(buffer).set(reply.bytes);
  form.set('to', reply.to);
  form.set('file', new Blob([buffer], { type: reply.mimeType }), reply.filename);
  if (reply.caption) form.set('caption', reply.caption);

  const response = await fetch(url, {
    method: 'POST',
    headers: process.env.WHATSAPP_OFFICE_ATTACHMENT_API_TOKEN
      ? { Authorization: `Bearer ${process.env.WHATSAPP_OFFICE_ATTACHMENT_API_TOKEN}` }
      : {},
    body: form,
  });
  if (!response.ok) throw new Error(`Gateway WA kantor menolak lampiran (${response.status}).`);
  return true;
}

export const sendWhatsAppReply = sendWhatsAppText;
