export function formatTicketNumber(dateStr: string, seq: number): string {
  const paddedSeq = String(seq).padStart(4, '0');
  return `TKT-${dateStr}-${paddedSeq}`;
}
