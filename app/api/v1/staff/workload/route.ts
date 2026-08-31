import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createErrorResponse } from '@/lib/utils/error-response';
import { getAuthenticatedUser } from '@/lib/auth/get-user';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getAuthenticatedUser(request);
    if (!currentUser || currentUser.role !== 'SUPERVISOR') {
      return createErrorResponse('FORBIDDEN', 'Hanya Supervisor yang dapat mengakses laporan beban kerja.', 403);
    }

    const supabase = createAdminClient();

    const { data: staffWorkload, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        role,
        is_active
      `)
      .eq('role', 'STAFF')
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const workloadData = await Promise.all(
      (staffWorkload || []).map(async (staff) => {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, status, ticket_number, created_at')
          .eq('assigned_to', staff.id)
          .in('status', ['OPEN', 'IN_PROGRESS', 'RESOLVED']);

        const openCount = tickets?.filter(t => t.status === 'OPEN').length || 0;
        const inProgressCount = tickets?.filter(t => t.status === 'IN_PROGRESS').length || 0;
        const resolvedCount = tickets?.filter(t => t.status === 'RESOLVED').length || 0;
        const totalActive = openCount + inProgressCount + resolvedCount;

        return {
          staff_id: staff.id,
          staff_name: staff.full_name,
          staff_username: staff.username,
          open_tickets: openCount,
          in_progress_tickets: inProgressCount,
          resolved_tickets: resolvedCount,
          total_active_tickets: totalActive,
          tickets: tickets || [],
        };
      })
    );

    return NextResponse.json(workloadData, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    return createErrorResponse('FETCH_WORKLOAD_FAILED', err.message || 'Gagal mengambil data beban kerja', 500);
  }
}
