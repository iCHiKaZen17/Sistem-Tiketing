import { NextResponse } from 'next/server';

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
  const body: ErrorResponseBody = {
    code,
    message,
    ...(details !== undefined && { details }),
  };
  return NextResponse.json(body, { status: statusCode });
}
