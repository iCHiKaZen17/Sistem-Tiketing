type LogLevel = 'info' | 'warn' | 'error';

function sanitize(value: unknown, key = ''): unknown {
  if (/password|token|secret|authorization|cookie|service[_-]?role/i.test(key)) return '[REDACTED]';
  if (typeof value === 'string') {
    if (/^(phone|sender|to|to_phone)$/i.test(key)) return value.length > 4 ? `${'*'.repeat(Math.min(8, value.length - 4))}${value.slice(-4)}` : '****';
    return value.slice(0, 2000);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitize(child, childKey)]));
  return value;
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return sanitize(context) as Record<string, unknown>;
}

export function log(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...redactLogContext(context) });
  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else console.info(entry);
}
