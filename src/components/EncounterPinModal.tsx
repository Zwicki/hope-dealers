import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  ExternalLink,
  HeartHandshake,
  MapPin,
  Mic,
  MicOff,
  Navigation,
  PhoneCall,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import {
  CHILLICOTHE_CENTER,
  COMMON_STREETS_PRESETS,
  EncounterPin,
  EncounterType,
  NEED_CATEGORIES,
  NeedCategoryId,
} from '../types/hopeDealers';
import { reverseGeocodeStreet } from '../services/cloudSyncService';

interface EncounterPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  walkId: string;
  recorderName: string;
  groupMembers: string[];
  currentWalkStreets: string[];
  lastKnownGps: [number, number] | null;
  editingPin?: EncounterPin | null;
  onSavePin: (pin: EncounterPin) => void;
}

export const EncounterPinModal: React.FC<EncounterPinModalProps> = ({
  isOpen,
  onClose,
  walkId,
  recorderName,
  groupMembers,
  currentWalkStreets,
  lastKnownGps,
  editingPin,
  onSavePin,
}) => {
  const [firstName, setFirstName] = useState('');
  const [encounterType, setEncounterType] = useState<EncounterType>('both');
  const [selectedNeeds, setSelectedNeeds] = useState<NeedCategoryId[]>([]);
  const [description, setDescription] = useState('');
  const [streetName, setStreetName] = useState('');
  const [pinDate, setPinDate] = useState(new Date().toISOString().slice(0, 10));
  const [coords, setCoords] = useState<[number, number]>(CHILLICOTHE_CENTER);
  const [locatingGps, setLocatingGps] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // Initialize coordinates and fields when modal opens or editingPin changes
  useEffect(() => {
    if (!isOpen) return;

    if (editingPin) {
      setFirstName(editingPin.firstName);
      setEncounterType(editingPin.type);
      setSelectedNeeds(editingPin.needCategories || []);
      setDescription(editingPin.description);
      setStreetName(editingPin.streetName);
      setPinDate(editingPin.timestamp.slice(0, 10));
      setCoords([editingPin.lat, editingPin.lng]);
      return;
    }

    setFirstName('');
    setEncounterType('both');
    setSelectedNeeds([]);
    setDescription('');
    setPinDate(new Date().toISOString().slice(0, 10));

    const defaultStreet =
      currentWalkStreets.length > 0
        ? currentWalkStreets[currentWalkStreets.length - 1]
        : 'Paint St';
    setStreetName(defaultStreet);

    if (lastKnownGps) {
      setCoords(lastKnownGps);
      void reverseGeocodeStreet(lastKnownGps[0], lastKnownGps[1]).then((road) => {
        if (road) setStreetName(road);
      });
    } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setLocatingGps(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords([lat, lng]);
          setLocatingGps(false);
          const road = await reverseGeocodeStreet(lat, lng);
          if (road) setStreetName(road);
        },
        () => {
          const jitterLat = CHILLICOTHE_CENTER[0] + (Math.random() - 0.5) * 0.008;
          const jitterLng = CHILLICOTHE_CENTER[1] + (Math.random() - 0.5) * 0.008;
          setCoords([Number(jitterLat.toFixed(5)), Number(jitterLng.toFixed(5))]);
          setLocatingGps(false);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  }, [isOpen, editingPin, lastKnownGps, currentWalkStreets]);

  if (!isOpen) return null;

  const toggleNeed = (id: NeedCategoryId) => {
    setSelectedNeeds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRefreshGps = () => {
    if (!navigator.geolocation) return;
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setCoords([lat, lng]);
        setLocatingGps(false);
        const road = await reverseGeocodeStreet(lat, lng);
        if (road) setStreetName(road);
      },
      () => {
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleVoiceToText = () => {
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition?: unknown;
          webkitSpeechRecognition?: unknown;
        }
      ).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        'Voice dictation is supported in Chrome, Safari, and Edge on mobile and desktop.'
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognition as any)();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setDescription((prev) =>
            prev ? `${prev.trim()} ${transcript}` : transcript
          );
        }
        setIsListeningVoice(false);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch {
      setIsListeningVoice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = firstName.trim() || 'Community Friend';
    const cleanDesc =
      description.trim() ||
      (encounterType === 'prayer'
        ? `Prayed with ${cleanName} on ${streetName || 'the street'}.`
        : `Connected ${cleanName} with community resources and prayed together.`);

    const updatedTimestamp = editingPin
      ? `${pinDate}${editingPin.timestamp.slice(10)}`
      : new Date().toISOString();

    const savedPin: EncounterPin = {
      id: editingPin ? editingPin.id : `pin-${Date.now()}`,
      walkId: editingPin ? editingPin.walkId : walkId,
      timestamp: updatedTimestamp,
      lat: coords[0],
      lng: coords[1],
      streetName: streetName.trim() || 'Chillicothe Outreach',
      firstName: cleanName,
      description: cleanDesc,
      type: encounterType,
      needCategories: selectedNeeds,
      loggedByRecorder: editingPin ? editingPin.loggedByRecorder : recorderName,
      groupMembers: editingPin ? editingPin.groupMembers : groupMembers,
      syncStatus: navigator.onLine ? 'synced' : 'pending',
    };

    onSavePin(savedPin);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-slateDark-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-slateDark-900/95 backdrop-blur px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-phoenix-500/20 border border-phoenix-500/40 flex items-center justify-center text-phoenix-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white leading-tight">
                {editingPin
                  ? `Edit Prayer & Service Record (${editingPin.firstName})`
                  : 'Log Prayer & Service Pin'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {editingPin
                  ? 'Update name, prayer description, needs, street, or GPS coordinates'
                  : 'Drops a pin on the map & updates your walk counters automatically'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Quick Community Resource Launcher Bar */}
          {!editingPin && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-emerald-200 font-medium">
                Need to look up shelter, food, or treatment right now?
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://chillicothecommunityresources.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slateDark-950 font-extrabold text-xs transition shadow"
                >
                  <span>Open Resource Directory</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href="tel:988"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs transition"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>988</span>
                </a>
              </div>
            </div>
          )}

          {/* 1. Encounter Type Toggle */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              1. What did your group do?
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEncounterType('prayer')}
                className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border text-center transition ${
                  encounterType === 'prayer'
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md'
                    : 'bg-slateDark-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🙏 Prayed Only
              </button>

              <button
                type="button"
                onClick={() => setEncounterType('both')}
                className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border text-center transition ${
                  encounterType === 'both'
                    ? 'bg-phoenix-500/25 border-phoenix-400 text-phoenix-200 shadow-md'
                    : 'bg-slateDark-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                ✨ Prayed + Linked
              </button>

              <button
                type="button"
                onClick={() => setEncounterType('service')}
                className={`py-2.5 px-2 rounded-xl text-xs font-extrabold border text-center transition ${
                  encounterType === 'service'
                    ? 'bg-blue-500/25 border-blue-400 text-blue-200 shadow-md'
                    : 'bg-slateDark-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🤝 Service Link
              </button>
            </div>
          </div>

          {/* 2. First Name of Person & Date (when editing) */}
          <div className={editingPin ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : ''}>
            <div className={editingPin ? 'sm:col-span-2' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  2. First Name of Person Prayed For
                </label>
                <button
                  type="button"
                  onClick={() => setFirstName('Friend (Anonymous)')}
                  className="text-[11px] font-semibold text-phoenix-400 hover:text-phoenix-300 underline"
                >
                  Tap if Anonymous
                </button>
              </div>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name (e.g., Marcus, Tiffany...)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                />
              </div>
            </div>

            {editingPin && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={pinDate}
                    onChange={(e) => setPinDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 rounded-xl bg-slateDark-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Quick-Tap Immediate Needs / Service Linkages */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              3. Immediate Needs / Services Linked (Tap all that apply)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {NEED_CATEGORIES.map((cat) => {
                const isSelected = selectedNeeds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleNeed(cat.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                      isSelected
                        ? `${cat.colorClass} ring-1 ring-white/30 scale-[1.02]`
                        : 'bg-slateDark-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.shortLabel}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Brief Description / Prayer Request with Voice-to-Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                4. Brief Description / Prayer Request
              </label>
              <button
                type="button"
                onClick={handleVoiceToText}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                  isListeningVoice
                    ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                    : 'bg-slate-800 hover:bg-slate-700 text-phoenix-300 border-slate-700'
                }`}
              >
                {isListeningVoice ? (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Listening...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    <span>🎙️ Voice-to-Text</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you pray for or what service did you connect them with? (e.g., Prayed for sobriety & family restoration, gave water & connected to Made for More...)"
              className="w-full p-3.5 rounded-xl bg-slateDark-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />
          </div>

          {/* 5. Street & GPS Pin Location */}
          <div className="p-3.5 rounded-xl bg-slateDark-950 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-phoenix-400" />
                <span>Street / Pin Location</span>
              </span>
              <button
                type="button"
                onClick={handleRefreshGps}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
              >
                <Navigation className="w-3 h-3" />
                <span>
                  {locatingGps
                    ? 'Acquiring GPS...'
                    : `GPS (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`}
                </span>
              </button>
            </div>

            <input
              type="text"
              value={streetName}
              onChange={(e) => setStreetName(e.target.value)}
              placeholder="Street or intersection (e.g., Paint St & E Main St)"
              className="w-full px-3 py-2 rounded-lg bg-slateDark-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
            />

            {editingPin && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={coords[0]}
                    onChange={(e) =>
                      setCoords([
                        parseFloat(e.target.value) || CHILLICOTHE_CENTER[0],
                        coords[1],
                      ])
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-slateDark-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-0.5">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={coords[1]}
                    onChange={(e) =>
                      setCoords([
                        coords[0],
                        parseFloat(e.target.value) || CHILLICOTHE_CENTER[1],
                      ])
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-slateDark-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Quick Street Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(currentWalkStreets.length > 0
                ? currentWalkStreets
                : COMMON_STREETS_PRESETS.slice(0, 6)
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStreetName(st)}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                    streetName === st
                      ? 'bg-phoenix-500/20 border-phoenix-500 text-phoenix-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-phoenix-500 via-phoenix-600 to-phoenix-red hover:from-phoenix-600 hover:to-phoenix-700 text-white font-black text-base shadow-xl shadow-phoenix-600/30 flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {editingPin
                ? 'Save Changes to Prayer Record'
                : 'Save Prayer & Drop Map Pin'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
