// Global Jest Mocks and Environment Setup

// Mock Supabase environment variables if not present
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-role-key';

// Mock Upstash environment variables if not present
process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://mock-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'mock-redis-token';
process.env.QSTASH_URL = process.env.QSTASH_URL || 'https://qstash.upstash.io';
process.env.QSTASH_TOKEN = process.env.QSTASH_TOKEN || 'mock-qstash-token';
