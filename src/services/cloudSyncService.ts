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
// ROUTE-LOCKED STREET PIN PLACEMENT & SEGMENT MATCHING FOR CHILLICOTHE, OH
// ============================================================================

const SEGMENT_STREET_CACHE_KEY = 'lrs_hope_dealers_seg_streets_v1';

function loadSegmentStreetCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SEGMENT_STREET_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveSegmentStreetToCache(
  midLat: number,
  midLng: number,
  streetName: string
): void {
  try {
    const cache = loadSegmentStreetCache();
    const key = `${midLat.toFixed(4)},${midLng.toFixed(4)}`;
    cache[key] = streetName;
    localStorage.setItem(SEGMENT_STREET_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

export function getCachedSegmentStreet(
  midLat: number,
  midLng: number
): string | undefined {
  const cache = loadSegmentStreetCache();
  return cache[`${midLat.toFixed(4)},${midLng.toFixed(4)}`];
}

// North-to-South rank of Chillicothe East-West streets (smaller = further North)
const EW_STREET_NS_RANK: Record<string, number> = {
  yoctangee: 1,
  water: 2,
  '2nd': 3,
  second: 3,
  main: 4,
  '4th': 5,
  fourth: 5,
  '5th': 6,
  fifth: 6,
  '7th': 7,
  seventh: 7,
  eastern: 8,
};

// West-to-East rank of Chillicothe North-South streets (smaller = further West)
const NS_STREET_WE_RANK: Record<string, number> = {
  western: 1,
  scioto: 1,
  high: 2,
  arch: 2,
  mill: 2,
  walnut: 3,
  church: 3,
  paint: 4,
  vine: 4,
  mulberry: 5,
  hickory: 6,
  ewing: 7,
  bridge: 8,
  sugar: 9,
  watt: 10,
  brownell: 11,
  mcarthur: 12,
  macarthur: 12,
  rose: 13,
};

export const CHILLICOTHE_STREET_COORDS: Record<string, [number, number]> = {
  'e 2nd': [39.3348, -82.9772],
  'w 2nd': [39.3346, -82.9862],
  '2nd': [39.3348, -82.9772],
  second: [39.3348, -82.9772],
  'e second': [39.3348, -82.9772],
  'w second': [39.3346, -82.9862],
  mcarthur: [39.3338, -82.9623],
  macarthur: [39.3338, -82.9623],
  'n mcarthur': [39.3342, -82.9624],
  's mcarthur': [39.3325, -82.9621],
  'e main': [39.3326, -82.9742],
  'w main': [39.333, -82.9885],
  main: [39.3326, -82.9742],
  paint: [39.3331, -82.9824],
  'n paint': [39.3355, -82.9822],
  's paint': [39.3302, -82.9826],
  'n bridge': [39.3365, -82.9717],
  's bridge': [39.3295, -82.9719],
  bridge: [39.333, -82.9718],
  'e water': [39.3361, -82.9795],
  'w water': [39.3359, -82.9875],
  water: [39.3361, -82.9795],
  eastern: [39.3278, -82.9675],
  western: [39.3338, -82.996],
  'n high': [39.3372, -82.9895],
  's high': [39.3292, -82.9892],
  high: [39.3332, -82.9893],
  mulberry: [39.335, -82.9786],
  'e 4th': [39.3316, -82.9755],
  'w 4th': [39.3314, -82.986],
  '4th': [39.3316, -82.9755],
  fourth: [39.3316, -82.9755],
  'e 5th': [39.3302, -82.9752],
  'w 5th': [39.33, -82.986],
  '5th': [39.3302, -82.9752],
  fifth: [39.3302, -82.9752],
  'e 7th': [39.3268, -82.9652],
  '7th': [39.3268, -82.9652],
  seventh: [39.3268, -82.9652],
  yoctangee: [39.3385, -82.9815],
  scioto: [39.332, -82.992],
  watt: [39.3305, -82.966],
  'n watt': [39.3335, -82.966],
  's watt': [39.3285, -82.966],
  ewing: [39.3315, -82.9748],
  walnut: [39.333, -82.9852],
  hickory: [39.3312, -82.9768],
  sugar: [39.3325, -82.969],
  'n sugar': [39.3342, -82.969],
  's sugar': [39.3305, -82.969],
  rose: [39.3342, -82.959],
  brownell: [39.334, -82.9642],
  arch: [39.3368, -82.988],
  vine: [39.3295, -82.9805],
  mill: [39.3352, -82.991],
  church: [39.3338, -82.9868],
};

export function normalizeStreetKey(raw: string): string {
  if (!raw) return '';
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

export function getCoreStreetName(raw: string): string {
  return normalizeStreetKey(raw).replace(/^[ewns]\s+/, '');
}

export interface RouteSegmentInfo {
  index: number;
  start: [number, number];
  end: [number, number];
  mid: [number, number];
  dLat: number;
  dLng: number;
  lengthMiles: number;
  isEastWest: boolean;
  isNorthSouth: boolean;
  cachedStreetKey: string;
  cachedCoreKey: string;
}

export function buildRouteSegments(
  routePoints: [number, number][],
  segmentStreetsOverride: Record<number, string> = {}
): RouteSegmentInfo[] {
  const segments: RouteSegmentInfo[] = [];
  if (!routePoints || routePoints.length < 2) return segments;

  for (let i = 0; i < routePoints.length - 1; i++) {
    const start = routePoints[i];
    const end = routePoints[i + 1];
    const lengthMiles = calculateDistanceMiles(
      start[0],
      start[1],
      end[0],
      end[1]
    );
    if (lengthMiles < 0.001) continue;

    const mid: [number, number] = [
      (start[0] + end[0]) / 2,
      (start[1] + end[1]) / 2,
    ];
    const dLat = Math.abs(end[0] - start[0]);
    const dLng = Math.abs(end[1] - start[1]) * 0.78; // cosine latitude scaling at 39.33°N

    const rawStreet =
      segmentStreetsOverride[i] || getCachedSegmentStreet(mid[0], mid[1]) || '';
    const cachedStreetKey = normalizeStreetKey(rawStreet);
    const cachedCoreKey = getCoreStreetName(rawStreet);

    segments.push({
      index: i,
      start,
      end,
      mid,
      dLat,
      dLng,
      lengthMiles,
      isEastWest: dLng >= dLat * 0.65,
      isNorthSouth: dLat >= dLng * 0.65,
      cachedStreetKey,
      cachedCoreKey,
    });
  }
  return segments;
}

// Match a street name to the exact segment of the walk's route
export function matchStreetToRouteSegment(
  streetName: string,
  segments: RouteSegmentInfo[],
  allWalkStreets: string[] = []
): RouteSegmentInfo | null {
  if (segments.length === 0) return null;
  if (segments.length === 1) return segments[0];

  const key = normalizeStreetKey(streetName);
  const core = getCoreStreetName(streetName);
  if (!core) return segments[0];

  // 1. Direct match against reverse-geocoded segment street name
  const directMatches = segments.filter(
    (s) =>
      s.cachedCoreKey &&
      (s.cachedStreetKey === key ||
        s.cachedCoreKey === core ||
        (core.length >= 3 && s.cachedCoreKey.includes(core)) ||
        (s.cachedCoreKey.length >= 3 && core.includes(s.cachedCoreKey)))
  );
  if (directMatches.length > 0) {
    // Return longest matching segment
    return directMatches.reduce((a, b) =>
      b.lengthMiles > a.lengthMiles ? b : a
    );
  }

  // 2. Match East-West street by North-to-South rank within the route's E-W segments
  const ewRank = EW_STREET_NS_RANK[core];
  if (ewRank !== undefined) {
    const ewSegments = segments.filter((s) => s.isEastWest);
    const pool = ewSegments.length > 0 ? ewSegments : segments;
    // Sort pool from North (highest lat) to South (lowest lat)
    const sortedNorthToSouth = [...pool].sort((a, b) => b.mid[0] - a.mid[0]);

    // Find all unique E-W streets involved in this walk
    const walkEwRanks = Array.from(
      new Set(
        [streetName, ...allWalkStreets]
          .map((st) => EW_STREET_NS_RANK[getCoreStreetName(st)])
          .filter((r): r is number => r !== undefined)
      )
    ).sort((a, b) => a - b);

    const rankIdx = walkEwRanks.indexOf(ewRank);
    if (walkEwRanks.length > 1 && sortedNorthToSouth.length > 1) {
      if (rankIdx === 0) {
        return sortedNorthToSouth[0]; // Northernmost E-W segment
      }
      if (rankIdx === walkEwRanks.length - 1) {
        return sortedNorthToSouth[sortedNorthToSouth.length - 1]; // Southernmost E-W segment
      }
      const mappedIdx = Math.min(
        sortedNorthToSouth.length - 1,
        Math.round(
          (rankIdx / (walkEwRanks.length - 1)) * (sortedNorthToSouth.length - 1)
        )
      );
      return sortedNorthToSouth[mappedIdx];
    }
    return sortedNorthToSouth[0];
  }

  // 3. Match North-South street by West-to-East rank within the route's N-S segments
  const nsRank = NS_STREET_WE_RANK[core];
  if (nsRank !== undefined) {
    const nsSegments = segments.filter((s) => s.isNorthSouth);
    const pool = nsSegments.length > 0 ? nsSegments : segments;

    // Find all unique N-S streets involved in this walk
    const walkNsRanks = Array.from(
      new Set(
        [streetName, ...allWalkStreets]
          .map((st) => NS_STREET_WE_RANK[getCoreStreetName(st)])
          .filter((r): r is number => r !== undefined)
      )
    ).sort((a, b) => a - b);

    // Sort pool from West (lowest lng) to East (highest lng)
    const sortedWestToEast = [...pool].sort((a, b) => a.mid[1] - b.mid[1]);

    if (walkNsRanks.length > 1 && sortedWestToEast.length > 1) {
      const rankIdx = walkNsRanks.indexOf(nsRank);
      if (rankIdx === 0) return sortedWestToEast[0];
      if (rankIdx === walkNsRanks.length - 1) {
        return sortedWestToEast[sortedWestToEast.length - 1];
      }
    }

    // If only 1 N-S street was specified on a closed loop (e.g. McArthur St on the east end of an E 2nd -> McArthur -> Main loop),
    // prefer the non-closing N-S segment (or the easternmost N-S segment for eastern streets like McArthur)
    if (nsRank >= 10 && sortedWestToEast.length > 1) {
      return sortedWestToEast[sortedWestToEast.length - 1];
    }
    const nonClosingPool =
      pool.length > 1 && segments.length >= 3
        ? pool.filter((s) => s.index !== segments.length - 1)
        : pool;
    return nonClosingPool[0] || pool[0];
  }

  // 4. Match by position in allWalkStreets
  const streetIdx = allWalkStreets.findIndex(
    (s) => getCoreStreetName(s) === core
  );
  if (streetIdx >= 0) {
    return segments[streetIdx % segments.length];
  }

  return segments[0];
}

export function interpolatePointOnSegment(
  seg: RouteSegmentInfo,
  pinIndexOnSegment: number,
  totalPinsOnSegment: number
): [number, number] {
  const t = (pinIndexOnSegment + 1) / (totalPinsOnSegment + 1);
  const lat = seg.start[0] + t * (seg.end[0] - seg.start[0]);
  const lng = seg.start[1] + t * (seg.end[1] - seg.start[1]);
  return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
}

// Minimum distance (in miles) from a point [lat, lng] to a route segment
function distancePointToSegmentMiles(
  lat: number,
  lng: number,
  seg: RouteSegmentInfo
): number {
  const A = lat - seg.start[0];
  const B = lng - seg.start[1];
  const C = seg.end[0] - seg.start[0];
  const D = seg.end[1] - seg.start[1];
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? Math.max(0, Math.min(1, dot / lenSq)) : 0;
  const projLat = seg.start[0] + param * C;
  const projLng = seg.start[1] + param * D;
  return calculateDistanceMiles(lat, lng, projLat, projLng);
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
  const core = getCoreStreetName(streetName);

  // PRIORITY 1: If the walk has a plotted route (routePoints.length >= 2), ALWAYS place the pin ON the walk's route segment for that street!
  if (routePoints.length >= 2) {
    const segments = buildRouteSegments(routePoints, waypointStreets);
    if (segments.length > 0) {
      const allStreets = [
        ...Object.values(waypointStreets),
        streetName,
      ].filter(Boolean);
      const matchedSeg = matchStreetToRouteSegment(
        streetName,
        segments,
        allStreets
      );
      if (matchedSeg) {
        // Count how many existing pins are already on this segment
        const existingOnSeg = existingCoords.filter(
          (c) => distancePointToSegmentMiles(c[0], c[1], matchedSeg) < 0.015
        ).length;
        const t =
          existingOnSeg === 0
            ? 0.5
            : existingOnSeg === 1
            ? 0.33
            : existingOnSeg === 2
            ? 0.67
            : (existingOnSeg % 4) * 0.2 + 0.2;
        const lat =
          matchedSeg.start[0] + t * (matchedSeg.end[0] - matchedSeg.start[0]);
        const lng =
          matchedSeg.start[1] + t * (matchedSeg.end[1] - matchedSeg.start[1]);
        return [Number(lat.toFixed(5)), Number(lng.toFixed(5))];
      }
    }
  }

  // PRIORITY 2: Standalone pin without a route — check Chillicothe dictionary
  const baseCoord =
    CHILLICOTHE_STREET_COORDS[key] || CHILLICOTHE_STREET_COORDS[core];
  if (baseCoord) {
    return applyAntiStackOffset(baseCoord, existingCoords);
  }

  return null;
}

export async function forwardGeocodeStreetInChillicothe(
  streetName: string,
  routePoints: [number, number][] = [],
  waypointStreets: Record<number, string> = {},
  existingCoords: Array<[number, number]> = []
): Promise<[number, number] | null> {
  // If we have a walk route, reverse-geocode any un-cached route segment midpoints first so segment street matching is 100% exact!
  if (routePoints.length >= 2) {
    const segments = buildRouteSegments(routePoints, waypointStreets);
    for (const seg of segments) {
      if (!seg.cachedCoreKey) {
        const road = await reverseGeocodeStreet(seg.mid[0], seg.mid[1]);
        if (road) {
          saveSegmentStreetToCache(seg.mid[0], seg.mid[1], road);
          waypointStreets[seg.index] = road;
        }
      }
    }
    const routeMatch = resolveStreetCoordinatesSync(
      streetName,
      routePoints,
      waypointStreets,
      existingCoords
    );
    if (routeMatch) return routeMatch;
  }

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
        const first = results[0];
        if (first.lat && first.lon) {
          return applyAntiStackOffset(
            [
              Number(Number(first.lat).toFixed(5)),
              Number(Number(first.lon).toFixed(5)),
            ],
            existingCoords
          );
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

// Tie every walk pin directly to its indicated street segment ON the walk's route
export function unstackAndResolvePins(
  walks: WalkSession[],
  pins: EncounterPin[]
): EncounterPin[] {
  if (!pins || pins.length === 0) return [];

  const walksById = new Map<string, WalkSession>();
  (walks || []).forEach((w) => walksById.set(w.id, w));

  // Helper to find the walk a pin belongs to (by walkId, or by matching date + street if standalone)
  const findWalkForPin = (pin: EncounterPin): WalkSession | undefined => {
    const direct = walksById.get(pin.walkId);
    if (direct && direct.gpsPath && direct.gpsPath.length >= 2) return direct;

    const pinDate = (pin.timestamp || '').slice(0, 10);
    const pinCore = getCoreStreetName(pin.streetName);
    // Match walk on same date
    const sameDateWalk = (walks || []).find(
      (w) => w.date === pinDate && w.gpsPath && w.gpsPath.length >= 2
    );
    if (sameDateWalk) return sameDateWalk;

    // Or match walk that walked this street
    if (pinCore) {
      return (walks || []).find(
        (w) =>
          w.gpsPath &&
          w.gpsPath.length >= 2 &&
          w.streetsWalked.some((s) => getCoreStreetName(s) === pinCore)
      );
    }
    return undefined;
  };

  // Group pins by walk so we can place each pin on its matched street segment along that walk's route
  const pinToWalkMap = new Map<string, WalkSession>();
  const pinsByWalkId = new Map<string, EncounterPin[]>();

  for (const pin of pins) {
    const walk = findWalkForPin(pin);
    if (walk) {
      pinToWalkMap.set(pin.id, walk);
      const list = pinsByWalkId.get(walk.id) || [];
      list.push(pin);
      pinsByWalkId.set(walk.id, list);
    }
  }

  const updatedPinCoords = new Map<string, [number, number]>();

  for (const [walkId, walkPins] of pinsByWalkId.entries()) {
    const walk = walksById.get(walkId);
    if (!walk || !walk.gpsPath || walk.gpsPath.length < 2) continue;

    const segments = buildRouteSegments(walk.gpsPath);
    if (segments.length === 0) continue;

    const allWalkStreets = [
      ...(walk.streetsWalked || []),
      ...walkPins.map((p) => p.streetName),
    ].filter(Boolean);

    // Assign each pin on this walk to its matching segment on walk.gpsPath
    const pinsBySegmentIdx = new Map<number, EncounterPin[]>();
    for (const pin of walkPins) {
      const matchedSeg =
        matchStreetToRouteSegment(pin.streetName, segments, allWalkStreets) ||
        segments[0];
      const segList = pinsBySegmentIdx.get(matchedSeg.index) || [];
      segList.push(pin);
      pinsBySegmentIdx.set(matchedSeg.index, segList);
    }

    // Interpolate each pin cleanly along its matched route segment
    for (const [segIdx, segPins] of pinsBySegmentIdx.entries()) {
      const seg = segments.find((s) => s.index === segIdx) || segments[0];
      segPins.forEach((pin, idxOnSeg) => {
        const pt = interpolatePointOnSegment(seg, idxOnSeg, segPins.length);
        updatedPinCoords.set(pin.id, pt);
      });
    }
  }

  return pins.map((pin) => {
    const newCoord = updatedPinCoords.get(pin.id);
    if (newCoord) {
      return {
        ...pin,
        lat: newCoord[0],
        lng: newCoord[1],
      };
    }
    return pin;
  });
}

// Async refinement: reverse-geocode any uncached route segment midpoints and snap pins to their exact street segments
export async function refineWalkPinsWithRouteGeocoding(
  state: AppDatabaseState
): Promise<AppDatabaseState | null> {
  let newlyGeocodedCount = 0;

  for (const walk of state.walks || []) {
    if (!walk.gpsPath || walk.gpsPath.length < 2) continue;
    const segments = buildRouteSegments(walk.gpsPath);
    for (const seg of segments) {
      if (!seg.cachedCoreKey) {
        const road = await reverseGeocodeStreet(seg.mid[0], seg.mid[1]);
        if (road) {
          saveSegmentStreetToCache(seg.mid[0], seg.mid[1], road);
          newlyGeocodedCount++;
        }
      }
    }
  }

  const snappedPins = unstackAndResolvePins(state.walks, state.pins);
  const pinsChanged = snappedPins.some(
    (p, idx) =>
      p.lat !== state.pins[idx]?.lat || p.lng !== state.pins[idx]?.lng
  );

  if (newlyGeocodedCount > 0 || pinsChanged) {
    return saveDatabase({
      ...state,
      pins: snappedPins,
    });
  }
  return null;
}
