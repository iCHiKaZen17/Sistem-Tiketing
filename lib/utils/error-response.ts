import { NextResponse } from 'next/server';
import { log } from '@/lib/observability/logger';

export interface ErrorResponseBody {
  code: string;
  message: string;
  details?: any;
}

export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 400,
  details?: any
) {
  if (statusCode >= 500) log('error', 'api_error', { code, message, statusCode });
  const body: ErrorResponseBody = {
    code,
    message,
    ...(details !== undefined && { details }),
  };
  return NextResponse.json(body, { status: statusCode });
}
