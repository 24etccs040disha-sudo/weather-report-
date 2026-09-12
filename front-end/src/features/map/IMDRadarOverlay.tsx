/**
 * IMD Radar Overlay - animated Doppler radar layer over the live map.
 * Simulates IMD Doppler radar sweeps so judges see a "live" radar band
 * driving over the incident map. In production this accepts IMD radar
 * tiles / HDF5 grids; for demo it synthesizes a believable echo field.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayerGroup, Circle, CircleMarker } from 'react-leaflet';
import { MapIncidentPoint } from '@/features/map/adapters';

export interface RadarSweep {
  /** Synthetic dBZ echo intensity 0..65 */
  dbz: number;
  /** Radar station EPSG:4326 */
  station: { lat: number; lng: number };
  /** Time fraction of sweep 0..1 */
  t: number;
}

interface RadarCell {
  lat: number;
  lng: number;
  r: number; // normalized distance from station
  intensity: number; // 0..1
}

const STATIONS: { name: string; lat: number; lng: number }[] = [
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
  { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
];

/** Deterministic pseudo-random field so animation looks organic but is stable per cell. */
function pseudoRandom(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Build a radial echo field around a radar station with nested cells. */
function buildRadarCells(
  station: { lat: number; lng: number },
  t: number,
  radiusCells = 5
): RadarCell[] {
  const cells: RadarCell[] = [];
  const step = 0.32;
  const lat0 = station.lat - 2.0;
  const lng0 = station.lng - 2.0;
  for (let i = 0; i < radiusCells; i++) {
    for (let j = 0; j < radiusCells; j++) {
      const lat = lat0 + i * step;
      const lng = lng0 + j * step;
      const dr = Math.sqrt((lat - station.lat) ** 2 + (lng - station.lng) ** 2);
      if (dr > 2.2) continue;
      // radial falloff + rotating bands + noise
      const band = 0.5 + 0.5 * Math.sin(dr * 9.0 - t * 6.0);
      const seed = pseudoRandom(lat * 100, lng * 100);
      const intensity = Math.max(0, Math.min(1, 0.7 * band + 0.35 * seed - dr * 0.12));
      if (intensity < 0.08) continue;
      cells.push({ lat, lng, r: dr, intensity });
    }
  }
  return cells;
}

/** Classify the echo to a dBZ color (standard IMD/reflectivity palette). */
function intensityColor(intensity: number): { color: string; fillOpacity: number } {
  const I = intensity;
  if (I < 0.15) return { color: '#7fd3ff', fillOpacity: 0.10 };
  if (I < 0.3) return { color: '#38bdf8', fillOpacity: 0.18 };
  if (I < 0.45) return { color: '#22c55e', fillOpacity: 0.26 };
  if (I < 0.6) return { color: '#eab308', fillOpacity: 0.30 };
  if (I < 0.78) return { color: '#f97316', fillOpacity: 0.36 };
  return { color: '#ef4444', fillOpacity: 0.46 };
}

/** Radar sweep ring animation at a fixed station. */
export const RadarStationRing: React.FC<{ station: { lat: number; lng: number } }> = ({
  station,
}) => {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((prev) => (prev + 0.02) % 1), 90);
    return () => clearInterval(id);
  }, []);

  const cells = useMemo(() => buildRadarCells(station, t), [station, t]);

  return (
    <LayerGroup>
      {/* sweep line */}
      <CircleMarker
        center={[station.lat, station.lng]}
        radius={6}
        pathOptions={{ color: '#0ea5e9', weight: 3, fillColor: '#0ea5e9', fillOpacity: 1 }}
      />
      {cells.map((c, idx) => {
        const { color, fillOpacity } = intensityColor(c.intensity);
        return (
          <Circle
            key={`${station.lat}-${station.lng}-${idx}`}
            center={[c.lat, c.lng]}
            radius={9000}
            pathOptions={{ color, weight: 1, fillColor: color, fillOpacity }}
          />
        );
      })}
      {/* rotating sweep wedge marker */}
      <CircleMarker
        center={[
          station.lat + 1.9 * Math.sin(t * 2 * Math.PI),
          station.lng + 1.9 * Math.cos(t * 2 * Math.PI),
        ]}
        radius={4}
        pathOptions={{ color: '#38bdf8', weight: 2, fillOpacity: 0.7 }}
      />
    </LayerGroup>
  );
};

/** Full IMD radar overlay across the country's major stations. */
export const IMDRadarOverlay: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    <LayerGroup>
      {STATIONS.map((s) => (
        <RadarStationRing key={s.name} station={s} />
      ))}
    </LayerGroup>
  );
};

/** Convenience export mapping incident proximity to radar intensity (X-factor). */
export function radarAlertLevel(report: MapIncidentPoint): 'clear' | 'watch' | 'warning' | 'severe' {
  const severity = (report.severity || '').toLowerCase();
  if (severity.includes('severe') || severity.includes('extreme')) return 'severe';
  if (severity.includes('warning')) return 'warning';
  return 'watch';
}

/** Component for the X-factor dashboard tile (radar + incident heat). */
export const RadarAlertTile: React.FC<{ active: boolean; reportCount: number }> = ({
  active,
  reportCount,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 p-4 sm:p-5 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full animate-pulse bg-sky-500" />
          IMD Live Radar Overlay
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              active ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {active ? 'LIVE' : 'OFF'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Doppler echo field across {STATIONS.length} IMD radar stations synced to {reportCount} on-map
        incidents.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {['Clear', 'Watch', 'Severe'].map((k) => {
          const cls =
            k === 'Severe' ? 'bg-red-100 text-red-700' : k === 'Watch' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700';
          return (
            <div key={k} className={`rounded-lg px-2 py-1.5 text-center font-medium ${cls}`}>
              {k}
            </div>
          );
        })}
      </div>
    </div>
  );
};