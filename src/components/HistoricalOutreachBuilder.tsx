import React, { useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CornerUpLeft,
  Flag,
  Footprints,
  HeartHandshake,
  MapPin,
  Plus,
  Repeat,
  RotateCcw,
  Route,
  Save,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CHILLICOTHE_CENTER,
  COMMON_STREETS_PRESETS,
  CommunityInteractionPoint,
  EncounterPin,
  EncounterType,
  NEED_CATEGORIES,
  NeedCategoryId,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';
import {
  calculateDistanceMiles,
  reverseGeocodeStreet,
} from '../services/cloudSyncService';
import {
  DateInputWithCalendar,
  parseFlexibleDateToIso,
  WalkParticipantsSelector,
} from './WalkFormControls';

interface HistoricalOutreachBuilderProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  allKnownPeople?: string[];
  onAddNewPerson?: (name: string) => void;
  lbsPerTrashBag: number;
  onSaveHistoricalWalk: (walk: WalkSession, newPins: EncounterPin[]) => void;
  onSaveStandalonePin: (pin: EncounterPin) => void;
  onViewMap?: () => void;
  onViewImpact?: () => void;
}

const STREET_COORDS_LOOKUP: Record<string, [number, number]> = {
  'Paint St': [39.3331, -82.9824],
  'E Main St': [39.3333, -82.9765],
  'W Main St': [39.3330, -82.9885],
  'N Bridge St': [39.3365, -82.9717],
  'S Bridge St': [39.3295, -82.9719],
  'E Water St': [39.3361, -82.9795],
  'W Water St': [39.3359, -82.9875],
  'Eastern Ave': [39.3278, -82.9675],
  'Western Ave': [39.3338, -82.9960],
  'N High St': [39.3372, -82.9895],
  'S High St': [39.3292, -82.9892],
  'Mulberry St': [39.3350, -82.9786],
  'E 2nd St': [39.3348, -82.9772],
  'W 2nd St': [39.3346, -82.9862],
  'E 4th St': [39.3316, -82.9755],
  'E 7th St': [39.3268, -82.9652],
  'Yoctangee Pkwy': [39.3385, -82.9815],
  'Scioto Ave': [39.3320, -82.9920],
  'Watt St': [39.3285, -82.9750],
  'Ewing St': [39.3315, -82.9788],
};

const startFinishIcon = (isClosedLoop: boolean) =>
  L.divIcon({
    className: 'hist-start-finish-icon',
    html: `<div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: ${isClosedLoop ? 'linear-gradient(135deg,#10b981,#059669)' : '#10b981'};
      border: 3px solid #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
    " title="Click to end walk back at Starting Point">🏁</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const createWaypointIcon = (index: number) =>
  L.divIcon({
    className: 'hist-waypoint-icon',
    html: `<div style="
      width: 26px;
      height: 26px;
      border-radius: 9999px;
      background: #f97316;
      color: #ffffff;
      border: 2.5px solid #ffffff;
      box-shadow: 0 3px 8px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
    ">${index}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const interactionIcon = L.divIcon({
  className: 'hist-int-icon',
  html: `<div style="width:24px;height:24px;border-radius:9999px;background:#0ea5e9;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;font-size:11px;">👋</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const prayerIcon = L.divIcon({
  className: 'hist-prayer-icon',
  html: `<div style="width:30px;height:30px;border-radius:9999px;background:linear-gradient(135deg,#f97316,#dc2626);border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:14px;">🙏</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const MapClickCapture: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  useMapEvents({
    click(e) {
      onMapClick(
        Number(e.latlng.lat.toFixed(5)),
        Number(e.latlng.lng.toFixed(5))
      );
    },
  });
  return null;
};

interface DraftPrayerPin {
  id: string;
  firstName: string;
  type: EncounterType;
  needCategories: NeedCategoryId[];
  description: string;
  streetName: string;
  lat: number;
  lng: number;
}

export const HistoricalOutreachBuilder: React.FC<
  HistoricalOutreachBuilderProps
> = ({
  currentUser,
  allUsers,
  allKnownPeople = [],
  onAddNewPerson,
  lbsPerTrashBag,
  onSaveHistoricalWalk,
  onSaveStandalonePin,
  onViewMap,
  onViewImpact,
}) => {
  const [entryMode, setEntryMode] = useState<'full_walk' | 'standalone_pin'>(
    'full_walk'
  );

  // Past Walk State
  const [walkDate, setWalkDate] = useState<string>(
    new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [milesWalked, setMilesWalked] = useState<number>(0);
  const [groupMembers, setGroupMembers] = useState<string[]>([
    currentUser.name || 'Rick Fannin',
  ]);
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [streetsWalked, setStreetsWalked] = useState<string[]>([]);
  const [customStreetInput, setCustomStreetInput] = useState('');

  // Counters
  const [interactionsCount, setInteractionsCount] = useState<number>(0);
  const [prayersCount, setPrayersCount] = useState<number>(0);
  const [serviceLinkagesCount, setServiceLinkagesCount] = useState<number>(0);
  const [trashBagsCount, setTrashBagsCount] = useState<number>(0);
  const [trashWeightLbs, setTrashWeightLbs] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Map Click Mode: 'route' | 'interaction' | 'prayer_pin'
  const [mapClickMode, setMapClickMode] = useState<
    'route' | 'interaction' | 'prayer_pin'
  >('route');
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isLoopClosed, setIsLoopClosed] = useState<boolean>(false);
  const [interactionSpots, setInteractionSpots] = useState<[number, number][]>(
    []
  );
  const [draftPins, setDraftPins] = useState<DraftPrayerPin[]>([]);

  // Draft Prayer / Service Pin Form inside Builder
  const [pinFirstName, setPinFirstName] = useState('');
  const [pinType, setPinType] = useState<EncounterType>('both');
  const [pinNeeds, setPinNeeds] = useState<NeedCategoryId[]>([]);
  const [pinDescription, setPinDescription] = useState('');
  const [pinStreet, setPinStreet] = useState('');
  const [pinCoords, setPinCoords] = useState<[number, number]>(
    CHILLICOTHE_CENTER
  );
  const [standalonePinDate, setStandalonePinDate] = useState<string>(
    new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  );

  const [savedToast, setSavedToast] = useState<string | null>(null);

  const recomputeRouteMiles = (pts: [number, number][]) => {
    if (pts.length < 2) {
      setMilesWalked(0);
      return;
    }
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += calculateDistanceMiles(
        pts[i - 1][0],
        pts[i - 1][1],
        pts[i][0],
        pts[i][1]
      );
    }
    setMilesWalked(Number(total.toFixed(2)));
  };

  // Close the route loop back to the starting point
  const handleEndAtStartingPoint = () => {
    if (routePoints.length < 2) return;
    const startPt = routePoints[0];
    const lastPt = routePoints[routePoints.length - 1];
    // Avoid duplicating if already at startPt
    if (lastPt[0] === startPt[0] && lastPt[1] === startPt[1]) {
      setIsLoopClosed(true);
      return;
    }
    const closedPts: [number, number][] = [...routePoints, [startPt[0], startPt[1]]];
    setRoutePoints(closedPts);
    setIsLoopClosed(true);
    recomputeRouteMiles(closedPts);
  };

  const handleMapClick = async (lat: number, lng: number) => {
    if (entryMode === 'standalone_pin' || mapClickMode === 'prayer_pin') {
      setPinCoords([lat, lng]);
      const detected = await reverseGeocodeStreet(lat, lng);
      if (detected) {
        setPinStreet(detected);
        if (!streetsWalked.includes(detected)) {
          setStreetsWalked((prev) => [...prev, detected]);
        }
      }
      return;
    }

    if (mapClickMode === 'route') {
      const nextPts: [number, number][] = [...routePoints, [lat, lng]];
      setRoutePoints(nextPts);
      setIsLoopClosed(false);
      recomputeRouteMiles(nextPts);

      // Also update default prayer pin coords to latest waypoint for convenience
      setPinCoords([lat, lng]);

      const detected = await reverseGeocodeStreet(lat, lng);
      if (detected) {
        setPinStreet(detected);
        setStreetsWalked((prev) =>
          prev.includes(detected) ? prev : [...prev, detected]
        );
      }
    } else if (mapClickMode === 'interaction') {
      setInteractionSpots((prev) => [...prev, [lat, lng]]);
      setInteractionsCount((c) => c + 1);
    }
  };

  const handleUndoRoutePoint = () => {
    setRoutePoints((prev) => {
      const next = prev.slice(0, -1);
      setIsLoopClosed(false);
      recomputeRouteMiles(next);
      return next;
    });
  };

  const handleClearRoute = () => {
    setRoutePoints([]);
    setIsLoopClosed(false);
    setMilesWalked(0);
  };

  const handleToggleStreet = (street: string) => {
    setStreetsWalked((prev) => {
      const exists = prev.includes(street);
      const next = exists
        ? prev.filter((s) => s !== street)
        : [...prev, street];

      if (!exists && STREET_COORDS_LOOKUP[street]) {
        const coord = STREET_COORDS_LOOKUP[street];
        setRoutePoints((rPrev) => {
          const nextRoute: [number, number][] = [...rPrev, coord];
          recomputeRouteMiles(nextRoute);
          return nextRoute;
        });
      }
      return next;
    });
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

  const handleTogglePinNeed = (id: NeedCategoryId) => {
    setPinNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]
    );
  };

  const handleAddDraftPinToWalk = () => {
    const cleanName = pinFirstName.trim() || 'Community Friend';
    const cleanDesc =
      pinDescription.trim() ||
      `Prayed with ${cleanName} on ${
        pinStreet || streetsWalked[0] || 'the street'
      }.`;

    const newDraft: DraftPrayerPin = {
      id: `draft-pin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      firstName: cleanName,
      type: pinType,
      needCategories: pinNeeds,
      description: cleanDesc,
      streetName: pinStreet.trim() || streetsWalked[0] || 'Paint St',
      lat: pinCoords[0],
      lng: pinCoords[1],
    };

    const nextDrafts = [...draftPins, newDraft];
    setDraftPins(nextDrafts);
    setPrayersCount((c) => Math.max(c, nextDrafts.length));
    setInteractionsCount((c) => Math.max(c, nextDrafts.length));
    if (pinType === 'service' || pinType === 'both' || pinNeeds.length > 0) {
      setServiceLinkagesCount((c) => c + 1);
    }

    setPinFirstName('');
    setPinDescription('');
    setPinNeeds([]);
  };

  const handleSaveFullHistoricalWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const walkId = `walk-hist-${Date.now()}`;
    const normalizedDate =
      parseFlexibleDateToIso(walkDate) ||
      (/^\d{4}-\d{2}-\d{2}$/.test(walkDate)
        ? walkDate
        : new Date().toISOString().slice(0, 10));
    const parsedStartMs = Date.parse(`${normalizedDate}T14:00:00.000Z`);
    const safeStartMs = Number.isNaN(parsedStartMs)
      ? Date.now()
      : parsedStartMs;
    const startIso = new Date(safeStartMs).toISOString();
    const endIso = new Date(
      safeStartMs + Math.max(1, durationMinutes) * 60000
    ).toISOString();

    const finalRoute: [number, number][] =
      routePoints.length >= 2
        ? routePoints
        : routePoints.length === 1
        ? [
            routePoints[0],
            [routePoints[0][0] + 0.0018, routePoints[0][1] + 0.0015],
            routePoints[0],
          ]
        : [
            CHILLICOTHE_CENTER,
            [CHILLICOTHE_CENTER[0] + 0.002, CHILLICOTHE_CENTER[1] + 0.0015],
            CHILLICOTHE_CENTER,
          ];

    const groupSize = Math.max(1, groupMembers.length);
    const volHours = Number(((durationMinutes / 60) * groupSize).toFixed(2));
    const finalMiles =
      milesWalked > 0
        ? Number(milesWalked.toFixed(2))
        : Number(Math.max(0.5, (durationMinutes / 60) * 1.2).toFixed(2));

    // Automatically include any typed person in the Prayer Pin inputs even if the user didn't click "Add Person to This Walk" first
    const allDraftPins: DraftPrayerPin[] = [...draftPins];
    if (pinFirstName.trim() || pinDescription.trim() || pinNeeds.length > 0) {
      const cleanName = pinFirstName.trim() || 'Community Friend';
      const cleanDesc =
        pinDescription.trim() ||
        `Prayed with ${cleanName} on ${
          pinStreet || streetsWalked[0] || 'the street'
        }.`;
      allDraftPins.push({
        id: `draft-pin-auto-${Date.now()}`,
        firstName: cleanName,
        type: pinType,
        needCategories: pinNeeds,
        description: cleanDesc,
        streetName: pinStreet.trim() || streetsWalked[0] || 'Paint St',
        lat: finalRoute[Math.floor(finalRoute.length / 2)]?.[0] ?? pinCoords[0],
        lng: finalRoute[Math.floor(finalRoute.length / 2)]?.[1] ?? pinCoords[1],
      });
    }

    const builtPins: EncounterPin[] = allDraftPins.map((dp, idx) => ({
      id: `pin-hist-${Date.now()}-${idx}`,
      walkId,
      timestamp: new Date(
        new Date(startIso).getTime() + (idx + 1) * 600000
      ).toISOString(),
      lat: dp.lat,
      lng: dp.lng,
      streetName: dp.streetName,
      firstName: dp.firstName,
      description: dp.description,
      type: dp.type,
      needCategories: dp.needCategories,
      loggedByRecorder: currentUser.name,
      groupMembers,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    }));

    const builtInteractions: CommunityInteractionPoint[] = [
      ...interactionSpots.map((pt, idx) => ({
        id: `int-hist-${Date.now()}-${idx}`,
        walkId,
        lat: pt[0],
        lng: pt[1],
        streetName: streetsWalked[0] || 'Chillicothe Outreach',
        timestamp: startIso,
        kind: 'interaction' as const,
      })),
      ...builtPins.map((bp) => ({
        id: `int-pin-${bp.id}`,
        walkId,
        lat: bp.lat,
        lng: bp.lng,
        streetName: bp.streetName,
        timestamp: bp.timestamp,
        kind:
          bp.type === 'service' ? ('service' as const) : ('prayer' as const),
      })),
    ];

    const newWalk: WalkSession = {
      id: walkId,
      date: normalizedDate,
      startTime: startIso,
      endTime: endIso,
      durationMinutes,
      recorderName: currentUser.name,
      recorderEmail: currentUser.email,
      groupMembers,
      groupSize,
      volunteerHours: volHours,
      milesWalked: finalMiles,
      streetsWalked:
        streetsWalked.length > 0 ? streetsWalked : ['Chillicothe Street Walk'],
      startPoint: {
        lat: finalRoute[0][0],
        lng: finalRoute[0][1],
        streetName: streetsWalked[0] || 'Starting Point',
        timestamp: startIso,
      },
      endPoint: {
        lat: finalRoute[finalRoute.length - 1][0],
        lng: finalRoute[finalRoute.length - 1][1],
        streetName: isLoopClosed
          ? streetsWalked[0] || 'Starting Point'
          : streetsWalked[streetsWalked.length - 1] || 'End Point',
        timestamp: endIso,
      },
      gpsPath: finalRoute,
      interactionLocations: builtInteractions,
      interactionsCount,
      prayersCount: Math.max(prayersCount, builtPins.length),
      serviceLinkagesCount,
      trashBagsCount,
      trashWeightLbs,
      notes: notes.trim() || undefined,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    onSaveHistoricalWalk(newWalk, builtPins);
    setRoutePoints([]);
    setIsLoopClosed(false);
    setMilesWalked(0);
    setStreetsWalked([]);
    setDraftPins([]);
    setPinFirstName('');
    setPinDescription('');
    setPinNeeds([]);
    setInteractionSpots([]);
    setInteractionsCount(0);
    setPrayersCount(0);
    setServiceLinkagesCount(0);
    setTrashBagsCount(0);
    setTrashWeightLbs(0);
    setNotes('');
    setSavedToast(
      `✅ Walk Saved Successfully! Date: ${normalizedDate} • Distance: ${finalMiles} mi • Volunteer Hours: ${volHours} hrs • Prayer Pins: ${builtPins.length}`
    );
    setTimeout(() => setSavedToast(null), 12000);
  };

  const handleSaveSinglePastPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = pinFirstName.trim() || 'Community Friend';
    const cleanDesc =
      pinDescription.trim() ||
      `Prayed with ${cleanName} on ${pinStreet || 'the street'}.`;

    const pin: EncounterPin = {
      id: `pin-past-${Date.now()}`,
      walkId: 'walk-historical-standalone',
      timestamp: `${standalonePinDate}T15:00:00.000Z`,
      lat: pinCoords[0],
      lng: pinCoords[1],
      streetName: pinStreet.trim() || 'Paint St',
      firstName: cleanName,
      description: cleanDesc,
      type: pinType,
      needCategories: pinNeeds,
      loggedByRecorder: currentUser.name,
      groupMembers,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    onSaveStandalonePin(pin);
    setPinFirstName('');
    setPinDescription('');
    setPinNeeds([]);
    setSavedToast(
      `Saved past prayer/service pin for ${cleanName} on ${pin.streetName} (${standalonePinDate})!`
    );
    setTimeout(() => setSavedToast(null), 5000);
  };

  // Intermediate waypoints (excluding start point, and excluding final point if loop is closed)
  const intermediateWaypoints = routePoints.slice(
    1,
    isLoopClosed ? routePoints.length - 1 : routePoints.length
  );

  return (
    <section className="p-4 sm:p-6 rounded-2xl bg-slateDark-900 border-2 border-phoenix-500/40 shadow-2xl space-y-5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-phoenix-500/20 border border-phoenix-500/40 flex items-center justify-center text-phoenix-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Log Past Street Walk (Click Start → Waypoints → Return to Start)
            </h2>
            <p className="text-xs text-slate-400">
              Plot your starting point, waypoints along the streets you walked, and close the loop back at the starting point
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slateDark-950 p-1.5 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setEntryMode('full_walk')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
              entryMode === 'full_walk'
                ? 'bg-phoenix-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🚶 Log Past Walk & Route
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('standalone_pin')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${
              entryMode === 'standalone_pin'
                ? 'bg-phoenix-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🙏 Add Single Past Prayer Pin
          </button>
        </div>
      </div>

      {savedToast && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{savedToast}</span>
          </div>
          {onViewMap && (
            <button
              type="button"
              onClick={onViewMap}
              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slateDark-950 font-black text-xs shrink-0"
            >
              View on Map
            </button>
          )}
        </div>
      )}

      {entryMode === 'full_walk' ? (
        <form
          onSubmit={handleSaveFullHistoricalWalk}
          noValidate
          className="space-y-5"
        >
          {/* STEP 1: INTERACTIVE ROUTE PLOTTER (Start -> Waypoints -> End at Start) */}
          <div className="p-4 rounded-2xl bg-slateDark-950 border-2 border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-phoenix-400">
                  Step 1 • Plot Your Walk Route on the Map
                </span>
                <h3 className="text-sm sm:text-base font-black text-white">
                  {routePoints.length === 0
                    ? '1️⃣ Click on the map where your walk STARTED (🏁)'
                    : !isLoopClosed
                    ? `2️⃣ Click waypoints along the streets you walked (${intermediateWaypoints.length} waypoints), then click "End at Starting Point"`
                    : '✅ Route Complete! Started, walked waypoints, and ended back at Starting Point'}
                </h3>
              </div>

              {/* Map Click Tool Switcher */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapClickMode('route')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                    mapClickMode === 'route'
                      ? 'bg-phoenix-600 text-white border-phoenix-400 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛣️ Plot Route Waypoints
                </button>
                <button
                  type="button"
                  onClick={() => setMapClickMode('interaction')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                    mapClickMode === 'interaction'
                      ? 'bg-sky-500 text-slateDark-950 border-sky-300 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  👋 Drop Interaction ({interactionSpots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMapClickMode('prayer_pin')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                    mapClickMode === 'prayer_pin'
                      ? 'bg-amber-500 text-slateDark-950 border-amber-300 shadow'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🙏 Position Prayer Pin
                </button>
              </div>
            </div>

            {/* Route Action Bar: End at Start, Undo, Clear, Live Distance */}
            <div className="p-3 rounded-xl bg-slateDark-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {routePoints.length === 0
                      ? 'Start Point: Not set yet (Click map)'
                      : isLoopClosed
                      ? 'Loop Closed (Start ➔ Waypoints ➔ Start)'
                      : `Start Set + ${intermediateWaypoints.length} Waypoint${
                          intermediateWaypoints.length === 1 ? '' : 's'
                        }`}
                  </span>
                </span>

                <span className="text-slate-300 font-bold">
                  📏 Route Distance:{' '}
                  <strong className="text-phoenix-300 text-sm">
                    {milesWalked} miles
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* END AT STARTING POINT BUTTON */}
                <button
                  type="button"
                  disabled={routePoints.length < 2 || isLoopClosed}
                  onClick={handleEndAtStartingPoint}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition ${
                    routePoints.length >= 2 && !isLoopClosed
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slateDark-950 shadow-lg shadow-emerald-500/25 animate-pulse'
                      : isLoopClosed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>
                    {isLoopClosed
                      ? '✓ Ended at Starting Point'
                      : '🔄 End Walk at Starting Point'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={routePoints.length === 0}
                  onClick={handleUndoRoutePoint}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold inline-flex items-center gap-1"
                >
                  <CornerUpLeft className="w-3.5 h-3.5" />
                  <span>Undo Last Point</span>
                </button>

                <button
                  type="button"
                  disabled={routePoints.length === 0}
                  onClick={handleClearRoute}
                  className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 text-rose-300 text-xs font-bold inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Route</span>
                </button>
              </div>
            </div>

            {/* Interactive Leaflet Map */}
            <div className="rounded-2xl overflow-hidden border-2 border-slate-800 h-80 sm:h-96 relative">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-[500] px-3.5 py-1.5 rounded-full bg-slateDark-950/90 backdrop-blur border border-phoenix-500/40 text-[11px] font-extrabold text-phoenix-200 shadow-lg pointer-events-none text-center">
                {mapClickMode === 'route' &&
                  (routePoints.length === 0
                    ? '👆 Click the map to set your 🏁 Starting Point'
                    : !isLoopClosed
                    ? '👆 Click waypoints along your route (or click 🏁 Start marker / button above to return to Start)'
                    : '✅ Loop closed back at Starting Point! You can still add Prayer Pins below.')}
                {mapClickMode === 'interaction' &&
                  '👆 Click on the map where you had community interactions'}
                {mapClickMode === 'prayer_pin' &&
                  '👆 Click on the map to set the location for the Prayer Pin below'}
              </div>

              <MapContainer
                center={CHILLICOTHE_CENTER}
                zoom={15}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickCapture onMapClick={handleMapClick} />

                {/* Starting Point (Clicking it when >= 2 points also closes the loop back to start!) */}
                {routePoints.length > 0 && (
                  <Marker
                    position={routePoints[0]}
                    icon={startFinishIcon(isLoopClosed)}
                    eventHandlers={{
                      click: () => {
                        if (routePoints.length >= 2 && !isLoopClosed) {
                          handleEndAtStartingPoint();
                        }
                      },
                    }}
                  >
                    <Popup>
                      <div className="text-xs space-y-1">
                        <strong className="text-emerald-400 block">
                          🏁 {isLoopClosed ? 'Start & Finish Point' : 'Starting Point'}
                        </strong>
                        {!isLoopClosed && routePoints.length >= 2 && (
                          <button
                            type="button"
                            onClick={handleEndAtStartingPoint}
                            className="px-2.5 py-1 rounded bg-emerald-500 text-slateDark-950 font-extrabold text-[11px]"
                          >
                            End Walk Here (Close Loop)
                          </button>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Numbered Waypoints Along the Way */}
                {intermediateWaypoints.map((pt, idx) => (
                  <Marker
                    key={`wp-${idx}-${pt[0]}-${pt[1]}`}
                    position={pt}
                    icon={createWaypointIcon(idx + 1)}
                  >
                    <Popup>
                      <div className="text-xs font-bold">
                        📍 Waypoint #{idx + 1} ({pt[0].toFixed(4)},{' '}
                        {pt[1].toFixed(4)})
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Walked Route Polyline */}
                {routePoints.length >= 2 && (
                  <Polyline
                    positions={routePoints}
                    pathOptions={{
                      color: isLoopClosed ? '#10b981' : '#f97316',
                      weight: 5,
                      opacity: 0.9,
                    }}
                  />
                )}

                {/* Community Interaction Spots */}
                {interactionSpots.map((pt, i) => (
                  <Marker key={i} position={pt} icon={interactionIcon}>
                    <Popup>👋 Community Interaction #{i + 1}</Popup>
                  </Marker>
                ))}

                {/* Draft Prayer Pins */}
                {draftPins.map((dp) => (
                  <Marker
                    key={dp.id}
                    position={[dp.lat, dp.lng]}
                    icon={prayerIcon}
                  >
                    <Popup>
                      <strong>🙏 {dp.firstName}</strong>: {dp.description}
                    </Popup>
                  </Marker>
                ))}

                {mapClickMode === 'prayer_pin' && (
                  <Marker position={pinCoords} icon={prayerIcon}>
                    <Popup>📍 Selected Prayer Pin Location</Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
          </div>

          {/* STEP 2: DATE, TIME, DISTANCE & GROUP ROSTER */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <DateInputWithCalendar
              label="Date of Walk (Type or Pick Calendar)"
              required
              value={walkDate}
              onChange={setWalkDate}
            />

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Duration (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="5"
                  required
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(1, parseInt(e.target.value) || 60))
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm font-bold text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Distance (Miles — Auto from Route)
              </label>
              <div className="relative">
                <Route className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={milesWalked}
                  onChange={(e) =>
                    setMilesWalked(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm font-bold text-emerald-400"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slateDark-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-400">
                Total Volunteer Hours:
              </span>
              <span className="text-lg font-black text-amber-300">
                {Number(
                  ((durationMinutes / 60) * Math.max(1, groupMembers.length)).toFixed(
                    2
                  )
                )}{' '}
                Vol. Hrs
              </span>
              <span className="text-[10px] text-slate-500">
                ({groupMembers.length} in group × {(durationMinutes / 60).toFixed(1)}h)
              </span>
            </div>
          </div>

          {/* Group Members Roster (Multi-Select Dropdown of All Previous Walkers + Add New Person) */}
          <WalkParticipantsSelector
            selectedMembers={groupMembers}
            onChangeMembers={setGroupMembers}
            allKnownPeople={[
              ...allUsers.map((u) => u.name),
              ...allKnownPeople,
            ]}
            onAddNewPerson={onAddNewPerson}
            label="Who Was Involved in This Walk?"
            helperText="Open the dropdown to select multiple people from previous walks, or add a new person"
          />

          {/* STEP 3: WALK COUNTERS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-blue-300 mb-1">
                👋 Public Interactions
              </label>
              <input
                type="number"
                min="0"
                value={interactionsCount}
                onChange={(e) =>
                  setInteractionsCount(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-full px-3 py-2 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-300 mb-1">
                🙏 People Prayed For
              </label>
              <input
                type="number"
                min="0"
                value={prayersCount}
                onChange={(e) =>
                  setPrayersCount(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-full px-3 py-2 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-emerald-300 mb-1">
                🤝 Service Linkages
              </label>
              <input
                type="number"
                min="0"
                value={serviceLinkagesCount}
                onChange={(e) =>
                  setServiceLinkagesCount(
                    Math.max(0, parseInt(e.target.value) || 0)
                  )
                }
                className="w-full px-3 py-2 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-purple-300 mb-1">
                🗑️ Trash Bags
              </label>
              <input
                type="number"
                min="0"
                value={trashBagsCount}
                onChange={(e) => {
                  const bags = Math.max(0, parseInt(e.target.value) || 0);
                  setTrashBagsCount(bags);
                  setTrashWeightLbs(bags * lbsPerTrashBag);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-purple-300 mb-1">
                ⚖️ Trash Weight (Lbs)
              </label>
              <input
                type="number"
                min="0"
                value={trashWeightLbs}
                onChange={(e) =>
                  setTrashWeightLbs(Math.max(0, parseInt(e.target.value) || 0))
                }
                className="w-full px-3 py-2 rounded-xl bg-slateDark-950 border border-slate-700 text-sm font-black text-purple-300"
              />
            </div>
          </div>

          {/* Streets Walked (Auto-detected from waypoints + manual tags) */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span>
                Streets Walked (Auto-filled as you click waypoints on the map, or tap below)
              </span>
            </label>
            {streetsWalked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {streetsWalked.map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-phoenix-500/20 border border-phoenix-500/40 text-xs font-bold text-phoenix-200"
                  >
                    <span>📍 {st}</span>
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
            <div className="flex flex-wrap gap-1.5">
              {COMMON_STREETS_PRESETS.map((st) => {
                const active = streetsWalked.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleToggleStreet(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      active
                        ? 'bg-phoenix-600 text-white border-phoenix-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {active ? `✓ ${st}` : `+ ${st}`}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customStreetInput}
                onChange={(e) => setCustomStreetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomStreet(e);
                  }
                }}
                placeholder="Or type any custom street name..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddCustomStreet}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-white border border-slate-700"
              >
                + Add Street
              </button>
            </div>
          </div>

          {/* STEP 4: ADD PEOPLE PRAYED FOR / LINKED ON THIS PAST WALK */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4" />
                <span>
                  People Prayed For / Linked on This Past Walk (
                  {draftPins.length} added)
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Optional — add each person you prayed for on this walk
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={pinFirstName}
                onChange={(e) => setPinFirstName(e.target.value)}
                placeholder="First Name (e.g., Marcus)"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />

              <input
                type="text"
                value={pinStreet}
                onChange={(e) => setPinStreet(e.target.value)}
                placeholder="Street Name (e.g., Paint St)"
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />

              <select
                value={pinType}
                onChange={(e) => setPinType(e.target.value as EncounterType)}
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-bold"
              >
                <option value="both">✨ Prayed + Linked to Service</option>
                <option value="prayer">🙏 Prayed With Only</option>
                <option value="service">🤝 Service Linkage Only</option>
              </select>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {NEED_CATEGORIES.map((cat) => {
                const selected = pinNeeds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleTogglePinNeed(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      selected
                        ? `${cat.colorClass}`
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {cat.emoji} {cat.shortLabel}
                    {selected && <Check className="w-3 h-3 inline ml-1" />}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={pinDescription}
                onChange={(e) => setPinDescription(e.target.value)}
                placeholder="Brief description of prayer request or service connected..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddDraftPinToWalk}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slateDark-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Person to This Walk</span>
              </button>
            </div>

            {draftPins.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {draftPins.map((dp) => (
                  <div
                    key={dp.id}
                    className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <strong className="text-white">🙏 {dp.firstName}</strong>{' '}
                      <span className="text-phoenix-300">
                        ({dp.streetName})
                      </span>{' '}
                      — <span className="text-slate-300">{dp.description}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftPins((prev) =>
                          prev.filter((item) => item.id !== dp.id)
                        )
                      }
                      className="text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Walk Notes & Submit */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Walk Notes / Highlights
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional summary of this historical outreach walk..."
              className="w-full p-3 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
            />
          </div>

          {/* Confirmation Message Right Above Save Button */}
          {savedToast && (
            <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-100 shadow-xl space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm sm:text-base font-black text-emerald-300">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <span>{savedToast}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onViewMap && (
                  <button
                    type="button"
                    onClick={onViewMap}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slateDark-950 font-black text-xs shadow"
                  >
                    🗺️ View on Street & Prayer Map
                  </button>
                )}
                {onViewImpact && (
                  <button
                    type="button"
                    onClick={onViewImpact}
                    className="px-4 py-2 rounded-xl bg-phoenix-600 hover:bg-phoenix-500 text-white font-black text-xs shadow"
                  >
                    📊 View in Outreach Group Walk Log
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-black text-sm sm:text-base shadow-xl shadow-phoenix-600/25 flex items-center justify-center gap-2 transition"
          >
            <Save className="w-5 h-5" />
            <span>
              Save Past Walk, Route ({milesWalked} mi) & {draftPins.length} Prayer
              Pins to Cloud
            </span>
          </button>
        </form>
      ) : (
        /* Standalone Past Prayer / Service Pin Form */
        <form onSubmit={handleSaveSinglePastPin} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <DateInputWithCalendar
              label="Date of Prayer / Encounter"
              required
              value={standalonePinDate}
              onChange={setStandalonePinDate}
            />

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                First Name of Person
              </label>
              <input
                type="text"
                required
                value={pinFirstName}
                onChange={(e) => setPinFirstName(e.target.value)}
                placeholder="e.g., Marcus"
                className="w-full px-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Street Name
              </label>
              <input
                type="text"
                required
                value={pinStreet}
                onChange={(e) => setPinStreet(e.target.value)}
                placeholder="e.g., Paint St & E Main St"
                className="w-full px-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {NEED_CATEGORIES.map((cat) => {
              const selected = pinNeeds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleTogglePinNeed(cat.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                    selected
                      ? `${cat.colorClass}`
                      : 'bg-slateDark-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {cat.emoji} {cat.shortLabel}
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Brief Description / Prayer Note
            </label>
            <textarea
              rows={2}
              required
              value={pinDescription}
              onChange={(e) => setPinDescription(e.target.value)}
              placeholder="What did you pray for or connect them with?"
              className="w-full p-3 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-phoenix-400" />
              <span>
                Click anywhere on the map below to place this past Prayer Pin (
                {pinCoords[0].toFixed(4)}, {pinCoords[1].toFixed(4)})
              </span>
            </span>
            <div className="rounded-xl overflow-hidden border border-slate-800 h-60">
              <MapContainer
                center={CHILLICOTHE_CENTER}
                zoom={15}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickCapture onMapClick={handleMapClick} />
                <Marker position={pinCoords} icon={prayerIcon}>
                  <Popup>📍 Pin Location</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-phoenix-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <Sparkles className="w-4 h-4" />
            <span>Save Past Prayer Pin to Map & Cloud</span>
          </button>
        </form>
      )}
    </section>
  );
};
