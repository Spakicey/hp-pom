import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RoutePoint } from '../types';

interface RouteMapProps {
  points: RoutePoint[];
  className?: string;
  sample?: boolean;
}

const SAMPLE_CENTER: L.LatLngExpression = [35.2271, -80.8431];

export function RouteMap({ points, className = '', sample = false }: RouteMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => {
    if (!elementRef.current || mapRef.current) return;
    const map = L.map(elementRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView(SAMPLE_CENTER, 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      crossOrigin: true,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    layerRef.current = L.featureGroup().addTo(map);
    mapRef.current = map;
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(elementRef.current);
    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (points.length === 0) {
      map.setView(SAMPLE_CENTER, 14);
      return;
    }
    const latLngs = points.map((point) => L.latLng(point.lat, point.lng));
    if (latLngs.length > 1) {
      L.polyline(latLngs, { color: '#267a5b', weight: 5, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
    }
    const startIcon = L.divIcon({ className: 'route-pin route-pin-start', html: '<span></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
    const endIcon = L.divIcon({ className: 'route-pin route-pin-end', html: '<span></span>', iconSize: [20, 20], iconAnchor: [10, 10] });
    L.marker(latLngs[0], { icon: startIcon }).bindTooltip('Start', { direction: 'top' }).addTo(layer);
    if (latLngs.length > 1) L.marker(latLngs[latLngs.length - 1], { icon: endIcon }).bindTooltip('Latest location', { direction: 'top' }).addTo(layer);
    if (latLngs.length > 1) map.fitBounds(L.latLngBounds(latLngs).pad(0.18), { maxZoom: 17 });
    else map.setView(latLngs[0], 16);
  }, [points]);

  return <div ref={elementRef} className={`route-map ${className}`} aria-label={sample ? 'Sample walking route map' : 'Recorded walking route map'} />;
}
