import type { CareKey, RoutePoint, Visit } from './types';

export const CARE_LABELS: Record<CareKey, string> = {
  pee: 'Pee break',
  poop: 'Poop break',
  water: 'Fresh water',
  food: 'Food given',
  medication: 'Medication',
};

export function createVisit(): Visit {
  return {
    id: crypto.randomUUID(),
    clientName: '',
    dogName: '',
    serviceType: 'walk',
    status: 'draft',
    startedAt: null,
    endedAt: null,
    routePoints: [],
    notes: '',
    checklist: { pee: false, poop: false, water: false, food: false, medication: false },
    photos: [],
    isSample: false,
  };
}

export function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function distanceMeters(points: RoutePoint[]): number {
  return points.slice(1).reduce((total, point, index) => total + haversineMeters(points[index], point), 0);
}

export function formatDistance(meters: number): string {
  if (meters >= 1609.344) return `${(meters / 1609.344).toFixed(2)} mi`;
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remaining = safeSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`;
}

export function getDurationSeconds(visit: Visit, now = Date.now()): number {
  if (!visit.startedAt) return 0;
  const start = new Date(visit.startedAt).getTime();
  const end = visit.endedAt ? new Date(visit.endedAt).getTime() : now;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatDate(value: string | null): string {
  if (!value) return 'Not started';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function escapeCsv(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function visitToCsv(visit: Visit): string {
  const headers = [
    'visit_id', 'client_name', 'dog_name', 'service_type', 'status', 'start_time', 'end_time',
    'duration_seconds', 'duration_minutes', 'distance_meters', 'distance_miles', 'gps_points',
    'pee_break', 'poop_break', 'water_refilled', 'food_given', 'medication_given', 'notes', 'sample_data',
  ];
  const seconds = getDurationSeconds(visit);
  const meters = distanceMeters(visit.routePoints);
  const values = [
    visit.id, visit.clientName, visit.dogName, visit.serviceType, visit.status, visit.startedAt, visit.endedAt,
    seconds, Math.round(seconds / 60), Math.round(meters), (meters / 1609.344).toFixed(3), visit.routePoints.length,
    visit.checklist.pee, visit.checklist.poop, visit.checklist.water, visit.checklist.food, visit.checklist.medication,
    visit.notes, visit.isSample,
  ];
  return `${headers.join(',')}\r\n${values.map(escapeCsv).join(',')}\r\n`;
}

export function routeToGpx(visit: Visit): string {
  const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dogName = escapeXml(visit.dogName || 'Dog walk');
  const trackPoints = visit.routePoints.map((point) => `      <trkpt lat="${point.lat}" lon="${point.lng}"><time>${point.timestamp}</time><extensions><accuracy>${point.accuracy}</accuracy></extensions></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Pawprint Visit Cards" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${dogName}</name><trkseg>\n${trackPoints}\n  </trkseg></trk>\n</gpx>\n`;
}

export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function safeFilename(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'visit';
}
