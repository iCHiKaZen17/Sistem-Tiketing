'use client';
import { useEffect, useRef, useState } from 'react';

export function useTicketEvents(onChange: () => void) {
  const callback = useRef(onChange);
  const [connected, setConnected] = useState(true);
  callback.current = onChange;
  useEffect(() => {
    const events = new EventSource('/api/v1/events');
    let fallback: ReturnType<typeof setInterval> | undefined;
    events.addEventListener('ready', () => { setConnected(true); if (fallback) clearInterval(fallback); });
    events.addEventListener('change', () => callback.current());
    events.onerror = () => {
      setConnected(false);
      if (!fallback) fallback = setInterval(() => callback.current(), 30000);
    };
    return () => { events.close(); if (fallback) clearInterval(fallback); };
  }, []);
  return connected;
}
