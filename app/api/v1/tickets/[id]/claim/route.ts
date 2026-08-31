import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'STAFF') return NextResponse.json({ message: 'Hanya Staff yang dapat mengklaim tiket.' }, { status: 403 });
  const { data, error } = await createAdminClient().rpc('claim_ticket_atomic', { p_ticket_id: params.id, p_staff_id: user.id, p_actor_label: user.full_name });
  if (error) return NextResponse.json({ message: error.message }, { status: 409 });
  return NextResponse.json(data?.[0]);
}
