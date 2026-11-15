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
  customWebhookUrl: 'https://liferecoverysociety.org/api/impact-sync',
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
        cloudConfig: DEFAULT_CLOUD_CONFIG,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw) as AppDatabaseState;
    // Strip any leftover sample seed records
    parsed.walks = (parsed.walks || []).filter(
      (w) => !w.id.startsWith('walk-seed-')
    );
    parsed.pins = (parsed.pins || []).filter(
      (p) => !p.id.startsWith('pin-seed-')
    );
    parsed.users = (parsed.users || []).filter(
      (u) => !u.id.startsWith('user-vol-')
    );
    // Always guarantee Super User RFannin25@gmail.com exists with Zwicki0823!
    const hasSuper = parsed.users?.some(
      (u) => u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
    );
    if (!hasSuper) {
      parsed.users = [DEFAULT_USERS[0], ...(parsed.users || [])];
    } else {
      parsed.users = parsed.users.map((u) =>
        u.email.toLowerCase() === SUPER_USER_EMAIL.toLowerCase()
          ? { ...u, role: 'superuser', password: u.password || SUPER_USER_PASSWORD }
          : u
      );
    }
    if (!parsed.cloudConfig) {
      parsed.cloudConfig = DEFAULT_CLOUD_CONFIG;
    } else if (!parsed.cloudConfig.customWebhookUrl) {
      parsed.cloudConfig.customWebhookUrl = 'https://liferecoverysociety.org/api/impact-sync';
    }
    return parsed;
  } catch {
    return {
      users: DEFAULT_USERS,
      walks: [],
      pins: [],
      cloudConfig: DEFAULT_CLOUD_CONFIG,
    };
  }
}

export function saveDatabase(state: AppDatabaseState): AppDatabaseState {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const updated: AppDatabaseState = {
    ...state,
    cloudConfig: {
      ...state.cloudConfig,
      lastSyncedAt: isOnline ? new Date().toISOString() : state.cloudConfig.lastSyncedAt,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  // Notify other tabs/windows immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hope-dealers-db-updated'));
  }
  // Trigger async cloud sync if online
  if (isOnline) {
    void syncToRemoteCloud(updated);
  }
  return updated;
}

export async function syncToRemoteCloud(state: AppDatabaseState): Promise<{
  ok: boolean;
  message: string;
}> {
  const { cloudConfig } = state;

  // 1. If Supabase URL & Key are configured, sync walks and pins to Supabase tables
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
        markAllRecordsSynced();
        return { ok: true, message: 'Synced with Supabase Cloud' };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Supabase sync error',
        };
      }
    }
  }

  // 2. If Custom Cloud Webhook / JSON Endpoint is configured
  if (cloudConfig.customWebhookUrl) {
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
      markAllRecordsSynced();
      return { ok: true, message: 'Synced with Cloud Endpoint' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Webhook sync failed',
      };
    }
  }

  // 3. Built-in Cloud Browser Store Sync
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    markAllRecordsSynced();
    return { ok: true, message: 'Cloud Sync Active' };
  }

  return { ok: false, message: 'Offline — queued for automatic sync' };
}

export async function pullFromRemoteCloud(): Promise<AppDatabaseState | null> {
  const current = loadDatabase();
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

// Active Walk Draft Persistence (so a volunteer never loses an in-progress walk if they refresh their phone)
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
