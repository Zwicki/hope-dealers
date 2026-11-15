import React, { useEffect, useState } from 'react';
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
  Clock,
  CornerUpLeft,
  Flag,
  Footprints,
  Repeat,
  RotateCcw,
  Route,
  Save,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  CHILLICOTHE_CENTER,
  COMMON_STREETS_PRESETS,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';
import {
  calculateDistanceMiles,
  reverseGeocodeStreet,
} from '../services/cloudSyncService';
import {
  DateInputWithCalendar,
  WalkParticipantsSelector,
} from './WalkFormControls';

interface EditWalkModalProps {
  isOpen: boolean;
  walk: WalkSession | null;
  allUsers: UserAccount[];
  allKnownPeople?: string[];
  onAddNewPerson?: (name: string) => void;
  lbsPerTrashBag: number;
  onClose: () => void;
  onSaveWalk: (updatedWalk: WalkSession) => void;
}

const startFinishIcon = L.divIcon({
  className: 'edit-walk-start-icon',
  html: `<div style="
    width: 30px;
    height: 30px;
    border-radius: 9999px;
    background: #10b981;
    border: 2.5px solid #ffffff;
    box-shadow: 0 3px 10px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  ">🏁</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const createWaypointIcon = (index: number) =>
  L.divIcon({
    className: 'edit-walk-wp-icon',
    html: `<div style="
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #f97316;
      color: #ffffff;
      border: 2px solid #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 900;
    ">${index}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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

export const EditWalkModal: React.FC<EditWalkModalProps> = ({
  isOpen,
  walk,
  allUsers,
  allKnownPeople = [],
  onAddNewPerson,
  lbsPerTrashBag,
  onClose,
  onSaveWalk,
}) => {
  const [date, setDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [milesWalked, setMilesWalked] = useState(1.0);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [newPartnerInput, setNewPartnerInput] = useState('');
  const [streetsWalked, setStreetsWalked] = useState<string[]>([]);
  const [customStreetInput, setCustomStreetInput] = useState('');
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [interactionsCount, setInteractionsCount] = useState(0);
  const [prayersCount, setPrayersCount] = useState(0);
  const [serviceLinkagesCount, setServiceLinkagesCount] = useState(0);
  const [trashBagsCount, setTrashBagsCount] = useState(0);
  const [trashWeightLbs, setTrashWeightLbs] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !walk) return;
    setDate(walk.date);
    setDurationMinutes(walk.durationMinutes);
    setMilesWalked(walk.milesWalked);
    setGroupMembers(walk.groupMembers?.length ? walk.groupMembers : [walk.recorderName]);
    setStreetsWalked(walk.streetsWalked || []);
    setRoutePoints(walk.gpsPath || []);
    setInteractionsCount(walk.interactionsCount);
    setPrayersCount(walk.prayersCount);
    setServiceLinkagesCount(walk.serviceLinkagesCount);
    setTrashBagsCount(walk.trashBagsCount);
    setTrashWeightLbs(walk.trashWeightLbs);
    setNotes(walk.notes || '');
  }, [isOpen, walk]);

  if (!isOpen || !walk) return null;

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
    if (total > 0) {
      setMilesWalked(Number(total.toFixed(2)));
    }
  };

  const handleMapClick = async (lat: number, lng: number) => {
    const nextPts: [number, number][] = [...routePoints, [lat, lng]];
    setRoutePoints(nextPts);
    recomputeRouteMiles(nextPts);

    const detected = await reverseGeocodeStreet(lat, lng);
    if (detected && !streetsWalked.includes(detected)) {
      setStreetsWalked((prev) => [...prev, detected]);
    }
  };

  const handleEndAtStartingPoint = () => {
    if (routePoints.length < 2) return;
    const startPt = routePoints[0];
    const nextPts: [number, number][] = [...routePoints, [startPt[0], startPt[1]]];
    setRoutePoints(nextPts);
    recomputeRouteMiles(nextPts);
  };

  const handleUndoRoutePoint = () => {
    setRoutePoints((prev) => {
      const next = prev.slice(0, -1);
      recomputeRouteMiles(next);
      return next;
    });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const groupSize = Math.max(1, groupMembers.length);
    const volHours = Number(((durationMinutes / 60) * groupSize).toFixed(2));
    const finalRoute =
      routePoints.length >= 2 ? routePoints : walk.gpsPath || [CHILLICOTHE_CENTER];

    const updated: WalkSession = {
      ...walk,
      date,
      durationMinutes,
      milesWalked: Number(milesWalked.toFixed(2)),
      groupMembers,
      groupSize,
      volunteerHours: volHours,
      streetsWalked:
        streetsWalked.length > 0 ? streetsWalked : ['Downtown Chillicothe'],
      startPoint:
        finalRoute.length > 0
          ? {
              lat: finalRoute[0][0],
              lng: finalRoute[0][1],
              streetName: streetsWalked[0] || walk.startPoint?.streetName || 'Start Point',
              timestamp: walk.startTime,
            }
          : walk.startPoint,
      endPoint:
        finalRoute.length > 0
          ? {
              lat: finalRoute[finalRoute.length - 1][0],
              lng: finalRoute[finalRoute.length - 1][1],
              streetName:
                streetsWalked[streetsWalked.length - 1] ||
                walk.endPoint?.streetName ||
                'End Point',
              timestamp: walk.endTime || new Date().toISOString(),
            }
          : walk.endPoint,
      gpsPath: finalRoute,
      interactionsCount,
      prayersCount,
      serviceLinkagesCount,
      trashBagsCount,
      trashWeightLbs,
      notes: notes.trim() || undefined,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    onSaveWalk(updated);
    onClose();
  };

  const mapCenter: [number, number] =
    routePoints.length > 0 ? routePoints[0] : CHILLICOTHE_CENTER;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slateDark-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-slateDark-900/95 backdrop-blur px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              Edit Outreach Walk Record ({walk.date})
            </h3>
            <p className="text-xs text-slate-400">
              Update date, duration, miles, group members, counters, streets, or route waypoints
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Date, Duration, Miles & Volunteer Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <DateInputWithCalendar
              label="Walk Date (Type or Calendar)"
              required
              value={date}
              onChange={setDate}
            />

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Duration (Minutes)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="1"
                  required
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(1, parseInt(e.target.value) || 60))
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Miles Walked
              </label>
              <div className="relative">
                <Route className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  required
                  value={milesWalked}
                  onChange={(e) =>
                    setMilesWalked(Math.max(0, parseFloat(e.target.value) || 0))
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs font-bold text-emerald-400"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slateDark-950 border border-slate-800 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-slate-400">
                Total Volunteer Hours:
              </span>
              <span className="text-base font-black text-amber-300">
                {Number(
                  ((durationMinutes / 60) * Math.max(1, groupMembers.length)).toFixed(
                    2
                  )
                )}{' '}
                Vol. Hrs
              </span>
            </div>
          </div>

          {/* Group Members */}
          <WalkParticipantsSelector
            selectedMembers={groupMembers}
            onChangeMembers={setGroupMembers}
            allKnownPeople={[
              ...allUsers.map((u) => u.name),
              ...allKnownPeople,
            ]}
            onAddNewPerson={onAddNewPerson}
            label="Who Walked in This Group?"
            helperText="Select multiple people from previous walks, or add a new person"
          />

          {/* Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-blue-300 mb-1">
                👋 Interactions
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
                🙏 Prayed For
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
                🤝 Service Links
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

          {/* Streets Walked */}
          <div className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span>Streets Walked</span>
            </label>
            {streetsWalked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {streetsWalked.map((st) => (
                  <span
                    key={st}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-phoenix-500/20 border border-phoenix-500/40 text-xs font-bold text-phoenix-200"
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
              {COMMON_STREETS_PRESETS.slice(0, 12).map((st) => {
                const active = streetsWalked.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleToggleStreet(st)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
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
                placeholder="Add custom street..."
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

          {/* Interactive Route Waypoint Editor */}
          <div className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-emerald-400" />
                <span>
                  Edit Walk Route on Map ({routePoints.length} points) — Click map
                  to add points
                </span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={routePoints.length < 2}
                  onClick={handleEndAtStartingPoint}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <Repeat className="w-3 h-3" />
                  <span>End at Start</span>
                </button>
                <button
                  type="button"
                  disabled={routePoints.length === 0}
                  onClick={handleUndoRoutePoint}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <CornerUpLeft className="w-3 h-3" />
                  <span>Undo Point</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRoutePoints([])}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Route</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-800 h-56">
              <MapContainer
                center={mapCenter}
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
                  <Marker position={routePoints[0]} icon={startFinishIcon}>
                    <Popup>🏁 Starting Point</Popup>
                  </Marker>
                )}

                {routePoints.slice(1).map((pt, idx) => (
                  <Marker
                    key={`edit-wp-${idx}`}
                    position={pt}
                    icon={createWaypointIcon(idx + 1)}
                  >
                    <Popup>📍 Waypoint #{idx + 1}</Popup>
                  </Marker>
                ))}

                {routePoints.length >= 2 && (
                  <Polyline
                    positions={routePoints}
                    pathOptions={{ color: '#f97316', weight: 5, opacity: 0.9 }}
                  />
                )}
              </MapContainer>
            </div>
          </div>

          {/* Walk Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Walk Notes / Highlights
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-black text-sm sm:text-base shadow-xl flex items-center justify-center gap-2 transition"
          >
            <Save className="w-5 h-5" />
            <span>Save Changes to Outreach Walk</span>
          </button>
        </form>
      </div>
    </div>
  );
};
