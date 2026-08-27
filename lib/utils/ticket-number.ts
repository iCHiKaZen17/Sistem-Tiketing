import { redisClient } from '@/lib/cache/redis-client';
import { format } from 'date-fns';

export async function generateTicketNumber(date: Date = new Date()): Promise<string> {
  const dateStr = format(date, 'yyyyMMdd');
  const redisKey = `ticket:seq:${dateStr}`;

  let seqNum = 1;
  try {
    const incrResult = await redisClient.incr(redisKey);
    seqNum = Number(incrResult);
    if (seqNum === 1) {
      // Set TTL to 48 hours (172800 seconds)
      await redisClient.expire(redisKey, 172800);
    }
  } catch {
    // Fallback for offline/test environments
    seqNum = 1;
  }

  const paddedSeq = String(seqNum).padStart(4, '0');
  return `TKT-${dateStr}-${paddedSeq}`;
}

export function formatTicketNumber(dateStr: string, seq: number): string {
  const paddedSeq = String(seq).padStart(4, '0');
  return `TKT-${dateStr}-${paddedSeq}`;
}
