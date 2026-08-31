import { checkRateLimit, requestIp } from '@/lib/cache/rate-limit';
import { verifyJobRequest } from '@/lib/jobs/verify-job-request';
import { redactLogContext } from '@/lib/observability/logger';

describe('operational foundations', () => {
  it('fails open when Redis is not configured', async () => {
    const result = await checkRateLimit('test', 10, 60);
    expect(result).toEqual({ allowed: true, remaining: 10, retryAfter: 0, degraded: true });
  });

  it('uses the first forwarded IP address', () => {
    expect(requestIp(new Headers({ 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }))).toBe('203.0.113.10');
  });

  it('accepts the manual job secret and rejects an invalid secret', async () => {
    process.env.JOB_SECRET = 'test-job-secret';
    const valid = new Request('https://example.test/api/jobs/test', { headers: { authorization: 'Bearer test-job-secret' } });
    const invalid = new Request('https://example.test/api/jobs/test', { headers: { authorization: 'Bearer wrong' } });
    expect(await verifyJobRequest(valid)).toBe(true);
    expect(await verifyJobRequest(invalid)).toBe(false);
  });

  it('redacts secrets and masks phone numbers in structured logs', () => {
    expect(redactLogContext({ token: 'secret-value', phone: '628123456789', ticketId: 'ticket-1' })).toEqual({
      token: '[REDACTED]', phone: '********6789', ticketId: 'ticket-1',
    });
  });
});
