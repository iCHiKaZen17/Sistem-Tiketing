CREATE OR REPLACE FUNCTION search_tickets(
  p_user_id uuid, p_role text, p_status text DEFAULT NULL, p_app_name text DEFAULT NULL,
  p_assigned_to uuid DEFAULT NULL, p_date_from timestamptz DEFAULT NULL, p_date_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0
) RETURNS TABLE(id uuid, ticket_number varchar, reporter_name varchar, app_name varchar,
  error_desc_summary text, status ticket_status, created_at timestamptz, assigned_to_name varchar, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT t.id, t.ticket_number, r.name, t.app_name, left(t.error_desc,150), t.status, t.created_at,
    u.full_name, count(*) OVER()
  FROM tickets t JOIN reporters r ON r.id=t.reporter_id LEFT JOIN users u ON u.id=t.assigned_to
  WHERE (p_role='SUPERVISOR' OR t.assigned_to IS NULL OR t.assigned_to=p_user_id)
    AND (p_status IS NULL OR t.status::text=p_status)
    AND (p_app_name IS NULL OR t.app_name ILIKE '%'||p_app_name||'%')
    AND (p_role<>'SUPERVISOR' OR p_assigned_to IS NULL OR t.assigned_to=p_assigned_to)
    AND (p_date_from IS NULL OR t.created_at>=p_date_from)
    AND (p_date_to IS NULL OR t.created_at<=p_date_to)
    AND (p_search IS NULL OR t.ticket_number ILIKE '%'||p_search||'%' OR r.name ILIKE '%'||p_search||'%'
      OR t.error_desc ILIKE '%'||p_search||'%' OR t.app_name ILIKE '%'||p_search||'%' OR u.full_name ILIKE '%'||p_search||'%')
  ORDER BY t.created_at DESC LIMIT LEAST(p_limit,100) OFFSET GREATEST(p_offset,0);
$$;
REVOKE ALL ON FUNCTION search_tickets(uuid,text,text,text,uuid,timestamptz,timestamptz,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION search_tickets(uuid,text,text,text,uuid,timestamptz,timestamptz,text,integer,integer) TO service_role;
