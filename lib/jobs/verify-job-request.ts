import { Receiver } from '@upstash/qstash';

export async function verifyJobRequest(request: Request): Promise<boolean> {
  const qstashSignature = request.headers.get('upstash-signature');
  if (qstashSignature) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentSigningKey || !nextSigningKey) return false;
    try {
      return await new Receiver({ currentSigningKey, nextSigningKey }).verify({
        signature: qstashSignature,
        body: await request.clone().text(),
        url: request.url,
        clockTolerance: 5,
      });
    } catch { return false; }
  }
  const secret = process.env.JOB_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}
