import { Redis } from '@upstash/redis';

let client: Redis | null | undefined;

export function getRedisClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token && !url.includes('mock-redis') ? new Redis({ url, token }) : null;
  return client;
}
