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
  Footprints,
  HeartHandshake,
  MapPin,
  Plus,
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

interface HistoricalOutreachBuilderProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  lbsPerTrashBag: number;
  onSaveHistoricalWalk: (walk: WalkSession, newPins: EncounterPin[]) => void;
  onSaveStandalonePin: (pin: EncounterPin) => void;
}

// Preset coordinates for common Chillicothe streets so tapping street chips can also auto-build a route
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

const startIcon = L.divIcon({
  className: 'hist-start-icon',
  html: `<div style="width:28px;height:28px;border-radius:9999px;background:#10b981;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:13px;">🏁</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
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
  lbsPerTrashBag,
  onSaveHistoricalWalk,
  onSaveStandalonePin,
}) => {
  const [entryMode, setEntryMode] = useState<'full_walk' | 'standalone_pin'>(
    'full_walk'
  );

  // Past Walk State
  const [walkDate, setWalkDate] = useState<string>(
    new Date(Date.now() - 86400000 * 7).toISOString().slice(0, 10)
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [milesWalked, setMilesWalked] = useState<number>(2.0);
  const [groupMembers, setGroupMembers] = useState<string[]>([
    currentUser.name || 'Rick Fannin',
  ]);
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [streetsWalked, setStreetsWalked] = useState<string[]>(['Paint St']);
  const [customStreetInput, setCustomStreetInput] = useState('');

  // Counters
  const [interactionsCount, setInteractionsCount] = useState<number>(15);
  const [prayersCount, setPrayersCount] = useState<number>(3);
  const [serviceLinkagesCount, setServiceLinkagesCount] = useState<number>(2);
  const [trashBagsCount, setTrashBagsCount] = useState<number>(2);
  const [trashWeightLbs, setTrashWeightLbs] = useState<number>(
    2 * lbsPerTrashBag
  );
  const [notes, setNotes] = useState<string>('');

  // Map Click Mode: 'route' | 'interaction' | 'prayer_pin'
  const [mapClickMode, setMapClickMode] = useState<
    'route' | 'interaction' | 'prayer_pin'
  >('route');
  const [routePoints, setRoutePoints] = useState<[number, number][]>([
    [39.3318, -82.9824],
    [39.3348, -82.9823],
  ]);
  const [interactionSpots, setInteractionSpots] = useState<[number, number][]>(
    []
  );
  const [draftPins, setDraftPins] = useState<DraftPrayerPin[]>([]);

  // Draft Prayer / Service Pin Form inside Builder
  const [pinFirstName, setPinFirstName] = useState('');
  const [pinType, setPinType] = useState<EncounterType>('both');
  const [pinNeeds, setPinNeeds] = useState<NeedCategoryId[]>([]);
  const [pinDescription, setPinDescription] = useState('');
  const [pinStreet, setPinStreet] = useState('Paint St');
  const [pinCoords, setPinCoords] = useState<[number, number]>(
    CHILLICOTHE_CENTER
  );
  const [standalonePinDate, setStandalonePinDate] = useState<string>(
    new Date(Date.now() - 86400000 * 3).toISOString().slice(0, 10)
  );

  const [savedToast, setSavedToast] = useState<string | null>(null);

  const recomputeRouteMiles = (pts: [number, number][]) => {
    if (pts.length < 2) return;
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += calculateDistanceMiles(
        pts[i - 1][0],
        pts[i - 1][1],
        pts[i][0],
        pts[i][1]
      );
    }
    if (total > 0.05) {
      setMilesWalked(Number(total.toFixed(2)));
    }
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
      recomputeRouteMiles(nextPts);
      const detected = await reverseGeocodeStreet(lat, lng);
      if (detected && !streetsWalked.includes(detected)) {
        setStreetsWalked((prev) => [...prev, detected]);
      }
    } else if (mapClickMode === 'interaction') {
      setInteractionSpots((prev) => [...prev, [lat, lng]]);
      setInteractionsCount((c) => Math.max(c, interactionSpots.length + 1));
    }
  };

  const handleToggleStreet = (street: string) => {
    setStreetsWalked((prev) => {
      const exists = prev.includes(street);
      const next = exists
        ? prev.filter((s) => s !== street)
        : [...prev, street];

      // If adding a known Chillicothe street, also append its coordinates to the route if not already there
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
      `Prayed with ${cleanName} on ${pinStreet || 'the street'}.`;

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
    if (pinType === 'service' || pinType === 'both' || pinNeeds.length > 0) {
      setServiceLinkagesCount((c) => c + 1);
    }

    // Reset pin inputs for next person
    setPinFirstName('');
    setPinDescription('');
    setPinNeeds([]);
    // Slightly offset coords for next pin convenience
    setPinCoords([
      Number((pinCoords[0] + 0.0006).toFixed(5)),
      Number((pinCoords[1] - 0.0005).toFixed(5)),
    ]);
  };

  const handleSaveFullHistoricalWalk = (e: React.FormEvent) => {
    e.preventDefault();
    const walkId = `walk-hist-${Date.now()}`;
    const startIso = `${walkDate}T14:00:00.000Z`;
    const endIso = new Date(
      new Date(startIso).getTime() + durationMinutes * 60000
    ).toISOString();

    const finalRoute: [number, number][] =
      routePoints.length >= 2
        ? routePoints
        : [
            CHILLICOTHE_CENTER,
            [CHILLICOTHE_CENTER[0] + 0.0025, CHILLICOTHE_CENTER[1] + 0.0015],
          ];

    const groupSize = Math.max(1, groupMembers.length);
    const volHours = Number(((durationMinutes / 60) * groupSize).toFixed(2));

    const builtPins: EncounterPin[] = draftPins.map((dp, idx) => ({
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
        streetName: streetsWalked[0] || 'Paint St',
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
      date: walkDate,
      startTime: startIso,
      endTime: endIso,
      durationMinutes,
      recorderName: currentUser.name,
      recorderEmail: currentUser.email,
      groupMembers,
      groupSize,
      volunteerHours: volHours,
      milesWalked: Number(milesWalked.toFixed(2)),
      streetsWalked:
        streetsWalked.length > 0 ? streetsWalked : ['Downtown Chillicothe'],
      startPoint: {
        lat: finalRoute[0][0],
        lng: finalRoute[0][1],
        streetName: streetsWalked[0] || 'Paint St',
        timestamp: startIso,
      },
      endPoint: {
        lat: finalRoute[finalRoute.length - 1][0],
        lng: finalRoute[finalRoute.length - 1][1],
        streetName:
          streetsWalked[streetsWalked.length - 1] ||
          streetsWalked[0] ||
          'Paint St',
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
    setDraftPins([]);
    setInteractionSpots([]);
    setNotes('');
    setSavedToast(
      `Saved historical walk for ${walkDate} (${newWalk.milesWalked} mi, ${volHours} vol hrs, and ${builtPins.length} prayer pins)!`
    );
    setTimeout(() => setSavedToast(null), 6000);
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

  return (
    <section className="p-5 rounded-2xl bg-slateDark-900 border-2 border-phoenix-500/40 shadow-2xl space-y-5">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-phoenix-500/20 border border-phoenix-500/40 flex items-center justify-center text-phoenix-400 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Add Past Walks, Routes & Prayers (Historical Backfill)
            </h2>
            <p className="text-xs text-slate-400">
              Manually enter street walks, routes, counters, and people prayed for from trips made before this app was created
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
            🚶 Add Past Walk + Route + Pins
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
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {entryMode === 'full_walk' ? (
        <form onSubmit={handleSaveFullHistoricalWalk} className="space-y-5">
          {/* Row 1: Date, Duration, Miles & Volunteer Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Date of Past Walk
              </label>
              <input
                type="date"
                required
                value={walkDate}
                onChange={(e) => setWalkDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm text-white"
              />
            </div>

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
                Distance (Miles Walked)
              </label>
              <div className="relative">
                <Route className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={milesWalked}
                  onChange={(e) =>
                    setMilesWalked(Math.max(0.1, parseFloat(e.target.value) || 1))
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs sm:text-sm font-bold text-emerald-400"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slateDark-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-400">
                Auto Total Volunteer Hours:
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

          {/* Row 2: Group Members Roster */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-phoenix-400" />
              <span>Who Walked in This Group? (2–3 Volunteers)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {groupMembers.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-phoenix-600/25 border border-phoenix-500/40 text-xs font-bold text-white"
                >
                  <span>👟 {m}</span>
                  {groupMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGroupMembers((prev) => prev.filter((x) => x !== m))
                      }
                      className="hover:text-rose-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {allUsers
                .filter((u) => !groupMembers.includes(u.name))
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setGroupMembers((prev) => [...prev, u.name])}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-700"
                  >
                    + {u.name}
                  </button>
                ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="text"
                  value={newPartnerInput}
                  onChange={(e) => setNewPartnerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newPartnerInput.trim()) {
                        setGroupMembers((prev) => [
                          ...prev,
                          newPartnerInput.trim(),
                        ]);
                        setNewPartnerInput('');
                      }
                    }
                  }}
                  placeholder="Add partner name..."
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newPartnerInput.trim()) {
                      setGroupMembers((prev) => [
                        ...prev,
                        newPartnerInput.trim(),
                      ]);
                      setNewPartnerInput('');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-phoenix-300 border border-slate-700"
                >
                  <UserPlus className="w-3.5 h-3.5 inline mr-1" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Walk Counters */}
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

          {/* Row 4: Streets Walked */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span>
                Streets Walked (Tapping a street also adds it to the route line!)
              </span>
            </label>
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

          {/* Row 5: Interactive Route, Interaction & Prayer Pin Map Designer */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-extrabold text-white">
                  Interactive Past Route & Pin Map Designer
                </h3>
                <p className="text-[11px] text-slate-400">
                  Choose what clicking on the map does below: draw your walked route, drop interaction spots, or place a prayer pin
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapClickMode('route')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                    mapClickMode === 'route'
                      ? 'bg-phoenix-600 text-white border-phoenix-400'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  🛣️ Click Map to Draw Route ({routePoints.length} pts)
                </button>
                <button
                  type="button"
                  onClick={() => setMapClickMode('interaction')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                    mapClickMode === 'interaction'
                      ? 'bg-sky-500 text-slateDark-950 border-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  👋 Click Map to Add Interaction ({interactionSpots.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMapClickMode('prayer_pin')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition ${
                    mapClickMode === 'prayer_pin'
                      ? 'bg-amber-500 text-slateDark-950 border-amber-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  🙏 Click Map to Position Prayer Pin
                </button>
              </div>
            </div>

            {/* Route Undo / Clear Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">
                {mapClickMode === 'route' &&
                  '👆 Click along the streets on the map to trace the route you walked (first point is 🏁 Start Point).'}
                {mapClickMode === 'interaction' &&
                  '👆 Click on the map wherever your group had community interactions.'}
                {mapClickMode === 'prayer_pin' &&
                  `👆 Click on the map to set the location for the Prayer Pin form below (${pinCoords[0].toFixed(
                    4
                  )}, ${pinCoords[1].toFixed(4)}).`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRoutePoints((prev) => prev.slice(0, -1));
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo Route Point</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutePoints([])}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300"
                >
                  Clear Route
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 h-72">
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

                {routePoints.length > 0 && (
                  <Marker position={routePoints[0]} icon={startIcon}>
                    <Popup>🏁 Walk Starting Point</Popup>
                  </Marker>
                )}

                {routePoints.length >= 2 && (
                  <Polyline
                    positions={routePoints}
                    pathOptions={{ color: '#f97316', weight: 5, opacity: 0.9 }}
                  />
                )}

                {interactionSpots.map((pt, i) => (
                  <Marker key={i} position={pt} icon={interactionIcon}>
                    <Popup>👋 Community Interaction #{i + 1}</Popup>
                  </Marker>
                ))}

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

          {/* Row 6: Add People Prayed For / Service Linkages on This Past Walk */}
          <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-extrabold text-amber-300 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4" />
                <span>
                  Add People Prayed For / Linked on This Past Walk (
                  {draftPins.length} added)
                </span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Add as many people as you prayed with on this walk
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

            {/* List of Added Draft Pins */}
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

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-black text-sm sm:text-base shadow-xl shadow-phoenix-600/25 flex items-center justify-center gap-2 transition"
          >
            <Save className="w-5 h-5" />
            <span>
              Save Historical Walk, Route & {draftPins.length} Prayer Pins to Cloud
            </span>
          </button>
        </form>
      ) : (
        /* Standalone Past Prayer / Service Pin Form */
        <form onSubmit={handleSaveSinglePastPin} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Date of Prayer / Encounter
              </label>
              <input
                type="date"
                required
                value={standalonePinDate}
                onChange={(e) => setStandalonePinDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
              />
            </div>

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
