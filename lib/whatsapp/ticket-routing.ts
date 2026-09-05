export function parseTicketReference(text: string) {
  const references = text.match(/\bTKT-[^\s,;]+/gi) || [];
  if (references.length !== 1 || !/^TKT-\d{8}-\d{4}$/i.test(references[0])) {
    return { number: null, text, invalid: references.length > 0 };
  }
  return { number: references[0].toUpperCase(), text: text.replace(references[0], '').trim(), invalid: false };
}

export async function resolveReporterTicket(db: any, reporterId: string, text: string) {
  const reference = parseTicketReference(text);
  if (reference.invalid) return { ticket: null, text, error: 'Cantumkan satu nomor tiket yang valid, contoh TKT-20260905-0001.' };
  let query = db.from('tickets').select('id,ticket_number,status,app_name,error_desc,repro_steps').eq('reporter_id', reporterId);
  query = reference.number ? query.eq('ticket_number', reference.number) : query.in('status', ['OPEN', 'IN_PROGRESS', 'RESOLVED']);
  const { data, error } = await query.limit(2);
  if (error) throw new Error(error.message);
  if (!data?.length) return { ticket: null, text, error: reference.number ? 'Tiket tidak ditemukan untuk nomor WhatsApp Anda.' : 'Tidak ada tiket aktif. Buat laporan dengan #t deskripsi kendala.' };
  if (data.length > 1) return { ticket: null, text, error: 'Anda memiliki beberapa tiket aktif. Cantumkan nomor tiket pada pesan atau kirim ulang lampiran dengan caption nomor tiket.' };
  return { ticket: data[0], text: reference.text, error: null };
}
