import { NextResponse } from 'next/server';
import { log } from '@/lib/observability/logger';

export interface ErrorResponseBody {
  code: string;
  message: string;
  details?: any;
}

function validationMessages(value: unknown) {
  if (!Array.isArray(value)) return null;

  const messages = value
    .map((issue) => {
      if (!issue || typeof issue !== 'object' || !('message' in issue)) return null;
      return typeof issue.message === 'string' ? issue.message.trim() : null;
    })
    .filter((message): message is string => Boolean(message));

  return messages.length > 0 ? [...new Set(messages)].join(' ') : null;
}

export function getErrorMessage(error: unknown, fallback = 'Permintaan tidak valid.') {
  if (typeof error === 'string') {
    const message = error.trim();
    if (!message) return fallback;

    try {
      return validationMessages(JSON.parse(message)) ?? message;
    } catch {
      return message;
    }
  }

  if (error instanceof Error) return getErrorMessage(error.message, fallback);

  if (error && typeof error === 'object') {
    if ('issues' in error) {
      const message = validationMessages(error.issues);
      if (message) return message;
    }
    if ('message' in error) return getErrorMessage(error.message, fallback);
  }

  return fallback;
}

export function createErrorResponse(
  code: string,
  message: unknown,
  statusCode: number = 400,
  details?: any
) {
  const readableMessage = getErrorMessage(message);
  if (statusCode >= 500) log('error', 'api_error', { code, message: readableMessage, statusCode });
  const body: ErrorResponseBody = {
    code,
    message: readableMessage,
    ...(details !== undefined && { details }),
  };
  return NextResponse.json(body, { status: statusCode });
}
