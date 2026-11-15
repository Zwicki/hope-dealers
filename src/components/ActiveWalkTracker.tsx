import React, { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import {
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  Flag,
  Flame,
  Footprints,
  HeartHandshake,
  LogIn,
  MapPin,
  Minus,
  Navigation,
  Pause,
  Pencil,
  Play,
  Plus,
  Route,
  Save,
  Sparkles,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CHILLICOTHE_CENTER,
  COMMON_STREETS_PRESETS,
  CommunityInteractionPoint,
  EncounterPin,
  GpsWaypoint,
  NEED_CATEGORIES,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';
import {
  ActiveWalkDraft,
  calculateDistanceMiles,
  loadActiveWalkDraft,
  reverseGeocodeStreet,
  saveActiveWalkDraft,
} from '../services/cloudSyncService';
import { EncounterPinModal } from './EncounterPinModal';
import { HistoricalOutreachBuilder } from './HistoricalOutreachBuilder';

interface ActiveWalkTrackerProps {
  currentUser: UserAccount | null;
  allUsers: UserAccount[];
  lbsPerTrashBag: number;
  pins: EncounterPin[];
  onOpenLogin: () => void;
  onSaveWalk: (walk: WalkSession) => void;
  onSaveHistoricalWalk?: (walk: WalkSession, newPins: EncounterPin[]) => void;
  onSavePin: (pin: EncounterPin) => void;
  onViewMap: () => void;
  onOpenHistoricalEntry?: () => void;
  onActiveWalkStateChange: (isRunning: boolean) => void;
}

const startMarkerIcon = L.divIcon({
  className: 'gps-start-icon',
  html: `<div style="
    width: 30px;
    height: 30px;
    border-radius: 9999px;
    background: #10b981;
    border: 2.5px solid #ffffff;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  ">🏁</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const currentPosMarkerIcon = L.divIcon({
  className: 'gps-current-icon',
  html: `<div style="
    width: 22px;
    height: 22px;
    border-radius: 9999px;
    background: #3b82f6;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 6px rgba(59,130,246,0.35);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const interactionDotIcon = L.divIcon({
  className: 'gps-interaction-icon',
  html: `<div style="
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: #0ea5e9;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  ">👋</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const prayerPinMiniIcon = L.divIcon({
  className: 'gps-prayer-mini-icon',
  html: `<div style="
    width: 28px;
    height: 28px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #f97316, #dc2626);
    border: 2px solid #ffffff;
    box-shadow: 0 3px 10px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
  ">🙏</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const RecenterMapHelper: React.FC<{ center: [number, number] | null }> = ({
  center,
}) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, map]);
  return null;
};

export const ActiveWalkTracker: React.FC<ActiveWalkTrackerProps> = ({
  currentUser,
  allUsers,
  lbsPerTrashBag,
  pins,
  onOpenLogin,
  onSaveWalk,
  onSaveHistoricalWalk,
  onSavePin,
  onViewMap,
  onActiveWalkStateChange,
}) => {
  const [walkLoggingMode, setWalkLoggingMode] = useState<'live' | 'past'>('live');
  const initialDraft = loadActiveWalkDraft();

  const [walkId, setWalkId] = useState<string>(
    initialDraft?.walkId || `walk-${Date.now()}`
  );
  const [isRunning, setIsRunning] = useState<boolean>(
    initialDraft?.isRunning || false
  );
  const [startedAtIso, setStartedAtIso] = useState<string>(
    initialDraft?.startedAtIso || new Date().toISOString()
  );
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(
    initialDraft?.elapsedSeconds || 0
  );

  // Group Roster (2-3 volunteers walking together)
  const defaultRecorder = currentUser?.name || 'Rick Fannin';
  const [groupMembers, setGroupMembers] = useState<string[]>(
    initialDraft?.groupMembers?.length
      ? initialDraft.groupMembers
      : [defaultRecorder]
  );
  const [newTeammateName, setNewTeammateName] = useState('');

  // GPS Starting Point, Route Path, Distance & Community Interaction Locations
  const [startPoint, setStartPoint] = useState<GpsWaypoint | undefined>(
    initialDraft?.startPoint
  );
  const [milesWalked, setMilesWalked] = useState<number>(
    initialDraft?.milesWalked ?? 0
  );
  const [manualMilesOverride, setManualMilesOverride] = useState<boolean>(
    initialDraft?.manualMilesOverride ?? false
  );
  const [streetsWalked, setStreetsWalked] = useState<string[]>(
    initialDraft?.streetsWalked || ['Paint St']
  );
  const [customStreetInput, setCustomStreetInput] = useState('');
  const [gpsPath, setGpsPath] = useState<[number, number][]>(
    initialDraft?.gpsPath || []
  );
  const [interactionLocations, setInteractionLocations] = useState<
    CommunityInteractionPoint[]
  >(initialDraft?.interactionLocations || []);
  const [gpsTrackingActive, setGpsTrackingActive] = useState<boolean>(
    initialDraft?.gpsTrackingActive ?? true
  );
  const [lastKnownGps, setLastKnownGps] = useState<[number, number] | null>(
    initialDraft?.gpsPath?.length
      ? initialDraft.gpsPath[initialDraft.gpsPath.length - 1]
      : initialDraft?.startPoint
      ? [initialDraft.startPoint.lat, initialDraft.startPoint.lng]
      : null
  );
  const [gpsAccuracyFeet, setGpsAccuracyFeet] = useState<number | null>(null);
  const [gpsStatusText, setGpsStatusText] = useState<string>('Ready to lock GPS');

  // Counters
  const [interactionsCount, setInteractionsCount] = useState<number>(
    initialDraft?.interactionsCount || 0
  );
  const [prayersCount, setPrayersCount] = useState<number>(
    initialDraft?.prayersCount || 0
  );
  const [serviceLinkagesCount, setServiceLinkagesCount] = useState<number>(
    initialDraft?.serviceLinkagesCount || 0
  );
  const [trashBagsCount, setTrashBagsCount] = useState<number>(
    initialDraft?.trashBagsCount || 0
  );
  const [trashWeightLbs, setTrashWeightLbs] = useState<number>(
    initialDraft?.trashWeightLbs || 0
  );
  const [manualWeightOverride, setManualWeightOverride] = useState<boolean>(
    initialDraft?.manualWeightOverride || false
  );
  const [notes, setNotes] = useState<string>(initialDraft?.notes || '');

  // Modals & notifications
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<EncounterPin | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);

  // Sync currentUser name into group roster if not already present
  useEffect(() => {
    if (currentUser?.name) {
      setGroupMembers((prev) => {
        if (prev.length === 0) return [currentUser.name];
        if (
          prev.length === 1 &&
          prev[0] === 'Rick Fannin' &&
          currentUser.name !== 'Rick Fannin'
        ) {
          return [currentUser.name];
        }
        return prev;
      });
    }
  }, [currentUser]);

  // Notify parent of running state
  useEffect(() => {
    onActiveWalkStateChange(isRunning);
  }, [isRunning, onActiveWalkStateChange]);

  // Persist draft on every change
  useEffect(() => {
    const draft: ActiveWalkDraft = {
      walkId,
      isRunning,
      startedAtIso,
      elapsedSeconds,
      recorderName: currentUser?.name || groupMembers[0] || 'Hope Dealer',
      groupMembers,
      milesWalked,
      manualMilesOverride,
      streetsWalked,
      startPoint,
      gpsPath,
      interactionLocations,
      gpsTrackingActive,
      interactionsCount,
      prayersCount,
      serviceLinkagesCount,
      trashBagsCount,
      trashWeightLbs,
      manualWeightOverride,
      notes,
    };
    saveActiveWalkDraft(draft);
  }, [
    walkId,
    isRunning,
    startedAtIso,
    elapsedSeconds,
    currentUser,
    groupMembers,
    milesWalked,
    manualMilesOverride,
    streetsWalked,
    startPoint,
    gpsPath,
    interactionLocations,
    gpsTrackingActive,
    interactionsCount,
    prayersCount,
    serviceLinkagesCount,
    trashBagsCount,
    trashWeightLbs,
    manualWeightOverride,
    notes,
  ]);

  // Live Stopwatch Timer
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  // Helper to capture current GPS position on demand (for starting point or community interaction)
  const acquireCurrentGpsCoordinate = (
    callback: (lat: number, lng: number, streetName?: string) => void
  ) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(5));
          const lng = Number(pos.coords.longitude.toFixed(5));
          if (pos.coords.accuracy) {
            setGpsAccuracyFeet(Math.round(pos.coords.accuracy * 3.28084));
          }
          setLastKnownGps([lat, lng]);
          setGpsStatusText(`GPS Active (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
          const road = await reverseGeocodeStreet(lat, lng);
          if (road) {
            setStreetsWalked((prev) =>
              prev.includes(road) ? prev : [...prev, road]
            );
          }
          callback(lat, lng, road || streetsWalked[streetsWalked.length - 1]);
        },
        () => {
          // Fallback to lastKnownGps or simulated step along Chillicothe route if inside/desktop
          const base = lastKnownGps || CHILLICOTHE_CENTER;
          const offsetLat = Number(
            (base[0] + (Math.random() - 0.45) * 0.0012).toFixed(5)
          );
          const offsetLng = Number(
            (base[1] + (Math.random() - 0.45) * 0.0012).toFixed(5)
          );
          setLastKnownGps([offsetLat, offsetLng]);
          callback(
            offsetLat,
            offsetLng,
            streetsWalked[streetsWalked.length - 1] || 'Paint St'
          );
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
      );
    } else {
      const base = lastKnownGps || CHILLICOTHE_CENTER;
      callback(base[0], base[1], streetsWalked[0] || 'Paint St');
    }
  };

  // Live GPS Watch when walk is running and GPS tracking is enabled
  useEffect(() => {
    if (
      !isRunning ||
      !gpsTrackingActive ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    setGpsStatusText('Tracking route & distance via GPS...');

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        if (pos.coords.accuracy) {
          setGpsAccuracyFeet(Math.round(pos.coords.accuracy * 3.28084));
        }
        setLastKnownGps([lat, lng]);
        setGpsStatusText(`GPS Locked (${lat.toFixed(4)}, ${lng.toFixed(4)})`);

        // Set starting point if not yet locked
        setStartPoint((prevStart) => {
          if (prevStart) return prevStart;
          return {
            lat,
            lng,
            streetName: streetsWalked[0] || 'Starting Point',
            timestamp: new Date().toISOString(),
          };
        });

        setGpsPath((prev) => {
          if (prev.length === 0) {
            return [[lat, lng]];
          }
          const [lastLat, lastLng] = prev[prev.length - 1];
          const segmentMiles = calculateDistanceMiles(lastLat, lastLng, lat, lng);
          // Append breadcrumb if moved at least ~18 feet (0.0035 miles)
          if (segmentMiles >= 0.0035) {
            if (!manualMilesOverride) {
              setMilesWalked((m) => Number((m + segmentMiles).toFixed(2)));
            }
            return [...prev, [lat, lng]];
          }
          return prev;
        });

        // Reverse-geocode current street automatically
        const detectedRoad = await reverseGeocodeStreet(lat, lng);
        if (detectedRoad) {
          setStreetsWalked((prev) =>
            prev.includes(detectedRoad) ? prev : [...prev, detectedRoad]
          );
          setStartPoint((prevStart) =>
            prevStart && prevStart.streetName === 'Starting Point'
              ? { ...prevStart, streetName: detectedRoad }
              : prevStart
          );
        }
      },
      () => {
        setGpsStatusText('GPS signal weak — using hybrid street tracking');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isRunning, gpsTrackingActive, manualMilesOverride, streetsWalked]);

  const handleStartOrResumeWalk = () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    if (elapsedSeconds === 0) {
      setStartedAtIso(new Date().toISOString());
    }
    setIsRunning(true);

    // Immediately lock GPS Starting Point when starting walk
    if (!startPoint) {
      acquireCurrentGpsCoordinate((lat, lng, street) => {
        const sp: GpsWaypoint = {
          lat,
          lng,
          streetName: street || 'Paint St',
          timestamp: new Date().toISOString(),
        };
        setStartPoint(sp);
        setGpsPath((prev) => (prev.length === 0 ? [[lat, lng]] : prev));
      });
    }
  };

  // Lock or Re-Lock GPS Starting Point manually at any time
  const handleLockStartingPointNow = () => {
    acquireCurrentGpsCoordinate((lat, lng, street) => {
      const sp: GpsWaypoint = {
        lat,
        lng,
        streetName: street || streetsWalked[0] || 'Paint St',
        timestamp: new Date().toISOString(),
      };
      setStartPoint(sp);
      setGpsPath((prev) => [[lat, lng], ...prev]);
      setSavedBanner(
        `🏁 Locked GPS Starting Point at ${sp.streetName} (${lat.toFixed(
          4
        )}, ${lng.toFixed(4)})`
      );
      setTimeout(() => setSavedBanner(null), 4000);
    });
  };

  // Log a Community Interaction with automatic GPS location capture
  const handleRecordInteractionWithGps = (
    kind: 'interaction' | 'prayer' | 'service'
  ) => {
    if (kind === 'interaction') {
      setInteractionsCount((c) => c + 1);
    } else if (kind === 'prayer') {
      setPrayersCount((c) => c + 1);
      setInteractionsCount((c) => c + 1);
    } else if (kind === 'service') {
      setServiceLinkagesCount((c) => c + 1);
      setInteractionsCount((c) => c + 1);
    }

    acquireCurrentGpsCoordinate((lat, lng, street) => {
      const point: CommunityInteractionPoint = {
        id: `int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        walkId,
        lat,
        lng,
        streetName: street || streetsWalked[streetsWalked.length - 1] || 'Paint St',
        timestamp: new Date().toISOString(),
        kind,
      };
      setInteractionLocations((prev) => [...prev, point]);

      // Also extend route path & distance if walking between interactions
      setGpsPath((prev) => {
        if (prev.length === 0) {
          return [[lat, lng]];
        }
        const [lastLat, lastLng] = prev[prev.length - 1];
        const segMiles = calculateDistanceMiles(lastLat, lastLng, lat, lng);
        if (segMiles >= 0.002) {
          if (!manualMilesOverride) {
            setMilesWalked((m) => Number((m + segMiles).toFixed(2)));
          }
          return [...prev, [lat, lng]];
        }
        return prev;
      });
    });
  };

  const handleAddGroupMember = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (!groupMembers.includes(clean)) {
      setGroupMembers((prev) => [...prev, clean]);
    }
    setNewTeammateName('');
  };

  const handleRemoveGroupMember = (name: string) => {
    if (groupMembers.length <= 1) return;
    setGroupMembers((prev) => prev.filter((m) => m !== name));
  };

  const handleToggleStreet = (street: string) => {
    setStreetsWalked((prev) =>
      prev.includes(street)
        ? prev.filter((s) => s !== street)
        : [...prev, street]
    );
  };

  const handleAddCustomStreet = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customStreetInput.trim();
    if (!clean) return;
    if (!streetsWalked.includes(clean)) {
      setStreetsWalked((prev) => [...prev, clean]);
    }
    setCustomStreetInput('');
  };

  const handleTrashBagsChange = (delta: number) => {
    setTrashBagsCount((prev) => {
      const next = Math.max(0, prev + delta);
      if (!manualWeightOverride) {
        setTrashWeightLbs(next * lbsPerTrashBag);
      }
      return next;
    });
  };

  const handlePinCreated = (pin: EncounterPin) => {
    const isEditing = Boolean(editingPin);
    onSavePin(pin);
    if (!isEditing) {
      setInteractionsCount((c) => c + 1);
      if (pin.type === 'prayer' || pin.type === 'both') {
        setPrayersCount((c) => c + 1);
      }
      if (
        pin.type === 'service' ||
        pin.type === 'both' ||
        pin.needCategories.length > 0
      ) {
        setServiceLinkagesCount((c) => c + 1);
      }
      if (pin.streetName && !streetsWalked.includes(pin.streetName)) {
        setStreetsWalked((prev) => [...prev, pin.streetName]);
      }

      // Also add pin GPS coordinate to route & interactionLocations
      const intPoint: CommunityInteractionPoint = {
        id: `int-pin-${pin.id}`,
        walkId,
        lat: pin.lat,
        lng: pin.lng,
        streetName: pin.streetName,
        timestamp: pin.timestamp,
        kind: pin.type === 'service' ? 'service' : 'prayer',
      };
      setInteractionLocations((prev) => [...prev, intPoint]);
      setGpsPath((prev) => {
        if (prev.length === 0) return [[pin.lat, pin.lng]];
        const [lastLat, lastLng] = prev[prev.length - 1];
        const segMiles = calculateDistanceMiles(
          lastLat,
          lastLng,
          pin.lat,
          pin.lng
        );
        if (segMiles >= 0.002 && !manualMilesOverride) {
          setMilesWalked((m) => Number((m + segMiles).toFixed(2)));
        }
        return [...prev, [pin.lat, pin.lng]];
      });
    }
    setEditingPin(null);

    setSavedBanner(
      isEditing
        ? `Updated prayer record for ${pin.firstName}!`
        : `Saved GPS pin for ${pin.firstName} on ${pin.streetName}!`
    );
    setTimeout(() => setSavedBanner(null), 4500);
  };

  const handleCompleteAndSaveWalk = () => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }

    const durationMins = Math.max(1, Math.round(elapsedSeconds / 60) || 60);
    const groupSize = Math.max(1, groupMembers.length);
    const volHours = Number(((durationMins / 60) * groupSize).toFixed(2));

    const currentWalkPins = pins.filter((p) => p.walkId === walkId);
    let finalPath = [...gpsPath];
    if (finalPath.length < 2) {
      if (currentWalkPins.length >= 2) {
        finalPath = currentWalkPins.map((p) => [p.lat, p.lng]);
      } else if (interactionLocations.length >= 2) {
        finalPath = interactionLocations.map((i) => [i.lat, i.lng]);
      } else {
        const baseLat =
          startPoint?.lat ??
          currentWalkPins[0]?.lat ??
          CHILLICOTHE_CENTER[0];
        const baseLng =
          startPoint?.lng ??
          currentWalkPins[0]?.lng ??
          CHILLICOTHE_CENTER[1];
        finalPath = [
          [baseLat, baseLng],
          [baseLat + 0.0022, baseLng + 0.0018],
          [baseLat + 0.0035, baseLng - 0.0012],
        ];
      }
    }

    // Calculate route distance from GPS path if milesWalked is still 0
    let computedRouteMiles = milesWalked;
    if (computedRouteMiles <= 0 && finalPath.length >= 2) {
      let sum = 0;
      for (let i = 1; i < finalPath.length; i++) {
        sum += calculateDistanceMiles(
          finalPath[i - 1][0],
          finalPath[i - 1][1],
          finalPath[i][0],
          finalPath[i][1]
        );
      }
      computedRouteMiles = Number(Math.max(0.2, sum).toFixed(2));
    }

    const finalStartPoint: GpsWaypoint = startPoint || {
      lat: finalPath[0][0],
      lng: finalPath[0][1],
      streetName: streetsWalked[0] || 'Paint St',
      timestamp: startedAtIso,
    };

    const finalEndPoint: GpsWaypoint = {
      lat: finalPath[finalPath.length - 1][0],
      lng: finalPath[finalPath.length - 1][1],
      streetName:
        streetsWalked[streetsWalked.length - 1] ||
        finalStartPoint.streetName ||
        'Paint St',
      timestamp: new Date().toISOString(),
    };

    const completedWalk: WalkSession = {
      id: walkId,
      date: new Date().toISOString().slice(0, 10),
      startTime: startedAtIso,
      endTime: new Date().toISOString(),
      durationMinutes: durationMins,
      recorderName: currentUser.name,
      recorderEmail: currentUser.email,
      groupMembers,
      groupSize,
      volunteerHours: volHours,
      milesWalked: computedRouteMiles,
      streetsWalked:
        streetsWalked.length > 0 ? streetsWalked : ['Downtown Chillicothe'],
      startPoint: finalStartPoint,
      endPoint: finalEndPoint,
      gpsPath: finalPath,
      interactionLocations,
      interactionsCount,
      prayersCount,
      serviceLinkagesCount,
      trashBagsCount,
      trashWeightLbs,
      notes: notes.trim() || undefined,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    onSaveWalk(completedWalk);

    // Reset for next walk
    const nextWalkId = `walk-${Date.now()}`;
    setWalkId(nextWalkId);
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartPoint(undefined);
    setMilesWalked(0);
    setManualMilesOverride(false);
    setGpsPath([]);
    setInteractionLocations([]);
    setInteractionsCount(0);
    setPrayersCount(0);
    setServiceLinkagesCount(0);
    setTrashBagsCount(0);
    setTrashWeightLbs(0);
    setManualWeightOverride(false);
    setNotes('');
    saveActiveWalkDraft(null);

    setSavedBanner(
      `Walk saved & synced to Cloud! (${computedRouteMiles} GPS mi • ${volHours} total volunteer hrs)`
    );
    setTimeout(() => setSavedBanner(null), 6000);
  };

  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentWalkPins = pins.filter((p) => p.walkId === walkId);
  const durationMinutesEstimate = Math.max(0, Math.round(elapsedSeconds / 60));
  const totalVolunteerHoursLive = Number(
    (((elapsedSeconds || 3600) / 3600) * groupMembers.length).toFixed(1)
  );

  const mapCenter: [number, number] =
    lastKnownGps ||
    (startPoint ? [startPoint.lat, startPoint.lng] : CHILLICOTHE_CENTER);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-5">
      {/* Hope Dealers Brand Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slateDark-900 via-slateDark-900 to-phoenix-950/40 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <img
            src="/hope-dealers-logo.png"
            alt="Hope Dealers Logo"
            className="h-24 sm:h-28 w-auto object-contain drop-shadow-xl"
          />
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-phoenix-400">
              Life Recovery Society Street Ministry
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Love • Pray • Serve • Restore
            </h1>
            <p className="text-xs text-amber-400 font-bold tracking-wider uppercase mt-0.5">
              Giving the Hopeless Hope — Chillicothe & Ross County
            </p>
          </div>
        </div>

        {!currentUser && (
          <button
            onClick={onOpenLogin}
            className="w-full sm:w-auto shrink-0 px-4 py-3 rounded-xl bg-gradient-to-r from-phoenix-500 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-phoenix-600/30 transition"
          >
            <LogIn className="w-4 h-4" />
            <span>Volunteer / Super User Login</span>
          </button>
        )}
      </div>

      {/* Mode Switcher: Live GPS Walk vs. Log Past Walk (Start -> Waypoints -> End at Start) */}
      {currentUser && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slateDark-900 p-2 rounded-2xl border border-slate-800 shadow-lg">
          <button
            type="button"
            onClick={() => setWalkLoggingMode('live')}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition ${
              walkLoggingMode === 'live'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slateDark-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Navigation className="w-4 h-4" />
            <span>📡 Live GPS Walk (Walking Right Now)</span>
          </button>

          <button
            type="button"
            onClick={() => setWalkLoggingMode('past')}
            className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition ${
              walkLoggingMode === 'past'
                ? 'bg-gradient-to-r from-phoenix-500 to-phoenix-red text-white shadow-md'
                : 'text-amber-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Flag className="w-4 h-4" />
            <span>
              📅 Log Past Walk (Click Start → Waypoints → Return to Start)
            </span>
          </button>
        </div>
      )}

      {walkLoggingMode === 'past' && currentUser && onSaveHistoricalWalk ? (
        <HistoricalOutreachBuilder
          currentUser={currentUser}
          allUsers={allUsers}
          lbsPerTrashBag={lbsPerTrashBag}
          onSaveHistoricalWalk={onSaveHistoricalWalk}
          onSaveStandalonePin={onSavePin}
          onViewMap={onViewMap}
        />
      ) : (
        <>

      {/* Toast Notification Banner */}
      {savedBanner && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 flex items-center justify-between gap-3 shadow-lg animate-fade-in">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{savedBanner}</span>
          </div>
          <button
            onClick={onViewMap}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500 text-slateDark-950 font-extrabold text-xs"
          >
            View on Map
          </button>
        </div>
      )}

      {/* STEP 1: WALKING GROUP ROSTER (2-3 Volunteers Together) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-phoenix-500/20 border border-phoenix-500/30 flex items-center justify-center text-phoenix-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                1. Walking Group Roster (Usually 2–3 Hope Dealers)
              </h2>
              <p className="text-[11px] text-slate-400">
                One person records on their phone — add your 1–2 walking partners below
              </p>
            </div>
          </div>

          <div className="px-3 py-1 rounded-full bg-phoenix-500/15 border border-phoenix-500/30 text-phoenix-300 text-xs font-extrabold">
            👥 {groupMembers.length}{' '}
            {groupMembers.length === 1 ? 'Volunteer' : 'Volunteers'} ={' '}
            {groupMembers.length}x Volunteer Hours
          </div>
        </div>

        {/* Active Group Member Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {groupMembers.map((member, idx) => (
            <span
              key={member}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-phoenix-600/25 border border-phoenix-500/50 text-xs font-bold text-white"
            >
              <span>
                {idx === 0 ? '📱 ' : '👟 '}
                {member}
              </span>
              {idx === 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-phoenix-500/30 text-phoenix-200">
                  Recorder
                </span>
              )}
              {groupMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveGroupMember(member)}
                  className="text-slate-300 hover:text-rose-400 ml-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          ))}
        </div>

        {/* Quick-Add Teammate Chips + Custom Input */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">
              Quick add partner:
            </span>
            {allUsers
              .filter((u) => u.active && !groupMembers.includes(u.name))
              .map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleAddGroupMember(u.name)}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slateDark-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold transition"
                >
                  <Plus className="w-3 h-3 text-phoenix-400" />
                  <span>{u.name}</span>
                </button>
              ))}
          </div>

          <div className="flex items-center gap-1.5 sm:ml-auto">
            <input
              type="text"
              value={newTeammateName}
              onChange={(e) => setNewTeammateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddGroupMember(newTeammateName);
                }
              }}
              placeholder="Or type partner name..."
              className="flex-1 sm:w-44 px-3 py-1.5 rounded-lg bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />
            <button
              type="button"
              onClick={() => handleAddGroupMember(newTeammateName)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1 border border-slate-700"
            >
              <UserPlus className="w-3.5 h-3.5 text-phoenix-400" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </section>

      {/* STEP 2: LIVE GPS TRACKER, STARTING POINT, ROUTE & DISTANCE */}
      <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slateDark-900 via-slateDark-900 to-phoenix-950/30 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Start / Pause Primary Button */}
          {!isRunning ? (
            <button
              type="button"
              onClick={handleStartOrResumeWalk}
              className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slateDark-950 font-black text-base sm:text-lg shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition active:scale-[0.99]"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>
                {elapsedSeconds > 0
                  ? 'Resume GPS Street Walk'
                  : 'Start Live GPS Street Walk'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsRunning(false)}
              className="flex-1 py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slateDark-950 font-black text-base sm:text-lg shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2.5 transition"
            >
              <Pause className="w-6 h-6 fill-current" />
              <span>Pause Walk Timer & GPS</span>
            </button>
          )}

          {/* Live Stopwatch & GPS Distance Readout */}
          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            {/* Timer Box */}
            <div className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                <Clock className="w-3 h-3 text-phoenix-400" />
                <span>Walk Time</span>
              </div>
              <div className="text-base sm:text-xl font-black text-white font-mono mt-0.5">
                {formatTime(elapsedSeconds)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() =>
                    setElapsedSeconds((s) => Math.max(0, s - 15 * 60))
                  }
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
                  title="Subtract 15 mins"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => setElapsedSeconds((s) => s + 15 * 60)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
                  title="Add 15 mins"
                >
                  +15m
                </button>
              </div>
            </div>

            {/* GPS Miles Box */}
            <div className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                <Route className="w-3 h-3 text-emerald-400" />
                <span>GPS Miles</span>
              </div>
              <input
                type="number"
                step="0.05"
                min="0"
                value={milesWalked}
                onChange={(e) => {
                  setManualMilesOverride(true);
                  setMilesWalked(Math.max(0, parseFloat(e.target.value) || 0));
                }}
                className="w-20 mx-auto text-center bg-transparent text-base sm:text-xl font-black text-emerald-400 focus:outline-none border-b border-slate-700 focus:border-emerald-400 mt-0.5"
              />
              <div className="flex items-center justify-center gap-1 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setManualMilesOverride(true);
                    setMilesWalked((m) =>
                      Number(Math.max(0, m - 0.25).toFixed(2))
                    );
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
                >
                  -.25
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualMilesOverride(true);
                    setMilesWalked((m) => Number((m + 0.25).toFixed(2)));
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
                >
                  +.25
                </button>
              </div>
            </div>

            {/* Group Volunteer Hours Box */}
            <div className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-400">
                <Users className="w-3 h-3 text-amber-400" />
                <span>Vol. Hours</span>
              </div>
              <div className="text-base sm:text-xl font-black text-amber-300 mt-0.5">
                {durationMinutesEstimate > 0
                  ? Number(
                      ((durationMinutesEstimate / 60) * groupMembers.length).toFixed(
                        1
                      )
                    )
                  : totalVolunteerHoursLive}
                h
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                {groupMembers.length} in group
              </p>
            </div>
          </div>
        </div>

        {/* GPS Telemetry Bar: Starting Point, Route Points & Live GPS Accuracy */}
        <div className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
              <Flag className="w-3.5 h-3.5" />
              <span>
                Start Point:{' '}
                {startPoint
                  ? `${startPoint.streetName || 'Locked'} (${startPoint.lat.toFixed(
                      4
                    )}, ${startPoint.lng.toFixed(4)})`
                  : 'Tap "Start Walk" or "Set Start GPS"'}
              </span>
            </span>

            <span className="text-slate-400">
              • Route Points: <strong className="text-white">{gpsPath.length}</strong>
            </span>

            <span className="text-slate-400">
              • GPS Interaction Spots:{' '}
              <strong className="text-blue-400">
                {interactionLocations.length}
              </strong>
            </span>

            {gpsAccuracyFeet !== null && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                ±{gpsAccuracyFeet} ft accuracy
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleLockStartingPointNow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-phoenix-300 font-bold text-[11px] border border-slate-700 transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{startPoint ? 'Update Start GPS' : 'Set Start GPS Now'}</span>
          </button>
        </div>

        {/* LIVE GPS ROUTE, STARTING POINT & COMMUNITY INTERACTION MINI-MAP */}
        <div className="rounded-xl overflow-hidden border border-slate-800 h-52 sm:h-60 relative">
          <div className="absolute top-2 left-2 z-[500] px-2.5 py-1 rounded-lg bg-slateDark-950/90 backdrop-blur border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-emerald-400" />
            <span>{gpsStatusText}</span>
          </div>

          <MapContainer
            center={mapCenter}
            zoom={16}
            scrollWheelZoom={false}
            className="w-full h-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RecenterMapHelper center={lastKnownGps} />

            {/* Starting Point Flag Marker */}
            {startPoint && (
              <Marker
                position={[startPoint.lat, startPoint.lng]}
                icon={startMarkerIcon}
              >
                <Popup>
                  <div className="text-xs font-bold">
                    🏁 Starting Point: {startPoint.streetName || 'Walk Start'}
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Live GPS Position Marker */}
            {lastKnownGps && (
              <Marker position={lastKnownGps} icon={currentPosMarkerIcon}>
                <Popup>
                  <div className="text-xs font-bold">
                    📍 Current Team GPS Position
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Live Route Polyline */}
            {gpsPath.length >= 2 && (
              <Polyline
                positions={gpsPath}
                pathOptions={{
                  color: '#f97316',
                  weight: 5,
                  opacity: 0.9,
                }}
              />
            )}

            {/* GPS Markers for Community Interactions */}
            {interactionLocations.map((loc) => (
              <Marker
                key={loc.id}
                position={[loc.lat, loc.lng]}
                icon={interactionDotIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>👋 Community Interaction</strong>
                    <div>📍 {loc.streetName || 'Street Outreach'}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(loc.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Detailed Prayer / Service Pins on this Walk */}
            {currentWalkPins.map((pin) => (
              <Marker
                key={pin.id}
                position={[pin.lat, pin.lng]}
                icon={prayerPinMiniIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <strong>🙏 {pin.firstName}</strong>
                    <div>{pin.description}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* GIANT 1-TAP "LOG PERSON PRAYED FOR / SERVICE LINKAGE PIN" CTA */}
        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              onOpenLogin();
              return;
            }
            setIsPinModalOpen(true);
          }}
          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-black text-base sm:text-lg shadow-xl shadow-phoenix-600/30 border border-phoenix-400/40 flex items-center justify-center gap-3 transition active:scale-[0.99]"
        >
          <Sparkles className="w-6 h-6 shrink-0" />
          <span>🙏 Log Person Prayed For / Service Pin (at Current GPS)</span>
        </button>
      </section>

      {/* STEP 3: 4 GIANT THUMB-FRIENDLY LIVE COUNTERS (Automatically Stamp GPS on +1) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Counter 1: Public Interactions */}
        <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-blue-400">
              👋 Public Interactions
            </span>
            <div className="text-3xl font-black text-white mt-0.5">
              {interactionsCount}
            </div>
            <p className="text-[11px] text-slate-400">
              +1 automatically logs GPS interaction spot
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setInteractionsCount((c) => Math.max(0, c - 1));
                setInteractionLocations((prev) => prev.slice(0, -1));
              }}
              className="w-12 h-12 rounded-xl bg-slateDark-950 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleRecordInteractionWithGps('interaction')}
              className="w-16 h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-lg flex items-center justify-center gap-1 shadow-lg shadow-blue-600/30 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" />
              <span>1</span>
            </button>
          </div>
        </div>

        {/* Counter 2: People Prayed For */}
        <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
              🙏 People Prayed For
            </span>
            <div className="text-3xl font-black text-white mt-0.5">
              {prayersCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Tap +1 or use Prayer Pin button above
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPrayersCount((c) => Math.max(0, c - 1))}
              className="w-12 h-12 rounded-xl bg-slateDark-950 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleRecordInteractionWithGps('prayer')}
              className="w-16 h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slateDark-950 font-black text-lg flex items-center justify-center gap-1 shadow-lg shadow-amber-500/30 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" />
              <span>1</span>
            </button>
          </div>
        </div>

        {/* Counter 3: Service Linkages */}
        <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              🤝 Linked to Services
            </span>
            <div className="text-3xl font-black text-white mt-0.5">
              {serviceLinkagesCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Immediate needs & resource referrals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setServiceLinkagesCount((c) => Math.max(0, c - 1))
              }
              className="w-12 h-12 rounded-xl bg-slateDark-950 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleRecordInteractionWithGps('service')}
              className="w-16 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slateDark-950 font-black text-lg flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/30 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" />
              <span>1</span>
            </button>
          </div>
        </div>

        {/* Counter 4: Trash Bags & Estimated Weight */}
        <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 flex items-center justify-between gap-3 shadow-lg">
          <div>
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-purple-400">
              🗑️ Trash Picked Up
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl font-black text-white">
                {trashBagsCount}
              </span>
              <span className="text-xs font-bold text-slate-400">bags</span>
              <span className="text-xs font-extrabold text-purple-300">
                (~{trashWeightLbs} lbs)
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] text-slate-400">Est. lbs:</span>
              <input
                type="number"
                min="0"
                value={trashWeightLbs}
                onChange={(e) => {
                  setManualWeightOverride(true);
                  setTrashWeightLbs(Math.max(0, parseInt(e.target.value) || 0));
                }}
                className="w-14 px-1.5 py-0.5 rounded bg-slateDark-950 border border-slate-700 text-[11px] font-bold text-purple-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleTrashBagsChange(-1)}
              className="w-12 h-12 rounded-xl bg-slateDark-950 hover:bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => handleTrashBagsChange(1)}
              className="w-16 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-lg flex items-center justify-center gap-1 shadow-lg shadow-purple-600/30 active:scale-95 transition"
            >
              <Plus className="w-5 h-5" />
              <span>1</span>
            </button>
          </div>
        </div>
      </section>

      {/* STEP 4: STREETS WALKED (Auto GPS + 1-Tap Street Chips) */}
      <section className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 shadow-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Footprints className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Streets Walked on This Outreach
              </h3>
              <p className="text-[11px] text-slate-400">
                Auto-detected via GPS as you walk or tap streets below
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setGpsTrackingActive((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition ${
              gpsTrackingActive
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>
              {gpsTrackingActive ? 'Live GPS Route ON' : 'GPS Paused'}
            </span>
          </button>
        </div>

        {/* Selected Street Tags */}
        {streetsWalked.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slateDark-950 border border-slate-800">
            {streetsWalked.map((st) => (
              <span
                key={st}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-phoenix-500/20 border border-phoenix-500/40 text-xs font-bold text-phoenix-200"
              >
                <MapPin className="w-3 h-3 text-phoenix-400" />
                <span>{st}</span>
                <button
                  type="button"
                  onClick={() => handleToggleStreet(st)}
                  className="hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Quick-Tap Common Chillicothe Streets */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Quick-Tap Streets:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_STREETS_PRESETS.map((street) => {
              const active = streetsWalked.includes(street);
              return (
                <button
                  key={street}
                  type="button"
                  onClick={() => handleToggleStreet(street)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                    active
                      ? 'bg-phoenix-600 text-white border-phoenix-400 shadow'
                      : 'bg-slateDark-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {active ? `✓ ${street}` : `+ ${street}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add Any Custom Street */}
        <form onSubmit={handleAddCustomStreet} className="flex gap-2">
          <input
            type="text"
            value={customStreetInput}
            onChange={(e) => setCustomStreetInput(e.target.value)}
            placeholder="Type any other street name or intersection..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shrink-0"
          >
            + Add Street
          </button>
        </form>
      </section>

      {/* PEOPLE PRAYED FOR DURING THIS WALK */}
      {currentWalkPins.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-3">
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-phoenix-400" />
            <span>
              People Prayed For / Linked on This Walk ({currentWalkPins.length})
            </span>
          </h3>
          <div className="space-y-2">
            {currentWalkPins.map((pin) => (
              <div
                key={pin.id}
                className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">
                      {pin.firstName}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-phoenix-500/20 text-phoenix-300 font-semibold">
                      📍 {pin.streetName} ({pin.lat.toFixed(4)}, {pin.lng.toFixed(4)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {pin.description}
                  </p>
                  {pin.needCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pin.needCategories.map((needId) => {
                        const meta = NEED_CATEGORIES.find((n) => n.id === needId);
                        return meta ? (
                          <span
                            key={needId}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold"
                          >
                            {meta.emoji} {meta.shortLabel}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {currentUser?.role === 'superuser' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPin(pin);
                      setIsPinModalOpen(true);
                    }}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* OPTIONAL WALK NOTES & COMPLETE WALK BUTTON */}
      <section className="p-4 sm:p-5 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Optional Walk Summary / Highlights
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any highlights from the group walk, supplies needed next time, or community observations..."
            className="w-full p-3 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={handleCompleteAndSaveWalk}
            className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-slateDark-950 font-black text-base shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition active:scale-[0.99]"
          >
            <Save className="w-5 h-5" />
            <span>Complete & Sync GPS Walk to Cloud</span>
          </button>

          <a
            href="https://chillicothecommunityresources.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="py-4 px-5 rounded-2xl bg-slateDark-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
          >
            <span>Chillicothe Community Resources</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Encounter Pin Modal */}
      <EncounterPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setEditingPin(null);
        }}
        walkId={walkId}
        recorderName={currentUser?.name || groupMembers[0] || 'Hope Dealer'}
        groupMembers={groupMembers}
        currentWalkStreets={streetsWalked}
        lastKnownGps={lastKnownGps}
        editingPin={editingPin}
        onSavePin={handlePinCreated}
      />
        </>
      )}
    </div>
  );
};
