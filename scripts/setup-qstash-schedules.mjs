import { Client } from '@upstash/qstash';

const token = process.env.QSTASH_TOKEN;
const baseUrl = process.env.APP_BASE_URL?.replace(/\/$/, '');
if (!token || !baseUrl) throw new Error('QSTASH_TOKEN dan APP_BASE_URL wajib diisi.');

const client = new Client({ token });
const failureCallback = `${baseUrl}/api/jobs/qstash-failure`;
const schedules = [
  { scheduleId: 'ticket-maintenance-5m', destination: `${baseUrl}/api/jobs/ticket-maintenance`, cron: '*/5 * * * *', retries: 3, failureCallback },
];
if (process.env.ENABLE_WHATSAPP_OUTBOX_SCHEDULE === 'true') {
  schedules.push({ scheduleId: 'whatsapp-outbox-1m', destination: `${baseUrl}/api/jobs/whatsapp-outbox`, cron: '* * * * *', retries: 3, failureCallback });
} else {
  console.log('whatsapp-outbox-1m: dilewati (ENABLE_WHATSAPP_OUTBOX_SCHEDULE bukan true)');
}

for (const schedule of schedules) {
  const result = await client.schedules.create(schedule);
  console.log(`${schedule.scheduleId}: ${result.scheduleId}`);
}
