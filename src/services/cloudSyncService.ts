import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AppDatabaseState,
  CloudConfig,
  CommunityInteractionPoint,
  EncounterPin,
  GpsWaypoint,
  UserAccount,
  WalkSession,
} from '../types/hopeDealers';

const LEGACY_STORAGE_KEY = 'lrs_hope_dealers_db_v1';
const STORAGE_KEY = 'lrs_hope_dealers_db_v2';
const AUTH_SESSION_KEY = 'lrs_hope_dealers_session_v1';
const ACTIVE_WALK_DRAFT_KEY = 'lrs_hope_dealers_active_walk_v2';
const NETLIFY_CLOUD_ENDPOINT = '/.netlify/functions/cloud-state';

export const SUPER_USER_EMAIL = 'RFannin25@gmail.com';
export const SUPER_USER_PASSWORD = 'Zwicki0823!';

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-superuser-rick',
    name: 'Rick Fannin',
    email: SUPER_USER_EMAIL,
    password: SUPER_USER_PASSWORD,
    role: 'superuser',
    phone: '(614) 200-2139',
    createdAt: '2026-01-01T08:00:00.000Z',
    active: true,
  },
];

export const SEED_WALKS: WalkSession[] = [];

export const SEED_PINS: EncounterPin[] = [];

const DEFAULT_CLOUD_CONFIG: CloudConfig = {
  enabled: true,
  provider: 'cloud_storage',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  customWebhookUrl: '',
  teamAccessCode: 'HOPE2026',
  lbsPerTrashBag: 15,
  lastSyncedAt: new Date().toISOString(),
};

let supabaseClient: SupabaseClient | null = null;

function getSupabase(config: CloudConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabaseAnonKey) return null;
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey);
    } catch {
      return null;
    }
  }
  return supabaseClient;
}

function ensureSuperUser(users: UserAccount[]): UserAccount[] {
  const cleaned = (users || []).filter((u) => !u.id.startsWith('user-vol-'));
  const hasSuper = cleaned.some(
    (u) => u.email?.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
  );
  if (!hasSuper) {
    return [DEFAULT_USERS[0], ...cleaned];
  }
  return cleaned.map((u) =>
    u.email?.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
      ? {
          ...u,
          role: 'superuser',
          password: u.password || SUPER_USER_PASSWORD,
        }
      : u
  );
}

export function loadDatabase(): AppDatabaseState {
  try {
    // Purge legacy sample database key if present
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem('lrs_hope_dealers_active_walk_v1');

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: AppDatabaseState = {
        users: DEFAULT_USERS,
        walks: [],
        pins: [],
        deletedWalkIds: [],
        deletedPinIds: [],
        deletedUserIds: [],
        cloudConfig: DEFAULT_CLOUD_CONFIG,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    parsed.walks = (parsed.walks || []).filter(
      (w) => !w.id.startsWith('walk-seed-')
    );
    parsed.pins = (parsed.pins || []).filter(
      (p) => !p.id.startsWith('pin-seed-')
    );
    parsed.pins = unstackAndResolvePins(parsed.walks, parsed.pins);
    parsed.users = ensureSuperUser(parsed.users || []);
    parsed.deletedWalkIds = parsed.deletedWalkIds || [];
    parsed.deletedPinIds = parsed.deletedPinIds || [];
    parsed.deletedUserIds = parsed.deletedUserIds || [];

    if (!parsed.cloudConfig) {
      parsed.cloudConfig = DEFAULT_CLOUD_CONFIG;
    } else if (
      parsed.cloudConfig.customWebhookUrl ===
      'https://liferecoverysociety.org/api/impact-sync'
    ) {
      // Clear legacy placeholder webhook URL
      parsed.cloudConfig.customWebhookUrl = '';
    }
    return parsed;
  } catch {
    return {
      users: DEFAULT_USERS,
      walks: [],
      pins: [],
      deletedWalkIds: [],
      deletedPinIds: [],
      deletedUserIds: [],
      cloudConfig: DEFAULT_CLOUD_CONFIG,
    };
  }
}

export function saveDatabase(
  state: AppDatabaseState,
  options?: { mode?: 'merge' | 'replace' }
): AppDatabaseState {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const nowIso = new Date().toISOString();
  const updated: AppDatabaseState = {
    ...state,
    users: ensureSuperUser(state.users || []),
    deletedWalkIds: state.deletedWalkIds || [],
    deletedPinIds: state.deletedPinIds || [],
    deletedUserIds: state.deletedUserIds || [],
    cloudConfig: {
      ...state.cloudConfig,
      lastSyncedAt: isOnline ? nowIso : state.cloudConfig.lastSyncedAt,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hope-dealers-db-updated'));
  }

  // Immediately push & merge to Cloud Storage
  if (isOnline) {
    void syncToRemoteCloud(updated, options);
  }
  return updated;
}

interface NetlifyCloudResponse {
  ok: boolean;
  record?: {
    users?: UserAccount[];
    walks?: WalkSession[];
    pins?: EncounterPin[];
    deletedWalkIds?: string[];
    deletedPinIds?: string[];
    deletedUserIds?: string[];
    teamAccessCode?: string;
    lbsPerTrashBag?: number;
    updatedAt?: string;
  } | null;
  error?: string;
}

function applyRemoteRecordToLocal(
  current: AppDatabaseState,
  record: NonNullable<NetlifyCloudResponse['record']>
): AppDatabaseState {
  const nowIso = new Date().toISOString();
  const mergedWalks = ((record.walks || []) as WalkSession[])
    .filter((w) => !w.id.startsWith('walk-seed-'))
    .map((w) => ({ ...w, syncStatus: 'synced' as const }))
    .sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

  const rawPins = ((record.pins || []) as EncounterPin[])
    .filter((p) => !p.id.startsWith('pin-seed-'))
    .map((p) => ({ ...p, syncStatus: 'synced' as const }))
    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  const mergedPins = unstackAndResolvePins(mergedWalks, rawPins);

  const mergedUsers = ensureSuperUser((record.users || []) as UserAccount[]);

  const nextState: AppDatabaseState = {
    ...current,
    users: mergedUsers,
    walks: mergedWalks,
    pins: mergedPins,
    deletedWalkIds: record.deletedWalkIds || current.deletedWalkIds || [],
    deletedPinIds: record.deletedPinIds || current.deletedPinIds || [],
    deletedUserIds: record.deletedUserIds || current.deletedUserIds || [],
    cloudConfig: {
      ...current.cloudConfig,
      teamAccessCode:
        record.teamAccessCode || current.cloudConfig.teamAccessCode || 'HOPE2026',
      lbsPerTrashBag:
        record.lbsPerTrashBag ?? current.cloudConfig.lbsPerTrashBag ?? 15,
      lastSyncedAt: record.updatedAt || nowIso,
    },
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hope-dealers-db-updated'));
  }
  return nextState;
}

export async function syncToRemoteCloud(
  state: AppDatabaseState,
  options?: { mode?: 'merge' | 'replace' }
): Promise<{
  ok: boolean;
  message: string;
  mergedState?: AppDatabaseState;
}> {
  const { cloudConfig } = state;
  let syncedWithCloud = false;
  let mergedState: AppDatabaseState | undefined;

  // 1. Primary Built-in Netlify Cloud Database (Netlify Blobs via /.netlify/functions/cloud-state)
  try {
    const res = await fetch(NETLIFY_CLOUD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        mode: options?.mode || 'merge',
        users: state.users,
        walks: state.walks,
        pins: state.pins,
        deletedWalkIds: state.deletedWalkIds || [],
        deletedPinIds: state.deletedPinIds || [],
        deletedUserIds: state.deletedUserIds || [],
        teamAccessCode: cloudConfig.teamAccessCode,
        lbsPerTrashBag: cloudConfig.lbsPerTrashBag,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as NetlifyCloudResponse;
      if (data.ok && data.record) {
        syncedWithCloud = true;
        mergedState = applyRemoteRecordToLocal(state, data.record);
      }
    }
  } catch {
    // Fallback if running in local Vite dev server without Netlify Functions
  }

  // 2. Optional: If Supabase URL & Key are also configured, mirror to Supabase tables
  if (cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey) {
    const client = getSupabase(cloudConfig);
    if (client) {
      try {
        if (state.walks.length > 0) {
          await client.from('hope_dealers_walks').upsert(
            state.walks.map((w) => ({
              id: w.id,
              payload: w,
              updated_at: new Date().toISOString(),
            }))
          );
        }
        if (state.pins.length > 0) {
          await client.from('hope_dealers_pins').upsert(
            state.pins.map((p) => ({
              id: p.id,
              walk_id: p.walkId,
              payload: p,
              updated_at: new Date().toISOString(),
            }))
          );
        }
        syncedWithCloud = true;
      } catch {
        // ignore
      }
    }
  }

  // 3. Optional: If Custom Cloud Webhook is configured
  if (
    cloudConfig.customWebhookUrl &&
    cloudConfig.customWebhookUrl !==
      'https://liferecoverysociety.org/api/impact-sync'
  ) {
    try {
      await fetch(cloudConfig.customWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: 'Life Recovery Society - Hope Dealers',
          syncedAt: new Date().toISOString(),
          walks: state.walks,
          pins: state.pins,
        }),
      });
      syncedWithCloud = true;
    } catch {
      // ignore
    }
  }

  if (syncedWithCloud) {
    markAllRecordsSynced();
    return {
      ok: true,
      message: 'Synced with Cloud Database',
      mergedState,
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    markAllRecordsSynced();
    return { ok: true, message: 'Saved locally (Cloud Sync ready)' };
  }

  return { ok: false, message: 'Offline — queued for automatic cloud sync' };
}

export async function pullFromRemoteCloud(): Promise<AppDatabaseState | null> {
  const current = loadDatabase();

  // 1. Sync & Pull from Built-in Netlify Cloud Database (/.netlify/functions/cloud-state)
  try {
    const hasLocalDataToPush =
      current.walks.length > 0 ||
      current.pins.length > 0 ||
      current.users.length > 1 ||
      (current.deletedWalkIds && current.deletedWalkIds.length > 0) ||
      (current.deletedPinIds && current.deletedPinIds.length > 0);

    if (hasLocalDataToPush) {
      // Two-way merge: pushes any walks/pins logged on this browser up to the cloud AND pulls down any walks/pins from other devices!
      const syncResult = await syncToRemoteCloud(current, { mode: 'merge' });
      if (syncResult.mergedState) {
        return syncResult.mergedState;
      }
    } else {
      // This device has an empty local database (e.g. a phone opening the site for the first time) — pull from cloud!
      const res = await fetch(NETLIFY_CLOUD_ENDPOINT, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.ok) {
        const data = (await res.json()) as NetlifyCloudResponse;
        if (data.ok && data.record) {
          return applyRemoteRecordToLocal(current, data.record);
        }
      }
    }
  } catch {
    // Continue to optional Supabase fallback if Netlify function endpoint is unreachable locally
  }

  // 2. Optional Supabase Fallback
  const { cloudConfig } = current;
  if (!cloudConfig.supabaseUrl || !cloudConfig.supabaseAnonKey) return null;

  const client = getSupabase(cloudConfig);
  if (!client) return null;

  try {
    const [{ data: walkRows }, { data: pinRows }] = await Promise.all([
      client.from('hope_dealers_walks').select('payload'),
      client.from('hope_dealers_pins').select('payload'),
    ]);

    if (walkRows || pinRows) {
      const mergedWalksMap = new Map<string, WalkSession>();
      current.walks.forEach((w) => mergedWalksMap.set(w.id, w));
      (walkRows || []).forEach((r: { payload: WalkSession }) => {
        if (r?.payload?.id) mergedWalksMap.set(r.payload.id, r.payload);
      });

      const mergedPinsMap = new Map<string, EncounterPin>();
      current.pins.forEach((p) => mergedPinsMap.set(p.id, p));
      (pinRows || []).forEach((r: { payload: EncounterPin }) => {
        if (r?.payload?.id) mergedPinsMap.set(r.payload.id, r.payload);
      });

      const nextState: AppDatabaseState = {
        ...current,
        walks: Array.from(mergedWalksMap.values()).sort((a, b) =>
          b.startTime.localeCompare(a.startTime)
        ),
        pins: Array.from(mergedPinsMap.values()).sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp)
        ),
        cloudConfig: {
          ...current.cloudConfig,
          lastSyncedAt: new Date().toISOString(),
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return nextState;
    }
  } catch {
    // Keep local state if remote fetch fails
  }
  return null;
}

function markAllRecordsSynced() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as AppDatabaseState;
    let changed = false;
    parsed.walks = parsed.walks.map((w) => {
      if (w.syncStatus === 'pending') {
        changed = true;
        return { ...w, syncStatus: 'synced' };
      }
      return w;
    });
    parsed.pins = parsed.pins.map((p) => {
      if (p.syncStatus === 'pending') {
        changed = true;
        return { ...p, syncStatus: 'synced' };
      }
      return p;
    });
    if (changed) {
      parsed.cloudConfig.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // ignore
  }
}

// Session Persistence
export function loadCurrentSession(): UserAccount | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as UserAccount) : null;
  } catch {
    return null;
  }
}

export function saveCurrentSession(user: UserAccount | null): void {
  if (!user) {
    localStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
  }
}

// Active Walk Draft Persistence
export interface ActiveWalkDraft {
  walkId: string;
  isRunning: boolean;
  startedAtIso: string;
  elapsedSeconds: number;
  recorderName: string;
  groupMembers: string[];
  milesWalked: number;
  manualMilesOverride: boolean;
  streetsWalked: string[];
  startPoint?: GpsWaypoint;
  gpsPath: [number, number][];
  interactionLocations: CommunityInteractionPoint[];
  gpsTrackingActive: boolean;
  interactionsCount: number;
  prayersCount: number;
  serviceLinkagesCount: number;
  trashBagsCount: number;
  trashWeightLbs: number;
  manualWeightOverride: boolean;
  notes: string;
}

export function loadActiveWalkDraft(): ActiveWalkDraft | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WALK_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as ActiveWalkDraft) : null;
  } catch {
    return null;
  }
}

export function saveActiveWalkDraft(draft: ActiveWalkDraft | null): void {
  if (!draft) {
    localStorage.removeItem(ACTIVE_WALK_DRAFT_KEY);
  } else {
    localStorage.setItem(ACTIVE_WALK_DRAFT_KEY, JSON.stringify(draft));
  }
}

// Haversine formula to calculate distance in miles between two GPS coordinates
export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Reverse geocode GPS coordinates into a street name via OpenStreetMap Nominatim
export async function reverseGeocodeStreet(
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const road =
      data?.address?.road ||
      data?.address?.pedestrian ||
      data?.address?.neighbourhood ||
      data?.address?.suburb;
    return road ? String(road) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// STREET-TO-COORDINATES RESOLUTION & ANTI-STACKING FOR CHILLICOTHE, OH
// ============================================================================

export const CHILLICOTHE_STREET_COORDS: Record<string, [number, number]> = {
  'e 2nd': [39.3348, -82.9772],
  'w 2nd': [39.3346, -82.9862],
  '2nd': [39.3348, -82.9772],
  'second': [39.3348, -82.9772],
  'e second': [39.3348, -82.9772],
  'w second': [39.3346, -82.9862],
  'mcarthur': [39.3328, -82.9695],
  'macarthur': [39.3328, -82.9695],
  'n mcarthur': [39.3338, -82.9693],
  's mcarthur': [39.3315, -82.9697],
  'e main': [39.3326, -82.9742],
  'w main': [39.3330, -82.9885],
  'main': [39.3326, -82.9742],
  'paint': [39.3331, -82.9824],
  'n paint': [39.3355, -82.9822],
  's paint': [39.3302, -82.9826],
  'n bridge': [39.3365, -82.9717],
  's bridge': [39.3295, -82.9719],
  'bridge': [39.3330, -82.9718],
  'e water': [39.3361, -82.9795],
  'w water': [39.3359, -82.9875],
  'water': [39.3361, -82.9795],
  'eastern': [39.3278, -82.9675],
  'western': [39.3338, -82.9960],
  'n high': [39.3372, -82.9895],
  's high': [39.3292, -82.9892],
  'high': [39.3332, -82.9893],
  'mulberry': [39.3350, -82.9786],
  'n mulberry': [39.3355, -82.9785],
  's mulberry': [39.3318, -82.9788],
  'e 4th': [39.3316, -82.9755],
  'w 4th': [39.3314, -82.9860],
  '4th': [39.3316, -82.9755],
  'fourth': [39.3316, -82.9755],
  'e 5th': [39.3302, -82.9752],
  'w 5th': [39.3300, -82.9860],
  '5th': [39.3302, -82.9752],
  'fifth': [39.3302, -82.9752],
  'e 7th': [39.3268, -82.9652],
  'w 7th': [39.3270, -82.9840],
  '7th': [39.3268, -82.9652],
  'seventh': [39.3268, -82.9652],
  'yoctangee': [39.3385, -82.9815],
  'scioto': [39.3320, -82.9920],
  'watt': [39.3305, -82.9750],
  'n watt': [39.3335, -82.9748],
  's watt': [39.3285, -82.9750],
  'ewing': [39.3315, -82.9788],
  'walnut': [39.3330, -82.9852],
  'n walnut': [39.3350, -82.9850],
  's walnut': [39.3305, -82.9854],
  'hickory': [39.3312, -82.9768],
  'n hickory': [39.3335, -82.9765],
  's hickory': [39.3295, -82.9770],
  'sugar': [39.3325, -82.9722],
  'n sugar': [39.3342, -82.9720],
  's sugar': [39.3305, -82.9724],
  'rose': [39.3342, -82.9682],
  'n rose': [39.3342, -82.9682],
  'brownell': [39.3340, -82.9735],
  'arch': [39.3368, -82.9880],
  'vine': [39.3295, -82.9805],
  'mill': [39.3352, -82.9910],
  'church': [39.3338, -82.9868],
};

export function normalizeStreetKey(raw: string): string {
  if (!raw) return '';
  // Take first street if intersection ("Paint St & E Main St" -> "Paint St")
  const primary = raw.split(/&|\band\b|\/|@/i)[0].trim().toLowerCase();
  const tokens = primary
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const normalized: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (i === 0) {
      if (t === 'east') {
        normalized.push('e');
        continue;
      }
      if (t === 'west') {
        normalized.push('w');
        continue;
      }
      if (t === 'north') {
        normalized.push('n');
        continue;
      }
      if (t === 'south') {
        normalized.push('s');
        continue;
      }
    }
    if (
      [
        'st',
        'street',
        'ave',
        'avenue',
        'rd',
        'road',
        'pkwy',
        'parkway',
        'blvd',
        'boulevard',
        'dr',
        'drive',
        'ln',
        'lane',
        'ct',
        'court',
        'aly',
        'alley',
        'way',
        'pl',
        'place',
      ].includes(t)
    ) {
      continue;
    }
    normalized.push(t);
  }
  return normalized.join(' ');
}

export function applyAntiStackOffset(
  baseCoord: [number, number],
  existingCoords: Array<[number, number]>
): [number, number] {
  let [lat, lng] = baseCoord;
  let attempts = 0;
  while (
    attempts < 12 &&
    existingCoords.some(
      (c) =>
        Math.abs(c[0] - lat) < 0.00018 && Math.abs(c[1] - lng) < 0.00018
    )
  ) {
    attempts++;
    const angle = attempts * 1.15;
    const radius = 0.00024 * Math.ceil(attempts / 2);
    lat = Number((baseCoord[0] + Math.sin(angle) * radius).toFixed(5));
    lng = Number((baseCoord[1] + Math.cos(angle) * radius).toFixed(5));
  }
  return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
}

export function resolveStreetCoordinatesSync(
  streetName: string,
  routePoints: [number, number][] = [],
  waypointStreets: Record<number, string> = {},
  existingCoords: Array<[number, number]> = []
): [number, number] | null {
  const key = normalizeStreetKey(streetName);
  if (!key) return null;
  const keyWithoutDir = key.replace(/^[ewns]\s+/, '');

  // 1. Check if any waypoint along the walk's route was geocoded to this street
  for (const [idxStr, wpStreet] of Object.entries(waypointStreets)) {
    const wpKey = normalizeStreetKey(wpStreet);
    const wpKeyNoDir = wpKey.replace(/^[ewns]\s+/, '');
    if (
      wpKey &&
      (wpKey === key ||
        (keyWithoutDir.length >= 3 && wpKeyNoDir === keyWithoutDir))
    ) {
      const idx = Number(idxStr);
      if (routePoints[idx]) {
        return applyAntiStackOffset(routePoints[idx], existingCoords);
      }
    }
  }

  // 2. Check the Chillicothe street dictionary
  let baseCoord: [number, number] | undefined =
    CHILLICOTHE_STREET_COORDS[key] ||
    CHILLICOTHE_STREET_COORDS[keyWithoutDir];

  if (!baseCoord) {
    // Partial match against known Chillicothe street keys
    for (const [dictKey, coord] of Object.entries(CHILLICOTHE_STREET_COORDS)) {
      if (
        (keyWithoutDir.length >= 3 && dictKey.includes(keyWithoutDir)) ||
        (dictKey.length >= 4 && key.includes(dictKey))
      ) {
        baseCoord = coord;
        break;
      }
    }
  }

  if (baseCoord) {
    // If the walk has route points and one of the route points is close to this street (within ~0.22 miles),
    // snap near that route segment or blend so the pin sits naturally along the walked path on that street
    if (routePoints.length > 0) {
      let closestPt: [number, number] | null = null;
      let minDist = Infinity;
      for (const pt of routePoints) {
        const d = calculateDistanceMiles(baseCoord[0], baseCoord[1], pt[0], pt[1]);
        if (d < minDist) {
          minDist = d;
          closestPt = pt;
        }
      }
      if (closestPt && minDist <= 0.14) {
        return applyAntiStackOffset(closestPt, existingCoords);
      }
    }
    return applyAntiStackOffset(baseCoord, existingCoords);
  }

  return null;
}

// Forward-geocode any street name in Chillicothe, OH using OpenStreetMap Nominatim (with sync fallback)
export async function forwardGeocodeStreetInChillicothe(
  streetName: string,
  routePoints: [number, number][] = [],
  waypointStreets: Record<number, string> = {},
  existingCoords: Array<[number, number]> = []
): Promise<[number, number] | null> {
  // First check fast sync resolver (waypoint match + Chillicothe street dictionary)
  const syncMatch = resolveStreetCoordinatesSync(
    streetName,
    routePoints,
    waypointStreets,
    existingCoords
  );
  if (syncMatch) return syncMatch;

  const clean = (streetName || '').trim();
  if (!clean) return null;

  try {
    const query = `${clean}, Chillicothe, OH`;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        query
      )}&limit=5&viewbox=-83.05,39.38,-82.91,39.28&bounded=1`,
      {
        headers: { Accept: 'application/json' },
      }
    );
    if (res.ok) {
      const results = (await res.json()) as Array<{
        lat?: string;
        lon?: string;
      }>;
      if (Array.isArray(results) && results.length > 0) {
        const candidates: [number, number][] = results
          .map(
            (r) =>
              [Number(r.lat), Number(r.lon)] as [number, number]
          )
          .filter((c) => !Number.isNaN(c[0]) && !Number.isNaN(c[1]));

        if (candidates.length > 0) {
          // Pick candidate closest to the walk's route if routePoints exist
          let best = candidates[0];
          if (routePoints.length > 0) {
            let bestDist = Infinity;
            for (const cand of candidates) {
              for (const rPt of routePoints) {
                const d = calculateDistanceMiles(
                  cand[0],
                  cand[1],
                  rPt[0],
                  rPt[1]
                );
                if (d < bestDist) {
                  bestDist = d;
                  best = cand;
                }
              }
            }
          }
          return applyAntiStackOffset(
            [Number(best[0].toFixed(5)), Number(best[1].toFixed(5))],
            existingCoords
          );
        }
      }
    }
  } catch {
    // ignore network error
  }

  return null;
}

// Automatically unstack existing pins that were stacked at a single location when different streetNames were specified
export function unstackAndResolvePins(
  walks: WalkSession[],
  pins: EncounterPin[]
): EncounterPin[] {
  if (!pins || pins.length === 0) return [];

  const walksById = new Map<string, WalkSession>();
  (walks || []).forEach((w) => walksById.set(w.id, w));

  // Count how many pins share each rounded coordinate
  const coordCounts = new Map<string, number>();
  pins.forEach((p) => {
    const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
    coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
  });

  const placedCoords: Array<[number, number]> = [];

  return pins.map((pin) => {
    const coordKey = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
    const isStacked = (coordCounts.get(coordKey) || 0) > 1;
    const walk = walksById.get(pin.walkId);
    const routePts = walk?.gpsPath || [];

    // Check if pin is sitting on the walk's start point or default center while specifying a known street
    const isAtStartPoint =
      walk?.startPoint &&
      Math.abs(pin.lat - walk.startPoint.lat) < 0.0002 &&
      Math.abs(pin.lng - walk.startPoint.lng) < 0.0002;

    const resolvedForStreet = resolveStreetCoordinatesSync(
      pin.streetName,
      routePts,
      {},
      placedCoords
    );

    if (resolvedForStreet) {
      const distFromResolved = calculateDistanceMiles(
        pin.lat,
        pin.lng,
        resolvedForStreet[0],
        resolvedForStreet[1]
      );
      // If pins were stacked together or placed > 0.08 miles away from the street named on the pin, move to the street!
      if (isStacked || isAtStartPoint || distFromResolved > 0.08) {
        placedCoords.push(resolvedForStreet);
        return {
          ...pin,
          lat: resolvedForStreet[0],
          lng: resolvedForStreet[1],
        };
      }
    }

    if (isStacked) {
      const offsetCoord = applyAntiStackOffset(
        [pin.lat, pin.lng],
        placedCoords
      );
      placedCoords.push(offsetCoord);
      return {
        ...pin,
        lat: offsetCoord[0],
        lng: offsetCoord[1],
      };
    }

    placedCoords.push([pin.lat, pin.lng]);
    return pin;
  });
}
