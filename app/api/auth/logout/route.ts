import { NextResponse } from 'next/server';
import { AuthService } from '@/lib/auth/auth-service';

export async function POST() {
  await AuthService.logout();
  return NextResponse.json({ status: 'logged_out' }, { status: 200 });
}
