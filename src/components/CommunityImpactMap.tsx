import React, { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Crosshair,
  Eye,
  EyeOff,
  Filter,
  Flag,
  Footprints,
  HeartHandshake,
  Lock,
  MapPin,
  Pencil,
  PlusCircle,
  Route,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  CHILLICOTHE_CENTER,
  CommunityInteractionPoint,
  EncounterPin,
  NEED_CATEGORIES,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';
import { EncounterPinModal } from './EncounterPinModal';

interface CommunityImpactMapProps {
  walks: WalkSession[];
  pins: EncounterPin[];
  currentUser: UserAccount | null;
  onSavePin: (pin: EncounterPin) => void;
  onDeletePin?: (pinId: string) => void;
  onDeleteWalk?: (walkId: string) => void;
  onOpenLogin: () => void;
}

function createPinIcon(type: 'prayer' | 'service' | 'both') {
  const bg =
    type === 'both'
      ? 'linear-gradient(135deg, #f97316, #dc2626)'
      : type === 'prayer'
      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
      : 'linear-gradient(135deg, #10b981, #0284c7)';

  const symbol = type === 'both' ? '✨' : type === 'prayer' ? '🙏' : '🤝';

  return L.divIcon({
    className: 'custom-hope-pin',
    html: `<div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      background: ${bg};
      border: 2.5px solid #ffffff;
      box-shadow: 0 6px 14px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    ">${symbol}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

const startFlagIcon = L.divIcon({
  className: 'custom-start-flag',
  html: `<div style="
    width: 30px;
    height: 30px;
    border-radius: 9999px;
    background: #10b981;
    border: 2.5px solid #ffffff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  ">🏁</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -14],
});

const createRouteWaypointIcon = (num: number) =>
  L.divIcon({
    className: 'custom-route-waypoint',
    html: `<div style="
      width: 22px;
      height: 22px;
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
    ">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -10],
  });

const communityInteractionIcon = L.divIcon({
  className: 'custom-interaction-dot',
  html: `<div style="
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    background: #0ea5e9;
    border: 2px solid #ffffff;
    box-shadow: 0 3px 8px rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
  ">👋</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -10],
});

const MapClickWatcher: React.FC<{
  enabled: boolean;
  onLocationPicked: (coords: [number, number]) => void;
}> = ({ enabled, onLocationPicked }) => {
  useMapEvents({
    click(e) {
      if (enabled) {
        onLocationPicked([
          Number(e.latlng.lat.toFixed(5)),
          Number(e.latlng.lng.toFixed(5)),
        ]);
      }
    },
  });
  return null;
};

// Automatically fit map bounds to all walks and pins (or a specifically focused walk route)
const AutoFitMapBounds: React.FC<{
  walks: WalkSession[];
  pins: EncounterPin[];
  focusedPath: [number, number][] | null;
}> = ({ walks, pins, focusedPath }) => {
  const map = useMap();

  useEffect(() => {
    if (focusedPath && focusedPath.length > 0) {
      const bounds = L.latLngBounds(focusedPath);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
      }
      return;
    }

    const allCoords: [number, number][] = [];
    walks.forEach((w) => {
      if (w.startPoint) {
        allCoords.push([w.startPoint.lat, w.startPoint.lng]);
      }
      (w.gpsPath || []).forEach((pt) => {
        if (Array.isArray(pt) && pt.length === 2) {
          allCoords.push([pt[0], pt[1]]);
        }
      });
      (w.interactionLocations || []).forEach((loc) => {
        allCoords.push([loc.lat, loc.lng]);
      });
    });
    pins.forEach((p) => {
      allCoords.push([p.lat, p.lng]);
    });

    if (allCoords.length > 0) {
      const bounds = L.latLngBounds(allCoords);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [walks, pins, focusedPath, map]);

  return null;
};

export const CommunityImpactMap: React.FC<CommunityImpactMapProps> = ({
  walks,
  pins,
  currentUser,
  onSavePin,
  onDeletePin,
  onDeleteWalk,
  onOpenLogin,
}) => {
  const [filterType, setFilterType] = useState<
    'all' | 'prayer' | 'service' | 'both'
  >('all');
  const [showRoutes, setShowRoutes] = useState(true);
  const [showStartPoints, setShowStartPoints] = useState(true);
  const [showInteractionSpots, setShowInteractionSpots] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tapToPinMode, setTapToPinMode] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<[number, number] | null>(
    null
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [editingPin, setEditingPin] = useState<EncounterPin | null>(null);
  const [focusedPath, setFocusedPath] = useState<[number, number][] | null>(
    null
  );

  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStreet = p.streetName.toLowerCase().includes(q);
        const matchName = currentUser
          ? p.firstName.toLowerCase().includes(q)
          : false;
        const matchDesc = currentUser
          ? p.description.toLowerCase().includes(q)
          : false;
        return matchStreet || matchName || matchDesc;
      }
      return true;
    });
  }, [pins, filterType, searchQuery, currentUser]);

  const allInteractionSpots = useMemo(() => {
    const list: Array<CommunityInteractionPoint & { walkDate: string }> = [];
    walks.forEach((w) => {
      (w.interactionLocations || []).forEach((loc) => {
        list.push({ ...loc, walkDate: w.date });
      });
    });
    return list;
  }, [walks]);

  const allUniqueStreets = useMemo(() => {
    const set = new Set<string>();
    walks.forEach((w) => w.streetsWalked.forEach((s) => set.add(s)));
    pins.forEach((p) => {
      if (p.streetName) set.add(p.streetName);
    });
    return Array.from(set);
  }, [walks, pins]);

  const handleMapLocationPicked = (coords: [number, number]) => {
    setPickedCoords(coords);
    setTapToPinMode(false);
    setEditingPin(null);
    setIsPinModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-4">
      {/* Top Map Header & Privacy Banner */}
      <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-black text-white">
              GPS Streets, Routes & Community Interactions Map
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                currentUser
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {currentUser ? (
                <>
                  <Eye className="w-3 h-3" />
                  <span>Full Volunteer View (Names & Prayer Notes Visible)</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3" />
                  <span>Public Privacy Mode (Personal Names Hidden)</span>
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Showing {walks.length} logged walk route{walks.length === 1 ? '' : 's'},{' '}
            {pins.length} prayer/service pin{pins.length === 1 ? '' : 's'}, and{' '}
            {allInteractionSpots.length} community interaction spot
            {allInteractionSpots.length === 1 ? '' : 's'}.
          </p>
        </div>

        {/* Map Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {currentUser ? (
            <button
              type="button"
              onClick={() => setTapToPinMode((v) => !v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition ${
                tapToPinMode
                  ? 'bg-emerald-500 text-slateDark-950 border-emerald-300 animate-pulse'
                  : 'bg-phoenix-600 hover:bg-phoenix-500 text-white border-phoenix-400 shadow-lg shadow-phoenix-600/20'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {tapToPinMode
                  ? 'Tap Anywhere on Map to Place Pin...'
                  : 'Tap Map to Add Pin'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-phoenix-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Login to See Prayer Names & Add Pins</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFocusedPath(null)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slateDark-950 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
          >
            <Crosshair className="w-3.5 h-3.5 inline mr-1 text-phoenix-400" />
            Fit All Routes
          </button>

          <button
            type="button"
            onClick={() => setShowRoutes((r) => !r)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              showRoutes
                ? 'bg-phoenix-500/20 border-phoenix-500/40 text-phoenix-300'
                : 'bg-slateDark-950 border-slate-800 text-slate-400'
            }`}
          >
            <Footprints className="w-3.5 h-3.5 inline mr-1" />
            Routes ({walks.length}) {showRoutes ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setShowStartPoints((s) => !s)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              showStartPoints
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slateDark-950 border-slate-800 text-slate-400'
            }`}
          >
            <Flag className="w-3.5 h-3.5 inline mr-1" />
            Start & Waypoints {showStartPoints ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            onClick={() => setShowInteractionSpots((i) => !i)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              showInteractionSpots
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slateDark-950 border-slate-800 text-slate-400'
            }`}
          >
            👋 Interactions ({allInteractionSpots.length}){' '}
            {showInteractionSpots ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Filters & Legend Bar */}
      <div className="p-3.5 rounded-2xl bg-slateDark-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-phoenix-400" />
            <span>Show Pins:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'all'
                ? 'bg-phoenix-600 text-white'
                : 'bg-slateDark-950 text-slate-400 hover:text-white'
            }`}
          >
            All ({pins.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'both'
                ? 'bg-phoenix-600 text-white'
                : 'bg-slateDark-950 text-slate-400 hover:text-white'
            }`}
          >
            ✨ Prayed + Service ({pins.filter((p) => p.type === 'both').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('prayer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'prayer'
                ? 'bg-amber-500 text-slateDark-950'
                : 'bg-slateDark-950 text-slate-400 hover:text-white'
            }`}
          >
            🙏 Prayed Only ({pins.filter((p) => p.type === 'prayer').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('service')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              filterType === 'service'
                ? 'bg-emerald-500 text-slateDark-950'
                : 'bg-slateDark-950 text-slate-400 hover:text-white'
            }`}
          >
            🤝 Service Link ({pins.filter((p) => p.type === 'service').length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              currentUser
                ? 'Filter by street or first name...'
                : 'Filter by street name...'
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
          />
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl h-[480px] sm:h-[560px]">
        {tapToPinMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-full bg-emerald-500 text-slateDark-950 font-black text-xs shadow-xl">
            👆 Tap any street or corner on the map to drop a Prayer / Service Pin
          </div>
        )}

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

          <AutoFitMapBounds
            walks={walks}
            pins={pins}
            focusedPath={focusedPath}
          />

          <MapClickWatcher
            enabled={tapToPinMode}
            onLocationPicked={handleMapLocationPicked}
          />

          {/* Polylines for Walked GPS Routes */}
          {showRoutes &&
            walks.map((walk) =>
              walk.gpsPath && walk.gpsPath.length >= 2 ? (
                <Polyline
                  key={walk.id}
                  positions={walk.gpsPath}
                  pathOptions={{
                    color: '#f97316',
                    weight: 6,
                    opacity: 0.88,
                    lineCap: 'round',
                  }}
                >
                  <Popup>
                    <div className="space-y-1.5 min-w-[210px]">
                      <div className="text-xs font-extrabold text-phoenix-400 uppercase">
                        🚶 Hope Dealers Street Route
                      </div>
                      <div className="text-xs font-bold text-white">
                        {walk.streetsWalked.join(' • ')}
                      </div>
                      {walk.startPoint && (
                        <div className="text-[11px] text-emerald-300 font-semibold">
                          🏁 Start: {walk.startPoint.streetName || 'Locked'} (
                          {walk.startPoint.lat.toFixed(4)},{' '}
                          {walk.startPoint.lng.toFixed(4)})
                        </div>
                      )}
                      <div className="text-[11px] text-slate-300">
                        📅 {walk.date} •{' '}
                        <strong>{walk.milesWalked} miles</strong> •{' '}
                        {walk.durationMinutes} mins
                      </div>
                      <div className="text-[11px] text-amber-300 font-semibold">
                        👥 Group ({walk.groupSize}): {walk.groupMembers.join(', ')} (
                        {walk.volunteerHours} Vol. Hrs)
                      </div>
                      <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] text-slate-200 border-t border-slate-700">
                        <span>👋 {walk.interactionsCount} Interactions</span>
                        <span>🙏 {walk.prayersCount} Prayers</span>
                        <span>🤝 {walk.serviceLinkagesCount} Referrals</span>
                        <span>
                          🗑️ {walk.trashBagsCount} Bags ({walk.trashWeightLbs} lbs)
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              ) : null
            )}

          {/* Starting Point Markers (🏁) and Route Waypoints for Each Walk */}
          {showStartPoints &&
            walks.map((walk) => {
              const sp =
                walk.startPoint ||
                (walk.gpsPath.length > 0
                  ? {
                      lat: walk.gpsPath[0][0],
                      lng: walk.gpsPath[0][1],
                      streetName: walk.streetsWalked[0] || 'Start Point',
                      timestamp: walk.startTime,
                    }
                  : null);

              const waypoints = (walk.gpsPath || []).slice(1);

              return (
                <React.Fragment key={`route-pts-${walk.id}`}>
                  {sp && (
                    <Marker position={[sp.lat, sp.lng]} icon={startFlagIcon}>
                      <Popup>
                        <div className="space-y-1 min-w-[190px]">
                          <div className="text-xs font-extrabold text-emerald-400">
                            🏁 Walk Starting Point
                          </div>
                          <div className="text-xs font-bold text-white">
                            📍 {sp.streetName || walk.streetsWalked[0]}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            📅 {walk.date} • Route Distance: {walk.milesWalked} mi
                          </div>
                          <div className="text-[11px] text-amber-300">
                            👥 {walk.groupMembers.join(', ')}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {waypoints.map((pt, idx) => {
                    // Don't overlap start flag if last waypoint returned to exact start point
                    if (
                      sp &&
                      idx === waypoints.length - 1 &&
                      Math.abs(pt[0] - sp.lat) < 0.0001 &&
                      Math.abs(pt[1] - sp.lng) < 0.0001
                    ) {
                      return null;
                    }
                    return (
                      <Marker
                        key={`wp-${walk.id}-${idx}`}
                        position={pt}
                        icon={createRouteWaypointIcon(idx + 1)}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <strong className="text-phoenix-400 block">
                              📍 Route Waypoint #{idx + 1}
                            </strong>
                            <div>📅 {walk.date}</div>
                            <div className="text-[11px] text-slate-300">
                              Streets: {walk.streetsWalked.join(', ')}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              );
            })}

          {/* GPS Markers for Community Interaction Spots (👋) */}
          {showInteractionSpots &&
            allInteractionSpots.map((spot) => (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                icon={communityInteractionIcon}
              >
                <Popup>
                  <div className="space-y-1 min-w-[180px]">
                    <div className="text-xs font-extrabold text-sky-400">
                      👋 Community Interaction Location
                    </div>
                    <div className="text-xs font-bold text-white">
                      📍 {spot.streetName || 'Chillicothe Outreach'}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      📅 {spot.walkDate} •{' '}
                      {new Date(spot.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      GPS: {spot.lat.toFixed(4)}, {spot.lng.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* Pins for Each Person Prayed For or Linked to Service */}
          {filteredPins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={createPinIcon(pin.type)}
            >
              <Popup>
                <div className="space-y-2 min-w-[220px] max-w-[270px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-phoenix-500/20 text-phoenix-300 border border-phoenix-500/40">
                      {pin.type === 'both'
                        ? '✨ Prayer & Service Link'
                        : pin.type === 'prayer'
                        ? '🙏 Prayed With'
                        : '🤝 Linked to Service'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(pin.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Role-Based Name & Description */}
                  {currentUser ? (
                    <>
                      <div className="text-sm font-black text-white flex items-center gap-1.5">
                        <HeartHandshake className="w-4 h-4 text-phoenix-400 shrink-0" />
                        <span>Prayed for: {pin.firstName}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed bg-slateDark-950 p-2.5 rounded-lg border border-slate-800">
                        "{pin.description}"
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-black text-white">
                        Neighbor Prayed For & Supported
                      </div>
                      <p className="text-[11px] text-slate-400 italic">
                        First name & personal prayer request protected in Public View.
                      </p>
                    </>
                  )}

                  {/* Need Badges */}
                  {pin.needCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {pin.needCategories.map((id) => {
                        const cat = NEED_CATEGORIES.find((c) => c.id === id);
                        return cat ? (
                          <span
                            key={id}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-emerald-300 font-semibold"
                          >
                            {cat.emoji} {cat.shortLabel}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      📍 {pin.streetName} ({pin.lat.toFixed(4)},{' '}
                      {pin.lng.toFixed(4)})
                    </span>
                    {currentUser?.role === 'superuser' && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPin(pin);
                            setIsPinModalOpen(true);
                          }}
                          className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        {onDeletePin && (
                          <button
                            type="button"
                            onClick={() => onDeletePin(pin.id)}
                            className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Logged Walk Routes, Streets Covered & Prayer Log Cards Below Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Logged Walks & Routes + Streets Covered */}
        <div className="space-y-4">
          {/* Logged Walks & Routes List */}
          <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Route className="w-4 h-4 text-phoenix-400" />
              <span>Logged Walks & Routes ({walks.length})</span>
            </h3>

            {walks.length === 0 ? (
              <p className="text-xs text-slate-400">
                No walks logged yet. Sign in and go to "Log Walk & Counters" to record a live or past walk!
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {walks.map((w) => (
                  <div
                    key={w.id}
                    className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-phoenix-300">
                        📅 {w.date} • {w.milesWalked} mi
                      </span>
                      <div className="flex items-center gap-1.5">
                        {w.gpsPath && w.gpsPath.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFocusedPath([...w.gpsPath])}
                            className="px-2 py-0.5 rounded bg-phoenix-500/20 hover:bg-phoenix-500/30 text-phoenix-300 text-[10px] font-bold"
                          >
                            🎯 Zoom to Route
                          </button>
                        )}
                        {currentUser?.role === 'superuser' && onDeleteWalk && (
                          <button
                            type="button"
                            onClick={() => onDeleteWalk(w.id)}
                            className="text-slate-500 hover:text-rose-400"
                            title="Delete Walk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white">
                      📍 {w.streetsWalked.join(' • ')}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      👥 {w.groupMembers.join(', ')} ({w.volunteerHours} Vol. Hrs)
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-300 pt-0.5">
                      <span>👋 {w.interactionsCount} Int.</span>
                      <span>🙏 {w.prayersCount} Prayers</span>
                      <span>🤝 {w.serviceLinkagesCount} Links</span>
                      <span>🗑️ {w.trashBagsCount} Bags</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Streets Walked Cloud */}
          <div className="p-4 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-3">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Footprints className="w-4 h-4 text-emerald-400" />
              <span>All Streets Covered ({allUniqueStreets.length})</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {allUniqueStreets.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    setSearchQuery((prev) => (prev === st ? '' : st))
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    searchQuery === st
                      ? 'bg-phoenix-600 text-white border-phoenix-400'
                      : 'bg-slateDark-950 border-slate-800 text-slate-300 hover:border-phoenix-500/50'
                  }`}
                >
                  📍 {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2 & 3: Recent Prayer & Service Encounters Feed */}
        <div className="lg:col-span-2 p-4 rounded-2xl bg-slateDark-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                {currentUser
                  ? `People Prayed For & Linked (${filteredPins.length})`
                  : `Recent Street Outreach Encounters (${filteredPins.length})`}
              </span>
            </h3>
            {!currentUser && (
              <span className="text-[11px] text-slate-400">
                Names anonymized publicly
              </span>
            )}
          </div>

          {filteredPins.length === 0 ? (
            <div className="p-6 rounded-xl bg-slateDark-950 border border-slate-800 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No individual prayer pins plotted yet. Click{' '}
                <strong className="text-phoenix-300">"Tap Map to Add Pin"</strong>{' '}
                above or log a person prayed for during a walk!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
              {filteredPins.map((pin) => (
                <div
                  key={pin.id}
                  className="p-3 rounded-xl bg-slateDark-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-extrabold text-xs sm:text-sm text-white">
                      {currentUser
                        ? `🙏 ${pin.firstName}`
                        : '🙏 Neighbor Prayed With'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFocusedPath([[pin.lat, pin.lng]])}
                      className="text-[10px] px-2 py-0.5 rounded bg-phoenix-500/15 hover:bg-phoenix-500/25 text-phoenix-300 font-semibold"
                    >
                      <MapPin className="w-2.5 h-2.5 inline mr-0.5" />
                      {pin.streetName}
                    </button>
                  </div>

                  {currentUser ? (
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {pin.description}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Hope Dealers team prayed together and shared community support on{' '}
                      {pin.streetName}.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-1">
                    <div className="flex flex-wrap gap-1">
                      {pin.needCategories.map((id) => {
                        const cat = NEED_CATEGORIES.find((c) => c.id === id);
                        return cat ? (
                          <span
                            key={id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-emerald-300 border border-slate-800"
                          >
                            {cat.emoji} {cat.shortLabel}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {new Date(pin.timestamp).toLocaleDateString()}
                      </span>
                      {currentUser?.role === 'superuser' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPin(pin);
                            setIsPinModalOpen(true);
                          }}
                          className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold inline-flex items-center gap-1"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal for Map-Picked or Edited Pin */}
      <EncounterPinModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setEditingPin(null);
        }}
        walkId="walk-map-direct"
        recorderName={currentUser?.name || 'Rick Fannin'}
        groupMembers={[currentUser?.name || 'Rick Fannin']}
        currentWalkStreets={[]}
        lastKnownGps={pickedCoords}
        editingPin={editingPin}
        onSavePin={onSavePin}
      />
    </div>
  );
};
