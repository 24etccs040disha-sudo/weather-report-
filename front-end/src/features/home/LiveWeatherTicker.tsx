/**
 * Live Social Weather Ticker - bottom marquee of #IMD and weather hashtag
 * captures flowing across the dashboard. X-factor #1: makes "collecting
 * real-time weather info tagged #IMD" (PS line 2) visible as a live stream.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface TickItem {
  id: string;
  handle: string;
  text: string;
  hashtag: string;
  source: string;
  capturedAt: string;
}

// Adapter-compatible seed payloads so demo renders even with no live source.
const SEED: TickItem[] = [
  { id: 't1', handle: '@imd_mumbai', text: 'Heavy rainfall alert: Kurla & Andheri may see 100mm in 6h#MumbaiRains', hashtag: '#MumbaiRains', source: 'X', capturedAt: new Date().toISOString() },
  { id: 't2', handle: '@kdma_delhi', text: 'Strong winds + dust predicted across Delhi NCR tonight #IMD', hashtag: '#IMD', source: 'Mastodon', capturedAt: new Date().toISOString() },
  { id: 't3', handle: '@chennai_rr', text: 'Water level rising at Adyar river near Kotturpuram #ChennaiFlood', hashtag: '#ChennaiFlood', source: 'X', capturedAt: new Date().toISOString() },
  { id: 't4', handle: '@bengaluru_weather', text: 'Unseasonal thunderstorm approaching Bengaluru outskirts #KarnatakaRains', hashtag: '#KarnatakaRains', source: 'GDELT', capturedAt: new Date().toISOString() },
  { id: 't5', handle: '@imd_lko', text: 'Fog likely in Lucknow, Kanpur, Varanasi between 11pm-9am #IMD', hashtag: '#IMD', source: 'Mastodon', capturedAt: new Date().toISOString() },
];

const TICK_INTERVAL_MS = 4000;

export const LiveWeatherTicker: React.FC<{ items?: TickItem[] }> = ({ items }) => {
  const [ticks, setTicks] = useState<TickItem[]>(items ?? SEED);
  const idxRef = useRef(0);

  // Simulate stream arrival; replace with WS/SSE in prod.
  useEffect(() => {
    if (items && items.length) {
      setTicks(items);
      return;
    }
    const id = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % SEED.length;
      const next = { ...SEED[idxRef.current], id: `t-${Date.now()}` };
      setTicks((prev) => [next, ...prev].slice(0, 5));
    }, TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [items]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Live #{'#IMD'} Social Weather Capture
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
          STREAMING
        </span>
      </div>
      <div className="flex flex-col gap-1 p-2 text-xs">
        {ticks.slice(0, 4).map((t, i) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
              i % 2 ? 'bg-slate-50' : 'bg-white'
            }`}
          >
            <span className="font-semibold text-slate-700">{t.handle}</span>
            <span className="truncate text-slate-500">{t.text}</span>
            <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              {t.hashtag}
            </span>
            <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
              {t.source}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};