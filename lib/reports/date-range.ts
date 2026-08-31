export function parseReportRange(from: string | null, to: string | null) {
  const dateFrom = from ? new Date(`${from}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86400000);
  const dateTo = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  if (!Number.isFinite(dateFrom.getTime()) || !Number.isFinite(dateTo.getTime()) || dateFrom > dateTo) throw new Error('Rentang tanggal tidak valid.');
  if (dateTo.getTime() - dateFrom.getTime() > 365 * 86400000) throw new Error('Rentang laporan maksimal 365 hari.');
  return { dateFrom: dateFrom.toISOString(), dateTo: dateTo.toISOString() };
}
