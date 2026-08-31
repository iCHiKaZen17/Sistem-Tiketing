import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/get-user';
import { createAdminClient } from '@/lib/supabase/server';
import { log } from '@/lib/observability/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let activeStreams = 0;

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return new Response('Unauthorized', { status: 401 });
  const encoder = new TextEncoder();
  let lastVersion = '';
  let timer: ReturnType<typeof setInterval>;
  let release = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let released = false;
      activeStreams++;
      log('info', 'sse_connected', { userId: user.id, activeStreams });
      release = () => {
        if (released) return;
        released = true;
        activeStreams = Math.max(0, activeStreams - 1);
        log('info', 'sse_disconnected', { userId: user.id, activeStreams });
      };
      const fail = (error: unknown) => {
        clearInterval(timer);
        log('error', 'sse_stream_failed', { userId: user.id, message: error instanceof Error ? error.message : String(error) });
        release();
        try { controller.error(new Error('Event stream failed')); } catch {}
      };
      const check = async () => {
        const supabase = createAdminClient();
        let ticketQuery = supabase.from('tickets').select('updated_at').order('updated_at', { ascending: false }).limit(1);
        if (user.role === 'STAFF') ticketQuery = ticketQuery.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
        const [tickets, notifications] = await Promise.all([
          ticketQuery,
          supabase.from('notifications').select('created_at,is_read').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
        ]);
        if (tickets.error || notifications.error) throw new Error(tickets.error?.message || notifications.error?.message);
        const version = `${tickets.data?.[0]?.updated_at || ''}:${notifications.data?.[0]?.created_at || ''}:${notifications.data?.[0]?.is_read || false}`;
        if (lastVersion && version !== lastVersion) controller.enqueue(encoder.encode(`event: change\ndata: ${JSON.stringify({ version })}\n\n`));
        lastVersion = version;
      };
      controller.enqueue(encoder.encode('event: ready\ndata: {}\n\n'));
      check().catch(fail);
      timer = setInterval(() => check().catch(fail), 3000);
      request.signal.addEventListener('abort', () => { clearInterval(timer); release(); try { controller.close(); } catch {} });
    },
    cancel() { clearInterval(timer); release(); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}
