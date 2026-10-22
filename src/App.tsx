import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, CircleHelp, Clock3, Download,
  Footprints, Heart, House, Info, MapPin, Navigation, PawPrint, Plus, RefreshCw,
  Share2, Sparkles, Timer, Trash2, Upload, Wind, X,
} from 'lucide-react';
import { RouteMap } from './components/RouteMap';
import type { CareKey, GpsStatus, RoutePoint, Visit } from './types';
import {
  CARE_LABELS, createVisit, distanceMeters, downloadText, formatDate, formatDuration,
  formatTime, getDurationSeconds, routeToGpx, safeFilename, visitToCsv,
} from './utils';

const careOrder: CareKey[] = ['pee', 'poop', 'water', 'food', 'medication'];

type Screen = 'visit' | 'report';

function App() {
  const [visit, setVisit] = useState<Visit>(createVisit);
  const [screen, setScreen] = useState<Screen>('visit');
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [gpsMessage, setGpsMessage] = useState('');
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const isActive = visit.status === 'active';
  const elapsedSeconds = useMemo(() => getDurationSeconds(visit, now), [visit, now]);
  const distance = useMemo(() => distanceMeters(visit.routePoints), [visit.routePoints]);

  useEffect(() => {
    if (!isActive) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) navigator.geolocation.clearWatch(watchIdRef.current);
      if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
      visit.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
    // The cleanup intentionally runs only when the app unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setToast(''), 2800);
  }, []);

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const addRoutePoint = useCallback((point: RoutePoint) => {
    setVisit((current) => {
      if (current.status !== 'active' || current.serviceType !== 'walk') return current;
      const lastPoint = current.routePoints[current.routePoints.length - 1];
      if (lastPoint) {
        const latDelta = point.lat - lastPoint.lat;
        const lngDelta = point.lng - lastPoint.lng;
        const roughMeters = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111_000;
        const secondsApart = (new Date(point.timestamp).getTime() - new Date(lastPoint.timestamp).getTime()) / 1000;
        // Ignore near-identical readings unless enough time has elapsed to be useful.
        if (roughMeters < 3 && secondsApart < 12) return current;
      }
      return { ...current, routePoints: [...current.routePoints, point] };
    });
  }, []);

  const startGpsTracking = useCallback(() => {
    stopGpsTracking();
    setGpsMessage('');
    if (!('geolocation' in navigator)) {
      setGpsStatus('unsupported');
      setGpsMessage('This browser does not support GPS tracking. You can still complete the visit and add the details manually.');
      return;
    }
    if (!window.isSecureContext) {
      setGpsStatus('error');
      setGpsMessage('GPS needs a secure HTTPS page. Open this site from GitHub Pages or Vercel, rather than a local network address.');
      return;
    }
    setGpsStatus('requesting');
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsStatus('tracking');
        setGpsMessage('GPS is recording in this browser while it remains active. Keep the screen awake for the most reliable track.');
        addRoutePoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: new Date(position.timestamp || Date.now()).toISOString(),
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setGpsStatus('error');
        if (error.code === 1) {
          setGpsMessage('Location permission was denied. Enable location for this site in iPhone Settings or Safari settings, then retry GPS.');
        } else if (error.code === 2) {
          setGpsMessage('The phone could not get a location fix. Move somewhere with a clearer view of the sky, then retry.');
        } else {
          setGpsMessage('GPS took too long to respond. The visit timer is still running; you can retry GPS at any time.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 2500, timeout: 20000 },
    );
    watchIdRef.current = watchId;
  }, [addRoutePoint, stopGpsTracking]);

  const updateVisit = <K extends keyof Visit>(key: K, value: Visit[K]) => {
    setVisit((current) => ({ ...current, [key]: value }));
  };

  const handleStartVisit = () => {
    if (!visit.dogName.trim()) {
      showToast('Add the dog’s name first.');
      return;
    }
    const startedAt = new Date().toISOString();
    setVisit((current) => ({ ...current, status: 'active', startedAt, endedAt: null }));
    setNow(Date.now());
    setScreen('visit');
    if (visit.serviceType === 'walk') startGpsTracking();
    else {
      setGpsStatus('idle');
      setGpsMessage('Drop-in visits do not record a GPS route.');
    }
  };

  const handleFinishVisit = () => {
    const endedAt = new Date().toISOString();
    stopGpsTracking();
    setVisit((current) => ({ ...current, status: 'completed', endedAt }));
    setGpsStatus('idle');
    setGpsMessage('Visit complete. Review the card before sharing it with the client.');
    setNow(Date.now());
    setScreen('report');
    showToast('Visit completed. Your report is ready.');
  };

  const handleNewVisit = () => {
    if (isActive && !window.confirm('This visit is still in progress. Discard it and start a new visit? The current visit will no longer be available in memory.')) return;
    stopGpsTracking();
    visit.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setVisit(createVisit());
    setGpsStatus('idle');
    setGpsMessage('');
    setScreen('visit');
    setNow(Date.now());
    showToast('Ready for a new visit. Export the previous visit first if you need a record.');
  };

  const handleChecklistToggle = (key: CareKey) => {
    setVisit((current) => ({ ...current, checklist: { ...current.checklist, [key]: !current.checklist[key] } }));
  };

  const handlePhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    const spaceLeft = Math.max(0, 6 - visit.photos.length);
    const chosen = imageFiles.slice(0, spaceLeft);
    if (imageFiles.length > spaceLeft) showToast('A report can include up to 6 photos.');
    setVisit((current) => ({
      ...current,
      photos: [...current.photos, ...chosen.map((file) => ({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }))],
    }));
    if (chosen.length) showToast(`${chosen.length} photo${chosen.length === 1 ? '' : 's'} added.`);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    const photo = visit.photos.find((item) => item.id === id);
    if (photo) URL.revokeObjectURL(photo.url);
    setVisit((current) => ({ ...current, photos: current.photos.filter((item) => item.id !== id) }));
  };

  const handleCsvExport = () => {
    if (visit.status === 'draft') {
      showToast('Start or complete the visit before exporting it.');
      return;
    }
    downloadText(`${safeFilename(visit.dogName)}-${visit.id.slice(0, 8)}.csv`, visitToCsv(visit), 'text/csv;charset=utf-8');
    showToast('Visit CSV exported. Save it in Files to keep a copy.');
  };

  const handleGpxExport = () => {
    if (visit.routePoints.length < 2) {
      showToast('Record at least two GPS points before exporting a route.');
      return;
    }
    downloadText(`${safeFilename(visit.dogName)}-${visit.id.slice(0, 8)}.gpx`, routeToGpx(visit), 'application/gpx+xml;charset=utf-8');
    showToast('GPS route exported as GPX.');
  };

  const loadSampleVisit = () => {
    stopGpsTracking();
    visit.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    const start = new Date();
    start.setHours(10, 15, 0, 0);
    const end = new Date(start.getTime() + 27 * 60 * 1000);
    const routeCoords: Array<[number, number]> = [
      [35.2271, -80.8431], [35.228, -80.8424], [35.2287, -80.841], [35.229, -80.8398],
      [35.2282, -80.8388], [35.2272, -80.8392], [35.2264, -80.8403], [35.2268, -80.8415],
      [35.2278, -80.842], [35.2271, -80.8431],
    ];
    const sample: Visit = {
      ...createVisit(),
      clientName: 'The Smith family',
      dogName: 'Cooper',
      serviceType: 'walk',
      status: 'completed',
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      routePoints: routeCoords.map(([lat, lng], index) => ({ lat, lng, timestamp: new Date(start.getTime() + index * 3 * 60 * 1000).toISOString(), accuracy: 8 + (index % 3) * 4 })),
      notes: 'Cooper had a lovely walk today! We enjoyed some sniffing time and found a shady spot to take a short water break. He came back happy and ready for a nap.',
      checklist: { pee: true, poop: true, water: true, food: false, medication: false },
      isSample: true,
    };
    setVisit(sample);
    setGpsStatus('idle');
    setGpsMessage('This is a sample report with a fictional route, not real GPS data.');
    setNow(Date.now());
    setScreen('report');
    showToast('Sample report loaded. All data is fictional.');
  };

  const goToReport = () => {
    if (visit.status === 'draft') {
      showToast('Start a visit first, or load the sample report.');
      return;
    }
    setScreen('report');
  };

  const shareSummary = async () => {
    const service = visit.serviceType === 'walk' ? 'Walk' : 'Drop-in visit';
    const summary = `${service} report for ${visit.dogName || 'your pet'}\nDate: ${formatDate(visit.startedAt)}\nDuration: ${formatDuration(getDurationSeconds(visit))}${visit.serviceType === 'walk' ? `\nDistance: ${(distance / 1609.344).toFixed(2)} miles` : ''}\n\n${visit.notes || 'Thanks for trusting me with your pet!'}\n\n${visit.isSample ? 'Sample report — fictional data.' : 'Created with Pawprint Visit Cards.'}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${visit.dogName || 'Pet'} visit report`, text: summary });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
        showToast('Summary copied. Paste it into your message.');
      } else {
        window.prompt('Copy this visit summary:', summary);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') showToast('Unable to open the share sheet. Use Print / Save PDF instead.');
    }
  };

  const printReport = () => {
    if (visit.status === 'draft') {
      showToast('Start a visit or load the sample report first.');
      return;
    }
    window.print();
  };

  const isSample = visit.isSample;
  const routeIsEmpty = visit.routePoints.length === 0;
  const statusLabel = isSample ? 'SAMPLE' : visit.status === 'active' ? 'IN PROGRESS' : visit.status === 'completed' ? 'COMPLETED' : 'NEW VISIT';

  return (
    <div className="app-shell">
      <header className="app-header no-print">
        <div className="brand-lockup">
          <div className="brand-mark"><PawPrint size={21} strokeWidth={2.4} /></div>
          <div>
            <div className="brand-name">pawprint<span>.</span></div>
            <div className="brand-subtitle">little moments, well cared for</div>
          </div>
        </div>
        <div className={`privacy-pill ${isActive ? 'is-active' : ''}`}><span className="privacy-dot" />{isActive ? 'Visit live' : 'On this device'}</div>
      </header>

      <main className="main-content">
        <div className="page-intro no-print">
          <div>
            <div className="eyebrow">VISIT CARD STUDIO <span className="eyebrow-line" /></div>
            <h1>{screen === 'visit' ? (isActive ? 'You’re out and about.' : 'Let’s make a card.') : 'A little visit recap.'}</h1>
            <p>{screen === 'visit' ? (isActive ? 'Capture the little details as you go.' : 'A thoughtful update for their favorite human.') : 'Check everything looks right before you send it.'}</p>
          </div>
          <div className={`status-chip status-${visit.status}`}><span className="status-dot" />{statusLabel}</div>
        </div>

        <nav className="step-tabs no-print" aria-label="Visit workflow">
          <button type="button" className={`step-tab ${screen === 'visit' ? 'selected' : ''}`} onClick={() => setScreen('visit')}>
            <span className="step-number">1</span><span>Visit details</span>
          </button>
          <div className="step-connector" />
          <button type="button" className={`step-tab ${screen === 'report' ? 'selected' : ''}`} onClick={goToReport}>
            <span className="step-number">2</span><span>Card preview</span>
          </button>
        </nav>

        {screen === 'visit' ? (
          <div className="visit-layout">
            <section className="panel details-panel">
              <div className="panel-heading">
                <div className="panel-icon"><PawPrint size={19} /></div>
                <div><h2>Who’s the lucky pup?</h2><p>Just the basics to get started.</p></div>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Dog’s name <span className="required">*</span></span>
                  <input value={visit.dogName} onChange={(event) => updateVisit('dogName', event.target.value)} placeholder="e.g. Cooper" autoComplete="off" disabled={isActive || visit.status === 'completed'} />
                </label>
                <label className="field">
                  <span>Pet parent / client</span>
                  <input value={visit.clientName} onChange={(event) => updateVisit('clientName', event.target.value)} placeholder="e.g. The Smith family" autoComplete="off" disabled={isActive || visit.status === 'completed'} />
                </label>
              </div>

              <div className="field service-field">
                <span className="field-label">What are we doing today?</span>
                <div className="service-options" role="group" aria-label="Service type">
                  <button type="button" className={`service-option ${visit.serviceType === 'walk' ? 'selected' : ''}`} onClick={() => updateVisit('serviceType', 'walk')} disabled={isActive || visit.status === 'completed'}>
                    <span className="service-option-icon"><Footprints size={20} /></span>
                    <span><strong>Walk</strong><small>GPS route + distance</small></span>
                    {visit.serviceType === 'walk' && <Check size={17} className="service-check" />}
                  </button>
                  <button type="button" className={`service-option ${visit.serviceType === 'drop-in' ? 'selected' : ''}`} onClick={() => updateVisit('serviceType', 'drop-in')} disabled={isActive || visit.status === 'completed'}>
                    <span className="service-option-icon"><House size={20} /></span>
                    <span><strong>Drop-in</strong><small>Care notes, no route</small></span>
                    {visit.serviceType === 'drop-in' && <Check size={17} className="service-check" />}
                  </button>
                </div>
              </div>

              <div className={`timer-panel ${isActive ? 'timer-running' : ''}`}>
                <div className="timer-topline">
                  <span className="timer-label"><Timer size={16} /> VISIT TIMER</span>
                  {isActive && <span className="recording-label"><span className="recording-pulse" /> LIVE</span>}
                  {visit.status === 'completed' && <span className="done-label"><CheckCircle2 size={14} /> Finished</span>}
                </div>
                <div className="timer-main-row">
                  <div>
                    <div className="timer-value">{formatDuration(elapsedSeconds)}</div>
                    <div className="timer-caption">{visit.startedAt ? `${formatTime(visit.startedAt)}${visit.endedAt ? ` — ${formatTime(visit.endedAt)}` : ' · in progress'}` : 'Your time starts when you begin.'}</div>
                  </div>
                  {!isActive && visit.status === 'draft' && (
                    <button type="button" className="button button-primary start-button" onClick={handleStartVisit}>
                      Start visit <ArrowRight size={17} />
                    </button>
                  )}
                  {isActive && (
                    <button type="button" className="button button-danger" onClick={handleFinishVisit}>
                      Finish visit <Check size={17} />
                    </button>
                  )}
                  {visit.status === 'completed' && (
                    <button type="button" className="button button-secondary" onClick={() => setScreen('report')}>View card <ArrowRight size={16} /></button>
                  )}
                </div>
              </div>
              {visit.serviceType === 'walk' && (
                <div className="gps-status-row">
                  <div className={`gps-status-icon gps-${gpsStatus}`}><Navigation size={16} /></div>
                  <div className="gps-copy">
                    <strong>{gpsStatus === 'tracking' ? 'Route recording' : gpsStatus === 'requesting' ? 'Finding your location…' : gpsStatus === 'error' || gpsStatus === 'unsupported' ? 'GPS needs attention' : visit.status === 'completed' ? 'Route saved with this visit' : 'Map your walk'}</strong>
                    <span>{gpsStatus === 'tracking' ? `${visit.routePoints.length} GPS point${visit.routePoints.length === 1 ? '' : 's'} recorded` : gpsMessage || 'GPS starts when you begin the visit. Allow location access when prompted.'}</span>
                  </div>
                  {isActive && gpsStatus !== 'tracking' && <button type="button" className="text-button" onClick={startGpsTracking}><RefreshCw size={14} /> Retry</button>}
                </div>
              )}
            </section>

            <section className="panel route-panel">
              <div className="panel-heading panel-heading-spread">
                <div className="heading-cluster"><div className="panel-icon panel-icon-map"><MapPin size={19} /></div><div><h2>The walk, mapped.</h2><p>{visit.serviceType === 'walk' ? 'Your GPS trail appears here.' : 'No map needed for a drop-in.'}</p></div></div>
                {visit.serviceType === 'walk' && visit.routePoints.length > 1 && <span className="distance-badge">{(distance / 1609.344).toFixed(2)} mi</span>}
              </div>
              {visit.serviceType === 'walk' ? (
                <div className="map-wrap">
                  {routeIsEmpty && <div className="map-empty-overlay"><div className="map-empty-icon"><MapPin size={21} /></div><strong>Your route will show up here</strong><span>Start a walk and allow location access.</span></div>}
                  <RouteMap points={visit.routePoints} sample={isSample} />
                </div>
              ) : (
                <div className="dropin-map-placeholder"><div className="dropin-icon"><House size={23} /></div><strong>Home base</strong><span>Drop-in visits focus on care details, not distance.</span></div>
              )}
              <div className="map-footer"><span><span className={`map-status-dot ${gpsStatus === 'tracking' ? 'map-status-live' : ''}`} />{gpsStatus === 'tracking' ? 'Recording route' : visit.routePoints.length ? `${visit.routePoints.length} points in route` : 'Route not started'}</span><span>Map data © OpenStreetMap</span></div>
            </section>

            <section className="panel care-panel">
              <div className="panel-heading">
                <div className="panel-icon panel-icon-care"><Heart size={19} /></div>
                <div><h2>The care checklist</h2><p>Tap anything you took care of.</p></div>
                <span className="optional-label">OPTIONAL</span>
              </div>
              <div className="checklist-grid">
                {careOrder.map((key) => (
                  <button type="button" key={key} className={`checklist-item ${visit.checklist[key] ? 'checked' : ''}`} onClick={() => handleChecklistToggle(key)}>
                    <span className="check-box">{visit.checklist[key] && <Check size={14} strokeWidth={3} />}</span>
                    <span>{CARE_LABELS[key]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel notes-panel">
              <div className="panel-heading">
                <div className="panel-icon panel-icon-notes"><Wind size={19} /></div>
                <div><h2>A little note</h2><p>What would their human love to know?</p></div>
                <span className="optional-label">OPTIONAL</span>
              </div>
              <textarea className="notes-input" value={visit.notes} onChange={(event) => updateVisit('notes', event.target.value)} placeholder="Cooper had a great walk today! We found a shady path and took a little water break…" rows={4} />
              <div className="character-count">{visit.notes.length} characters</div>
            </section>

            <section className="panel photos-panel">
              <div className="panel-heading panel-heading-spread">
                <div className="heading-cluster"><div className="panel-icon panel-icon-photos"><Camera size={19} /></div><div><h2>Photo moments</h2><p>A picture is worth a thousand tail wags.</p></div></div>
                <span className="photo-count">{visit.photos.length}/6</span>
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="visually-hidden" onChange={(event) => handlePhotos(event.target.files)} />
              {visit.photos.length > 0 && (
                <div className="photo-grid">
                  {visit.photos.map((photo) => <div className="photo-thumb" key={photo.id}><img src={photo.url} alt={photo.name} /><button type="button" aria-label={`Remove ${photo.name}`} onClick={() => removePhoto(photo.id)}><X size={15} /></button></div>)}
                </div>
              )}
              <button type="button" className="photo-upload" onClick={() => photoInputRef.current?.click()} disabled={visit.photos.length >= 6}>
                <span className="upload-icon"><Plus size={18} /></span><span><strong>{visit.photos.length ? 'Add another photo' : 'Add photos'}</strong><small>Take a new photo or choose from your library</small></span><Upload size={18} className="upload-arrow" />
              </button>
            </section>

            <div className="bottom-actions no-print">
              {visit.status === 'draft' && <button type="button" className="button button-primary button-full" onClick={handleStartVisit}>Start {visit.serviceType === 'walk' ? 'walk' : 'visit'} <ArrowRight size={18} /></button>}
              {isActive && <button type="button" className="button button-danger button-full" onClick={handleFinishVisit}>Finish visit & build card <CheckCircle2 size={18} /></button>}
              {visit.status === 'completed' && <button type="button" className="button button-primary button-full" onClick={() => setScreen('report')}>Preview report card <ArrowRight size={18} /></button>}
              <div className="bottom-helper"><Info size={14} /> Your visit details stay in this tab’s memory until you export them.</div>
            </div>
          </div>
        ) : (
          <div className="report-layout">
            {isSample && <div className="sample-banner no-print"><Sparkles size={16} /><span><strong>Sample card</strong> — fictitious client and route, for preview only.</span></div>}
            <article className="report-card" id="print-report">
              <div className="report-top-rule" />
              <div className="report-card-header">
                <div className="report-brand"><div className="report-brand-icon"><PawPrint size={20} /></div><div><strong>pawprint<span>.</span></strong><small>VISIT REPORT</small></div></div>
                <div className={`report-stamp ${visit.status === 'completed' ? 'stamp-complete' : ''}`}>{visit.status === 'completed' ? <><CheckCircle2 size={13} /> VISIT COMPLETE</> : <><Clock3 size={13} /> IN PROGRESS</>}</div>
              </div>
              <div className="report-hero">
                <div className="report-hello">A LITTLE UPDATE FOR</div>
                <h2>{visit.clientName.trim() || 'Your favorite human'}<span>’s</span></h2>
                <div className="report-dog-line"><span className="report-dog-avatar"><PawPrint size={25} /></span><div><strong>{visit.dogName.trim() || 'Your pup'}</strong><small>{visit.serviceType === 'walk' ? 'Out for a walk' : 'Drop-in visit'} · {formatDate(visit.startedAt)}</small></div></div>
                {isSample && <div className="fictional-note">EXAMPLE DATA · NOT A REAL VISIT</div>}
              </div>

              <div className="report-stats">
                <div className="report-stat"><span className="stat-icon"><Clock3 size={17} /></span><div><strong>{formatDuration(getDurationSeconds(visit, now)).replace(/\s+\d+s$/, '')}</strong><small>DURATION</small></div></div>
                {visit.serviceType === 'walk' && <div className="report-stat"><span className="stat-icon"><Footprints size={17} /></span><div><strong>{(distance / 1609.344).toFixed(2)} mi</strong><small>DISTANCE</small></div></div>}
                <div className="report-stat"><span className="stat-icon"><Camera size={17} /></span><div><strong>{visit.photos.length}</strong><small>PHOTOS</small></div></div>
              </div>

              {visit.serviceType === 'walk' && (
                <section className="report-section report-route-section">
                  <div className="report-section-title"><span>01</span><h3>Our little adventure</h3></div>
                  {visit.routePoints.length > 0 ? <RouteMap points={visit.routePoints} sample={isSample} className="report-map" /> : <div className="report-no-route"><MapPin size={20} /><span>No GPS route was recorded for this visit.</span></div>}
                  <div className="route-caption"><span><MapPin size={13} /> {visit.routePoints.length} GPS points</span><span>{visit.routePoints.length > 1 ? 'Start → Finish' : 'Route unavailable'}</span></div>
                </section>
              )}

              <section className="report-section">
                <div className="report-section-title"><span>{visit.serviceType === 'walk' ? '02' : '01'}</span><h3>All the important bits</h3></div>
                {careOrder.some((key) => visit.checklist[key]) ? (
                  <div className="report-care-grid">
                    {careOrder.filter((key) => visit.checklist[key]).map((key) => <div className="report-care-item" key={key}><span><Check size={12} /></span>{CARE_LABELS[key]}</div>)}
                  </div>
                ) : <p className="report-muted">No care checklist items were selected.</p>}
              </section>

              <section className="report-section">
                <div className="report-section-title"><span>{visit.serviceType === 'walk' ? '03' : '02'}</span><h3>A note from me</h3></div>
                <p className="report-notes">{visit.notes.trim() || 'We had a lovely visit together. Thanks for trusting me with your best friend!'}</p>
              </section>

              {visit.photos.length > 0 && (
                <section className="report-section report-photo-section">
                  <div className="report-section-title"><span>{visit.serviceType === 'walk' ? '04' : '03'}</span><h3>Little moments</h3></div>
                  <div className="report-photo-grid">{visit.photos.map((photo) => <img key={photo.id} src={photo.url} alt={photo.name} />)}</div>
                </section>
              )}

              <footer className="report-footer"><div className="footer-paw"><PawPrint size={18} /></div><div><strong>Thanks for letting me care for {visit.dogName.trim() || 'your pup'}.</strong><span>They made my day a little brighter, too.</span></div><Heart size={17} className="footer-heart" /></footer>
            </article>

            <div className="report-actions no-print">
              <button type="button" className="button button-primary button-full" onClick={printReport}><Download size={18} /> Print / Save card as PDF</button>
              <button type="button" className="button button-secondary button-full" onClick={shareSummary}><Share2 size={18} /> Share text summary</button>
              <div className="export-actions">
                <button type="button" className="export-link" onClick={handleCsvExport}><Download size={15} /> Export visit CSV</button>
                {visit.serviceType === 'walk' && <button type="button" className="export-link" onClick={handleGpxExport}><Navigation size={15} /> Export GPS route (GPX)</button>}
              </div>
              <p className="export-help"><Info size={14} /> On iPhone, use Print / Save to make a PDF, then share or save it in Files. CSV and GPX downloads are separate data exports.</p>
              <div className="report-secondary-actions"><button type="button" className="text-button" onClick={() => setScreen('visit')}><ArrowLeft size={15} /> Back to visit</button><button type="button" className="text-button text-button-danger" onClick={handleNewVisit}><Plus size={15} /> New visit</button></div>
            </div>
          </div>
        )}

        {screen === 'visit' && (
          <div className="utility-row no-print">
            <button type="button" className="utility-button" onClick={loadSampleVisit}><Sparkles size={15} /> Preview example card</button>
            <button type="button" className="utility-button" onClick={handleNewVisit}><Trash2 size={15} /> Clear / new visit</button>
            <button type="button" className="utility-button" onClick={() => showToast('GPS needs HTTPS and permission. Keep this page active during walks for best results.')}><CircleHelp size={15} /> GPS help</button>
          </div>
        )}
      </main>

      <nav className="mobile-bottom-nav no-print" aria-label="Main navigation">
        <button type="button" className={screen === 'visit' ? 'nav-selected' : ''} onClick={() => setScreen('visit')}><PawPrint size={18} /><span>Visit</span></button>
        <button type="button" className={screen === 'report' ? 'nav-selected' : ''} onClick={goToReport}><Heart size={18} /><span>Card preview</span></button>
      </nav>

      {toast && <div role="status" className="toast no-print"><CheckCircle2 size={17} /><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
      <footer className="app-footer no-print"><span>Made with a little extra care.</span><span>Private by design <Heart size={12} fill="currentColor" /></span></footer>
    </div>
  );
}

export default App;
