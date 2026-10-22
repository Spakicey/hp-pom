export type ServiceType = 'walk' | 'drop-in';
export type VisitStatus = 'draft' | 'active' | 'completed';
export type GpsStatus = 'idle' | 'requesting' | 'tracking' | 'error' | 'unsupported';

export interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  accuracy: number;
}

export type CareKey = 'pee' | 'poop' | 'water' | 'food' | 'medication';
export type CareChecklist = Record<CareKey, boolean>;

export interface VisitPhoto {
  id: string;
  name: string;
  url: string;
}

export interface Visit {
  id: string;
  clientName: string;
  dogName: string;
  serviceType: ServiceType;
  status: VisitStatus;
  startedAt: string | null;
  endedAt: string | null;
  routePoints: RoutePoint[];
  notes: string;
  checklist: CareChecklist;
  photos: VisitPhoto[];
  isSample: boolean;
}
